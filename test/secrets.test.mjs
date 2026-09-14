#!/usr/bin/env node
/**
 * No secret in the repository, and no secret in its history's working tree.
 *
 * This suite's own test fixtures contain strings shaped like Stripe keys, so
 * a naive scan is all false positives and gets switched off within a week.
 * The rule here is narrower and holds: a *live* credential never appears
 * anywhere, a test-shaped credential only inside test files, and a committed
 * .env never at all.
 *
 * Deliberately dependency-free. gitleaks is the better tool and should run in
 * CI too where the runner can fetch it; this exists so the check cannot be
 * skipped by a network that will not reach a release server.
 *
 *   node test/secrets.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

/** Anything matching these is a real credential wherever it appears. */
const NEVER = [
  [/\bsk_live_[A-Za-z0-9]{10,}/, 'a live Stripe secret key'],
  [/\brk_live_[A-Za-z0-9]{10,}/, 'a live Stripe restricted key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\bghp_[A-Za-z0-9]{30,}/, 'a GitHub personal access token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
];
/** Real in production, routine in a fixture — so: tests only. */
const TESTS_ONLY = [
  [/\bsk_test_[A-Za-z0-9]{10,}/, 'a Stripe test key'],
  [/\bwhsec_[A-Za-z0-9+/=]{16,}/, 'a webhook signing secret'],
];
const isTestFile = (rel) => /(^|\/)(test|tests)\//.test(rel) || /\.test\.mjs$/.test(rel)
  || /(^|\/)scripts\//.test(rel) || /\.example$/.test(rel);

try {
  // Ask git what is tracked: a scan of the working tree would miss the
  // question that matters, which is what is committed.
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  assert.ok(tracked.length > 0, 'git listed no tracked files — the scan examined nothing');

  const findings = [];
  let scanned = 0;
  for (const rel of tracked) {
    const abs = path.join(root, rel);
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue; // binary
    scanned += 1;
    for (const [pattern, what] of NEVER) {
      if (pattern.test(text)) findings.push(`${rel} contains ${what}`);
    }
    if (!isTestFile(rel)) {
      for (const [pattern, what] of TESTS_ONLY) {
        if (pattern.test(text)) findings.push(`${rel} contains ${what} outside a test or example file`);
      }
    }
  }
  assert.ok(scanned > 0, 'no readable tracked file was scanned');
  assert.deepEqual(findings, [], `\n${findings.join('\n')}\n`);
  ok(`${scanned} tracked files scanned: no live key, token or private key anywhere, and no test credential outside a fixture`);

  // A committed .env is the single most common way a key escapes.
  const envFiles = tracked.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !/\.example$/.test(f));
  assert.deepEqual(envFiles, [], `a .env file is committed: ${envFiles.join(', ')}`);
  ok('no .env file is tracked — only .env.example');

  // And the ignore rule that keeps it that way must still be there.
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /(^|\n)\.?\*?\.?env/, '.gitignore no longer ignores .env files');
  ok('.gitignore still excludes .env');

  console.log(`\n${passed} secret-hygiene checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
