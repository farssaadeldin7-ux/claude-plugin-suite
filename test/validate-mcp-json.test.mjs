#!/usr/bin/env node
/**
 * Regression test: a plugin missing .mcp.json used to pass validate.mjs
 * silently. .mcp.json is what actually registers a plugin's MCP server —
 * without it the plugin installs with zero tools, and nothing else in
 * validate.mjs would ever notice.
 *
 * scripts/validate.mjs always resolves its own root from its file location,
 * with no override, so this drops a throwaway broken plugin directly into
 * the real plugins/ tree for the duration of the check and removes it
 * again in a finally block — the same thing you'd do by hand to reproduce
 * this, just automated and guaranteed to clean up after itself.
 *
 *   node test/validate-mcp-json.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const fixtureId = '_test-missing-mcp-json';
const fixtureDir = path.join(root, 'plugins', fixtureId);

const runValidate = () => {
  try {
    const stdout = execFileSync(process.execPath, [path.join(root, 'scripts', 'validate.mjs')], {
      cwd: root, encoding: 'utf8',
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout, stderr: err.stderr };
  }
};

try {
  fs.mkdirSync(path.join(fixtureDir, '.claude-plugin'), { recursive: true });
  // Borrow a real plugin.json shape so this fails on the .mcp.json check
  // specifically, not on unrelated missing fields.
  const template = JSON.parse(fs.readFileSync(path.join(root, 'plugins/basecamp-split/.claude-plugin/plugin.json'), 'utf8'));
  fs.writeFileSync(
    path.join(fixtureDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ ...template, name: fixtureId }, null, 2)
  );
  // Deliberately no .mcp.json.

  const result = runValidate();
  assert.notEqual(result.code, 0, 'a plugin with no .mcp.json passed validation');
  assert.match(result.stdout + (result.stderr ?? ''), new RegExp(`plugins/${fixtureId}: \\.mcp\\.json is missing`));
  ok('a plugin missing .mcp.json fails validation instead of shipping with zero tools unnoticed');

  console.log(`\n${passed} validate.mjs .mcp.json checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
