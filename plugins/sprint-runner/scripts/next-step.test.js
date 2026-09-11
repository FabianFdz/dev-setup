'use strict';
/**
 * Regression tests for next-step.js's ticket-routing loop.
 *
 * Run with: node --test plugins/sprint-runner/scripts/next-step.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const NEXT_STEP = path.join(__dirname, 'next-step.js');

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'next-step-test-'));
  const currentDir = path.join(root, '.claude', 'handoffs', 'current');
  fs.mkdirSync(currentDir, { recursive: true });
  return { root, currentDir };
}

function writeJSON(dir, name, data) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}

function runNextStep(root) {
  const out = execFileSync('node', [NEXT_STEP], { cwd: root, encoding: 'utf8' });
  return JSON.parse(out);
}

const now = new Date().toISOString();

function baseStatus(tickets) {
  return {
    sprint: 1,
    plan: 'done',
    designPr: '10',
    designMerged: 'done',
    tickets,
    docsUpdated: 'pending',
    sprintStatus: 'in_progress',
    updatedAt: now,
  };
}

test('surfaces merge-confirm for a done-but-unmerged ticket instead of routing the next ticket to a coder', () => {
  const { root, currentDir } = makeProject();

  writeJSON(currentDir, 'status.json', baseStatus({
    'E1-T01': { design: 'done', code: 'done', codeReview: 'approved', status: 'done', merged: 'pending' },
    'E1-T02': { design: 'done', code: 'pending', codeReview: 'pending', status: 'pending', merged: 'pending' },
  }));
  writeJSON(currentDir, 'reviewer-to-human.json', {
    sprint: 1,
    from: 'reviewer',
    to: 'human',
    status: 'approved',
    timestamp: now,
    payload: { ticket: 'E1-T01', pr: '42' },
  });

  const decision = runNextStep(root);

  assert.equal(decision.action, 'merge-confirm');
  assert.equal(decision.payload.ticket, 'E1-T01');
});

test('still routes an in-flight ticket to a coder when no prior ticket is awaiting merge', () => {
  const { root, currentDir } = makeProject();

  writeJSON(currentDir, 'status.json', baseStatus({
    'E1-T01': { design: 'done', code: 'done', codeReview: 'approved', status: 'done', merged: 'done' },
    'E1-T02': { design: 'done', code: 'pending', codeReview: 'pending', status: 'pending', merged: 'pending' },
  }));

  const decision = runNextStep(root);

  assert.equal(decision.action, 'run-agent');
  assert.equal(decision.agent, 'coder');
  assert.match(decision.reason, /E1-T02/);
});
