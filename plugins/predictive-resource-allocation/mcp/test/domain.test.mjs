#!/usr/bin/env node
/**
 * Regression tests for lib/dispatch.js and lib/estimates.js.
 *
 *   node plugins/predictive-resource-allocation/mcp/test/domain.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dispatchPlan } from '../lib/dispatch.js';

process.env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'pra-domain-test-'));
const { logEstimate, recordActual, reviewEstimates } = await import('../lib/estimates.js');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- the 10x-overhead rule applies above 30 minutes too ----------------
  // Regression test: a 45-minute frame behind a 10-minute overhead was told
  // to dispatch per frame unconditionally once past the 30-minute mark,
  // even though overhead was 18% of the total — nearly double the 10% the
  // rule promises to keep it under.
  {
    const result = dispatchPlan({ frame_time_seconds: 45 * 60, overhead_seconds: 10 * 60 });
    assert.equal(result.verdict.dispatch, 'batch', `overhead is ${result.overhead_fraction_if_dispatched_per_frame} of the total if dispatched per frame — the 10x rule should have said batch`);
  }
  ok('a long frame whose overhead still fails the 10x threshold is batched, not dispatched per frame just for being over 30 minutes');

  {
    // A frame genuinely far past its overhead should still dispatch per frame.
    const result = dispatchPlan({ frame_time_seconds: 45 * 60, overhead_seconds: 60 });
    assert.equal(result.verdict.dispatch, 'per_frame');
  }
  ok('a long frame that genuinely clears the 10x threshold still dispatches per frame');

  // ---- within_factor_two is cumulative, not "factor-two but not 25%" -----
  // Regression test: a perfectly calibrated log (every ratio near 1.0, well
  // inside the tighter 25% band) reported zero "within a factor of two",
  // because the two checks were chained as mutually exclusive else-if
  // branches instead of independent, overlapping bands.
  {
    for (let i = 0; i < 3; i++) {
      const rec = logEstimate({ job: `job${i}`, predicted_value: 10 });
      recordActual(rec.id, { actual_value: 10 }); // ratio exactly 1.0 — perfectly calibrated
    }
    const review = reviewEstimates();
    assert.equal(review.calibration.resolved, 3);
    assert.equal(review.calibration.within_25_percent, 3);
    assert.equal(review.calibration.within_factor_two, 3, 'every one of these ratios is also within a factor of two, and must be counted as such');
    assert.equal(review.calibration.outside_factor_two, 0);
  }
  ok('a perfectly calibrated log reports the true within-factor-two count, not zero');

  console.log(`\n${passed} predictive-resource-allocation domain checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(process.env.XDG_CONFIG_HOME, { recursive: true, force: true });
}
