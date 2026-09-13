#!/usr/bin/env node
/**
 * Regression tests for lib/weight.js.
 *
 *   node plugins/basecamp-split/mcp/test/weight.test.mjs
 */
import assert from 'node:assert/strict';
import { weightLedger } from '../lib/weight.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- a real overage cannot be rounded away in aggregate -----------------
  // Regression test: the aggregate fit check summed each person's already
  // rounded-to-100g figures, so several small overages that individually
  // round down could sum to a "fits in aggregate" verdict that the raw,
  // unrounded totals contradict.
  {
    // Two self-declared carriers, each 0.02 kg (20 g) over their own limit —
    // below the 0.1 kg rounding granularity individually, but a real 40 g
    // aggregate overage together.
    const result = weightLedger([
      { name: 'a', target_load_kg: 10, personal_kg: 10.02 },
      { name: 'b', target_load_kg: 10, personal_kg: 10.02 },
    ]);
    assert.equal(result.summary.total_allowance_kg, 20);
    assert.equal(result.summary.fits_in_aggregate, false, 'the raw totals are 20.04 kg of load against 20 kg of allowance — that must not round away to a fit');
  }
  ok('a real cross-person overage below the 100g rounding granularity is not hidden by summing already-rounded per-person totals');

  // ---- the headroom warning matches the band it warns about ---------------
  // Regression test: the warning fired at 91% of the limit while its own
  // message said "nobody should start above about 90-95%" — implying up to
  // 95% is within the described band, not the first point past 90%.
  {
    const at91 = weightLedger([{ name: 'a', target_load_kg: 100, personal_kg: 91 }]);
    assert.equal(at91.people[0].headroom_warning, undefined, 'a start at 91% is inside the band the message itself calls acceptable (90-95%) and must not warn');

    const at96 = weightLedger([{ name: 'a', target_load_kg: 100, personal_kg: 96 }]);
    assert.ok(at96.people[0].headroom_warning, 'a start past the described 90-95% band should warn');
  }
  ok('the headroom warning threshold matches the 90-95% band its own message describes');

  // ---- an implausible body weight is rejected, not silently accepted -----
  // Regression test: any finite positive body_weight_kg was accepted with
  // no sanity range, so a units or decimal-point typo (0.07 instead of 70)
  // silently produced a carry limit of a fraction of a gram.
  {
    assert.throws(
      () => weightLedger([{ name: 'a', body_weight_kg: 0.07, band: 'typical' }]),
      (err) => err instanceof ToolError && err.code === 'implausible_body_weight'
    );
  }
  ok('a body_weight_kg far outside a plausible human range is rejected rather than producing a near-zero carry limit');

  console.log(`\n${passed} weight.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
