import crypto from 'node:crypto';
import { createJsonArrayStore } from '../local-store.js';

/**
 * The regression-run history: every scored run is recorded so the next one
 * can be read against it. "Re-run on every article, prompt, retriever or
 * model change" only means something if the runs are kept — a metric with no
 * previous value is not a trend. Stored on the user's machine only.
 */

const store = createJsonArrayStore('customer-sales-support-runs.json', 'runs');
const readAll = store.readAll;
const storePath = () => store.file;

export function logRun({ label, change_note, cases, counts, metrics }) {
  return store.update((runs) => {
    const record = {
      id: `run_${crypto.randomBytes(6).toString('hex')}`,
      created_at: new Date().toISOString(),
      label: label ?? null,
      change_note: change_note ?? null,
      cases,
      counts,
      metrics: {
        containment_percent: metrics.containment_percent,
        accuracy_on_contained_percent: metrics.accuracy_on_contained_percent,
        false_containment_percent: metrics.false_containment_percent,
        over_escalation_percent: metrics.over_escalation_percent,
      },
    };
    runs.unshift(record);
    return { items: runs.slice(0, 500), result: record };
  });
}

const delta = (current, previous) =>
  current == null || previous == null ? null : Math.round((current - previous) * 10) / 10;

/**
 * The recorded runs, newest first, each with the arithmetic difference from
 * the run before it in percentage points. Counting and subtraction only — it
 * does not say whether a movement is good, significant or noise.
 */
export function listRuns({ limit = 20 } = {}) {
  const runs = readAll();
  const shown = runs.slice(0, limit).map((run, index) => {
    const previous = runs[index + 1] ?? null;
    return {
      id: run.id,
      created_at: run.created_at,
      label: run.label,
      change_note: run.change_note,
      cases: run.cases,
      metrics: run.metrics,
      ...(previous ? {
        change_from_previous_run_points: {
          containment: delta(run.metrics.containment_percent, previous.metrics.containment_percent),
          accuracy_on_contained: delta(run.metrics.accuracy_on_contained_percent, previous.metrics.accuracy_on_contained_percent),
          false_containment: delta(run.metrics.false_containment_percent, previous.metrics.false_containment_percent),
          over_escalation: delta(run.metrics.over_escalation_percent, previous.metrics.over_escalation_percent),
        },
      } : {}),
    };
  });

  return {
    total_runs: runs.length,
    runs: shown,
    stored_at: storePath(),
    note:
      'Differences are arithmetic, in percentage points against the previous recorded run. On a ' +
      '50-100 case set, single-case movements are within noise — the runs history shows direction, ' +
      'not significance.',
  };
}

export const RUNS_FILE = storePath();
