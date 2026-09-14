#!/usr/bin/env node
/**
 * Regression tests for lib/calls.js: the local prediction log's band
 * validity, the record/result lifecycle, and — the real arithmetic in this
 * file — reviewCalls' calibration tally (exact / one-band-off / two-or-more
 * band gap between the called band and the actual band).
 *
 * calls.js creates its store (and resolves the config directory) at import
 * time, so XDG_CONFIG_HOME must be set — and calls.js dynamically imported —
 * before that happens, matching the pattern in
 * professor-mind-reader/mcp/test/domain.test.mjs.
 *
 *   node plugins/ghost-post-preview/mcp/test/calls.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-post-preview-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { bandIsValid, logCall, recordResult, reviewCalls, BANDS } = await import('../lib/calls.js');

try {
  // ---- BANDS order and bandIsValid ------------------------------------------
  {
    assert.deepEqual(BANDS, ['well_below', 'below', 'at', 'above', 'well_above']);
    for (const b of BANDS) assert.equal(bandIsValid(b), true);
    for (const b of ['maybe', '', undefined, null, 'WELL_BELOW']) assert.equal(bandIsValid(b), false);
  }
  ok('bandIsValid accepts exactly the five documented bands, in the documented worst-to-best order, and nothing else');

  // ---- a fresh store reports no calls and the zero-resolved calibration shape ----
  // reviewCalls' calibration object has two different shapes depending on whether
  // anything is resolved yet ({resolved:0, note:...} vs the full tally) — this must
  // be checked before any calls are logged, while the store is still empty.
  {
    const review = reviewCalls();
    assert.equal(review.total_calls, 0);
    assert.equal(review.unresolved, 0);
    assert.deepEqual(review.calibration, { resolved: 0, note: 'No calls have a recorded result yet — record one with record_result.' });
    assert.deepEqual(review.recent, []);
  }
  ok('reviewCalls on an empty store reports zero totals and the no-results-yet calibration shape, not a tally of zeros');

  // ---- logCall defaults and id/timestamp shape -------------------------------
  {
    const record = logCall({ verdict: 'ship' });
    assert.match(record.id, /^call_[0-9a-f]{12}$/);
    assert.equal(record.verdict, 'ship');
    assert.equal(record.platform, null);
    assert.equal(record.band, null);
    assert.equal(record.confidence, null);
    assert.equal(record.hook_summary, null);
    assert.equal(record.notes, null);
    assert.equal(record.actual_band, null);
    assert.ok(!Number.isNaN(Date.parse(record.created_at)), 'created_at must be a parseable timestamp');
  }
  ok('logCall fills every omitted optional field with null rather than leaving it undefined, and stamps an id and a real timestamp');

  // ---- recordResult on an unknown id returns null, not a throw --------------
  {
    assert.equal(recordResult('call_doesnotexist', { actual_band: 'at' }), null);
  }
  ok('recordResult returns null for an id that is not in the store, instead of throwing');

  // ---- the calibration gap boundary: 1 band off vs 2 bands off --------------
  // BANDS indices: well_below=0, below=1, at=2, above=3, well_above=4. The code
  // buckets gap===0 as exact, gap===1 as one_band_off, anything else as
  // two_or_more_off — so gap=1 and gap=2 are the two sides of the boundary that
  // most deserve a direct check (the same off-by-one shape this codebase has had
  // bugs in before), plus a reversed-direction gap=2 case (above -> below) to
  // confirm the distance is symmetric (abs), not signed.
  const exact = logCall({ platform: 'linkedin', verdict: 'ship', band: 'at' });
  const oneOff = logCall({ platform: 'linkedin', verdict: 'ship', band: 'below' });
  const twoOff = logCall({ platform: 'linkedin', verdict: 'ship', band: 'well_below' });
  const twoOffReversed = logCall({ platform: 'linkedin', verdict: 'ship', band: 'above' });
  recordResult(exact.id, { actual_band: 'at' });           // gap |2-2| = 0
  recordResult(oneOff.id, { actual_band: 'at' });          // gap |1-2| = 1
  recordResult(twoOff.id, { actual_band: 'above' });       // gap |0-3| = 3
  recordResult(twoOffReversed.id, { actual_band: 'below' }); // gap |3-1| = 2, opposite direction

  // ---- a call with no baseline band never enters calibration, even once resolved ----
  // recordResult will happily set actual_band on it, but reviewCalls requires the
  // original `band` to be truthy too (matches the README: no baseline means no band
  // is reported at all) — this is a real, easy-to-get-backwards rule worth locking in.
  const noBaseline = logCall({ platform: 'linkedin', verdict: 'ship' }); // band omitted
  recordResult(noBaseline.id, { actual_band: 'at' });

  // ---- a logged call that is simply never resolved stays unresolved -----------------
  logCall({ platform: 'linkedin', verdict: 'rewrite', band: 'above' });

  {
    const review = reviewCalls();
    // 7 calls logged in total across this file: the earlier "logCall fills every
    // omitted field" record, the 4 gap-boundary calls, noBaseline, and the
    // never-resolved one.
    assert.equal(review.total_calls, 7);
    // resolved = has both `band` and `actual_band`: exact, oneOff, twoOff, twoOffReversed (4);
    // unresolved = the earlier defaults-test record (no band, no actual_band) + noBaseline
    // (has actual_band but no original band) + the never-resolved one (band, no actual_band) = 3.
    assert.equal(review.unresolved, 3);
    assert.equal(review.calibration.resolved, 4);
    assert.equal(review.calibration.exact_band, 1);
    assert.equal(review.calibration.one_band_off, 1, 'gap=1 (below vs at) must land in one_band_off, not two_or_more_off');
    assert.equal(review.calibration.two_or_more_off, 2, 'both gap=3 and the reversed-direction gap=2 must land in two_or_more_off');
  }
  ok('reviewCalls tallies exact/one-band-off/two-or-more-off correctly across the gap=0/1/2/3 boundary, using an unsigned (abs) distance');

  {
    const review = reviewCalls();
    const resolvedIds = new Set([exact.id, oneOff.id, twoOff.id, twoOffReversed.id]);
    assert.equal(resolvedIds.has(noBaseline.id), false, 'sanity: noBaseline is a distinct call');
  }
  ok('a call logged without a baseline band is excluded from calibration even after its actual_band is recorded, matching "no baseline means no band" (README)');

  // ---- recent respects the limit and lists most-recently-logged first (logCall unshifts) ----
  {
    const review = reviewCalls({ limit: 1 });
    assert.equal(review.recent.length, 1);
    assert.equal(review.recent[0].verdict, 'rewrite', 'the most recently logged call (never-resolved "rewrite") must be first');
    assert.deepEqual(Object.keys(review.recent[0]).sort(), ['actual_band', 'band', 'created_at', 'id', 'platform', 'verdict'].sort());
  }
  ok('reviewCalls respects the limit option and returns the most recently logged call first');

  console.log(`\n${passed} calls.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
