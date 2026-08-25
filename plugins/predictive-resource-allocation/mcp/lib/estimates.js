import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The estimate log behind "one measured run beats any estimate": every
 * prediction — a VRAM figure, a frame time, a sim time — is recorded so the
 * measured actual can be logged against it later, and the review shows how
 * often the estimates landed inside their stated factor-of-two band. An
 * estimate that is never checked has no error bar. Stored on the user's
 * machine only.
 */

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'predictive-resource-allocation-estimates.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.estimates) ? parsed.estimates : [];
  } catch {
    return [];
  }
}

function writeAll(estimates) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the log.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, estimates }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function logEstimate({ job, quantity, unit, predicted_value, assumptions, notes }) {
  const estimates = readAll();
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
  writeAll(estimates.slice(0, 2000));
  return record;
}

export function recordActual(id, { actual_value, notes }) {
  const estimates = readAll();
  const index = estimates.findIndex((e) => e.id === id);
  if (index === -1) return null;
  estimates[index] = {
    ...estimates[index],
    actual_value,
    ...(notes ? { result_notes: notes } : {}),
    resolved_at: new Date().toISOString(),
  };
  writeAll(estimates);
  return estimates[index];
}

/**
 * The record of past estimates, with a plain tally of how they landed against
 * the stated factor-of-two band. Counting only — the whole point is an error
 * bar the user can see, not a new claim.
 */
export function reviewEstimates({ limit = 20 } = {}) {
  const estimates = readAll();
  const resolved = estimates.filter((e) => e.predicted_value > 0 && e.actual_value > 0);

  let within25 = 0, withinBand = 0, outsideBand = 0;
  for (const e of resolved) {
    const ratio = e.actual_value / e.predicted_value;
    if (ratio >= 0.8 && ratio <= 1.25) within25++;
    else if (ratio >= 0.5 && ratio <= 2) withinBand++;
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
