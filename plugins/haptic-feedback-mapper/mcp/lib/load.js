import { ToolError } from '../mcp-lite.js';

/**
 * The refocus-cost figures the skill computes with, as data, and the baseline
 * / Deep-Work Protection arithmetic: checks x refocus minutes x working days
 * x the buyer's own rate, run at both stated bounds with every assumption
 * echoed back. Arithmetic only — nothing here measures a session, and the
 * projection is labelled a projection until an after-measurement exists.
 */

export const REFOCUS_FIGURES = {
  conservative_floor: {
    minutes: [1, 5],
    default_minutes: 2,
    basis:
      'A defensible floor for a glance-level switch: the check itself plus re-finding the working ' +
      'state. Use this bound in anything a buyer will scrutinise.',
  },
  literature: {
    minutes: [10, 23],
    default_minutes: 15,
    basis:
      'The commonly cited range for full refocus after an interruption in the task-switching ' +
      'literature. It studied office work, not studio work — borrow it as an upper bound, never ' +
      'as a measurement.',
  },
  rule:
    'State which figure you used and why, every time a number appears. Compute with the ' +
    'conservative floor and the literature figure both; even the floor is usually alarming, and ' +
    'the floor is credible.',
};

export const FORMULA = 'weekly cost = checks/day x refocus minutes x working days';

export const DEFAULTS = { working_days_per_week: 5, working_weeks_per_year: 46 };

const round1 = (n) => Number(n.toFixed(1));
const round0 = (n) => Math.round(n);

function costAt({ label, minutes, basis }, { checksPerDay, daysPerWeek, weeksPerYear, hourlyRate }) {
  const minutesPerDay = checksPerDay * minutes;
  const hoursPerWeek = (minutesPerDay * daysPerWeek) / 60;
  const hoursPerYear = hoursPerWeek * weeksPerYear;
  return {
    figure: label,
    refocus_minutes_per_switch: minutes,
    basis,
    minutes_per_day: round1(minutesPerDay),
    hours_per_week: round1(hoursPerWeek),
    hours_per_year: round1(hoursPerYear),
    ...(hourlyRate !== undefined
      ? {
        cost_per_week: round0(hoursPerWeek * hourlyRate),
        cost_per_year: round0(hoursPerYear * hourlyRate),
      }
      : {}),
  };
}

/**
 * The load arithmetic at both bounds. checks_per_day is required; everything
 * else defaults conservatively and is echoed under assumptions.
 */
export function computeLoad({
  checks_per_day,
  refocus_minutes,
  working_days_per_week,
  working_weeks_per_year,
  hourly_rate,
  currency,
}) {
  const checksPerDay = Number(checks_per_day);
  if (!(checksPerDay > 0)) {
    throw new ToolError('invalid_request', 'Pass checks_per_day as a positive number — it comes from observing or logging real sessions, not from a guess.');
  }
  const daysPerWeek = working_days_per_week === undefined ? DEFAULTS.working_days_per_week : Number(working_days_per_week);
  if (!(daysPerWeek > 0 && daysPerWeek <= 7)) {
    throw new ToolError('invalid_request', 'working_days_per_week must be between 1 and 7.');
  }
  const weeksPerYear = working_weeks_per_year === undefined ? DEFAULTS.working_weeks_per_year : Number(working_weeks_per_year);
  if (!(weeksPerYear > 0 && weeksPerYear <= 52)) {
    throw new ToolError('invalid_request', 'working_weeks_per_year must be between 1 and 52.');
  }
  const hourlyRate = hourly_rate === undefined ? undefined : Number(hourly_rate);
  if (hourlyRate !== undefined && !(hourlyRate > 0)) {
    throw new ToolError('invalid_request', 'hourly_rate must be a positive number when given.');
  }

  const scenario = { checksPerDay, daysPerWeek, weeksPerYear, hourlyRate };
  const bounds = [];

  if (refocus_minutes !== undefined) {
    const custom = Number(refocus_minutes);
    if (!(custom > 0)) throw new ToolError('invalid_request', 'refocus_minutes must be a positive number when given.');
    bounds.push(costAt({ label: 'custom', minutes: custom, basis: 'Caller-supplied figure — state its source wherever this number is shown.' }, scenario));
  }
  bounds.push(costAt({
    label: 'conservative_floor',
    minutes: REFOCUS_FIGURES.conservative_floor.default_minutes,
    basis: REFOCUS_FIGURES.conservative_floor.basis,
  }, scenario));
  bounds.push(costAt({
    label: 'literature',
    minutes: REFOCUS_FIGURES.literature.default_minutes,
    basis: REFOCUS_FIGURES.literature.basis,
  }, scenario));

  return {
    formula: FORMULA,
    assumptions: {
      checks_per_day: checksPerDay,
      working_days_per_week: daysPerWeek,
      working_weeks_per_year: weeksPerYear,
      ...(hourlyRate !== undefined ? { hourly_rate: hourlyRate, currency: currency ?? 'unspecified' } : {}),
      note: 'Every figure above must appear next to any cost derived from it. The credibility of the pitch rests on the math being checkable.',
    },
    bounds,
    figures: REFOCUS_FIGURES,
    status:
      'This is a projection from the stated assumptions, not a measurement. Sell the measured ' +
      'before/after where it exists; sell the framework and the two-week trial where it does not.',
  };
}
