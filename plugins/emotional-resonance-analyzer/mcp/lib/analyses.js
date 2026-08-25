import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The local analysis log: what was flagged, which three cuts were chosen and
 * whether real retention data was in the room. Two versions of the same cut
 * logged side by side is how "choosing between two versions" gets an audit
 * trail. Stored on the user's machine only.
 */

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'emotional-resonance-analyzer-analyses.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.analyses) ? parsed.analyses : [];
  } catch {
    return [];
  }
}

function writeAll(analyses) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the log.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, analyses }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function logAnalysis({ film, version, form, total_runtime, retention_data_supplied, findings_summary, cuts, notes }) {
  const analyses = readAll();
  const record = {
    id: `arc_${crypto.randomBytes(6).toString('hex')}`,
    created_at: new Date().toISOString(),
    film,
    version: version ?? null,
    form: form ?? null,
    total_runtime: total_runtime ?? null,
    retention_data_supplied: Boolean(retention_data_supplied),
    findings_summary: findings_summary ?? null,
    cuts: cuts ?? [],
    notes: notes ?? null,
  };
  analyses.unshift(record);
  writeAll(analyses.slice(0, 2000));
  return record;
}

export function getAnalysis(id) {
  return readAll().find((a) => a.id === id) ?? null;
}

export function reviewAnalyses({ film, limit = 20 } = {}) {
  const all = readAll();
  const filtered = film
    ? all.filter((a) => (a.film ?? '').toLowerCase().includes(String(film).toLowerCase()))
    : all;
  return {
    total_logged: all.length,
    ...(film ? { matching: filtered.length, film_filter: film } : {}),
    analyses: filtered.slice(0, limit).map((a) => ({
      id: a.id,
      created_at: a.created_at,
      film: a.film,
      version: a.version,
      form: a.form,
      retention_data_supplied: a.retention_data_supplied,
      cuts: a.cuts.length,
    })),
    stored_at: storePath(),
  };
}

export const ANALYSES_FILE = storePath();
