#!/usr/bin/env node
/**
 * Regression tests for professor-mind-reader's domain logic: the
 * weight-to-effort arithmetic, the marks-at-stake scorecard, the verb-ladder
 * lookup, band-name validity, and the audit calibration tally.
 *
 * effortMap's core case is the worked decomposition example printed
 * verbatim in references/rubric-decomposition.md — turning that example
 * into an assertion is the point: a reference doc's own worked numbers are
 * a stronger check than hand-picked test data, because they were computed
 * once by a human for the doc and now have to agree with the code twice.
 *
 *   node plugins/professor-mind-reader/mcp/test/domain.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// audits.js creates its store (and resolves the config directory) at import
// time, so XDG_CONFIG_HOME must be set — and audits.js dynamically
// imported — before that happens. A static import of it here would be
// hoisted ahead of this assignment regardless of source order.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'professor-mind-reader-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { effortMap, ratioVerdict } = await import('../lib/effort.js');
const { scorecard, verdictIsValid } = await import('../lib/scorecard.js');
const { levelForVerb } = await import('../lib/ladder.js');
const { bandIsValid, bandIndex } = await import('../lib/bands.js');
const { logAudit, recordResult, reviewAudits } = await import('../lib/audits.js');

try {
  // ---- effortMap: the worked example from references/rubric-decomposition.md ----
  // Brief: 2,500 words; rubric A=20%, B=40%, C=25%, D=15%. The reference's
  // "Typical draft, audited" section reports 900/700/500/400 actual words
  // and ratios 1.8 / 0.7 / 0.8 / 1.07 — hand-verified here against the
  // formulas the same doc states (target = total x weight; ratio = actual /
  // target) before encoding them, so this is checking the code against an
  // independently-computed reference, not restating the code's own math.
  {
    const result = effortMap(2500, [
      { name: 'A', weight: 20, actual_words: 900 },
      { name: 'B', weight: 40, actual_words: 700 },
      { name: 'C', weight: 25, actual_words: 500 },
      { name: 'D', weight: 15, actual_words: 400 },
    ]);
    const [a, b, c, d] = result.criteria;

    assert.equal(a.target_words, 500);
    assert.equal(a.marks_per_100_words, 0.8);
    assert.equal(a.investment_ratio, 1.8);
    assert.equal(a.verdict, 'over_invested');

    assert.equal(b.target_words, 1000);
    assert.equal(b.marks_per_100_words, 1.6);
    assert.equal(b.investment_ratio, 0.7);
    assert.equal(b.verdict, 'thin');

    assert.equal(c.target_words, 625);
    assert.equal(c.marks_per_100_words, 1.0);
    assert.equal(c.investment_ratio, 0.8, 'C sits exactly on the on_budget/thin boundary in the worked example');
    assert.equal(c.verdict, 'on_budget');

    assert.equal(d.target_words, 375);
    assert.equal(d.marks_per_100_words, 0.6);
    assert.equal(d.investment_ratio, 1.07);
    assert.equal(d.verdict, 'on_budget');

    assert.equal(result.weight_sum_percent, 100);
    assert.equal(result.weight_warning, undefined, 'weights already sum to 100% and must not warn');
  }
  ok('effortMap reproduces the worked decomposition example in references/rubric-decomposition.md exactly: targets, marks-per-100-words, and investment ratios for a 900/700/500/400-word draft against a 20/40/25/15% rubric');

  // ---- effortMap: a criterion with no actual_words reports target only ---
  {
    const result = effortMap(1000, [{ name: 'X', weight: 50 }]);
    assert.equal(result.criteria[0].target_words, 500);
    assert.equal(result.criteria[0].actual_words, null);
    assert.equal(result.criteria[0].investment_ratio, null);
    assert.equal(result.criteria[0].verdict, undefined, 'no actual words means no verdict, not a guessed one');
  }
  ok('effortMap reports target-only, no ratio or verdict, when actual_words is omitted');

  // ---- effortMap: weights not summing to 100% warn but still compute -----
  {
    const result = effortMap(1000, [{ name: 'X', weight: 60 }, { name: 'Y', weight: 30 }]);
    assert.equal(result.weight_sum_percent, 90);
    assert.match(result.weight_warning, /90%, not 100%/);
  }
  ok('effortMap warns when a rubric\'s weights do not sum to 100%, rather than silently computing against a rubric that does not add up');

  // ---- ratioVerdict: the documented boundaries are inclusive on the lower edge ----
  // Regression coverage for exactly the kind of off-by-one a `>` vs `>=`
  // typo produces: the reference table reads "Above 1.5" for over_invested
  // and "1.5 to 1.2" for slightly_heavy, so 1.5 itself belongs to the lower
  // bucket, not the one it borders.
  {
    assert.equal(ratioVerdict(1.51).verdict, 'over_invested');
    assert.equal(ratioVerdict(1.5).verdict, 'slightly_heavy', '1.5 exactly is documented as "Above 1.5" excluded — it belongs to the 1.5-to-1.2 bucket');
    assert.equal(ratioVerdict(1.2).verdict, 'on_budget', '1.2 exactly belongs to the 1.2-to-0.8 bucket, not slightly_heavy');
    assert.equal(ratioVerdict(0.8).verdict, 'on_budget', '0.8 exactly belongs to the 1.2-to-0.8 bucket, not thin');
    assert.equal(ratioVerdict(0.79).verdict, 'thin');
    assert.equal(ratioVerdict(0.5).verdict, 'thin', '0.5 exactly belongs to the 0.8-to-0.5 bucket, not under_invested');
    assert.equal(ratioVerdict(0.49).verdict, 'under_invested');
  }
  ok('ratioVerdict places each documented boundary value in its lower bucket, matching the reference table\'s own "above"/"to" wording');

  // ---- scorecard: marks-at-stake, standing rules, and ranking ------------
  // A criterion at or above 20% weight that is unmet outranks everything
  // else regardless of effort (standing rule 1), ranked among themselves by
  // weight; everything else ranks by marks_at_stake / effort. A criterion at
  // or below 10% that is met is "finished" and excluded from ranking (it has
  // no marks at stake) but reported separately.
  {
    const sc = scorecard([
      { name: 'A', weight: 20, verdict: 'unmet', effort: 2 },
      { name: 'B', weight: 40, verdict: 'partially_met', effort: 1 },
      { name: 'C', weight: 10, verdict: 'met', effort: 1 },
      { name: 'D', weight: 30, verdict: 'unmet', effort: 5 },
    ]);

    const byName = Object.fromEntries(sc.criteria.map((r) => [r.criterion, r]));
    assert.equal(byName.A.marks_at_stake, 20); // 20 x 1.0 (unmet)
    assert.equal(byName.B.marks_at_stake, 20); // 40 x 0.5 (partially_met)
    assert.equal(byName.C.marks_at_stake, 0);  // met
    assert.equal(byName.D.marks_at_stake, 30); // 30 x 1.0 (unmet)

    assert.equal(byName.A.priority_override, true, 'A is 20% and unmet — the >=20%-and-unmet standing rule applies at the boundary');
    assert.equal(byName.D.priority_override, true);
    assert.equal(byName.B.priority_override, false, 'B is 40% but only partially_met, not unmet — the override is verdict-specific, not weight-specific');
    assert.equal(byName.C.finished, true, 'C is 10% and met — the <=10%-and-met standing rule applies at the boundary');

    assert.equal(sc.total_marks_at_stake, 70);
    assert.deepEqual(sc.finished_criteria, ['C']);
    // D and A both trigger the priority override (ranked by weight, D=30 > A=20,
    // regardless of D's higher effort); B never competes with them despite a
    // marks_at_stake/effort ratio (20/1=20) that would otherwise beat D's (30/5=6).
    assert.deepEqual(sc.ranked_fixes.map((r) => r.criterion), ['D', 'A', 'B'],
      'priority-override criteria must rank before all others regardless of effort, and among themselves by weight');
  }
  ok('scorecard applies both standing rules at their exact weight boundaries and ranks priority-override criteria ahead of a higher marks-at-stake/effort ratio');

  // ---- scorecard: the fix list is capped at five --------------------------
  {
    const many = Array.from({ length: 7 }, (_, i) => ({ name: `C${i}`, weight: 5, verdict: 'unmet', effort: 1 }));
    const sc = scorecard(many);
    assert.equal(sc.ranked_fixes.length, 5);
    assert.equal(sc.fixes_beyond_five, 2);
  }
  ok('scorecard caps ranked_fixes at five and reports how many were left off, rather than silently truncating');

  // ---- verdictIsValid -------------------------------------------------------
  {
    for (const v of ['met', 'partially_met', 'unmet']) assert.equal(verdictIsValid(v), true);
    for (const v of ['maybe', '', undefined, null]) assert.equal(verdictIsValid(v), false);
  }
  ok('verdictIsValid accepts exactly the three real verdicts and nothing else');

  // ---- levelForVerb: table lookup, case-insensitive, unrecognised -> null ----
  {
    assert.equal(levelForVerb('evaluate').level, 6);
    assert.equal(levelForVerb('Describe').level, 1, 'lookup must be case-insensitive');
    assert.equal(levelForVerb('  apply  ').level, 3, 'lookup must trim whitespace');
    assert.equal(levelForVerb('synthesise').level, 7);
    assert.equal(levelForVerb('yeet'), null, 'an unrecognised verb must return null, not guess a rung');
    assert.equal(levelForVerb(''), null);
    assert.equal(levelForVerb(undefined), null);
  }
  ok('levelForVerb looks up every rung correctly, case- and whitespace-insensitively, and returns null rather than guessing for an unrecognised verb');

  // ---- bandIsValid / bandIndex ----------------------------------------------
  {
    assert.equal(bandIsValid('first'), true);
    assert.equal(bandIsValid('starred_first'), false);
    assert.equal(bandIndex('fail'), 0);
    assert.equal(bandIndex('first'), 4);
  }
  ok('bandIsValid and bandIndex agree with the documented worst-to-best band order');

  // ---- audits: calibration tally against recorded outcomes ------------------
  // Regression-shaped coverage: the distance calculation must use min/max of
  // floor and ceiling (an audit can state either order) and must count "one
  // band outside" and "two or more outside" correctly relative to the range,
  // not to a single point estimate.
  {
    const a1 = logAudit({ assignment: 'essay1', band_floor: 'two_two', band_ceiling: 'two_one', total_marks_at_stake: 40 });
    const a2 = logAudit({ assignment: 'essay2', band_floor: 'two_two', band_ceiling: 'two_one', total_marks_at_stake: 40 });
    const a3 = logAudit({ assignment: 'essay3', band_floor: 'two_two', band_ceiling: 'two_one', total_marks_at_stake: 40 });
    const a4 = logAudit({ assignment: 'essay4', band_floor: 'two_one', band_ceiling: 'two_two', total_marks_at_stake: 40 }); // floor/ceiling given in reverse order
    assert.equal(a1.actual_band, null);

    recordResult(a1.id, { actual_band: 'two_two' }); // inside [two_two, two_one] -> within
    recordResult(a2.id, { actual_band: 'first' });   // one band above two_one -> one_band_outside
    recordResult(a3.id, { actual_band: 'fail' });    // two bands below two_two -> two_or_more_outside
    recordResult(a4.id, { actual_band: 'first' });   // reversed floor/ceiling must still read as [two_two, two_one] -> one_band_outside

    const review = reviewAudits();
    assert.equal(review.total_audits, 4);
    assert.equal(review.unresolved, 0);
    assert.equal(review.calibration.resolved, 4);
    assert.equal(review.calibration.within_range, 1);
    assert.equal(review.calibration.one_band_outside, 2);
    assert.equal(review.calibration.two_or_more_outside, 1);
  }
  ok('reviewAudits tallies within/one-band-outside/two-or-more-outside correctly, including when band_floor and band_ceiling are logged in reverse order');

  // ---- audits: an unresolved audit is excluded from calibration -------------
  {
    logAudit({ assignment: 'essay5', band_floor: 'third', band_ceiling: 'two_two', total_marks_at_stake: 10 });
    const review = reviewAudits();
    assert.equal(review.total_audits, 5);
    assert.equal(review.unresolved, 1);
    assert.equal(review.calibration.resolved, 4, 'an audit with no recorded actual_band must not enter the calibration tally');
  }
  ok('an audit with no recorded result is counted as unresolved and excluded from the calibration tally');

  console.log(`\n${passed} professor-mind-reader domain-logic checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
