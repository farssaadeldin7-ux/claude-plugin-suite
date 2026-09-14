#!/usr/bin/env node
/**
 * Regression tests for scripts/bake-billing-url.mjs.
 *
 * Runs the real script as a subprocess against a synthetic plugins/ tree, so
 * this exercises the actual file it will run at release time — not a copy of
 * its logic reimplemented in the test.
 *
 *   node test/bake-billing-url.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptSrc = path.join(root, 'scripts', 'bake-billing-url.mjs');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const SERVER_TEMPLATE = "const DEFAULT_BILLING_URL = 'https://billing.example.com';\n"
  + 'const client = new LicenseClient({ defaultBillingUrl: DEFAULT_BILLING_URL });\n';

/** A fresh fixture tree: <tmp>/scripts/bake-billing-url.mjs, <tmp>/plugins/fixture/mcp/server.js. */
function makeFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bake-url-test-'));
  fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'plugins', 'fixture', 'mcp'), { recursive: true });
  fs.copyFileSync(scriptSrc, path.join(tmp, 'scripts', 'bake-billing-url.mjs'));
  const serverFile = path.join(tmp, 'plugins', 'fixture', 'mcp', 'server.js');
  fs.writeFileSync(serverFile, SERVER_TEMPLATE);
  return { tmp, serverFile };
}

const run = (tmp, args) => {
  try {
    const stdout = execFileSync(process.execPath, [path.join(tmp, 'scripts', 'bake-billing-url.mjs'), ...args], {
      encoding: 'utf8',
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout, stderr: err.stderr };
  }
};

try {
  // ---- a normal URL is baked in verbatim -----------------------------------
  {
    const { tmp, serverFile } = makeFixture();
    const result = run(tmp, ['https://billing.codestudioplugin.com']);
    assert.equal(result.code, 0);
    const updated = fs.readFileSync(serverFile, 'utf8');
    assert.match(updated, /DEFAULT_BILLING_URL = 'https:\/\/billing\.codestudioplugin\.com';/);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok('a normal https URL replaces DEFAULT_BILLING_URL');

  // ---- a URL containing $& is written literally, not expanded -------------
  // Regression test: String.replace()'s second argument, when it is a
  // string, treats $&, $1, $$, ... as substitution patterns — not literal
  // text. A URL is free to contain a literal `$` (a query string, say), and
  // one containing `$&` used to have the entire matched line re-inserted
  // into itself, corrupting the file with a syntactically broken duplicate
  // declaration in every plugin server it touched.
  {
    const { tmp, serverFile } = makeFixture();
    const trickyUrl = 'https://billing.example.com/?x=$&y=1';
    const result = run(tmp, [trickyUrl]);
    assert.equal(result.code, 0);
    const updated = fs.readFileSync(serverFile, 'utf8');
    // Built by concatenation, deliberately not String.replace(): using the
    // same buggy substitution here would make this assertion pass either way.
    const expected = `const DEFAULT_BILLING_URL = '${trickyUrl}';\n`
      + 'const client = new LicenseClient({ defaultBillingUrl: DEFAULT_BILLING_URL });\n';
    assert.equal(updated, expected, 'a URL containing $& was not written literally');
    assert.doesNotThrow(() => new Function(updated), 'the rewritten file is not valid JavaScript');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok('a URL containing $& is baked in literally instead of corrupting the file');

  // ---- a quote or backslash in the URL is refused, not injected ------------
  // Regression test: the URL is embedded inside a single-quoted JS string
  // literal with no escaping. A URL containing a bare quote used to close
  // that literal early and let whatever followed run as code the next time
  // the plugin server started.
  {
    const { tmp, serverFile } = makeFixture();
    const before = fs.readFileSync(serverFile, 'utf8');
    const result = run(tmp, ["https://billing.example.com/'; process.exit(1); //"]);
    assert.notEqual(result.code, 0, 'a URL containing a single quote was accepted');
    assert.equal(fs.readFileSync(serverFile, 'utf8'), before, 'the file was modified despite the rejected URL');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok('a URL containing a quote is refused before it ever reaches a file');

  // ---- updating nothing is a failure, not a silent success ----------------
  // Regression test: if DEFAULT_BILLING_URL is not found in any plugin — a
  // sign this script and the source have drifted apart — the script used to
  // still print a summary and exit 0.
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bake-url-test-'));
    fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'plugins', 'fixture', 'mcp'), { recursive: true });
    fs.copyFileSync(scriptSrc, path.join(tmp, 'scripts', 'bake-billing-url.mjs'));
    // No DEFAULT_BILLING_URL anywhere under plugins/.
    fs.writeFileSync(path.join(tmp, 'plugins', 'fixture', 'mcp', 'server.js'), '// nothing to bake here\n');
    const result = run(tmp, ['https://billing.codestudioplugin.com']);
    assert.notEqual(result.code, 0, 'zero files updated was reported as success');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok('updating zero plugins exits non-zero instead of reporting success');

  console.log(`\n${passed} bake-billing-url.mjs checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
