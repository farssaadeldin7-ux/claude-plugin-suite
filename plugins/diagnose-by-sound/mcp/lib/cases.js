import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Local case history. Stored on the technician's own machine, not on the
 * billing service — diagnosis notes and customer vehicles are not something
 * this suite should be collecting centrally.
 */

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'diagnose-by-sound-cases.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.cases) ? parsed.cases : [];
  } catch {
    return [];
  }
}

function writeAll(cases) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify({ version: 1, cases }, null, 2), { mode: 0o600 });
}

export function saveCase({ vehicle, observation, ranked, chosen, outcome, notes }) {
  const cases = readAll();
  const record = {
    id: `case_${crypto.randomBytes(6).toString('hex')}`,
    created_at: new Date().toISOString(),
    vehicle: vehicle ?? null,
    observation: observation ?? null,
    candidates: (ranked ?? []).slice(0, 5).map((c) => ({
      id: c.id, label: c.label, confidence: c.confidence, severity: c.severity,
    })),
    chosen: chosen ?? null,
    outcome: outcome ?? null,
    notes: notes ?? null,
  };
  cases.unshift(record);
  writeAll(cases.slice(0, 2000));
  return record;
}

export function listCases({ limit = 20, query = null } = {}) {
  let cases = readAll();
  if (query) {
    const needle = query.toLowerCase();
    cases = cases.filter((c) =>
      JSON.stringify(c).toLowerCase().includes(needle)
    );
  }
  return cases.slice(0, limit);
}

export function getCase(id) {
  return readAll().find((c) => c.id === id) ?? null;
}

export function updateCase(id, patch) {
  const cases = readAll();
  const index = cases.findIndex((c) => c.id === id);
  if (index === -1) return null;
  cases[index] = { ...cases[index], ...patch, updated_at: new Date().toISOString() };
  writeAll(cases);
  return cases[index];
}

/**
 * What the shop has actually seen. Useful because the second time a model
 * shows up with the same noise, the previous outcome is the best evidence
 * available — better than any general signature list.
 */
export function priorOutcomes({ signatureId = null, make = null, model = null } = {}) {
  const cases = readAll().filter((c) => c.outcome);
  const matches = cases.filter((c) => {
    if (signatureId && c.chosen !== signatureId && !c.candidates?.some((x) => x.id === signatureId)) return false;
    if (make && c.vehicle?.make?.toLowerCase() !== make.toLowerCase()) return false;
    if (model && c.vehicle?.model?.toLowerCase() !== model.toLowerCase()) return false;
    return true;
  });

  const tally = {};
  for (const c of matches) {
    const key = c.chosen || 'unrecorded';
    tally[key] = (tally[key] || 0) + 1;
  }

  return {
    matching_cases: matches.length,
    confirmed_causes: Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([cause, count]) => ({ cause, count })),
    recent: matches.slice(0, 5).map((c) => ({
      id: c.id, created_at: c.created_at,
      vehicle: c.vehicle ? `${c.vehicle.year ?? ''} ${c.vehicle.make ?? ''} ${c.vehicle.model ?? ''}`.trim() : null,
      chosen: c.chosen, outcome: c.outcome,
    })),
  };
}

export const CASES_FILE = storePath();
