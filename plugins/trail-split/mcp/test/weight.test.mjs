#!/usr/bin/env node
/**
 * Regression tests for lib/weight.js.
 *
 *   node plugins/trail-split/mcp/test/weight.test.mjs
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

  // ---- the worked example from references/consumables-planning.md: the naive split ----
  // "Worked example: four people, three days, temperate, moderate hiking" — the
  // naive even split table. Hand-verified against the doc's own stated inputs
  // (personal kit + 1.5 kg water each + 19.3 kg group mass split four ways)
  // before encoding: A 9.0+1.5+4.825=15.325, B 8.5+1.5+4.825=14.825,
  // C 7.5+1.5+4.825=13.825, D 8.0+1.5+4.825=14.325.
  {
    const roster = [
      { name: 'A', body_weight_kg: 92, band: 'conditioned', band_percent: 28, personal_kg: 9.0, water_kg: 1.5, group_kg: 4.825 },
      { name: 'B', body_weight_kg: 78, band: 'typical', personal_kg: 8.5, water_kg: 1.5, group_kg: 4.825 },
      { name: 'C', body_weight_kg: 64, band: 'typical', personal_kg: 7.5, water_kg: 1.5, group_kg: 4.825 },
      { name: 'D', body_weight_kg: 58, band: 'unconditioned', personal_kg: 8.0, water_kg: 1.5, group_kg: 4.825 },
    ];
    const result = weightLedger(roster);
    const [a, b, c, d] = result.people;

    assert.equal(a.limit_kg, 25.8, 'A: 92 kg x 28% = 25.76, rounds to 25.8, matching the doc\'s stated limit');
    assert.equal(b.limit_kg, 15.6, 'B: 78 kg x 20% = 15.6');
    assert.equal(c.limit_kg, 12.8, 'C: 64 kg x 20% = 12.8');
    assert.equal(d.limit_kg, 8.7, 'D: 58 kg x 15% = 8.7');
    assert.equal(result.summary.total_allowance_kg, 62.9, 'the doc\'s stated total allowance for the four bands');

    assert.equal(a.total_kg, 15.3);
    assert.equal(a.percent_of_limit, 59, 'the doc reports A at 59% — badly under-used');
    assert.equal(b.total_kg, 14.8);
    assert.equal(b.percent_of_limit, 95);
    assert.equal(c.total_kg, 13.8);
    assert.equal(c.over_by_kg, 1.0, 'the doc reports C over by 1.0 kg');
    assert.equal(d.total_kg, 14.3);
    assert.equal(d.over_by_kg, 5.6, 'the doc reports D over by 5.6 kg');

    // The doc's own prose states "Total load 58.2 kg" here, but that figure is
    // the sum of the four already-rounded per-person totals printed in its
    // table (15.3+14.8+13.8+14.3=58.2) rather than the true raw total
    // (15.325+14.825+13.825+14.325=58.3 exactly) — precisely the
    // rounding-then-summing trap this file's own aggregate-fit test above
    // exists to avoid. Asserting against the doc's printed 58.2 here would
    // encode that trap into the test, so this checks the hand-verified raw
    // figure (58.3) that weightLedger actually computes and reports it as a
    // doc inconsistency instead (see the final report).
    assert.equal(result.summary.total_load_kg, 58.3);
    assert.equal(result.summary.fits_in_aggregate, true, 'the doc says this fits in aggregate (58.x against 62.9 kg of allowance)');
    assert.equal(result.summary.fits_as_split, false, 'C and D are both over their own band');
    assert.deepEqual(result.summary.over_band, ['C', 'D']);
  }
  ok('weightLedger reproduces the "naive even split fails" worked table in references/consumables-planning.md: per-person limits, totals and over-by-kg figures for A/B/C/D (flagging one doc-prose figure that does not match its own table — see report)');

  // ---- the same worked example's "re-split": every band respected ----------
  {
    const roster = [
      { name: 'A', body_weight_kg: 92, band: 'conditioned', band_percent: 28, personal_kg: 9.0, water_kg: 1.5, group_kg: 12.0 },
      { name: 'B', body_weight_kg: 78, band: 'typical', personal_kg: 8.5, water_kg: 1.5, group_kg: 4.3 },
      { name: 'C', body_weight_kg: 64, band: 'typical', personal_kg: 7.5, water_kg: 1.5, group_kg: 3.0 },
      { name: 'D', body_weight_kg: 58, band: 'unconditioned', personal_kg: 6.5, water_kg: 1.0, group_kg: 0 },
    ];
    const result = weightLedger(roster);
    const [a, b, c, d] = result.people;

    assert.equal(a.total_kg, 22.5); assert.equal(a.percent_of_limit, 87);
    assert.equal(b.total_kg, 14.3); assert.equal(b.percent_of_limit, 92);
    assert.equal(c.total_kg, 12.0); assert.equal(c.percent_of_limit, 94);
    assert.equal(d.total_kg, 7.5); assert.equal(d.percent_of_limit, 86);

    assert.equal(result.summary.fits_as_split, true, 'the re-split respects every band, matching the doc\'s stated result');
    assert.equal(result.summary.over_band.length, 0);
    for (const p of result.people) assert.equal(p.headroom_warning, undefined, 'nobody in the re-split is past the 90-95% headroom band');
  }
  ok('weightLedger reproduces the worked example\'s "re-split" table: every band respected, matching percentages, and no false headroom warnings at C\'s 94%');

  // ---- MIN/MAX plausible body weight are inclusive boundaries --------------
  // Regression coverage for the same off-by-one shape as the implausible-body-
  // weight test above, but at the documented range edges themselves: the
  // check is `< MIN || > MAX`, so the boundary values 20 and 300 must be
  // accepted, not rejected by a stray `<=`/`>=`.
  {
    assert.doesNotThrow(() => weightLedger([{ name: 'a', body_weight_kg: 20, band: 'typical' }]),
      '20 kg exactly is the documented lower edge and must be accepted');
    assert.throws(
      () => weightLedger([{ name: 'a', body_weight_kg: 19.99, band: 'typical' }]),
      (err) => err instanceof ToolError && err.code === 'implausible_body_weight',
      'just below 20 kg must still be rejected'
    );
    assert.doesNotThrow(() => weightLedger([{ name: 'a', body_weight_kg: 300, band: 'typical' }]),
      '300 kg exactly is the documented upper edge and must be accepted');
    assert.throws(
      () => weightLedger([{ name: 'a', body_weight_kg: 300.01, band: 'typical' }]),
      (err) => err instanceof ToolError && err.code === 'implausible_body_weight',
      'just above 300 kg must still be rejected'
    );
  }
  ok('the plausible body-weight range (20-300 kg) is inclusive at both edges, not off by one in either direction');

  // ---- band_percent may reach the band's ceiling exactly, never past it ----
  {
    // conditioned: percent { low: 25, high: 30 }
    assert.doesNotThrow(() => weightLedger([{ name: 'a', body_weight_kg: 100, band: 'conditioned', band_percent: 30 }]),
      'band_percent exactly at the 30% ceiling must be accepted, not rejected by a `>=` in place of `>`');
    assert.throws(
      () => weightLedger([{ name: 'a', body_weight_kg: 100, band: 'conditioned', band_percent: 30.01 }]),
      (err) => err instanceof ToolError && err.code === 'band_exceeded',
      'a hair past the ceiling must still be rejected'
    );
    assert.throws(
      () => weightLedger([{ name: 'a', body_weight_kg: 100, band: 'conditioned', band_percent: 0 }]),
      (err) => err instanceof ToolError && err.code === 'invalid_band_percent',
      'band_percent of exactly 0 must be rejected (the check is `<= 0`)'
    );
    assert.doesNotThrow(() => weightLedger([{ name: 'a', body_weight_kg: 100, band: 'conditioned', band_percent: 0.01 }]),
      'a small positive band_percent must be accepted');
  }
  ok('band_percent is accepted exactly at a band\'s documented ceiling and rejected exactly at 0, matching the `> high` / `<= 0` checks');

  // ---- the headroom warning boundary at exactly 95% -------------------------
  {
    const at95 = weightLedger([{ name: 'a', target_load_kg: 100, personal_kg: 95 }]);
    assert.equal(at95.people[0].headroom_warning, undefined, 'exactly 95% must not warn — the check is `> 95`, not `>= 95`');
    const at96 = weightLedger([{ name: 'a', target_load_kg: 100, personal_kg: 96 }]);
    assert.ok(at96.people[0].headroom_warning, 'the very next percentage point past 95% must warn');
  }
  ok('the headroom warning threshold is exclusive of 95% exactly, matching the `percent_of_limit > 95` check');

  // ---- the binding-constraint finding fires only once non-group kit exceeds the limit ----
  {
    const atLimit = weightLedger([{ name: 'a', target_load_kg: 10, personal_kg: 10 }]);
    assert.equal(atLimit.people[0].binding_constraint, undefined, 'non-group kit exactly equal to the limit is not yet a binding constraint — the check is strictly `>`');
    // === rather than assert.equal/Object.is: total exactly at the limit makes
    // overBy exactly 0, and round1(-0) is JS's negative zero — mathematically
    // still zero (and what JSON.stringify would serialise as "0"), but
    // assert.strict's Object.is-based equal() treats -0 and 0 as distinct.
    assert.ok(atLimit.people[0].headroom_kg === 0, 'total exactly at the limit reports zero headroom, not a (rounded-away) overage');
    assert.equal(atLimit.people[0].over_by_kg, undefined);

    const justOver = weightLedger([{ name: 'a', target_load_kg: 10, personal_kg: 10.2 }]);
    assert.ok(justOver.people[0].binding_constraint, 'non-group kit a fraction over the limit must be flagged as the binding constraint');
    assert.equal(justOver.people[0].over_by_kg, 0.2);
  }
  ok('binding_constraint and the over_by_kg/headroom_kg split both key off strict inequality at the limit, not off a rounded display figure');

  // ---- the aggregate-fit check is inclusive of an exact match ---------------
  {
    const exact = weightLedger([
      { name: 'a', target_load_kg: 10, personal_kg: 10 },
      { name: 'b', target_load_kg: 10, personal_kg: 10 },
    ]);
    assert.equal(exact.summary.fits_in_aggregate, true, 'a raw total exactly equal to the raw allowance must fit — the check is `<=`, not `<`');
  }
  ok('fits_in_aggregate is true when the raw total load exactly equals the raw allowance, not just when strictly under it');

  // ---- other rejected inputs -------------------------------------------------
  {
    assert.throws(
      () => weightLedger([{ name: 'a', personal_kg: 10 }]),
      (err) => err instanceof ToolError && err.code === 'no_limit_basis',
      'a person with neither body_weight_kg nor target_load_kg must be rejected, never defaulted to an assumed body weight'
    );
    assert.throws(
      () => weightLedger([{ name: 'a', body_weight_kg: 70, band: 'elite' }]),
      (err) => err instanceof ToolError && err.code === 'unknown_band'
    );
    assert.throws(
      () => weightLedger([{ name: 'a', target_load_kg: 10 }, { name: 'a', target_load_kg: 10 }]),
      (err) => err instanceof ToolError && err.code === 'duplicate_names'
    );
  }
  ok('weightLedger rejects a missing limit basis, an unknown conditioning band, and duplicate roster names');

  console.log(`\n${passed} weight.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
