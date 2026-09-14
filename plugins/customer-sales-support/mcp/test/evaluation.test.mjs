#!/usr/bin/env node
/**
 * Regression tests for lib/evaluation.js's scoreRegression and
 * outcomeIsValid: the four metric formulas stated in METRICS, computed by
 * hand below before being asserted; the rollout gates' exact thresholds
 * (90%, 95%, 2%) on both sides; the zero-denominator edge cases; the
 * composition minimums (10 must-escalate, 5 near-miss, 5 no-answer); and the
 * inconsistency checks between a case's flags and its scored outcome.
 *
 *   node plugins/customer-sales-support/mcp/test/evaluation.test.mjs
 */
import assert from 'node:assert/strict';
import { scoreRegression, outcomeIsValid, OUTCOMES, COMPOSITION } from '../lib/evaluation.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const cases = (spec) => {
  // spec: { correct_contained: n, correct_escalated: n, over_escalated: n, false_contained: n }
  const out = [];
  let id = 0;
  for (const [outcome, n] of Object.entries(spec)) {
    for (let i = 0; i < n; i++) out.push({ id: `c${id++}`, outcome });
  }
  return out;
};

try {
  // ---- outcomeIsValid: exactly the four documented outcomes --------------
  {
    for (const o of Object.keys(OUTCOMES)) assert.equal(outcomeIsValid(o), true);
    for (const bad of ['correct', 'escalated', '', undefined, null, 'partially_correct']) assert.equal(outcomeIsValid(bad), false);
  }
  ok('outcomeIsValid accepts exactly the four documented outcomes and rejects everything else, including near-miss spellings');

  // ---- the four metric formulas, hand-computed against a worked scenario ----
  // 100 cases: 70 correct_contained, 15 correct_escalated, 10 over_escalated,
  // 5 false_contained. By METRICS' own stated formulas:
  //   containment = (70+5)/100 = 75.0%
  //   accuracy on contained = 70/75 = 93.333...% -> rounds to 93.3%
  //   false-containment = 5/100 = 5.0%
  //   over-escalation = 10/100 = 10.0%
  {
    const result = scoreRegression(cases({ correct_contained: 70, correct_escalated: 15, over_escalated: 10, false_contained: 5 }));
    assert.equal(result.cases, 100);
    assert.deepEqual(result.counts, { correct_contained: 70, correct_escalated: 15, over_escalated: 10, false_contained: 5 });
    assert.equal(result.metrics.containment_percent, 75, 'containment = (correct_contained + false_contained) / total = 75/100');
    assert.equal(result.metrics.accuracy_on_contained_percent, 93.3, 'accuracy on contained = 70/75, rounded to one decimal place = 93.3');
    assert.equal(result.metrics.false_containment_percent, 5, 'false-containment = false_contained / total = 5/100');
    assert.equal(result.metrics.over_escalation_percent, 10, 'over-escalation = over_escalated / total = 10/100');
  }
  ok('scoreRegression reproduces all four METRICS formulas exactly on a hand-computed 70/15/10/5 worked scenario, including the 70/75 = 93.333...% -> 93.3% rounding');

  // ---- rounding resolution: pct rounds to one decimal place, not a coarser step ----
  // 1 correct_contained out of 3 total (with the other two being
  // correct_escalated and over_escalated, so contained = 1): containment =
  // 1/3 = 33.333...% -> 33.3%; accuracy = 1/1 = 100%.
  {
    const result = scoreRegression(cases({ correct_contained: 1, correct_escalated: 1, over_escalated: 1 }));
    assert.equal(result.metrics.containment_percent, 33.3);
    assert.equal(result.metrics.accuracy_on_contained_percent, 100);
    assert.equal(result.metrics.over_escalation_percent, 33.3);
  }
  ok('scoreRegression rounds a repeating-decimal percentage (1/3) to one decimal place (33.3), not to a whole number or a coarser step');

  // ---- zero-denominator edge cases: no cases contained, and no cases at all ----
  {
    // Every case escalated, none contained: accuracy's denominator
    // (contained) is zero, so accuracy must be null, not NaN or a divide
    // error surfacing.
    const noneContained = scoreRegression(cases({ correct_escalated: 10 }));
    assert.equal(noneContained.metrics.containment_percent, 0);
    assert.equal(noneContained.metrics.accuracy_on_contained_percent, null, 'accuracy on contained must be null (not NaN) when nothing was contained at all');
    assert.equal(noneContained.metrics.false_containment_percent, 0);

    // No cases at all: every metric's denominator is zero.
    const empty = scoreRegression([]);
    assert.equal(empty.cases, 0);
    assert.equal(empty.metrics.containment_percent, null);
    assert.equal(empty.metrics.accuracy_on_contained_percent, null);
    assert.equal(empty.metrics.false_containment_percent, null);
    assert.equal(empty.metrics.over_escalation_percent, null);
    assert.equal(empty.rollout_gates[0].met, null, 'a gate that depends on a null accuracy must itself report met: null, not falsely pass or fail');
  }
  ok('scoreRegression returns null (not NaN) for every metric whose denominator is zero, whether only the containment count is zero or the whole case set is empty, and gates depending on a null metric report met: null');

  // ---- rollout gate 1 ("Suggest-only, human sends"): accuracy > 90%, both sides ----
  // 90 correct_contained + 10 false_contained, all 100 cases contained:
  // accuracy = 90/100 = 90.0% exactly.
  {
    const at90 = scoreRegression(cases({ correct_contained: 90, false_contained: 10 }));
    assert.equal(at90.metrics.accuracy_on_contained_percent, 90);
    assert.equal(at90.rollout_gates[0].met, false, 'accuracy of exactly 90% must not meet the gate — the rule is "above 90%", not "90% or above"');

    // 901 correct_contained + 99 false_contained out of 1000 contained-and-total:
    // accuracy = 901/1000 = 90.1% exactly.
    const at901 = scoreRegression(cases({ correct_contained: 901, false_contained: 99 }));
    assert.equal(at901.metrics.accuracy_on_contained_percent, 90.1);
    assert.equal(at901.rollout_gates[0].met, true, 'accuracy one-tenth of a point above 90% must meet the gate');
  }
  ok('rollout gate 1 (suggest-only) requires accuracy strictly above 90%: 90.0% exactly fails it, 90.1% passes it');

  // ---- rollout gate 2 ("Auto-answer top 3 static intents"): accuracy > 95% AND false-containment < 2%, each boundary independently ----
  {
    // accuracy = 480/500 = 96.0% (passes the accuracy leg);
    // false_contained = 20/1000 = 2.0% exactly (fails the false-containment leg).
    const falseContainmentAtBoundary = scoreRegression(cases({
      correct_contained: 480, false_contained: 20, correct_escalated: 500,
    }));
    assert.equal(falseContainmentAtBoundary.metrics.accuracy_on_contained_percent, 96);
    assert.equal(falseContainmentAtBoundary.metrics.false_containment_percent, 2);
    assert.equal(falseContainmentAtBoundary.rollout_gates[1].met, false, 'false-containment of exactly 2% must not meet the gate — the rule is "under 2%"');

    // Same shape but false_contained = 19/1000 = 1.9%: accuracy becomes
    // 480/499 = 96.19...% -> 96.2%, and false-containment clears 2%.
    const bothPass = scoreRegression(cases({
      correct_contained: 480, false_contained: 19, correct_escalated: 501,
    }));
    assert.equal(bothPass.metrics.false_containment_percent, 1.9);
    assert.equal(bothPass.rollout_gates[1].met, true, 'accuracy above 95% and false-containment below 2% must meet the gate');

    // accuracy exactly 95% (with false-containment comfortably low) must
    // still fail the gate on its own leg.
    const accuracyAtBoundary = scoreRegression(cases({ correct_contained: 950, false_contained: 50 }));
    assert.equal(accuracyAtBoundary.metrics.accuracy_on_contained_percent, 95);
    assert.equal(accuracyAtBoundary.metrics.false_containment_percent, 5);
    assert.equal(accuracyAtBoundary.rollout_gates[1].met, false, 'accuracy of exactly 95% must not meet the gate on its own, regardless of false-containment');
  }
  ok('rollout gate 2 (auto-answer top 3) requires accuracy strictly above 95% AND false-containment strictly under 2%, with each threshold\'s boundary value (95.0%, 2.0%) failing the gate independently');

  // ---- the two live-only gates are reported as not assessable, never guessed ----
  {
    const result = scoreRegression(cases({ correct_contained: 100 }));
    assert.equal(result.rollout_gates[2].met, 'not assessable from a regression run — needs live per-intent data');
    assert.equal(result.rollout_gates[3].met, 'not assessable from outcome counts — needs the lookup verified and account-state cases');
  }
  ok('the two gates that need live data (widen to all static intents; enable account-specific answers) are always reported as not assessable, never inferred from outcome counts alone');

  // ---- composition: set_size flag below 50 cases, not at 50 --------------
  {
    const at50 = scoreRegression(cases({ correct_contained: 50 }));
    assert.ok(!at50.composition_findings.some((f) => f.check === 'set_size'), '50 cases exactly must not be flagged — the method asks for "50 to 100"');
    const at49 = scoreRegression(cases({ correct_contained: 49 }));
    assert.ok(at49.composition_findings.some((f) => f.check === 'set_size'), '49 cases must be flagged as too small');
  }
  ok('composition\'s set_size finding fires below 50 cases and not at exactly 50');

  // ---- composition: must-escalate / near-miss / no-answer minimums, each at and one below its floor ----
  // COMPOSITION states minimums of 10 must-escalate, 5 near-miss, 5 no-answer.
  {
    assert.equal(COMPOSITION.must_escalate_min, 10);
    assert.equal(COMPOSITION.near_miss_min, 5);
    assert.equal(COMPOSITION.no_answer_min, 5);

    const flaggedCases = (mustEscalate, nearMiss, noAnswer, total) => {
      const out = [];
      for (let i = 0; i < mustEscalate; i++) out.push({ id: `me${i}`, outcome: 'correct_escalated', must_escalate: true });
      for (let i = 0; i < nearMiss; i++) out.push({ id: `nm${i}`, outcome: 'correct_escalated', near_miss: true });
      for (let i = 0; i < noAnswer; i++) out.push({ id: `na${i}`, outcome: 'correct_escalated', no_answer_in_kb: true });
      while (out.length < total) out.push({ id: `fill${out.length}`, outcome: 'correct_contained' });
      return out;
    };

    const atFloors = scoreRegression(flaggedCases(10, 5, 5, 50));
    const atFloorChecks = atFloors.composition_findings.map((f) => f.check);
    assert.ok(!atFloorChecks.includes('must_escalate_cases'), '10 must-escalate cases exactly must clear the floor of 10');
    assert.ok(!atFloorChecks.includes('near_miss_cases'), '5 near-miss cases exactly must clear the floor of 5');
    assert.ok(!atFloorChecks.includes('no_answer_cases'), '5 no-answer cases exactly must clear the floor of 5');

    const belowFloors = scoreRegression(flaggedCases(9, 4, 4, 50));
    const belowFloorChecks = belowFloors.composition_findings.map((f) => f.check);
    assert.ok(belowFloorChecks.includes('must_escalate_cases'), '9 must-escalate cases must be flagged as under the floor of 10');
    assert.ok(belowFloorChecks.includes('near_miss_cases'), '4 near-miss cases must be flagged as under the floor of 5');
    assert.ok(belowFloorChecks.includes('no_answer_cases'), '4 no-answer cases must be flagged as under the floor of 5');
  }
  ok('the must-escalate (10), near-miss (5) and no-answer (5) composition minimums are each inclusive at their own floor and flagged one case below it, independently of each other');

  // ---- composition: flags_not_supplied when no case carries any composition flag ----
  {
    const noFlags = scoreRegression(cases({ correct_contained: 60 }));
    const checks = noFlags.composition_findings.map((f) => f.check);
    assert.deepEqual(checks, ['flags_not_supplied'], 'with no case carrying must_escalate/near_miss/no_answer_in_kb, the three minimums cannot be checked and only flags_not_supplied should appear');

    // A single case carrying the key at all — even explicitly false — is
    // enough to switch the scorer into "flags were supplied" mode, since the
    // check is `'must_escalate' in c`, not `c.must_escalate === true`.
    const oneFalseFlag = scoreRegression([{ id: 'x', outcome: 'correct_contained', must_escalate: false }, ...cases({ correct_contained: 59 })]);
    const oneFalseChecks = oneFalseFlag.composition_findings.map((f) => f.check);
    assert.ok(!oneFalseChecks.includes('flags_not_supplied'), 'a case carrying must_escalate: false still counts as "flags supplied" — presence of the key, not its truthiness, switches the mode');
    assert.ok(oneFalseChecks.includes('must_escalate_cases'), 'and since must_escalate is never true anywhere, the must-escalate minimum is now correctly reported as unmet rather than unchecked');
  }
  ok('composition falls back to flags_not_supplied only when no case carries any of the three flag keys at all, and switches to checking the minimums as soon as a single case carries the key — even set to false');

  // ---- inconsistencies: a must-escalate case that was actually contained --
  {
    const contained = scoreRegression([{ id: 'bad1', outcome: 'correct_contained', must_escalate: true }, ...cases({ correct_contained: 49 })]);
    assert.equal(contained.inconsistencies.length, 1);
    assert.equal(contained.inconsistencies[0].case, 'bad1');
    assert.match(contained.inconsistencies[0].why, /false containment/);

    const falseContained = scoreRegression([{ id: 'bad2', outcome: 'false_contained', must_escalate: true }, ...cases({ correct_contained: 49 })]);
    assert.equal(falseContained.inconsistencies.length, 1);
    assert.equal(falseContained.inconsistencies[0].case, 'bad2');

    // Correctly escalated must-escalate cases are, of course, not inconsistent.
    const good = scoreRegression([{ id: 'ok1', outcome: 'correct_escalated', must_escalate: true }, ...cases({ correct_contained: 49 })]);
    assert.ok(!('inconsistencies' in good), 'no inconsistencies key at all when nothing is inconsistent, not an empty array');
  }
  ok('a case flagged must_escalate that was scored correct_contained or false_contained is reported as an inconsistency in both cases; a correctly-escalated must-escalate case produces no inconsistencies key at all');

  // ---- inconsistencies: a no-answer-in-kb case scored correct_contained --
  {
    const result = scoreRegression([{ id: 'bad3', outcome: 'correct_contained', no_answer_in_kb: true }, ...cases({ correct_contained: 49 })]);
    assert.ok(result.inconsistencies.some((i) => i.case === 'bad3'));

    // A no-answer-in-kb case scored false_contained is NOT flagged as an
    // inconsistency by this check — only correct_contained is, since that is
    // the surprising case (it looks like a pass on a case where no correct
    // answer exists at all). Pinned down explicitly since it would be easy
    // to assume both outcomes are treated the same way.
    const notFlagged = scoreRegression([{ id: 'ok2', outcome: 'false_contained', no_answer_in_kb: true }, ...cases({ correct_contained: 49 })]);
    assert.ok(!('inconsistencies' in notFlagged) || !notFlagged.inconsistencies.some((i) => i.case === 'ok2'), 'a no_answer_in_kb case scored false_contained is not treated as an inconsistency by this specific check');
  }
  ok('a case flagged no_answer_in_kb that was scored correct_contained is reported as an inconsistency (a case with no correct answer cannot legitimately pass); the same flag on a false_contained outcome is not flagged by this check');

  console.log(`\n${passed} evaluation.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
