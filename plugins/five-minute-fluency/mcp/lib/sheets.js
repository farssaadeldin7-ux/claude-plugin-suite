import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The local sheet log behind the success check: every sheet ends with a
 * countable check for the next session, and a check that is never scored
 * taught nothing. Sheets and their session results are stored on the user's
 * machine only — nothing here is sent anywhere.
 */

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'five-minute-fluency-sheets.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.sheets) ? parsed.sheets : [];
  } catch {
    return [];
  }
}

function writeAll(sheets) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the log.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, sheets }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function logSheet({ game, genre, diagnosis, changes, stop_doing, success_check, next_session, notes }) {
  const sheets = readAll();
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
  writeAll(sheets.slice(0, 2000));
  return record;
}

export function recordSession(id, { passed, reported_count, notes }) {
  const sheets = readAll();
  const index = sheets.findIndex((s) => s.id === id);
  if (index === -1) return null;
  sheets[index] = {
    ...sheets[index],
    passed,
    reported_count: reported_count ?? null,
    ...(notes ? { session_notes: notes } : {}),
    resolved_at: new Date().toISOString(),
  };
  writeAll(sheets);
  return sheets[index];
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
