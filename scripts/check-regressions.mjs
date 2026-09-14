#!/usr/bin/env node
/**
 * Verifies that every defect fix in scripts/regression-manifest.mjs has a
 * real regression test — not just a keyword that happens to appear
 * somewhere. An earlier version of this idea (described, not present, in
 * an external audit of a related codebase state) reported zero gaps while
 * missing six fixes with no test at all, because:
 *
 *   - it searched source files as well as test files, so `nosniff`
 *     appearing in the *server's own source* counted as coverage for a
 *     test that was never written;
 *   - a loose pattern like `minLength|maxLength|pattern` was satisfied by
 *     the English word "patterns" in a completely unrelated test.
 *
 * This version closes both: it only ever reads files under a `test/`
 * directory or named `*.test.mjs` (never plugin `lib/`, `server.js`, or
 * service source), and it additionally *runs* every test file a finding
 * points at and requires it to actually pass — a keyword match in a test
 * that's broken, or that doesn't exist, proves nothing.
 *
 * The checking logic (evaluateEntry, isTestFile) is exported so
 * test/check-regressions.test.mjs can prove both fixes hold, against
 * synthetic fixtures, independent of this repo's real manifest.
 *
 *   node scripts/check-regressions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export function isTestFile(relPath) {
  // Deliberately narrow: a defect pattern must be found in something that
  // is unambiguously a test, never in application source — the exact hole
  // that let `nosniff` in server.js count as its own regression coverage.
  return relPath.split(path.sep).includes('test') || /\.test\.mjs$/.test(relPath);
}

/**
 * True if `pattern` matches some line, and a line containing a real
 * `assert` call sits within `window` lines of it. A word appearing
 * anywhere in a test file — a comment, a console.log, unrelated prose —
 * is not itself evidence of anything; a word sitting next to an actual
 * assertion is. This is what stops a loose pattern like
 * `minLength|maxLength|pattern` from being satisfied by the ordinary
 * English word "patterns" in a file that never asserts on it at all.
 */
// A call, not merely the word: excludes `import assert from ...`, which
// would otherwise sit within range of nearly every line in the file and
// defeat the whole point of requiring proximity to a real assertion.
const ASSERT_CALL = /\bassert\s*[.(]/;

export function matchesNearAssert(content, pattern, window = 2) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!pattern.test(lines[i])) continue;
    const start = Math.max(0, i - window);
    const end = Math.min(lines.length, i + window + 1);
    if (lines.slice(start, end).some((l) => ASSERT_CALL.test(l))) return true;
  }
  return false;
}

function runTest(root, relPath, cache) {
  if (cache.has(relPath)) return cache.get(relPath);
  const abs = path.join(root, relPath);
  let result;
  if (!fs.existsSync(abs)) {
    result = { passed: false, output: 'file does not exist' };
  } else {
    try {
      const output = execFileSync(process.execPath, [abs], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
      result = { passed: true, output };
    } catch (err) {
      result = { passed: false, output: (err.stdout || '') + (err.stderr || err.message) };
    }
  }
  cache.set(relPath, result);
  return result;
}

/**
 * Evaluate one manifest entry against a repository root. Returns
 * { covered: true, testFile } or { covered: false, reason }.
 *
 * `runCache` (a Map) lets a caller share test-execution results across
 * entries that point at the same file, so a file with several tracked
 * fixes in it only actually runs once.
 */
export function evaluateEntry(entry, root, runCache = new Map()) {
  if (!entry.testFiles.every(isTestFile)) {
    return { covered: false, reason: 'manifest entry points outside test/ — refusing to trust it' };
  }

  let matchedIn = null;
  for (const relPath of entry.testFiles) {
    const abs = path.join(root, relPath);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf8');
    if (matchesNearAssert(content, entry.pattern)) { matchedIn = relPath; break; }
  }
  if (!matchedIn) {
    return { covered: false, reason: `pattern ${entry.pattern} not found near a real assertion in any of: ${entry.testFiles.join(', ')}` };
  }

  const result = runTest(root, matchedIn, runCache);
  if (!result.passed) {
    return { covered: false, reason: `matching test file ${matchedIn} does not pass: ${result.output.split('\n').slice(-3).join(' / ')}` };
  }

  return { covered: true, testFile: matchedIn };
}

async function main() {
  const { REGRESSIONS } = await import('./regression-manifest.mjs');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const runCache = new Map();
  const gaps = [];
  const covered = [];

  for (const entry of REGRESSIONS) {
    const result = evaluateEntry(entry, root, runCache);
    if (result.covered) covered.push({ ...entry, testFile: result.testFile });
    else gaps.push({ ...entry, reason: result.reason });
  }

  for (const g of gaps) {
    console.log(`GAP  #${g.id}: ${g.summary}`);
    console.log(`     ${g.reason}`);
  }
  for (const c of covered) {
    console.log(`ok   #${c.id}: ${c.testFile}`);
  }

  console.log(`\n${covered.length}/${REGRESSIONS.length} tracked fixes have a real, passing regression test. ${gaps.length} gap(s).`);
  process.exit(gaps.length ? 1 : 0);
}

// Only run as a CLI, not when imported for its exports (by the self-test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
