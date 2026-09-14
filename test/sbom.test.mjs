#!/usr/bin/env node
/**
 * Regression tests for scripts/sbom.mjs, against a synthetic fixture repo
 * (a real git repo of its own, since the script shells out to `git
 * ls-files`) rather than this repository's own tracked files.
 *
 *   node test/sbom.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptSrc = path.join(root, 'scripts', 'sbom.mjs');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

function makeFixtureRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbom-test-'));
  execFileSync('git', ['init', '-q'], { cwd: tmp });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmp });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: tmp });
  fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.claude-plugin'), { recursive: true });
  fs.copyFileSync(scriptSrc, path.join(tmp, 'scripts', 'sbom.mjs'));
  fs.writeFileSync(path.join(tmp, '.claude-plugin', 'marketplace.json'), JSON.stringify({ metadata: { version: '1.2.3' } }));
  fs.writeFileSync(path.join(tmp, 'LICENSE'), 'Copyright (c) test\n');
  fs.writeFileSync(path.join(tmp, 'app.js'), "import fs from 'node:fs';\nconsole.log(fs);\n");
  return tmp;
}

const gitAdd = (tmp) => execFileSync('git', ['add', '-A'], { cwd: tmp });

const runCheck = (tmp) => {
  try {
    const stdout = execFileSync(process.execPath, [path.join(tmp, 'scripts', 'sbom.mjs'), '--check'], {
      cwd: tmp, encoding: 'utf8',
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout, stderr: err.stderr };
  }
};

try {
  // ---- a package.json that only declares type:module is not a dependency --
  // Regression test: package.json's mere presence used to be treated as
  // evidence of a dependency — but every plugin and services/billing now
  // carry one purely to tell Node these are ES modules on any runtime
  // without unflagged syntax-detection (real Node 20.x). A --check that
  // fails the moment that ships would have blocked every PR forever.
  {
    const tmp = makeFixtureRepo();
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module' }, null, 2));
    gitAdd(tmp);
    const result = runCheck(tmp);
    assert.equal(result.code, 0, `a dependency-free package.json failed the check:\n${result.stderr}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok('a package.json with no dependencies fields does not fail the check');

  // ---- a package.json that actually lists a dependency still fails --------
  {
    const tmp = makeFixtureRepo();
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
      name: 'fixture', type: 'module', dependencies: { 'left-pad': '^1.0.0' },
    }, null, 2));
    gitAdd(tmp);
    const result = runCheck(tmp);
    assert.notEqual(result.code, 0, 'a package.json declaring a real dependency was not caught');
    assert.match(result.stderr, /package\.json is tracked/);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok('a package.json that actually declares a dependency still fails the check');

  // ---- a package-lock.json fails regardless of its content ----------------
  {
    const tmp = makeFixtureRepo();
    fs.writeFileSync(path.join(tmp, 'package-lock.json'), JSON.stringify({ name: 'fixture' }, null, 2));
    gitAdd(tmp);
    const result = runCheck(tmp);
    assert.notEqual(result.code, 0, 'a tracked package-lock.json was not caught');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok('a tracked package-lock.json fails the check regardless of its own content');

  // ---- a real external import is still caught, independent of manifests ---
  {
    const tmp = makeFixtureRepo();
    fs.writeFileSync(path.join(tmp, 'app.js'), "import express from 'express';\n");
    gitAdd(tmp);
    const result = runCheck(tmp);
    assert.notEqual(result.code, 0, 'a genuine external import was not caught');
    assert.match(result.stderr, /express imported by/);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok('a genuine external import is still caught');

  console.log(`\n${passed} sbom.mjs checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
