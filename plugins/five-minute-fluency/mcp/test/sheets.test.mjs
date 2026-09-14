#!/usr/bin/env node
/**
 * Regression tests for lib/sheets.js: the local sheet log behind the
 * success-check tally (SKILL.md step 8 — "roughly a coin flip at their
 * current level"). There is no worked numeric example for this file in the
 * skill's reference docs (the docs describe the *rule* for setting a check,
 * not a sample log), so these tests are built around the file's own stated
 * invariants — defaults, id shape, and the pass/fail/unscored tally — plus
 * the boundary that matters most: a sheet with `passed: false` must still
 * count as *resolved* (scored), not get folded into "unscored" alongside a
 * sheet that was never recorded at all.
 *
 * Each test block gets its own throwaway XDG_CONFIG_HOME and a fresh
 * dynamic import (cache-busted with a query string) so the JSON-array
 * store's counts in one block can never be polluted by sheets a previous
 * block already logged.
 *
 *   node plugins/five-minute-fluency/mcp/test/sheets.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const tmpDirs = [];
let freshCounter = 0;

// createJsonArrayStore resolves its config directory at import time, so
// XDG_CONFIG_HOME must be set before sheets.js is evaluated — a static
// top-of-file import would be hoisted ahead of any assignment regardless of
// source order (same pattern as the professor-mind-reader pilot's audits.js
// import). The query-string cache-bust forces Node to re-evaluate the
// module fresh each time, so each block gets its own bound store.
async function freshSheets() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'five-minute-fluency-test-'));
  tmpDirs.push(dir);
  process.env.XDG_CONFIG_HOME = dir;
  return import(`../lib/sheets.js?fresh=${freshCounter++}`);
}

try {
  // ---- logSheet: defaults and id shape -------------------------------------
  {
    const { logSheet } = await freshSheets();
    const sheet = logSheet({
      game: 'Tactical FPS', genre: 'tactical_fps', diagnosis: 'untraded entries',
      changes: ['a', 'b', 'c'], stop_doing: 're-peeking', success_check: 'under 4 untraded deaths',
      next_session: null, notes: null,
    });
    assert.match(sheet.id, /^sheet_[0-9a-f]{12}$/, 'id must be "sheet_" plus 12 hex characters (6 random bytes)');
    assert.equal(sheet.passed, null, 'a freshly logged sheet has no recorded session yet');
    assert.equal(sheet.reported_count, null);
    assert.deepEqual(sheet.changes, ['a', 'b', 'c']);
    assert.ok(!Number.isNaN(Date.parse(sheet.created_at)), 'created_at must be a parseable timestamp');
  }
  ok('logSheet stamps a sheet_-prefixed id, an ISO created_at, and null passed/reported_count until a session is recorded');

  // ---- logSheet: a non-array `changes` is coerced to an empty array -------
  {
    const { logSheet } = await freshSheets();
    const sheet = logSheet({ game: 'g', genre: 'moba', diagnosis: 'd', changes: 'not an array', success_check: 'c' });
    assert.deepEqual(sheet.changes, [], 'a non-array changes value must be coerced to [], not stored as-is');
  }
  ok('logSheet coerces a non-array changes field to an empty array rather than storing malformed data');

  // ---- recordSession: unknown id returns null and touches nothing ---------
  {
    const { logSheet, recordSession, reviewSheets } = await freshSheets();
    logSheet({ game: 'g', genre: 'moba', diagnosis: 'd', success_check: 'c' });
    const before = reviewSheets();
    const result = recordSession('sheet_doesnotexist', { passed: true, reported_count: 1 });
    assert.equal(result, null, 'recording a session against an unknown id must return null');
    const after = reviewSheets();
    assert.equal(after.total_sheets, before.total_sheets, 'an unknown id must not add or remove a sheet');
  }
  ok('recordSession returns null for an unknown id and leaves the store unchanged');

  // ---- reviewSheets: pass/fail/unscored tally, including passed:false -----
  // Three sheets: one recorded as passed, one recorded as *failed*
  // (passed: false), one never recorded at all. The boundary this protects:
  // `passed !== null` must treat false as resolved — a naive `if (s.passed)`
  // read for "resolved" would silently fold the failed sheet into unscored.
  {
    const { logSheet, recordSession, reviewSheets } = await freshSheets();
    const s1 = logSheet({ game: 'g1', genre: 'moba', diagnosis: 'd1', success_check: 'c1' });
    const s2 = logSheet({ game: 'g2', genre: 'moba', diagnosis: 'd2', success_check: 'c2' });
    logSheet({ game: 'g3', genre: 'moba', diagnosis: 'd3', success_check: 'c3' });
    recordSession(s1.id, { passed: true, reported_count: 5 });
    recordSession(s2.id, { passed: false, reported_count: 9 });
    // the third sheet is left unrecorded.

    const review = reviewSheets();
    assert.equal(review.total_sheets, 3);
    assert.equal(review.unscored, 1, 'only the never-recorded sheet counts as unscored');
    assert.deepEqual(review.success_checks, { scored: 2, passed: 1, failed: 1 },
      'passed:false must be counted as scored-and-failed, not as unscored');
  }
  ok('reviewSheets tallies passed/failed/unscored correctly, counting a recorded failure (passed:false) as resolved rather than unscored');

  // ---- reviewSheets: the "no scored checks yet" note when nothing is resolved ----
  {
    const { logSheet, reviewSheets } = await freshSheets();
    logSheet({ game: 'g', genre: 'moba', diagnosis: 'd', success_check: 'c' });
    const review = reviewSheets();
    assert.deepEqual(review.success_checks, {
      scored: 0,
      note: 'No sheet has a scored success check yet — record one with record_session.',
    });
  }
  ok('reviewSheets reports the "no scored checks yet" note, instead of a 0/0 tally, when nothing has been recorded');

  // ---- reviewSheets: recent respects `limit`, most-recently-logged first --
  {
    const { logSheet, reviewSheets } = await freshSheets();
    for (const game of ['first', 'second', 'third', 'fourth', 'fifth']) {
      logSheet({ game, genre: 'moba', diagnosis: 'd', success_check: 'c' });
    }
    const full = reviewSheets();
    assert.equal(full.total_sheets, 5);
    assert.deepEqual(full.recent.map((s) => s.game), ['fifth', 'fourth', 'third', 'second', 'first'],
      'each new sheet is unshifted onto the front — recent must read most-recently-logged first');

    const limited = reviewSheets({ limit: 2 });
    assert.equal(limited.recent.length, 2, 'a limit of 2 with 5 sheets logged must return exactly 2, not the full list');
    assert.deepEqual(limited.recent.map((s) => s.game), ['fifth', 'fourth']);

    const exact = reviewSheets({ limit: 5 });
    assert.equal(exact.recent.length, 5, 'a limit exactly equal to the sheet count must return all of them, not one fewer');
  }
  ok('reviewSheets orders recent sheets most-recently-logged first and slices them to `limit`, including the limit-equals-count boundary');

  console.log(`\n${passed} sheets.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
}
