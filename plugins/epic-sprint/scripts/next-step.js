#!/usr/bin/env node
'use strict';
/**
 * Deterministic "what's next" resolver for the /sprint command.
 *
 * The ticket-cycle portion (code -> review) is driven by
 * <project>/.claude/handoffs/current/status.json, NOT by walking handoff
 * files in priority order. Handoff files are an append-only event log —
 * every redo (a rejection, then a fix) leaves the old file behind, so
 * "which file is highest priority" breaks the moment a ticket gets rejected
 * and redone. status.json's per-ticket fields don't have that problem —
 * each agent overwrites its own field in place. Handoff files are still
 * read, but only for payload detail once status.json has already said which
 * phase is next.
 *
 * merge-confirm decisions read status.json's ticket.merged field before
 * re-suggesting a merge — ticket.status: 'done' alone means the Ticket DoD
 * is met (Reviewer's gate), NOT that the PR was merged, and it never flips
 * back, so it can't be the "already merged" signal. The /sprint skill sets
 * ticket.merged: 'done' right after it runs the merge command(s) the human
 * confirmed. Once every ticket is both status: 'done' and merged: 'done',
 * this script recommends the Documenter (sprint close).
 *
 * This script does NOT launch agents, write handoffs, or touch git — it
 * only reads state and prints one JSON decision to stdout. The /sprint
 * skill runs it and performs whatever it says.
 *
 * Usage: node next-step.js
 * Exit codes: 0 = a decision was printed to stdout · 1 = error reading state.
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

/** Routes a single ticket from its current status.json fields. null = nothing
 *  ticket-specific to do right now (either blocked on Architect, or fully
 *  green and waiting on merge-confirm below). */
function ticketDecision(id, t) {
  if (t.design !== 'done') return null; // Architect hasn't finished this ticket yet

  if (t.code !== 'done') {
    return { action: 'run-agent', agent: 'coder', reason: `${id}: code is "${t.code}"` };
  }

  if (t.codeReview === 'rejected') {
    // Defensive only — coder.md resets code to "pending" on every redo, so
    // this branch shouldn't be reachable with code === 'done'.
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
    if (t.status !== 'done') break; // this is the one in-flight ticket — don't look past it
  }
}

// --- Merge confirmation (Reviewer already approved this ticket's PR) -------------
function alreadyMerged(payload) {
  const ticketId = payload && payload.ticket;
  return Boolean(ticketId && status && status.tickets[ticketId] && status.tickets[ticketId].merged === 'done');
}

const reviewerToHuman = readJSON('reviewer-to-human.json');
if (reviewerToHuman && reviewerToHuman.status === 'approved' && !alreadyMerged(reviewerToHuman.payload)) {
  print({ action: 'merge-confirm', payload: reviewerToHuman.payload, reason: 'reviewer-to-human.json approved' });
}

// --- All tickets done AND merged -> close the sprint (Documenter) ----------------
const humanToDocumenter = readJSON('human-to-documenter.json');
if (status && !humanToDocumenter && !readJSON('documenter-to-human.json')) {
  const tickets = Object.values(status.tickets);
  const allDone = tickets.length > 0 && tickets.every((t) => t.status === 'done' && t.merged === 'done');
  if (allDone) {
    print({ action: 'write-handoff-and-run', write: 'human-to-documenter.json', agent: 'documenter', reason: 'all tickets done and merged — close the sprint' });
  }
}

// --- Route into Architect ---------------------------------------------------------
const plannerToArchitect = readJSON('planner-to-architect.json');
if (plannerToArchitect && plannerToArchitect.status === 'approved') {
  print({ action: 'run-agent', agent: 'architect', reason: 'planner-to-architect.json approved' });
}

// --- Anything still pending/in_progress? ------------------------------------------
const files = fs.readdirSync(currentDir).filter((f) => f.endsWith('.json') && f !== 'status.json');
for (const f of files) {
  const h = readJSON(f);
  if (h && (h.status === 'pending' || h.status === 'in_progress')) {
    print({ action: 'stop', reason: `${f} is ${h.status} — agent still working` });
  }
}

// --- Nothing at all -> start the sprint -------------------------------------------
if (files.length === 0) {
  print({ action: 'run-agent', agent: 'planner', reason: 'no handoff in current/' });
}

print({ action: 'stop', reason: 'no matching rule — inspect current/ manually' });
