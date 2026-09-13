import crypto from 'node:crypto';
import { createJsonArrayStore } from '../local-store.js';

/**
 * The local sheet log behind the success check: every sheet ends with a
 * countable check for the next session, and a check that is never scored
 * taught nothing. Sheets and their session results are stored on the user's
 * machine only — nothing here is sent anywhere.
 */

const store = createJsonArrayStore('five-minute-fluency-sheets.json', 'sheets');
const readAll = store.readAll;
const storePath = () => store.file;

export function logSheet({ game, genre, diagnosis, changes, stop_doing, success_check, next_session, notes }) {
  return store.update((sheets) => {
    const record = {
      id: `sheet_${crypto.randomBytes(6).toString('hex')}`,
      created_at: new Date().toISOString(),
      game: game ?? null,
      genre: genre ?? null,
      diagnosis: diagnosis ?? null,
      changes: Array.isArray(changes) ? changes : [],
      stop_doing: stop_doing ?? null,
      success_check: success_check ?? null,
      next_session: next_session ?? null,
      notes: notes ?? null,
      passed: null,
      reported_count: null,
    };
    sheets.unshift(record);
    return { items: sheets.slice(0, 2000), result: record };
  });
}

export function recordSession(id, { passed, reported_count, notes }) {
  return store.update((sheets) => {
    const index = sheets.findIndex((s) => s.id === id);
    if (index === -1) return { items: sheets, result: null };
    sheets[index] = {
      ...sheets[index],
      passed,
      reported_count: reported_count ?? null,
      ...(notes ? { session_notes: notes } : {}),
      resolved_at: new Date().toISOString(),
    };
    return { items: sheets, result: sheets[index] };
  });
}

/**
 * The record of past sheets, with a plain tally of the success checks.
 * Counting only — passes, fails, unscored — because the skill sets each bar
 * at roughly a coin flip, and the tally is how the player sees whether the
 * bars are being set honestly.
 */
export function reviewSheets({ limit = 20 } = {}) {
  const sheets = readAll();
  const resolved = sheets.filter((s) => s.passed !== null);
  const passed = resolved.filter((s) => s.passed === true).length;

  return {
    total_sheets: sheets.length,
    unscored: sheets.length - resolved.length,
    success_checks: resolved.length
      ? { scored: resolved.length, passed, failed: resolved.length - passed }
      : { scored: 0, note: 'No sheet has a scored success check yet — record one with record_session.' },
    bar_note: 'The skill sets each success check at roughly a coin flip for the player\'s current '
      + 'level. Read the pass tally against that: a long run of certain passes means the bars are '
      + 'set too low, not that the plateau is over.',
    recent: sheets.slice(0, limit).map((s) => ({
      id: s.id, created_at: s.created_at, game: s.game, genre: s.genre,
      diagnosis: s.diagnosis, success_check: s.success_check,
      passed: s.passed, reported_count: s.reported_count, next_session: s.next_session,
    })),
    stored_at: storePath(),
  };
}

export const SHEETS_FILE = storePath();
