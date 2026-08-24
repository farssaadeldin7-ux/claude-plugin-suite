import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The build log behind the two-week re-measure: every automation built is
 * recorded with its predicted weekly firing rate, so the observed rate can be
 * checked against it later. Dead automation is worse than none — it still
 * occupies a hotkey and a slot in the designer's memory — and the only way to
 * find it is to look. Stored on the user's machine only.
 */

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'neural-link-intention-layer-builds.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.builds) ? parsed.builds : [];
  } catch {
    return [];
  }
}

function writeAll(builds) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the log.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, builds }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function recordBuild({ mechanism, application, sequence, predicted_f_per_week, payback_weeks, notes }) {
  const builds = readAll();
  const record = {
    id: `build_${crypto.randomBytes(6).toString('hex')}`,
    created_at: new Date().toISOString(),
    mechanism: mechanism ?? null,
    application: application ?? null,
    sequence: sequence ?? null,
    predicted_f_per_week: predicted_f_per_week ?? null,
    payback_weeks: payback_weeks ?? null,
    notes: notes ?? null,
    observed_f_per_week: null,
  };
  builds.unshift(record);
  writeAll(builds.slice(0, 2000));
  return record;
}

export function recordFollowup(id, { observed_f_per_week, notes }) {
  const builds = readAll();
  const index = builds.findIndex((b) => b.id === id);
  if (index === -1) return null;
  builds[index] = {
    ...builds[index],
    observed_f_per_week,
    ...(notes ? { followup_notes: notes } : {}),
    followed_up_at: new Date().toISOString(),
  };
  writeAll(builds);
  return builds[index];
}

/**
 * The record of past builds with predicted against observed firing rates.
 * Counting only — whether an underfiring macro comes out is the user's call,
 * made with the skill.
 */
export function reviewBuilds({ limit = 20 } = {}) {
  const builds = readAll();
  const checked = builds.filter((b) => b.predicted_f_per_week != null && b.observed_f_per_week != null);

  return {
    total_builds: builds.length,
    unchecked: builds.length - checked.length,
    ...(builds.length && !checked.length
      ? { note: 'No build has an observed firing rate yet — log again two weeks after building and record one with record_followup.' }
      : {}),
    recent: builds.slice(0, limit).map((b) => ({
      id: b.id,
      created_at: b.created_at,
      mechanism: b.mechanism,
      application: b.application,
      sequence: b.sequence,
      predicted_f_per_week: b.predicted_f_per_week,
      observed_f_per_week: b.observed_f_per_week,
      ...(b.predicted_f_per_week && b.observed_f_per_week != null
        ? { observed_over_predicted: +(b.observed_f_per_week / b.predicted_f_per_week).toFixed(2) }
        : {}),
    })),
    stored_at: storePath(),
  };
}

export const BUILDS_FILE = storePath();
