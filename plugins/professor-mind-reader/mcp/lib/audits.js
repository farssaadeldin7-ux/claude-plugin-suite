import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { BAND_ORDER, bandIndex } from './bands.js';

/**
 * The audit log behind "position honestly, then check": every band-range call
 * is recorded so the actual result can be logged against it later. A
 * positioning that is never checked has no error bar. Stored on the user's
 * machine only.
 */

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'professor-mind-reader-audits.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.audits) ? parsed.audits : [];
  } catch {
    return [];
  }
}

function writeAll(audits) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the log.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, audits }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function logAudit({ assignment, band_floor, band_ceiling, total_marks_at_stake, top_fix, notes }) {
  const audits = readAll();
  const record = {
    id: `audit_${crypto.randomBytes(6).toString('hex')}`,
    created_at: new Date().toISOString(),
    assignment: assignment ?? null,
    band_floor: band_floor ?? null,
    band_ceiling: band_ceiling ?? null,
    total_marks_at_stake: total_marks_at_stake ?? null,
    top_fix: top_fix ?? null,
    notes: notes ?? null,
    actual_band: null,
  };
  audits.unshift(record);
  writeAll(audits.slice(0, 2000));
  return record;
}

export function recordResult(id, { actual_band, notes }) {
  const audits = readAll();
  const index = audits.findIndex((a) => a.id === id);
  if (index === -1) return null;
  audits[index] = {
    ...audits[index],
    actual_band,
    ...(notes ? { result_notes: notes } : {}),
    resolved_at: new Date().toISOString(),
  };
  writeAll(audits);
  return audits[index];
}

/**
 * The record of past audits, with a plain tally of how the band-range calls
 * landed. Counting only — within the range, one band outside, further out —
 * because the point is an error bar the user can see, not a new claim.
 */
export function reviewAudits({ limit = 20 } = {}) {
  const audits = readAll();
  const resolved = audits.filter((a) => a.band_floor && a.band_ceiling && a.actual_band);

  let within = 0, oneOff = 0, wide = 0;
  for (const a of resolved) {
    const actual = bandIndex(a.actual_band);
    const floor = bandIndex(a.band_floor);
    const ceiling = bandIndex(a.band_ceiling);
    const lower = Math.min(floor, ceiling);
    const upper = Math.max(floor, ceiling);
    const distance = actual < lower ? lower - actual : actual > upper ? actual - upper : 0;
    if (distance === 0) within++;
    else if (distance === 1) oneOff++;
    else wide++;
  }

  return {
    total_audits: audits.length,
    unresolved: audits.length - resolved.length,
    calibration: resolved.length
      ? { resolved: resolved.length, within_range: within, one_band_outside: oneOff, two_or_more_outside: wide }
      : { resolved: 0, note: 'No audits have a recorded result yet — record one with record_result.' },
    recent: audits.slice(0, limit).map((a) => ({
      id: a.id, created_at: a.created_at, assignment: a.assignment,
      band_floor: a.band_floor, band_ceiling: a.band_ceiling, actual_band: a.actual_band,
    })),
    stored_at: storePath(),
  };
}

export const AUDITS_FILE = storePath();
export { BAND_ORDER };
