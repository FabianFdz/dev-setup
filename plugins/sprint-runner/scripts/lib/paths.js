'use strict';
const path = require('node:path');

// This file lives at <plugin-root>/scripts/lib/paths.js.
const pluginRoot = path.resolve(__dirname, '..', '..');

const schemasDir = path.join(pluginRoot, 'schemas');
const handoffSchemaPath = path.join(schemasDir, 'handoff.schema.json');
const statusSchemaPath = path.join(schemasDir, 'status.schema.json');

// Project-relative paths resolve against the current working directory,
// since these scripts always run from the target project's root (via a
// skill's bash block or the PostToolUse hook's reported cwd).
function projectPaths(root = process.cwd()) {
  const handoffsDir = path.join(root, '.claude', 'handoffs');
  const currentDir = path.join(handoffsDir, 'current');
  return {
    root,
    handoffsDir,
    currentDir,
    statusPath: path.join(currentDir, 'status.json'),
  };
}

module.exports = { pluginRoot, schemasDir, handoffSchemaPath, statusSchemaPath, projectPaths };
