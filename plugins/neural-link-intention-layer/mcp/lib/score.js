/**
 * The payback arithmetic of step 5, exactly as the reference states it:
 *
 *   value         = F x (K + C) / (S + R)
 *   payback_weeks = S x 1.3 / (F x (K + C))
 *
 * Pure arithmetic over caller-supplied terms. F must come from a log — this
 * function cannot check that, so it says so in every result rather than
 * pretending the number is validated.
 */

import { ToolError } from '../mcp-lite.js';
import { SCORING } from './method.js';
import { BREAK_EVEN } from './catalogue.js';

export function scoreCandidate({
  f_per_week,
  k_seconds,
  c_seconds = 0,
  setup_seconds,
  wrong_fire_p,
  wrong_fire_severity_seconds,
  stable_across_log,
}) {
  for (const [name, value] of [
    ['f_per_week', f_per_week],
    ['k_seconds', k_seconds],
    ['setup_seconds', setup_seconds],
  ]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new ToolError('invalid_term', `${name} must be a non-negative number.`);
    }
  }
  if (typeof c_seconds !== 'number' || !Number.isFinite(c_seconds) || c_seconds < 0) {
    throw new ToolError('invalid_term', 'c_seconds must be a non-negative number.');
  }
  if (f_per_week === 0 || k_seconds + c_seconds === 0) {
    throw new ToolError('invalid_term', 'F and K + C must both be above zero, or the payback is undefined.');
  }

  // R = (1 - p) x severity — only when both parts are supplied.
  let r = 0;
  if (wrong_fire_p != null || wrong_fire_severity_seconds != null) {
    if (
      typeof wrong_fire_p !== 'number' || wrong_fire_p < 0 || wrong_fire_p > 1 ||
      typeof wrong_fire_severity_seconds !== 'number' || wrong_fire_severity_seconds < 0
    ) {
      throw new ToolError(
        'invalid_term',
        'wrong_fire_p must be between 0 and 1 and wrong_fire_severity_seconds a non-negative number — supply both or neither.'
      );
    }
    r = (1 - wrong_fire_p) * wrong_fire_severity_seconds;
  }

  const perOccurrence = k_seconds + c_seconds;
  const value = (f_per_week * perOccurrence) / (setup_seconds + r);
  const paybackWeeks = (setup_seconds * SCORING.maintenance_factor) / (f_per_week * perOccurrence);
  const underThreshold = paybackWeeks < SCORING.payback_threshold_weeks;

  return {
    formulas: SCORING.formulas,
    terms: {
      F: f_per_week,
      K: k_seconds,
      C: c_seconds,
      S: setup_seconds,
      R: +r.toFixed(2),
      maintenance_factor: SCORING.maintenance_factor,
    },
    value: +value.toFixed(3),
    payback_weeks: +paybackWeeks.toFixed(2),
    seconds_saved_per_week: +(f_per_week * perOccurrence).toFixed(1),
    build_rule: SCORING.build_rule,
    payback_under_8_weeks: underThreshold,
    verdict: !underThreshold
      ? 'do_not_build — payback is 8 weeks or more'
      : stable_across_log === true
        ? 'build — payback under 8 weeks and the sequence stated stable across the whole log'
        : stable_across_log === false
          ? 'do_not_build — payback clears the threshold but the sequence is not stable across the log'
          : 'threshold_met_stability_unconfirmed — payback under 8 weeks; confirm the sequence is stable across the whole log before building',
    f_must_come_from_a_log:
      'F is only valid if read from a recorded command history. A frequency from recall recovers ' +
      'roughly half of what was actually done and is not a measurement.',
    typical_term_values: SCORING.terms,
    context_switch_note: SCORING.context_switch_note,
    break_even_reference: BREAK_EVEN,
  };
}
