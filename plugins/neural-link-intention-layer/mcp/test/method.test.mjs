#!/usr/bin/env node
/**
 * Regression tests for lib/method.js. Almost everything here is a fixed data
 * table (thresholds and constants consumed by analyse.js, predictor.js and
 * score.js, which have their own tests exercising those tables through real
 * behaviour). The one real arithmetic in this file is floorForK(), the
 * confidence-floor formula `k / (1 + k)` — worth checking on its own against
 * both tables that state it in the skill's materials: method.js's own
 * CONFIDENCE_FLOOR.table, and references/sequence-analysis.md's separate
 * worked table ("Confidence floors for suggestions").
 *
 *   node plugins/neural-link-intention-layer/mcp/test/method.test.mjs
 */
import assert from 'node:assert/strict';
import { floorForK, CONFIDENCE_FLOOR, SCORING, MIN_LOG_SIZES, UNDO_SHARE_BANDS, PER_ACTION_UNDO } from '../lib/method.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- floorForK against method.js's own CONFIDENCE_FLOOR.table -------------
  // Hand-verified: k/(1+k) for k=2,3,4,6,8 is 0.6667, 0.75, 0.8, 0.8571, 0.8889
  // — each rounds to the table's stated floor (0.67, 0.75, 0.8, 0.86, 0.89).
  {
    for (const { k, floor } of CONFIDENCE_FLOOR.table) {
      assert.equal(+floorForK(k).toFixed(2), floor, `k=${k} must round to the documented floor ${floor}`);
    }
  }
  ok('floorForK(k) = k/(1+k) rounds to every floor in method.js\'s own CONFIDENCE_FLOOR.table (k=2,3,4,6,8)');

  // ---- floorForK against the independent worked table in sequence-analysis.md ----
  // "Wrong-fire is... equal cost (k=1) -> 0.50; 2x worse (k=2) -> 0.67;
  // 4x worse (k=4) -> 0.80; 9x worse (k=9) -> 0.90." Computed independently
  // by hand from the same k/(1+k) formula, not copied from the code.
  {
    assert.equal(floorForK(1), 0.5, '1/2 = 0.5 exactly');
    assert.equal(+floorForK(2).toFixed(2), 0.67, '2/3 = 0.6667 rounds to 0.67');
    assert.equal(floorForK(4), 0.8, '4/5 = 0.8 exactly');
    assert.equal(floorForK(9), 0.9, '9/10 = 0.9 exactly');
  }
  ok('floorForK reproduces the independent "confidence floors for suggestions" table in references/sequence-analysis.md (k=1,2,4,9)');

  // ---- default_k / default_floor are internally consistent ------------------
  {
    assert.equal(CONFIDENCE_FLOOR.default_k, 4);
    assert.equal(CONFIDENCE_FLOOR.default_floor, floorForK(CONFIDENCE_FLOOR.default_k), 'default_floor must actually equal floorForK(default_k), not a value that drifted from it');
  }
  ok('CONFIDENCE_FLOOR.default_floor equals floorForK(default_k) rather than a hand-typed number that could drift out of sync');

  // ---- SCORING constants the whole payback formula depends on ---------------
  {
    assert.equal(SCORING.payback_threshold_weeks, 8);
    assert.equal(SCORING.maintenance_factor, 1.3);
  }
  ok('SCORING carries the documented payback threshold (8 weeks) and maintenance factor (x1.3) that score.js\'s formula depends on');

  // ---- MIN_LOG_SIZES / UNDO_SHARE_BANDS / PER_ACTION_UNDO match the doc -----
  {
    assert.equal(MIN_LOG_SIZES.length, 5);
    assert.deepEqual(MIN_LOG_SIZES.map((r) => r.actions), ['under 500', '500-2,000', '2,000-5,000', '5,000+', '20,000+']);
    assert.equal(UNDO_SHARE_BANDS.length, 4);
    assert.equal(PER_ACTION_UNDO.min_occurrences, 20);
    assert.equal(PER_ACTION_UNDO.threshold, 0.25);
  }
  ok('MIN_LOG_SIZES, UNDO_SHARE_BANDS and PER_ACTION_UNDO carry the exact boundary numbers analyse.js and predictor.js are built against');

  console.log(`\n${passed} method.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
