#!/usr/bin/env node
/**
 * Regression tests for scripts/build.mjs's archive contents.
 *
 *   node test/build.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  execFileSync('node', ['scripts/build.mjs', 'trail-split'], { cwd: root, stdio: 'pipe' });
  const version = JSON.parse(fs.readFileSync(path.join(root, 'plugins/trail-split/.claude-plugin/plugin.json'), 'utf8')).version;
  const archivePath = path.join(root, 'dist', `trail-split-${version}.plugin`);
  const listing = execFileSync('unzip', ['-l', archivePath], { encoding: 'utf8' });

  // ---- the repository LICENSE ships in every archive -----------------------
  // Regression test: no archive contained the repository LICENSE, while
  // every plugin README links to it — a customer who installed a .plugin
  // had a README citing terms that were not in the package.
  assert.match(listing, /\bLICENSE\b/, 'the archive must contain the repository LICENSE');
  ok('the built archive contains the repository LICENSE');

  // ---- dev-only files never ship -------------------------------------------
  // Regression test: build.mjs zipped the whole plugin directory with no
  // exclusions, so a plugin's own dev-only test files (or a stray .env,
  // had one existed) shipped inside the customer-facing archive.
  assert.doesNotMatch(listing, /mcp\/test\//, 'dev-only test files must not ship inside the archive');
  ok('the built archive excludes the plugin\'s own dev-only test files');

  console.log(`\n${passed} build.mjs checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
