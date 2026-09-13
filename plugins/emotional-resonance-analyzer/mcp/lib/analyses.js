import crypto from 'node:crypto';
import { createJsonArrayStore } from '../local-store.js';

/**
 * The local analysis log: what was flagged, which three cuts were chosen and
 * whether real retention data was in the room. Two versions of the same cut
 * logged side by side is how "choosing between two versions" gets an audit
 * trail. Stored on the user's machine only.
 */

const store = createJsonArrayStore('emotional-resonance-analyzer-analyses.json', 'analyses');
const readAll = store.readAll;
const storePath = () => store.file;

export function logAnalysis({ film, version, form, total_runtime, retention_data_supplied, findings_summary, cuts, notes }) {
  return store.update((analyses) => {
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
    return { items: analyses.slice(0, 2000), result: record };
  });
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
