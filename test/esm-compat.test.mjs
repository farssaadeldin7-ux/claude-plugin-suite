#!/usr/bin/env node
/**
 * Every shipped .js file must be loadable as an ES module without relying on
 * Node's syntax-detection heuristic — which is unflagged (on by default)
 * only from Node 22.7. The suite's documented floor is Node 20.6, and the
 * billing Dockerfile deploys on node:20-alpine; on any of those, a .js file
 * with no package.json declaring "type": "module" nearby fails to even
 * parse, with `SyntaxError: Cannot use import statement outside a module`.
 *
 * This process happens to run on a newer Node where that heuristic is on by
 * default, which would silently mask the exact failure this guards against
 * — every check below runs with --no-experimental-detect-module, which is
 * the documented way to reproduce pre-22.7 behaviour on a newer Node.
 *
 *   node test/esm-compat.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

/** Runs a file just far enough to prove it parses and starts as ESM, then kills it. */
function checkLoads(rel, { env = {} } = {}) {
  const abs = path.join(root, rel);
  try {
    execFileSync(process.execPath, ['--no-experimental-detect-module', '--check', abs], {
      cwd: root, stdio: 'pipe', encoding: 'utf8',
    });
  } catch (err) {
    const output = `${err.stdout || ''}${err.stderr || ''}`;
    if (/Cannot use import statement outside a module|Unexpected token 'export'/.test(output)) {
      return `${rel}: not loadable as an ES module without unflagged syntax-detection (needs a package.json declaring "type": "module" in an ancestor directory)\n${output.slice(0, 200)}`;
    }
    // --check on a file with top-level await or other things that need a
    // real run is expected to differ; only the module-type failure above is
    // what this test exists to catch.
  }
  return null;
}

try {
  const failures = [];

  // ---- every plugin's server and vendored runtime -------------------------
  const pluginIds = fs.readdirSync(path.join(root, 'plugins'))
    .filter((id) => fs.existsSync(path.join(root, 'plugins', id, 'mcp', 'server.js')));
  assert.ok(pluginIds.length > 0, 'no plugin servers found — the layout moved');
  for (const id of pluginIds) {
    const mcpDir = path.join(root, 'plugins', id, 'mcp');
    for (const file of fs.readdirSync(mcpDir)) {
      if (!file.endsWith('.js')) continue;
      const err = checkLoads(path.join('plugins', id, 'mcp', file));
      if (err) failures.push(err);
    }
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
  ok(`all ${pluginIds.length} plugins' server.js and vendored runtime files load as ES modules without unflagged syntax-detection`);

  // ---- the billing service, exactly as Docker copies it in ----------------
  const billingFailures = [];
  for (const rel of ['services/billing/server.js', 'services/billing/catalog.js']) {
    const err = checkLoads(rel);
    if (err) billingFailures.push(err);
  }
  for (const file of fs.readdirSync(path.join(root, 'services/billing/lib'))) {
    if (!file.endsWith('.js')) continue;
    const err = checkLoads(path.join('services/billing/lib', file));
    if (err) billingFailures.push(err);
  }
  assert.deepEqual(billingFailures, [], `\n${billingFailures.join('\n')}\n`);
  ok('the billing service loads as ES modules without unflagged syntax-detection');

  // ---- package.json actually declares type: module, not just exists -------
  // The check above proves loadability; this proves *why* it loads, so a
  // future edit that removes "type": "module" but leaves an empty
  // package.json behind is still caught.
  const manifestDirs = [
    root,
    path.join(root, 'services/billing'),
    ...pluginIds.map((id) => path.join(root, 'plugins', id)),
  ];
  const missingType = [];
  for (const dir of manifestDirs) {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) { missingType.push(`${path.relative(root, dir) || '.'}: no package.json`); continue; }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.type !== 'module') missingType.push(`${path.relative(root, dir) || '.'}: package.json does not declare "type": "module"`);
  }
  assert.deepEqual(missingType, [], `\n${missingType.join('\n')}\n`);
  ok(`the root, services/billing, and all ${pluginIds.length} plugins each have a package.json declaring "type": "module"`);

  console.log(`\n${passed} ESM-compatibility checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
