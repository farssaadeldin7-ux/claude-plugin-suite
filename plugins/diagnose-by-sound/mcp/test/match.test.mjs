#!/usr/bin/env node
/**
 * Regression tests for lib/match.js's weighted signature matcher.
 *
 * There is no reference doc with a worked scoring example for this module
 * (frequency-bands.md and isolation-protocol.md only cover acoustics.js), so
 * the "worked example" here is instead computed independently by hand from
 * the module's own stated formulas (WEIGHTS, CONTRADICTION_PENALTY) against
 * the real mcp/data/signatures.json entries for the "wheels" system, and
 * cross-checked before being written as assertions -- not copied from a run
 * of the code.
 *
 *   node plugins/diagnose-by-sound/mcp/test/match.test.mjs
 */
import assert from 'node:assert/strict';
import {
  matchSignatures, discriminatingQuestions, safetyVerdict,
  normaliseObservation, rejectedTerms,
} from '../lib/match.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ==================== matchSignatures ====================================

  // ---- hand-computed worked example: wheel-bearing vs its two lookalikes -
  // WEIGHTS: character 3.0, changes_with 2.5, rhythm 2.0, occurs_when 1.5,
  // pitch 0.8, location 1.0 (sum 10.8). Observation answers all six
  // dimensions and, against signature "wheel-bearing"
  // (character:[hum,drone,roar,growl,rumble], pitch:[low,medium],
  // rhythm:[speed_linked,continuous], occurs_when:[cruising,highway_speed,
  // turning_left,turning_right], location:[front_left,front_right,rear_left,
  // rear_right,wheel_area,cabin], changes_with:[speed,steering]):
  //   character 'growl' matches      -> +3.0
  //   pitch 'high' contradicts       -> -0.8*0.7 = -0.56
  //   rhythm 'speed_linked' matches  -> +2.0
  //   occurs_when 'cruising' matches -> +1.5
  //   location 'engine_bay' contradicts -> -1.0*0.7 = -0.7
  //   changes_with 'speed' matches   -> +2.5
  //   score = 3.0 - 0.56 + 2.0 + 1.5 - 0.7 + 2.5 = 7.74
  //   maxScore = totalWeight = 10.8 (every dimension answered) -> evidenceFactor = 1.0
  //   fit = confidence = round(7.74 / 10.8 * 100) = round(71.666...) = 72
  // The same observation against "tyre-cupping" and "tyre-flat-spot-belt"
  // both contradict on character, pitch and location and match on rhythm,
  // occurs_when and changes_with, giving both score = -2.1-0.56+2.0+1.5-0.7+2.5
  // = 2.64 -> fit = confidence = round(2.64/10.8*100) = round(24.44) = 24 --
  // an exact tie, broken by severity (tyre-flat-spot-belt is "high",
  // tyre-cupping is "moderate", and higher severity ranks first).
  {
    const result = matchSignatures({
      character: ['growl'], pitch: ['high'], rhythm: ['speed_linked'],
      occurs_when: ['cruising'], location: ['engine_bay'], changes_with: ['speed'],
    }, { systemFilter: 'wheels' });

    assert.equal(result.coverage, 100);
    assert.equal(result.evidence_weight, 100);
    assert.equal(result.total_considered, 3);
    assert.equal(result.ranked.length, 3);

    const [first, second, third] = result.ranked;
    assert.equal(first.id, 'wheel-bearing');
    assert.equal(first.fit, 72);
    assert.equal(first.confidence, 72);
    assert.equal(first.raw_score, 7.74);

    assert.equal(second.id, 'tyre-flat-spot-belt', 'tied at fit 24 with tyre-cupping, but "high" severity ranks ahead of "moderate"');
    assert.equal(second.fit, 24);
    assert.equal(second.raw_score, 2.64);
    assert.equal(third.id, 'tyre-cupping');
    assert.equal(third.fit, 24);
    assert.equal(third.raw_score, 2.64);

    assert.equal(result.spread, 48, 'top_two_gap = 72 - 24');
  }
  ok('matchSignatures reproduces a hand-computed worked example exactly: wheel-bearing\'s score/fit/confidence against six answered dimensions, and the severity tie-break between two equal-fit lookalikes');

  // ---- confidence is damped by coverage even at a perfect fit ------------
  // Only 2 of 6 dimensions answered (character, changes_with), both matching
  // wheel-bearing: score = maxScore = 3.0+2.5 = 5.5 -> fit = 100.
  // evidenceFactor = 5.5/10.8 = 0.50926 -> confidence = round(100*0.50926) = 51.
  // coverage = round(2/6*100) = 33; evidence_weight = round(0.50926*100) = 51.
  {
    const result = matchSignatures({ character: ['growl'], changes_with: ['speed'] }, { systemFilter: 'wheels' });
    assert.equal(result.coverage, 33);
    assert.equal(result.evidence_weight, 51);
    assert.equal(result.ranked[0].id, 'wheel-bearing');
    assert.equal(result.ranked[0].fit, 100, 'a perfect match on the dimensions actually answered is still a perfect fit');
    assert.equal(result.ranked[0].confidence, 51, 'but confidence is damped to how much of the evidence was actually supplied -- fit and confidence must not be conflated');
  }
  ok('matchSignatures damps confidence by evidence coverage while leaving fit (the raw match quality) undamped, so a perfect-fit-on-little-evidence result cannot masquerade as a sure thing');

  // ---- partial credit within one dimension --------------------------------
  // character:['growl','squeal'] vs wheel-bearing's character list: only
  // 'growl' overlaps, so score = 3.0 * (1/2) = 1.5. maxScore = 3.0.
  // fit = round(1.5/3.0*100) = 50. evidenceFactor = 3.0/10.8 = 0.27778 ->
  // confidence = round(50*0.27778) = round(13.89) = 14.
  {
    const result = matchSignatures({ character: ['growl', 'squeal'] }, { systemFilter: 'wheels' });
    assert.equal(result.ranked[0].id, 'wheel-bearing');
    assert.equal(result.ranked[0].raw_score, 1.5);
    assert.equal(result.ranked[0].fit, 50, 'only half of the two supplied character values overlap the signature\'s list');
    assert.equal(result.ranked[0].confidence, 14);
    assert.equal(result.coverage, 17, 'round(1/6*100)');
    assert.equal(result.evidence_weight, 28, 'round((3.0/10.8)*100)');
  }
  ok('matchSignatures gives partial credit within a single dimension proportional to how many of the supplied values overlap the signature');

  // ---- nothing recognised answered -> no ranking, not a crash ------------
  {
    const result = matchSignatures({ character: ['not_a_real_term'] });
    assert.deepEqual(result.ranked, []);
    assert.equal(result.coverage, 0);
    assert.match(result.warning, /No usable observations/);
  }
  ok('matchSignatures returns an explicit warning and an empty ranking when nothing supplied was in the controlled vocabulary, rather than matching against nothing');

  // ==================== normaliseObservation / rejectedTerms ================

  // ---- the prototype-pollution guard: Object.hasOwn, not `vocabulary[v]` -
  // 'constructor' and 'toString' are inherited properties of any plain
  // object, including TAXONOMY.character -- so a naive `vocabulary[v]`
  // lookup would read them as truthy and silently accept them as real
  // vocabulary terms. Object.hasOwn must reject both. Also checks
  // case-folding ('GROWL' -> 'growl') and dash/space-to-underscore
  // normalisation ('Loose-fit' -> 'loose_fit', which is not itself a real
  // term and must still be rejected).
  {
    const raw = { character: ['constructor', 'toString', 'GROWL', 'Loose-fit'] };
    assert.deepEqual(normaliseObservation(raw).character, ['growl'],
      'constructor/toString/loose_fit must all be dropped as not-in-vocabulary, leaving only the real term');
    assert.deepEqual(rejectedTerms(raw).character, ['constructor', 'tostring', 'loose_fit'],
      'rejectedTerms normalises case the same way before reporting what was dropped');
  }
  ok('normaliseObservation and rejectedTerms reject inherited Object.prototype property names ("constructor", "toString") that a `vocabulary[v]` lookup would wrongly accept, and fold case/dashes consistently');

  // ---- a bare string (not an array) is still accepted ---------------------
  {
    assert.deepEqual(normaliseObservation({ character: 'growl' }).character, ['growl']);
  }
  ok('normaliseObservation accepts a single bare string value the same as a one-element array');

  // ==================== discriminatingQuestions =============================

  // ---- exact question set and order for two clearly-differing contenders -
  // Both candidates' 'character' sets are disjoint (squeal/screech/chirp vs
  // grind/grate/scrape), so 'character' (the highest-weighted dimension) is
  // the first dimension found to differ; its two discriminators from each
  // candidate, in candidate order, exactly fill the default max of 4.
  {
    const A = {
      id: 'brake-wear-indicator', fit: 80, label: 'A',
      discriminators: ['Does the noise go away when you press the brake pedal?', 'Is it there at low speed with the windows down, without braking?'],
    };
    const B = {
      id: 'brake-metal-on-metal', fit: 70, label: 'B',
      discriminators: ['Does it happen only while braking?', 'Do you feel it through the pedal?'],
    };
    const questions = discriminatingQuestions([A, B]);
    assert.deepEqual(questions, [
      { question: 'Does the noise go away when you press the brake pedal?', separates: 'A', dimension: 'character' },
      { question: 'Is it there at low speed with the windows down, without braking?', separates: 'A', dimension: 'character' },
      { question: 'Does it happen only while braking?', separates: 'B', dimension: 'character' },
      { question: 'Do you feel it through the pedal?', separates: 'B', dimension: 'character' },
    ]);
  }
  ok('discriminatingQuestions returns the exact question set and order for two contenders differing on the highest-weighted dimension, capped at 4');

  // ---- the "within 25 of the leader" contender cutoff, both sides --------
  {
    const A = { id: 'brake-wear-indicator', fit: 80, label: 'A', discriminators: ['q-a'] };
    const B_at_boundary = { id: 'brake-metal-on-metal', fit: 55, label: 'B', discriminators: ['q-b'] }; // 80-25 = 55 exactly
    const C_below_boundary = { id: 'brake-caliper-sticking', fit: 54, label: 'C', discriminators: ['q-c'] };

    const included = discriminatingQuestions([A, B_at_boundary, C_below_boundary]);
    assert.ok(included.some((q) => q.separates === 'B'), 'fit exactly 55 (leader.fit - 25) must be included -- the cutoff is inclusive (>=)');
    assert.ok(!included.some((q) => q.separates === 'C'), 'fit 54, one below the cutoff, must be excluded');

    const B_below_boundary = { ...B_at_boundary, fit: 54 };
    assert.deepEqual(discriminatingQuestions([A, B_below_boundary]), [],
      'with only one contender left in range, there is nothing to discriminate between -- must return no questions, not questions about a single candidate');
  }
  ok('discriminatingQuestions includes a contender exactly at the leader.fit-25 cutoff and excludes one just below it, and returns nothing when fewer than two contenders remain');

  // ---- fewer than two ranked candidates overall --------------------------
  {
    assert.deepEqual(discriminatingQuestions([]), []);
    assert.deepEqual(discriminatingQuestions([{ id: 'x', fit: 90, label: 'X', discriminators: ['q'] }]), []);
  }
  ok('discriminatingQuestions returns no questions for zero or one ranked candidates');

  // ==================== safetyVerdict =====================================

  // ---- the plausibility threshold boundary (default 35), both sides ------
  {
    const below = safetyVerdict([{ label: 'X', severity: 'moderate', fit: 34 }]);
    assert.equal(below.level, 'unknown', 'fit 34 is below the default threshold of 35 -- no candidate is plausible enough to judge safety from');

    const at = safetyVerdict([{ label: 'X', severity: 'moderate', fit: 35 }]);
    assert.equal(at.level, 'moderate', 'fit exactly 35 must be included -- the threshold is inclusive (>=)');
  }
  ok('safetyVerdict treats fit 34 as implausible and fit 35 as plausible, matching the inclusive default threshold');

  // ---- the "precautionary" note boundary at fit 60, both sides -----------
  {
    const at60 = safetyVerdict([{ label: 'X', severity: 'critical', fit: 60 }]);
    assert.equal(at60.note, null, 'fit exactly 60 must NOT be flagged precautionary -- the note only fires strictly below 60');

    const at59 = safetyVerdict([{ label: 'X', severity: 'critical', fit: 59 }]);
    assert.match(at59.note, /precautionary/);
  }
  ok('safetyVerdict\'s precautionary note fires for fit 59 but not for fit exactly 60');

  // ---- picks the single most severe plausible candidate, not the top fit -
  {
    const result = safetyVerdict([
      { label: 'Low1', severity: 'low', fit: 90 },
      { label: 'Critical1', severity: 'critical', fit: 40 },
      { label: 'High1', severity: 'high', fit: 70 },
    ]);
    assert.equal(result.level, 'critical');
    assert.equal(result.driven_by, 'Critical1', 'the worst-severity plausible candidate governs the advice even though it has the lowest fit of the three');
  }
  ok('safetyVerdict is driven by the worst severity among plausible candidates, not the highest-confidence one');

  // ---- a severity tie keeps the first-encountered candidate --------------
  // Regression-shaped: the reduce uses `<=`, so on an exact severityRank tie
  // the earlier array entry must win. A `<` instead would flip this to the
  // later entry.
  {
    const result = safetyVerdict([
      { label: 'First', severity: 'moderate', fit: 50 },
      { label: 'Second', severity: 'moderate', fit: 90 },
    ]);
    assert.equal(result.driven_by, 'First', 'on an exact severity tie, the first-encountered candidate must be reported, regardless of the other\'s higher fit');
  }
  ok('safetyVerdict keeps the first-encountered candidate on an exact severity tie rather than silently preferring a later one');

  // ---- exact advice text from taxonomy.json -------------------------------
  {
    const result = safetyVerdict([{ label: 'X', severity: 'critical', fit: 80 }]);
    assert.equal(result.advice, 'Stop driving. Have the vehicle recovered rather than driven.');
  }
  ok('safetyVerdict\'s advice text matches taxonomy.json\'s severity table exactly');

  console.log(`\n${passed} match.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
