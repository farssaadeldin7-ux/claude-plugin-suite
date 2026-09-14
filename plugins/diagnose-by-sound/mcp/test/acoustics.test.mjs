#!/usr/bin/env node
/**
 * Regression tests for lib/acoustics.js: checkCapture, matchOrders (the order
 * arithmetic) and planElimination (the staged elimination planner).
 *
 * matchOrders' core cases are the worked numbers printed verbatim in
 * references/frequency-bands.md ("3,000 RPM -> 50 Hz", "a 2-metre-circumference
 * tyre at 100 km/h turns ~14 times a second") — hand-verified against the
 * formulas that same doc states before being encoded here. planElimination's
 * cases are checked against the stage/silences/survives table in
 * references/isolation-protocol.md and ELIMINATION_TESTS itself.
 *
 *   node plugins/diagnose-by-sound/mcp/test/acoustics.test.mjs
 */
import assert from 'node:assert/strict';
import { checkCapture, matchOrders, planElimination, ELIMINATION_TESTS } from '../lib/acoustics.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- nothing described must never read as a clean five-of-five ---------
  // Regression test: `flag(condition === false, ...)` only fires on an
  // explicit false, so an unset field silently reads the same as one
  // confirmed good — calling checkCapture with nothing at all described
  // reported "No capture-rule failures", a clean pass, rather than saying
  // none of the five conditions were actually checked.
  {
    const result = checkCapture();
    assert.equal(result.conditions_checked, 0);
    assert.equal(result.conditions_not_described.length, 5);
    assert.notEqual(result.verdict, 'No capture-rule failures in the described conditions.', 'a checklist run with nothing described must not read as a clean pass');
  }
  ok('checkCapture with nothing described reports zero conditions checked, not a clean five-of-five');

  // ---- an explicit, fully-described clean capture still passes cleanly ---
  {
    const result = checkCapture({
      windows_closed: true, hvac_off: true, radio_off: true, phone_mounted: true, reproduced_live: true,
    });
    assert.equal(result.conditions_checked, 5);
    assert.equal(result.conditions_not_described, undefined);
    assert.equal(result.verdict, 'No capture-rule failures in the described conditions.');
  }
  ok('a fully and explicitly described clean capture still reports a genuine five-of-five pass');

  // ---- a partially described capture is neither a false pass nor silent --
  {
    const result = checkCapture({ windows_closed: false });
    assert.equal(result.conditions_checked, 1);
    assert.deepEqual(result.conditions_not_described.sort(), ['hvac_off', 'phone_mounted', 'radio_off', 'reproduced_live'].sort());
    assert.equal(result.findings.length, 1);
  }
  ok('a partially described capture reports exactly what was checked and names what was not');

  // ==================== matchOrders ====================================

  // ---- the doc's own worked example: "3,000 RPM -> 50 Hz" ----------------
  // Because half-crank rate is defined as RPM/120 (exactly half of crank
  // rate RPM/60), 2x half-crank always equals crank rate -- so a measurement
  // at the crank line will always show up as a second, order-2 match on the
  // half-crank base too. That is a real property of the domain (not a test
  // bug), and the accessory band (2-3x crank = 100-150 Hz) correctly does
  // NOT match 50 Hz at any order, since its band lower edge only grows.
  {
    const result = matchOrders({ measured_hz: 50, rpm: 3000 });
    assert.equal(result.measured_hz, 50);
    assert.equal(result.tolerance_pct, 10);

    const [crank, halfCrank, accessory] = result.candidate_rates;
    assert.equal(crank.source, 'crank rate');
    assert.equal(crank.hz, 50);
    assert.equal(crank.working, '3000 RPM / 60 = 50 Hz');
    assert.equal(halfCrank.hz, 25);
    assert.equal(halfCrank.working, '3000 RPM / 120 = 25 Hz');
    assert.deepEqual(accessory.band_hz, [100, 150], 'accessory band is 2x-3x crank with no pulley_ratio given');

    assert.equal(result.matches.length, 2, 'crank order 1 and half-crank order 2 both land on 50 Hz exactly');
    assert.equal(result.matches[0].source, 'crank rate');
    assert.equal(result.matches[0].order, 1);
    assert.equal(result.matches[0].expected_hz, 50);
    assert.equal(result.matches[1].source, 'camshaft / half-crank rate (valvetrain ticks)');
    assert.equal(result.matches[1].order, 2);
    assert.equal(result.matches[1].working, '3000 RPM / 120 = 25 Hz; × order 2 = 50 Hz');
    assert.ok(result.disambiguation, 'more than one match must surface the disambiguation note, not silently pick one');
  }
  ok('matchOrders reproduces the frequency-bands.md worked example ("3,000 RPM -> 50 Hz") exactly, including the crank/half-crank double match it correctly implies');

  // ---- the doc's other worked example: wheel rate at 100 km/h ~14 Hz -----
  {
    const result = matchOrders({ measured_hz: 13.89, speed_kmh: 100 });
    assert.equal(result.candidate_rates.length, 1);
    assert.equal(result.candidate_rates[0].source, 'wheel rate (assumed 2.0 m circumference)', 'omitting tyre_circumference_m must say so in the source label');
    assert.equal(result.candidate_rates[0].hz, 13.89, '100/3.6/2 = 13.888... rounds to 13.89, matching the doc\'s "~14 times a second"');
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].order, 1);
    assert.equal(result.disambiguation, undefined, 'a single match must not carry the multiple-matches disambiguation note');
  }
  ok('matchOrders reproduces the frequency-bands.md wheel-rate worked example (100 km/h, default 2.0 m tyre -> ~13.89 Hz) and labels the assumed circumference');

  // ---- tyre_circumference_m boundary: open interval (0.5, 4) -------------
  {
    assert.throws(() => matchOrders({ measured_hz: 10, speed_kmh: 50, tyre_circumference_m: 0.5 }), /looks wrong/, '0.5 exactly must be rejected — the bound is strictly greater-than');
    assert.doesNotThrow(() => matchOrders({ measured_hz: 10, speed_kmh: 50, tyre_circumference_m: 0.51 }));
    assert.throws(() => matchOrders({ measured_hz: 10, speed_kmh: 50, tyre_circumference_m: 4 }), /looks wrong/, '4 exactly must be rejected — the bound is strictly less-than');
    assert.doesNotThrow(() => matchOrders({ measured_hz: 10, speed_kmh: 50, tyre_circumference_m: 3.99 }));
  }
  ok('matchOrders rejects tyre_circumference_m exactly at 0.5 and 4 (the open-interval boundaries) and accepts values just inside them');

  // ---- tolerance_pct boundary: (0, 50] --------------------------------
  {
    assert.doesNotThrow(() => matchOrders({ measured_hz: 10, rpm: 1000, tolerance_pct: 50 }), '50 exactly is the documented upper bound and must be allowed (<=)');
    assert.throws(() => matchOrders({ measured_hz: 10, rpm: 1000, tolerance_pct: 50.01 }), /tolerance_pct must be between/);
    assert.throws(() => matchOrders({ measured_hz: 10, rpm: 1000, tolerance_pct: 0 }), /tolerance_pct must be between/, '0 must be rejected — the lower bound is strictly greater-than');
  }
  ok('matchOrders accepts tolerance_pct up to and including 50, and rejects 0 and anything above 50');

  // ---- other input validation --------------------------------------------
  {
    assert.throws(() => matchOrders({ measured_hz: 0, rpm: 1000 }), /positive number/, 'measured_hz of exactly 0 is not a positive number');
    assert.throws(() => matchOrders({ measured_hz: 10, rpm: 0 }), /rpm must be positive/);
    assert.throws(() => matchOrders({ measured_hz: 10 }), /at least one of rpm/, 'neither rpm nor speed_kmh supplied leaves nothing to compare against');
  }
  ok('matchOrders rejects a non-positive measurement, a non-positive rpm, and a call with neither rpm nor speed_kmh');

  // ==================== planElimination ====================================

  const ALL_TEST_IDS = ELIMINATION_TESTS.map((t) => t.id);
  const STAGE1_IDS = ELIMINATION_TESTS.filter((t) => t.stage === 1).map((t) => t.id);
  const STAGE2_IDS = ELIMINATION_TESTS.filter((t) => t.stage === 2).map((t) => t.id);

  // ---- no results recorded: the full protocol, stage-ordered -------------
  {
    const result = planElimination();
    assert.equal(result.tests_recorded, 0);
    assert.deepEqual(result.readings, []);
    assert.equal(result.derived_side, 'undecided');
    assert.deepEqual(result.next_tests.map((t) => t.id), [...STAGE1_IDS, ...STAGE2_IDS],
      'with no side derived yet, every test is offered, stage 1 before stage 2, in table order within each stage');
  }
  ok('planElimination with no results offers the whole protocol in stage order (5 stage-1 tests, then 7 stage-2 tests)');

  // ---- idle_parked survives -> engine_side narrows what is offered next --
  {
    const result = planElimination({ results: { idle_parked: 'survives' } });
    assert.equal(result.derived_side, 'engine_side');
    assert.deepEqual(result.next_tests.map((t) => t.id), ['engine_off', 'rev_neutral', 'hvac_sweep', 'ac_toggle', 'two_gears'],
      'engine_side narrows to the remaining stage-1 tests plus two_gears, not the rest of stage 2');
  }
  ok('planElimination narrows to stage-1-plus-two_gears once idle_parked survives, matching isolation-protocol.md\'s "engine, accessories or exhaust" reading');

  // ---- neutral_coast: survives -> road_side, gone -> engine_side ---------
  {
    const survives = planElimination({ results: { neutral_coast: 'survives' } });
    assert.equal(survives.derived_side, 'road_side');
    assert.deepEqual(survives.next_tests.map((t) => t.id),
      ['idle_parked', 'rev_neutral', 'two_gears', 'surface_change', 's_turns', 'brake_drag', 'throttle_lift', 'windows'],
      'road_side narrows stage 1 down to just idle_parked/rev_neutral (the two re-checks), plus the rest of stage 2');

    const gone = planElimination({ results: { neutral_coast: 'gone' } });
    assert.equal(gone.derived_side, 'engine_side');
    assert.deepEqual(gone.next_tests.map((t) => t.id), ['engine_off', 'idle_parked', 'rev_neutral', 'hvac_sweep', 'ac_toggle', 'two_gears']);
  }
  ok('planElimination reads neutral_coast survives as road_side and neutral_coast gone as engine_side, each narrowing the next tests differently');

  // ---- rev_neutral going quiet must NOT be read as a road_side result ----
  // Regression-shaped: only idle_parked/neutral_coast survives and
  // neutral_coast gone set a side directly. rev_neutral going quiet only
  // means "not purely RPM-linked" per the table -- it must not be silently
  // upgraded to a road-side conclusion.
  {
    const result = planElimination({ results: { rev_neutral: 'gone' } });
    assert.equal(result.readings[0].means, 'Not purely RPM-linked');
    assert.equal(result.derived_side, 'undecided', 'rev_neutral going quiet alone must not derive a side either way');
  }
  ok('planElimination leaves derived_side undecided when rev_neutral alone goes quiet, rather than inferring road_side');

  // ---- conflicting sides -> conflict flag, every test still on the table -
  {
    const result = planElimination({ results: { idle_parked: 'survives', neutral_coast: 'survives' } });
    assert.equal(result.derived_side, 'conflicting');
    assert.match(result.conflict_note, /two noises/);
    assert.deepEqual(result.next_tests.map((t) => t.id).sort(), ALL_TEST_IDS.filter((id) => id !== 'idle_parked' && id !== 'neutral_coast').sort(),
      'a conflict must not narrow the remaining tests at all -- everything is back on the table');
  }
  ok('planElimination flags a conflict when idle_parked and neutral_coast both survive (pointing at both sides) and stops narrowing next_tests');

  // ---- 'unchanged' is an alias for 'survives' -----------------------------
  {
    const result = planElimination({ results: { hvac_sweep: 'unchanged' } });
    assert.equal(result.readings[0].outcome, 'survives', 'the stored outcome must be normalised, not left as the raw "unchanged"');
    assert.equal(result.readings[0].means, 'Rate follows fan speed → blower motor or debris in the box');
  }
  ok('planElimination normalises the "unchanged" outcome alias to "survives" in the stored reading');

  // ---- invalid outcome / unknown test id ----------------------------------
  {
    assert.throws(() => planElimination({ results: { engine_off: 'maybe' } }), (err) => err.code === 'invalid_outcome');
    assert.throws(() => planElimination({ results: { not_a_real_test: 'survives' } }), (err) => err.code === 'unknown_test');
  }
  ok('planElimination rejects an unrecognised outcome and an unrecognised test id with distinct error codes');

  console.log(`\n${passed} acoustics.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
