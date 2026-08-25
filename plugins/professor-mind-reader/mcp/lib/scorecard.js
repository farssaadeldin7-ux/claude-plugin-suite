/**
 * Marks-at-stake arithmetic and fix ranking, from the skill's audit table and
 * references/rubric-decomposition.md's standing rules:
 *
 *   marks at stake = weight x gap, where unmet = 1.0, partially met = 0.5, met = 0
 *   fix ranking    = marks at stake / effort, after the standing rules
 *
 * The verdicts themselves — met, partially met, unmet, each backed by a
 * verbatim quote or the absence of one — are the audit's judgement and are
 * supplied as input. This module only does the counting and the ordering.
 */

import { STANDING_RULES } from './effort.js';

export const VERDICT_GAPS = { met: 0, partially_met: 0.5, unmet: 1.0 };

export function verdictIsValid(verdict) {
  return Object.hasOwn(VERDICT_GAPS, verdict);
}

const round = (value) => Math.round(value * 100) / 100;

/**
 * @param {Array<{name: string, weight: number, verdict: string,
 *                fix?: string, effort?: number}>} criteria
 *   weight as a percentage; effort 1 (quick) to 5 (a rewrite), defaulting to 1.
 */
export function scorecard(criteria) {
  const rows = criteria.map((criterion) => {
    const gap = VERDICT_GAPS[criterion.verdict];
    const effort = criterion.effort ?? 1;
    return {
      criterion: criterion.name,
      weight_percent: criterion.weight,
      verdict: criterion.verdict,
      marks_at_stake: round(criterion.weight * gap),
      effort,
      ...(criterion.fix ? { fix: criterion.fix } : {}),
      // Standing rule 1: a criterion at or above 20% that is unmet outranks
      // every other fix, regardless of effort.
      priority_override: criterion.weight >= 20 && criterion.verdict === 'unmet',
      // Standing rule 2: at or below 10% and met is finished.
      finished: criterion.weight <= 10 && criterion.verdict === 'met',
    };
  });

  const ranked = rows
    .filter((row) => row.marks_at_stake > 0)
    .sort((a, b) => {
      if (a.priority_override !== b.priority_override) return a.priority_override ? -1 : 1;
      if (a.priority_override && b.priority_override) return b.weight_percent - a.weight_percent;
      return b.marks_at_stake / b.effort - a.marks_at_stake / a.effort;
    });

  return {
    criteria: rows,
    total_marks_at_stake: round(rows.reduce((sum, row) => sum + row.marks_at_stake, 0)),
    finished_criteria: rows.filter((row) => row.finished).map((row) => row.criterion),
    // The skill's fix list is five items maximum; anything past five is noise.
    ranked_fixes: ranked.slice(0, 5),
    ...(ranked.length > 5
      ? { fixes_beyond_five: ranked.length - 5, note: 'The fix list is capped at five items; address these before revisiting the rest.' }
      : {}),
    ranking_rule: 'Ranked by marks at stake divided by effort (effort defaults to 1 where not supplied), ' +
      'after the standing rules.',
    standing_rules: STANDING_RULES,
  };
}
