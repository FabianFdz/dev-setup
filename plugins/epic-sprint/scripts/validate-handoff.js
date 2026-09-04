#!/usr/bin/env node
'use strict';
/**
 * Deterministic validator for the handoff protocol.
 *
 * Usage:
 *   node validate-handoff.js <path/to/file.json>   validate one file
 *   node validate-handoff.js                        validate all in <cwd>/.claude/handoffs/current/
 *
 * Exit codes: 0 = all valid · 1 = one or more failed.
 *
 * Routes by filename inside handoffs/current/:
 *   - `status.json`          -> schemas/status.schema.json
 *   - `{from}-to-{to}.json`  -> schemas/handoff.schema.json + semantic checks
 *                                (valid transition, filename matches from/to)
 */
const fs = require('node:fs');
const path = require('node:path');
const { validate } = require('./lib/mini-ajv');
const { isValidTransition } = require('./lib/handoff');
const { handoffSchemaPath, statusSchemaPath, projectPaths } = require('./lib/paths');

const handoffSchema = JSON.parse(fs.readFileSync(handoffSchemaPath, 'utf8'));
const statusSchema = JSON.parse(fs.readFileSync(statusSchemaPath, 'utf8'));

function validateFile(filePath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [`invalid JSON: ${e.message}`];
  }

  if (path.basename(filePath) === 'status.json') {
    return validate(data, statusSchema);
  }

  const errors = validate(data, handoffSchema);
  if (typeof data.from === 'string' && typeof data.to === 'string') {
    if (!isValidTransition(data.from, data.to)) {
      errors.push(`invalid transition: ${data.from} -> ${data.to}`);
    }
    const expected = `${data.from}-to-${data.to}.json`;
    if (path.basename(filePath) !== expected) {
      errors.push(`filename "${path.basename(filePath)}" must be "${expected}"`);
    }
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  let files;
  if (args.length > 0) {
    files = args.map((a) => path.resolve(a));
  } else {
    const { currentDir } = projectPaths();
    if (!fs.existsSync(currentDir)) {
      console.error(`No handoffs directory at ${currentDir}`);
      process.exit(1);
    }
    files = fs
      .readdirSync(currentDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(currentDir, f));
  }

  let failed = 0;
  for (const f of files) {
    const errs = validateFile(f);
    if (errs.length) {
      failed++;
      console.error(`✖ ${f}`);
      for (const e of errs) console.error(`    - ${e}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} file(s) failed validation.`);
    process.exit(1);
  }
  console.log(`✓ ${files.length} file(s) valid.`);
}

if (require.main === module) main();

module.exports = { validateFile };
