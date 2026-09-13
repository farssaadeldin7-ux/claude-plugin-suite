import crypto from 'node:crypto';
import { createJsonArrayStore } from '../local-store.js';

/**
 * The estimate log behind "one measured run beats any estimate": every
 * prediction — a VRAM figure, a frame time, a sim time — is recorded so the
 * measured actual can be logged against it later, and the review shows how
 * often the estimates landed inside their stated factor-of-two band. An
 * estimate that is never checked has no error bar. Stored on the user's
 * machine only.
 */

const store = createJsonArrayStore('predictive-resource-allocation-estimates.json', 'estimates');
const readAll = store.readAll;
const storePath = () => store.file;

export function logEstimate({ job, quantity, unit, predicted_value, assumptions, notes }) {
  return store.update((estimates) => {
    const record = {
      id: `est_${crypto.randomBytes(6).toString('hex')}`,
      created_at: new Date().toISOString(),
      job: job ?? null,
      quantity: quantity ?? null,
      unit: unit ?? null,
      predicted_value,
      assumptions: assumptions ?? null,
      notes: notes ?? null,
      actual_value: null,
    };
    estimates.unshift(record);
    return { items: estimates.slice(0, 2000), result: record };
  });
}

export function recordActual(id, { actual_value, notes }) {
  return store.update((estimates) => {
    const index = estimates.findIndex((e) => e.id === id);
    if (index === -1) return { items: estimates, result: null };
    estimates[index] = {
      ...estimates[index],
      actual_value,
      ...(notes ? { result_notes: notes } : {}),
      resolved_at: new Date().toISOString(),
    };
    return { items: estimates, result: estimates[index] };
  });
}

/**
 * The record of past estimates, with a plain tally of how they landed against
 * the stated factor-of-two band. Counting only — the whole point is an error
 * bar the user can see, not a new claim.
 */
export function reviewEstimates({ limit = 20 } = {}) {
  const estimates = readAll();
  const resolved = estimates.filter((e) => e.predicted_value > 0 && e.actual_value > 0);

  // within_25_percent is a stricter subset check, reported alongside — not
  // instead of — the factor-of-two count: chaining them as else-if branches
  // would make within_factor_two mean "within a factor of two but *not*
  // within 25%", so a perfectly calibrated log (every ratio landing inside
  // the tighter 25% band) would report zero within a factor of two, despite
  // every single one of them qualifying.
  let within25 = 0, withinBand = 0, outsideBand = 0;
  for (const e of resolved) {
    const ratio = e.actual_value / e.predicted_value;
    if (ratio >= 0.8 && ratio <= 1.25) within25++;
    if (ratio >= 0.5 && ratio <= 2) withinBand++;
    else outsideBand++;
  }

  return {
    total_estimates: estimates.length,
    unresolved: estimates.length - resolved.length,
    calibration: resolved.length
      ? {
          resolved: resolved.length,
          within_25_percent: within25,
          within_factor_two: withinBand,
          outside_factor_two: outsideBand,
          note: 'The method claims a factor-of-two band. Estimates landing outside it mean an assumption was wrong — the assumptions field says which to check.',
        }
      : { resolved: 0, note: 'No estimate has a recorded actual yet — record one with record_actual once the job has run.' },
    recent: estimates.slice(0, limit).map((e) => ({
      id: e.id, created_at: e.created_at, job: e.job, quantity: e.quantity,
      predicted_value: e.predicted_value, actual_value: e.actual_value, unit: e.unit,
    })),
    stored_at: storePath(),
  };
}

export const ESTIMATES_FILE = storePath();
