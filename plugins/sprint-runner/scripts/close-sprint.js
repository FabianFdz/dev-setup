#!/usr/bin/env node
'use strict';
/**
 * Deterministic sprint-close checker + archiver.
 *
 * Usage:
 *   node close-sprint.js check     Evaluate the sprint DoD. Prints N on
 *                                  success (exit 0) or missing conditions on
 *                                  stderr (exit 1).
 *   node close-sprint.js archive   Re-checks the DoD, then archives. Exit 1
 *                                  and no changes if the DoD is not met.
 *
 * Sprint DoD:
 *   plan               === 'done'
 *   every ticket.status === 'done' and ticket.merged === 'done'
 *   docsUpdated         === 'done'
 */
const fs = require('node:fs');
const path = require('node:path');
const { validate } = require('./lib/mini-ajv');
const { projectPaths, statusSchemaPath } = require('./lib/paths');

const { handoffsDir, currentDir, statusPath } = projectPaths();

function loadStatus() {
  if (!fs.existsSync(statusPath)) {
    console.error(`✖ status.json not found at ${statusPath}`);
    process.exit(1);
  }
  let status;
  try {
    status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch (e) {
    console.error(`✖ status.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  const schema = JSON.parse(fs.readFileSync(statusSchemaPath, 'utf8'));
  const errors = validate(status, schema);
  if (errors.length) {
    console.error('✖ status.json fails schema validation:');
    for (const e of errors) console.error(`    - ${e}`);
    process.exit(1);
  }
  return status;
}

function sprintDoDIssues(status) {
  const issues = [];
  if (status.plan !== 'done') issues.push(`plan is "${status.plan}", expected "done"`);
  for (const [id, t] of Object.entries(status.tickets)) {
    if (t.status !== 'done') issues.push(`ticket ${id}.status is "${t.status}", expected "done"`);
    if (t.merged !== 'done') issues.push(`ticket ${id}.merged is "${t.merged}", expected "done"`);
  }
  if (status.docsUpdated !== 'done') issues.push(`docsUpdated is "${status.docsUpdated}", expected "done"`);
  return issues;
}

function nextSprintNumber() {
  if (!fs.existsSync(handoffsDir)) return 0;
  const numbers = fs
    .readdirSync(handoffsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^sprint-\d+$/.test(d.name))
    .map((d) => Number(d.name.slice('sprint-'.length)));
  return numbers.length === 0 ? 0 : Math.max(...numbers) + 1;
}

const mode = process.argv[2];

if (mode === 'check') {
  const status = loadStatus();
  const issues = sprintDoDIssues(status);
  if (issues.length) {
    console.error('✖ Sprint DoD NOT met:');
    for (const i of issues) console.error(`    - ${i}`);
    process.exit(1);
  }
  console.log(String(nextSprintNumber()));
  process.exit(0);
} else if (mode === 'archive') {
  const status = loadStatus();
  const issues = sprintDoDIssues(status);
  if (issues.length) {
    console.error('✖ Cannot archive — Sprint DoD NOT met:');
    for (const i of issues) console.error(`    - ${i}`);
    process.exit(1);
  }

  const n = nextSprintNumber();
  const archiveDir = path.join(handoffsDir, `sprint-${n}`);
  if (fs.existsSync(archiveDir)) {
    console.error(`✖ ${archiveDir} already exists — refusing to overwrite`);
    process.exit(1);
  }

  status.sprintStatus = 'done';
  status.updatedAt = new Date().toISOString();
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');

  fs.renameSync(currentDir, archiveDir);
  fs.mkdirSync(currentDir, { recursive: true });
  fs.writeFileSync(path.join(currentDir, '.gitkeep'), '');

  console.log(`✓ Sprint ${n} archived to ${archiveDir}. Fresh current/ created.`);
  process.exit(0);
} else {
  console.error('Usage: node close-sprint.js check|archive');
  process.exit(1);
}
