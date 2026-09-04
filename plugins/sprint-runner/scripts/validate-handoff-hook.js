#!/usr/bin/env node
'use strict';
/**
 * PostToolUse hook — enforces handoff validation after an agent writes its
 * output. Wired via hooks/hooks.json (fires on Write/Edit/MultiEdit in any
 * project this plugin is enabled in).
 *
 * Acts ONLY on files under <project>/.claude/handoffs/current/*.json — a
 * no-op (exit 0) for everything else. On failure it exits 2 and writes
 * feedback to stderr, which Claude Code surfaces back to the agent so it
 * self-corrects before the next agent runs.
 *
 * Note: PostToolUse runs AFTER the write, so it cannot prevent the file from
 * being created — it validates and forces correction.
 */
const path = require('node:path');
const { validateFile } = require('./validate-handoff');

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let filePath = '';
  let cwd = '';
  try {
    const payload = JSON.parse(input);
    filePath = (payload.tool_input && payload.tool_input.file_path) || '';
    cwd = payload.cwd || '';
  } catch {
    process.exit(0); // malformed hook payload — stay inert rather than block the agent
  }

  if (cwd) {
    try {
      process.chdir(cwd);
    } catch {
      /* ignore */
    }
  }

  const isHandoffFile = /[/\\]\.claude[/\\]handoffs[/\\]current[/\\][^/\\]+\.json$/.test(filePath);
  if (!isHandoffFile) process.exit(0);

  const errors = validateFile(path.resolve(filePath));
  if (errors.length === 0) process.exit(0);

  console.error(`Handoff validation FAILED for ${filePath}.`);
  for (const e of errors) console.error(`    - ${e}`);
  console.error('It must conform to the sprint-runner handoff/status schema before the next agent runs. Fix the file and re-emit it.');
  process.exit(2);
});
