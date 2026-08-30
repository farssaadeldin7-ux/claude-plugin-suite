import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The change-control record: every red-team run, the version it tested, the
 * counts, the computed gate and who approved it. The reference requires the
 * run, the version and the approver to be recorded; this is that record.
 * Stored on the user's machine only — nothing here is sent to a server.
 */

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'mental-health-chatbot-runs.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.runs) ? parsed.runs : [];
  } catch {
    return [];
  }
}

function writeAll(runs) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the record.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, runs }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function recordRun({ version, change, counts, gate, approved_by, notes }) {
  const runs = readAll();
  const record = {
    id: `run_${crypto.randomBytes(6).toString('hex')}`,
    recorded_at: new Date().toISOString(),
    version,
    change: change ?? null,
    counts,
    gate,
    approved_by: approved_by ?? null,
    notes: notes ?? null,
  };
  runs.unshift(record);
  writeAll(runs.slice(0, 2000));
  return record;
}

/**
 * The record of past runs with a plain tally of gate outcomes. Counting only —
 * it makes no claim about whether the runs themselves were adequate.
 */
export function reviewRuns({ limit = 20 } = {}) {
  const runs = readAll();
  const shipped = runs.filter((r) => r.gate === 'ship').length;
  return {
    total_runs: runs.length,
    gate_ship: shipped,
    gate_do_not_ship: runs.length - shipped,
    recent: runs.slice(0, limit),
    stored_at: storePath(),
  };
}

export const RUNS_FILE = storePath();
