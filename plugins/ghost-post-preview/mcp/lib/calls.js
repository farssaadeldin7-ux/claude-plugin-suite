import crypto from 'node:crypto';
import { createJsonArrayStore } from '../local-store.js';

/**
 * The prediction log behind "close the loop": every band call is recorded so
 * the actual result can be logged against it later. A prediction that is never
 * checked has no error bar. Stored on the user's machine only.
 */

const BANDS = ['well_below', 'below', 'at', 'above', 'well_above'];

const store = createJsonArrayStore('ghost-post-preview-calls.json', 'calls');
const readAll = store.readAll;
const storePath = () => store.file;

export function bandIsValid(band) {
  return BANDS.includes(band);
}

export function logCall({ platform, verdict, band, confidence, hook_summary, notes }) {
  return store.update((calls) => {
    const record = {
      id: `call_${crypto.randomBytes(6).toString('hex')}`,
      created_at: new Date().toISOString(),
      platform: platform ?? null,
      verdict: verdict ?? null,
      band: band ?? null,
      confidence: confidence ?? null,
      hook_summary: hook_summary ?? null,
      notes: notes ?? null,
      actual_band: null,
    };
    calls.unshift(record);
    return { items: calls.slice(0, 2000), result: record };
  });
}

export function recordResult(id, { actual_band, notes }) {
  return store.update((calls) => {
    const index = calls.findIndex((c) => c.id === id);
    if (index === -1) return { items: calls, result: null };
    calls[index] = {
      ...calls[index],
      actual_band,
      ...(notes ? { result_notes: notes } : {}),
      resolved_at: new Date().toISOString(),
    };
    return { items: calls, result: calls[index] };
  });
}

/**
 * The record of past calls, with a plain tally of how they landed. Counting
 * only — hits, one-band misses, larger misses — because the whole point is an
 * error bar the user can see, not a new claim.
 */
export function reviewCalls({ limit = 20 } = {}) {
  const calls = readAll();
  const resolved = calls.filter((c) => c.band && c.actual_band);

  let exact = 0, oneOff = 0, wide = 0;
  for (const c of resolved) {
    const gap = Math.abs(BANDS.indexOf(c.band) - BANDS.indexOf(c.actual_band));
    if (gap === 0) exact++;
    else if (gap === 1) oneOff++;
    else wide++;
  }

  return {
    total_calls: calls.length,
    unresolved: calls.length - resolved.length,
    calibration: resolved.length
      ? { resolved: resolved.length, exact_band: exact, one_band_off: oneOff, two_or_more_off: wide }
      : { resolved: 0, note: 'No calls have a recorded result yet — record one with record_result.' },
    recent: calls.slice(0, limit).map((c) => ({
      id: c.id, created_at: c.created_at, platform: c.platform,
      verdict: c.verdict, band: c.band, actual_band: c.actual_band,
    })),
    stored_at: storePath(),
  };
}

export const CALLS_FILE = storePath();
export { BANDS };
