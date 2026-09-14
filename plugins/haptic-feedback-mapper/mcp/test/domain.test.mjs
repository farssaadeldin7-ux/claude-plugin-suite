#!/usr/bin/env node
/**
 * Regression tests for lib/load.js, lib/classes.js and lib/vocabulary.js —
 * the pure arithmetic and mechanical-audit logic (no filesystem state).
 * lib/sessions.js (the local session log) is covered separately in
 * sessions.test.mjs because it needs an isolated XDG_CONFIG_HOME per
 * scenario.
 *
 *   node plugins/haptic-feedback-mapper/mcp/test/domain.test.mjs
 */
import assert from 'node:assert/strict';
import { computeLoad } from '../lib/load.js';
import { auditMapping, ACT_NOW_CEILING } from '../lib/classes.js';
import { checkVocabulary, PATTERN_LIMITS } from '../lib/vocabulary.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ==========================================================================
  // computeLoad (lib/load.js)
  // ==========================================================================

  // ---- the worked pitch example from SKILL.md / README.md -----------------
  // "For a freelance artist billing $75/hour, even 20 glance-level checks a
  // day at the 2-minute floor is ~3 hours a week — roughly $10k a year of
  // attention." Hand-verified against the doc's own formula (weekly cost =
  // checks/day x refocus minutes x working days) at the DEFAULTS (5 working
  // days/week, 46 working weeks/year) before encoding it:
  //   minutes/day = 20 x 2 = 40
  //   hours/week  = (40 x 5) / 60 = 3.333... -> 3.3 (matches "~3 hours a week")
  //   hours/year  = 3.333... x 46 = 153.333... -> 153.3
  //   cost/week   = 3.333... x 75 = 250
  //   cost/year   = 153.333... x 75 = 11500 (the doc's "roughly $10k" is a
  //     loose, round-down description of this exact figure -- see report)
  // The literature bound (15 min default) is also hand-computed independently
  // from the same formula, not copied from running the code:
  //   minutes/day = 20 x 15 = 300; hours/week = 300x5/60 = 25; hours/year = 1150
  //   cost/week = 1875; cost/year = 86250
  {
    const result = computeLoad({ checks_per_day: 20, hourly_rate: 75 });
    assert.equal(result.bounds.length, 2, 'no custom refocus_minutes given -> conservative_floor and literature only');

    const floor = result.bounds.find((b) => b.figure === 'conservative_floor');
    assert.equal(floor.refocus_minutes_per_switch, 2);
    assert.equal(floor.minutes_per_day, 40);
    assert.equal(floor.hours_per_week, 3.3);
    assert.equal(floor.hours_per_year, 153.3);
    assert.equal(floor.cost_per_week, 250);
    assert.equal(floor.cost_per_year, 11500);

    const lit = result.bounds.find((b) => b.figure === 'literature');
    assert.equal(lit.refocus_minutes_per_switch, 15);
    assert.equal(lit.minutes_per_day, 300);
    assert.equal(lit.hours_per_week, 25);
    assert.equal(lit.hours_per_year, 1150);
    assert.equal(lit.cost_per_week, 1875);
    assert.equal(lit.cost_per_year, 86250);

    assert.equal(result.assumptions.working_days_per_week, 5);
    assert.equal(result.assumptions.working_weeks_per_year, 46);
    assert.equal(result.assumptions.hourly_rate, 75);
    assert.equal(result.assumptions.currency, 'unspecified', 'currency defaults to "unspecified" when not given, rather than being omitted');
  }
  ok('computeLoad reproduces the SKILL.md/README.md pitch example (20 checks/day at $75/hr) exactly at both bounds, hand-verified against the stated formula');

  // ---- a caller-supplied refocus_minutes adds a third, "custom" bound -----
  // Hand-computed independently: 10 checks/day x 3 min = 30 min/day;
  // hours/week = 30x5/60 = 2.5; hours/year = 2.5x46 = 115. No hourly_rate
  // given, so no cost fields anywhere.
  {
    const result = computeLoad({ checks_per_day: 10, refocus_minutes: 3 });
    assert.equal(result.bounds.length, 3, 'a custom refocus_minutes adds a third bound alongside conservative_floor and literature');
    assert.equal(result.bounds[0].figure, 'custom', 'the custom bound is reported first');
    assert.equal(result.bounds[0].refocus_minutes_per_switch, 3);
    assert.equal(result.bounds[0].minutes_per_day, 30);
    assert.equal(result.bounds[0].hours_per_week, 2.5);
    assert.equal(result.bounds[0].hours_per_year, 115);
    assert.equal(result.bounds[0].cost_per_week, undefined, 'no hourly_rate given -> no cost fields on any bound');
    assert.equal(result.bounds[1].figure, 'conservative_floor');
    assert.equal(result.bounds[2].figure, 'literature');
    assert.equal(result.assumptions.hourly_rate, undefined);
    assert.equal(result.assumptions.currency, undefined, 'currency is omitted entirely (not "unspecified") when hourly_rate itself was never given');
  }
  ok('computeLoad adds a "custom" bound first when refocus_minutes is supplied, and omits every cost field when hourly_rate is omitted');

  // ---- validation boundaries: checks_per_day, working_days_per_week, -----
  // ---- working_weeks_per_year, hourly_rate, refocus_minutes --------------
  {
    assert.throws(() => computeLoad({ checks_per_day: 0 }), (e) => e instanceof ToolError && e.code === 'invalid_request', 'checks_per_day of exactly 0 must be rejected');
    assert.throws(() => computeLoad({ checks_per_day: -5 }), (e) => e instanceof ToolError && e.code === 'invalid_request');
    assert.doesNotThrow(() => computeLoad({ checks_per_day: 0.01 }), 'a tiny positive checks_per_day is still valid');

    assert.throws(() => computeLoad({ checks_per_day: 5, working_days_per_week: 0 }), (e) => e instanceof ToolError && e.code === 'invalid_request');
    assert.equal(computeLoad({ checks_per_day: 5, working_days_per_week: 7 }).assumptions.working_days_per_week, 7, '7 is the documented upper edge of a working week and must be accepted');
    assert.throws(() => computeLoad({ checks_per_day: 5, working_days_per_week: 8 }), (e) => e instanceof ToolError && e.code === 'invalid_request', '8 days in a week is impossible and must be rejected, one past the accepted boundary');

    assert.throws(() => computeLoad({ checks_per_day: 5, working_weeks_per_year: 0 }), (e) => e instanceof ToolError && e.code === 'invalid_request');
    assert.equal(computeLoad({ checks_per_day: 5, working_weeks_per_year: 52 }).assumptions.working_weeks_per_year, 52, '52 weeks is the full-year boundary and must be accepted');
    assert.throws(() => computeLoad({ checks_per_day: 5, working_weeks_per_year: 53 }), (e) => e instanceof ToolError && e.code === 'invalid_request', 'more than 52 weeks in a year is impossible and must be rejected');

    assert.throws(() => computeLoad({ checks_per_day: 5, hourly_rate: 0 }), (e) => e instanceof ToolError && e.code === 'invalid_request');
    assert.throws(() => computeLoad({ checks_per_day: 5, hourly_rate: -10 }), (e) => e instanceof ToolError && e.code === 'invalid_request');

    assert.throws(() => computeLoad({ checks_per_day: 5, refocus_minutes: 0 }), (e) => e instanceof ToolError && e.code === 'invalid_request');
  }
  ok('computeLoad rejects checks_per_day <= 0, working_days_per_week outside 1-7, working_weeks_per_year outside 1-52, non-positive hourly_rate and non-positive refocus_minutes, accepting the boundary values (7 days, 52 weeks) themselves');

  // ==========================================================================
  // auditMapping (lib/classes.js)
  // ==========================================================================

  // ---- a hand-verified mapping exercising every finding rule at once ------
  // 8 events: 3 act_now (one missing its haptic), 1 done (fine), 2 ambient
  // (one wrongly carrying a haptic), 2 noise (one wrongly carrying a haptic).
  // Hand-traced against the code's own rules before running it:
  //   - act_now/"export blocked" has no haptic -> haptic_class_without_haptic
  //   - ambient/"queue position moved" carries a haptic -> ambient_is_silent_by_default
  //   - noise/"likes" carries a haptic -> noise_gets_nothing
  //   - everything else is clean -> exactly 3 findings, no ceiling finding
  //     (3 act_now events is under the ceiling of 5)
  //   - distribution: act_now 3, done 1, ambient 2, noise 2 (total 8)
  //   - quiet_share = (ambient 2 + noise 2) / 8 = 0.5
  {
    const result = auditMapping({
      events: [
        { event: 'render failed', class: 'act_now', haptic: true, decision_fed: 'stop and fix the render' },
        { event: 'client approved', class: 'act_now', haptic: true },
        { event: 'export blocked', class: 'act_now' }, // no haptic recorded
        { event: 'queue position moved', class: 'ambient', haptic: true }, // ambient carrying a haptic
        { event: 'likes', class: 'noise', haptic: 'buzz' }, // noise carrying a haptic
        { event: '50% rendered', class: 'ambient' },
        { event: 'export complete', class: 'done', haptic: true },
        { event: 'newsletter', class: 'noise' },
      ],
    });

    assert.equal(result.events_audited, 8);
    assert.deepEqual(result.distribution, { act_now: 3, done: 1, ambient: 2, noise: 2 });
    assert.equal(result.quiet_share, 0.5);
    assert.equal(result.finding_count, 3);

    const rules = result.findings.map((f) => f.rule).sort();
    assert.deepEqual(rules, ['ambient_is_silent_by_default', 'haptic_class_without_haptic', 'noise_gets_nothing']);

    const byRule = Object.fromEntries(result.findings.map((f) => [f.rule, f]));
    assert.equal(byRule.haptic_class_without_haptic.event, 'export blocked');
    assert.equal(byRule.ambient_is_silent_by_default.event, 'queue position moved');
    assert.equal(byRule.noise_gets_nothing.event, 'likes');
  }
  ok('auditMapping flags exactly the three violations in a hand-traced 8-event mapping (a haptic-class event missing its haptic, an ambient event and a noise event each wrongly carrying one) and computes distribution/quiet_share correctly');

  // ---- the act-now ceiling boundary: "more than a handful (flags more -----
  // ---- than 5)" from DISTRIBUTION_NOTE, i.e. > ACT_NOW_CEILING, not >= ----
  {
    assert.equal(ACT_NOW_CEILING, 5, 'the doc-quoted ceiling must still be 5');
    const cleanEvent = (i) => ({ event: `act-now-${i}`, class: 'act_now', haptic: true, decision_fed: 'do something' });

    const atCeiling = auditMapping({ events: Array.from({ length: ACT_NOW_CEILING }, (_, i) => cleanEvent(i)) });
    assert.equal(atCeiling.distribution.act_now, 5);
    assert.equal(atCeiling.finding_count, 0, 'exactly 5 act_now events is at the ceiling, not past it, and must not be flagged');

    const overCeiling = auditMapping({ events: Array.from({ length: ACT_NOW_CEILING + 1 }, (_, i) => cleanEvent(i)) });
    assert.equal(overCeiling.distribution.act_now, 6);
    assert.equal(overCeiling.finding_count, 1);
    assert.equal(overCeiling.findings[0].rule, 'act_now_ceiling', 'one event past the ceiling must be flagged');
  }
  ok('auditMapping flags the act-now ceiling only strictly past 5 events, not at exactly 5 — matching the DISTRIBUTION_NOTE\'s "more than 5" wording');

  // ---- the no_decision_fed rule fires only when decision_fed was given ----
  // ---- and is blank, not when it was simply omitted -----------------------
  {
    const blank = auditMapping({ events: [{ event: 'render failed', class: 'act_now', haptic: true, decision_fed: '   ' }] });
    assert.equal(blank.findings.some((f) => f.rule === 'no_decision_fed'), true, 'a decision_fed present but blank on a haptic-class event must be flagged');

    const omitted = auditMapping({ events: [{ event: 'render failed', class: 'act_now', haptic: true }] });
    assert.equal(omitted.findings.some((f) => f.rule === 'no_decision_fed'), false, 'decision_fed simply never supplied must not be treated as blank');
  }
  ok('auditMapping\'s no_decision_fed rule distinguishes an explicitly blank decision_fed from one that was never supplied');

  // ---- request-shape errors -------------------------------------------------
  {
    assert.throws(() => auditMapping({ events: [] }), (e) => e instanceof ToolError && e.code === 'invalid_request');
    assert.throws(() => auditMapping({ events: [{ event: 'x', class: 'urgent' }] }), (e) => e instanceof ToolError && e.code === 'unknown_class');
    assert.throws(() => auditMapping({ events: [{ class: 'act_now' }] }), (e) => e instanceof ToolError && e.code === 'invalid_request', 'an event with no label must be rejected');
  }
  ok('auditMapping rejects an empty events array, an unrecognised class, and an event with no label');

  // ==========================================================================
  // checkVocabulary (lib/vocabulary.js)
  // ==========================================================================

  // ---- a hand-verified 5-pattern set exercising duplicate_meaning, --------
  // ---- pattern_collision and intensity_only_difference at once ------------
  // Patterns a and d are identical on meaning ("done") AND on all three axes
  // (count 1, intensity low, rhythm even) -> both duplicate_meaning and
  // pattern_collision. Patterns b and e share count (2) and rhythm
  // ("long-short") but differ only in intensity (high vs medium) ->
  // intensity_only_difference. Pattern c is the sole failure pattern with a
  // count (3) no one else uses, so it is not confusable. Hand-traced against
  // the pairwise-comparison code before running it.
  {
    const patterns = [
      { id: 'a', meaning: 'done', count: 1, intensity: 'low', rhythm: 'even' },
      { id: 'b', meaning: 'act_now', count: 2, intensity: 'high', rhythm: 'long-short' },
      { id: 'c', meaning: 'failure', count: 3, intensity: 'high', rhythm: 'rising', is_failure: true },
      { id: 'd', meaning: 'done', count: 1, intensity: 'low', rhythm: 'even' },
      { id: 'e', meaning: 'queue moved', count: 2, intensity: 'medium', rhythm: 'long-short' },
    ];
    const result = checkVocabulary({ patterns });

    assert.equal(result.patterns_checked, 5);
    assert.equal(result.within_limits, true, '5 patterns is at PATTERN_LIMITS.max, still within limits');
    assert.equal(result.finding_count, 3);

    const rules = result.findings.map((f) => f.rule).sort();
    assert.deepEqual(rules, ['duplicate_meaning', 'intensity_only_difference', 'pattern_collision']);

    const byRule = Object.fromEntries(result.findings.map((f) => [f.rule, f]));
    assert.deepEqual(byRule.duplicate_meaning.patterns.sort(), ['a', 'd']);
    assert.deepEqual(byRule.pattern_collision.patterns.sort(), ['a', 'd']);
    assert.deepEqual(byRule.intensity_only_difference.patterns.sort(), ['b', 'e']);
    assert.equal(result.findings.some((f) => f.rule === 'no_failure_pattern'), false, 'c is marked is_failure, so no_failure_pattern must not fire');
    assert.equal(result.findings.some((f) => f.rule === 'failure_confusable'), false, 'c\'s count (3) is unique, so it must not be flagged as confusable');
  }
  ok('checkVocabulary flags a hand-traced duplicate meaning, an exact 3-axis collision and an intensity-only pair in a 5-pattern set, while leaving the correctly-marked, non-confusable failure pattern alone');

  // ---- the 5-pattern ceiling boundary --------------------------------------
  {
    assert.equal(PATTERN_LIMITS.max, 5);
    const distinctPattern = (i, isFailure) => ({ id: `p${i}`, meaning: `m${i}`, count: i, intensity: 'low', rhythm: `r${i}`, is_failure: isFailure === true });

    const atMax = checkVocabulary({ patterns: [1, 2, 3, 4, 5].map((i) => distinctPattern(i, i === 5)) });
    assert.equal(atMax.within_limits, true);
    assert.equal(atMax.finding_count, 0, 'exactly 5 distinct, non-colliding patterns must not be flagged as too many');

    const overMax = checkVocabulary({ patterns: [1, 2, 3, 4, 5, 6].map((i) => distinctPattern(i, i === 5)) });
    assert.equal(overMax.within_limits, false, '6 patterns is past PATTERN_LIMITS.max');
    assert.equal(overMax.finding_count, 1);
    assert.equal(overMax.findings[0].rule, 'too_many_patterns');
  }
  ok('checkVocabulary accepts exactly 5 distinct patterns but flags too_many_patterns at 6, one past the documented 3-5 limit');

  // ---- the count-axis boundary: 0 is not a recorded count, 1 is -----------
  {
    const zeroCount = checkVocabulary({ patterns: [
      { id: 'x', meaning: 'done', count: 0, intensity: 'low', rhythm: 'even', is_failure: true },
      { id: 'y', meaning: 'act_now', count: 2, intensity: 'high', rhythm: 'rising' },
    ] });
    assert.equal(zeroCount.findings.some((f) => f.rule === 'axes_incomplete' && f.pattern === 'x'), true, 'a count of exactly 0 must be treated as no count recorded');

    const oneCount = checkVocabulary({ patterns: [
      { id: 'x', meaning: 'done', count: 1, intensity: 'low', rhythm: 'even', is_failure: true },
      { id: 'y', meaning: 'act_now', count: 2, intensity: 'high', rhythm: 'rising' },
    ] });
    assert.equal(oneCount.findings.some((f) => f.rule === 'axes_incomplete'), false, 'a count of exactly 1 is a valid recorded count');
  }
  ok('checkVocabulary treats a count of 0 as unrecorded (axes_incomplete) but a count of 1 as valid, at the exact boundary');

  // ---- no_failure_pattern and failure_confusable ---------------------------
  {
    const noFailure = checkVocabulary({ patterns: [
      { id: 'x', meaning: 'done', count: 1, intensity: 'low', rhythm: 'even' },
      { id: 'y', meaning: 'act_now', count: 2, intensity: 'high', rhythm: 'rising' },
    ] });
    assert.equal(noFailure.findings.some((f) => f.rule === 'no_failure_pattern'), true, 'no pattern marked is_failure must be flagged');

    const confusable = checkVocabulary({ patterns: [
      { id: 'x', meaning: 'done', count: 2, intensity: 'low', rhythm: 'even' },
      { id: 'y', meaning: 'failure', count: 2, intensity: 'high', rhythm: 'rising', is_failure: true },
    ] });
    assert.equal(confusable.findings.some((f) => f.rule === 'failure_confusable'), true, 'a failure pattern sharing its count with a non-failure pattern must be flagged, even with different intensity/rhythm');
  }
  ok('checkVocabulary flags a vocabulary with no marked failure pattern, and separately flags a failure pattern that shares its tap count with a success pattern');

  // ---- request-shape errors -------------------------------------------------
  {
    assert.throws(() => checkVocabulary({ patterns: [] }), (e) => e instanceof ToolError && e.code === 'invalid_request');
    assert.throws(() => checkVocabulary({ patterns: [{ meaning: 'done', count: 1 }] }), (e) => e instanceof ToolError && e.code === 'invalid_request', 'a pattern with no id must be rejected');
  }
  ok('checkVocabulary rejects an empty patterns array and a pattern with no id');

  console.log(`\n${passed} haptic-feedback-mapper domain-logic checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
