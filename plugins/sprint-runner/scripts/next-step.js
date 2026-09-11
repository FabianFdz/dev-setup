#!/usr/bin/env node
'use strict';
/**
 * Deterministic "what's next" resolver for the /sprint command.
 *
 * Ticket routing (design -> code -> review -> merge) is driven by
 * status.json, not by handoff files in priority order — handoff files are
 * an append-only log, so "highest priority file" breaks the moment a
 * ticket is rejected and redone. status.json's per-ticket fields don't
 * have that problem: each agent overwrites its own field in place.
 *
 * ticket.status: 'done' means the Reviewer approved it — NOT that the PR
 * merged. ticket.merged: 'done' is set by /sprint right after the human
 * confirms the merge. Once every ticket is done and merged, this
 * recommends the Documenter (sprint close).
 *
 * Read-only: prints one JSON decision to stdout. Doesn't launch agents,
 * write handoffs, or touch git — /sprint does whatever the decision says.
 *
 * Usage: node next-step.js
 * Exit codes: 0 = decision printed · 1 = error reading state.
 */
const fs = require('node:fs');
const path = require('node:path');
const { validate } = require('./lib/mini-ajv');
const { projectPaths, statusSchemaPath } = require('./lib/paths');

const { currentDir, statusPath } = projectPaths();

function readJSON(name) {
  const p = path.join(currentDir, name);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function print(decision) {
  console.log(JSON.stringify(decision, null, 2));
  process.exit(0);
}

if (!fs.existsSync(currentDir)) {
  console.error(`No current/ directory at ${currentDir}. Run /sprint again — it bootstraps this on first use.`);
  process.exit(1);
}

// --- Load & validate status.json (absent only at the very start of a sprint) -----
let status = null;
if (fs.existsSync(statusPath)) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch (e) {
    console.error(`status.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  const schema = JSON.parse(fs.readFileSync(statusSchemaPath, 'utf8'));
  const errors = validate(raw, schema);
  if (errors.length) {
    console.error('status.json fails schema validation:');
    for (const e of errors) console.error(`    - ${e}`);
    process.exit(1);
  }
  status = raw;
}

// --- Open question from an agent -> ask the human directly, right now ------------
// Takes priority over everything else. Once answered, this stops firing and
// falls through to normal routing, which re-selects the blocked agent.
const questionsPath = path.join(currentDir, 'questions.md');
if (fs.existsSync(questionsPath)) {
  const questionsContent = fs.readFileSync(questionsPath, 'utf8');
  const answer = questionsContent.match(/^##\s*Answer\s*\n([\s\S]*)$/im)?.[1]?.trim();
  if (!answer) {
    print({
      action: 'ask-question',
      payload: { questionsPath: '.claude/handoffs/current/questions.md', question: questionsContent },
      reason: 'an agent is blocked and needs a human answer before the loop can continue',
    });
  }
}

/** Routes a single ticket from its status.json fields. null = nothing
 *  ticket-specific to do (blocked on Architect, or green and waiting on
 *  merge-confirm below). */
function ticketDecision(id, t) {
  if (t.design !== 'done') return null; // Architect hasn't finished this ticket yet

  if (t.code !== 'done') {
    return { action: 'run-agent', agent: 'coder', reason: `${id}: code is "${t.code}"` };
  }

  if (t.codeReview === 'rejected') {
    // Defensive only: coder.md resets code to "pending" on every redo.
    return { action: 'run-agent', agent: 'coder', reason: `${id}: rejected but code is still marked done — needs a fix` };
  }

  if (t.codeReview === 'pending') {
    if (!readJSON('coder-to-reviewer.json')) {
      return { action: 'stop', reason: `${id}: review pending but coder-to-reviewer.json is missing — inspect manually` };
    }
    return { action: 'run-agent', agent: 'reviewer', reason: `${id}: code done, awaiting review` };
  }

  return null; // codeReview === 'approved' — everything green, merge-confirm handles the rest
}

// --- Design PR gate (sprint-level, checked before any per-ticket routing) --------
if (status && status.designMerged === 'pending') {
  print({
    action: 'merge-confirm',
    payload: {
      phase: 'design',
      pr: status.designPr,
      mergeCommand: `gh pr merge --squash ${status.designPr}`,
      next: 'Coder, per the routing handoff Architect already wrote',
    },
    reason: 'design PR open — must merge before any per-ticket work continues',
  });
}

if (status) {
  for (const [id, t] of Object.entries(status.tickets)) {
    const decision = ticketDecision(id, t);
    if (decision) print(decision);
    // Stop at the first ticket that isn't done AND merged: still in-flight,
    // or done but awaiting merge-confirm below.
    if (t.status !== 'done' || t.merged !== 'done') break;
  }
}

// --- Merge confirmation (Reviewer already approved this ticket's PR) -------------
const reviewerToHuman = readJSON('reviewer-to-human.json');
if (reviewerToHuman?.status === 'approved') {
  const ticketId = reviewerToHuman.payload?.ticket;
  const alreadyMerged = status?.tickets[ticketId]?.merged === 'done';
  if (!alreadyMerged) {
    print({ action: 'merge-confirm', payload: reviewerToHuman.payload, reason: 'reviewer-to-human.json approved' });
  }
}

// --- All tickets done AND merged -> close the sprint (Documenter) ----------------
const humanToDocumenter = readJSON('human-to-documenter.json');
const documenterToHuman = readJSON('documenter-to-human.json');
if (status && humanToDocumenter && !documenterToHuman) {
  // Write already happened but the Documenter hasn't finished — re-run it.
  print({ action: 'run-agent', agent: 'documenter', reason: 'human-to-documenter.json pending — documenter still needs to finish' });
}
if (status && !humanToDocumenter && !documenterToHuman) {
  const tickets = Object.values(status.tickets);
  const allDone = tickets.length > 0 && tickets.every((t) => t.status === 'done' && t.merged === 'done');
  if (allDone) {
    print({ action: 'write-handoff-and-run', write: 'human-to-documenter.json', agent: 'documenter', reason: 'all tickets done and merged — close the sprint' });
  }
}

// --- Route into Architect ---------------------------------------------------------
const plannerToArchitect = readJSON('planner-to-architect.json');
if (plannerToArchitect?.status === 'approved') {
  print({ action: 'run-agent', agent: 'architect', reason: 'planner-to-architect.json approved' });
}

// --- Anything still pending/in_progress? ------------------------------------------
// No agent should leave a handoff at "pending"/"in_progress" at rest — every
// agent writes its outbound handoff with a terminal status once it's done.
// So this is a bookkeeping bug in whichever agent wrote it (see CONTRACT.md),
// not a live agent still working.
const files = fs.readdirSync(currentDir).filter((f) => f.endsWith('.json') && f !== 'status.json');
for (const f of files) {
  const h = readJSON(f);
  if (h && (h.status === 'pending' || h.status === 'in_progress')) {
    print({ action: 'stop', reason: `${f} has status "${h.status}", which no agent should leave at rest — likely a bookkeeping bug, not a live agent still working. See CONTRACT.md.` });
  }
}

// --- Nothing at all -> start the sprint -------------------------------------------
if (files.length === 0) {
  print({ action: 'run-agent', agent: 'planner', reason: 'no handoff in current/' });
}

print({ action: 'stop', reason: 'no matching rule — inspect current/ manually' });
