import crypto from 'node:crypto';
import { createJsonArrayStore } from '../local-store.js';

/**
 * The change-control record: every red-team run, the version it tested, the
 * counts, the computed gate and who approved it. The reference requires the
 * run, the version and the approver to be recorded; this is that record.
 * Stored on the user's machine only — nothing here is sent to a server.
 */

const store = createJsonArrayStore('mental-health-chatbot-runs.json', 'runs');
const readAll = store.readAll;
const storePath = () => store.file;

export function recordRun({ version, change, counts, gate, approved_by, notes }) {
  return store.update((runs) => {
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
    return { items: runs.slice(0, 2000), result: record };
  });
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
