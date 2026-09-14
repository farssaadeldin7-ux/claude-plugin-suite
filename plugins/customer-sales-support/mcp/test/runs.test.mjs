#!/usr/bin/env node
/**
 * Regression tests for lib/runs.js: logRun's record shape (including that it
 * drops any metrics field beyond the four named ones), listRuns' change-from
 * -previous-run delta arithmetic and its null handling, and the 500-run
 * retention cap — a real boundary in the code (`runs.slice(0, 500)`), tested
 * by actually crossing it.
 *
 *   node plugins/customer-sales-support/mcp/test/runs.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// runs.js creates its store (and resolves the config directory) at import
// time via createJsonArrayStore, so XDG_CONFIG_HOME must be set — and
// runs.js dynamically imported — before that happens. A static import here
// would be hoisted ahead of this assignment regardless of source order.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'customer-sales-support-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { logRun, listRuns, RUNS_FILE } = await import('../lib/runs.js');

const baseMetrics = (containment) => ({
  containment_percent: containment,
  accuracy_on_contained_percent: 95,
  false_containment_percent: 1,
  over_escalation_percent: 5,
});

try {
  // ---- logRun: record shape, id/timestamp, and metrics field pruning -----
  {
    const record = logRun({
      label: 'baseline',
      change_note: 'first run',
      cases: 60,
      counts: { correct_contained: 50 },
      metrics: { ...baseMetrics(75), extra_field_the_caller_should_not_be_able_to_smuggle_in: 999 },
    });
    assert.match(record.id, /^run_[0-9a-f]{12}$/, 'the run id must follow the documented run_<12 hex chars> shape');
    assert.ok(!Number.isNaN(Date.parse(record.created_at)), 'created_at must be a parseable timestamp');
    assert.equal(record.label, 'baseline');
    assert.equal(record.change_note, 'first run');
    assert.deepEqual(Object.keys(record.metrics).sort(), ['accuracy_on_contained_percent', 'containment_percent', 'false_containment_percent', 'over_escalation_percent'].sort(),
      'metrics must be pruned to exactly the four named fields — an extra field passed in must not be smuggled into the stored record');
    assert.equal(record.metrics.containment_percent, 75);
  }
  ok('logRun stamps a run_<hex> id and an ISO timestamp, and stores only the four named metrics fields, dropping anything else the caller passed in metrics');

  // ---- logRun: label/change_note default to null, not undefined ---------
  {
    const record = logRun({ cases: 10, counts: {}, metrics: baseMetrics(50) });
    assert.equal(record.label, null);
    assert.equal(record.change_note, null);
  }
  ok('logRun defaults an omitted label or change_note to null rather than leaving it undefined');

  // ---- listRuns: newest first, and the arithmetic delta from the run before it ----
  {
    // Two more runs on top of the two already logged above (baseline=75,
    // then 50). By hand: containment deltas should be run2->run1 = 50-75 =
    // -25.0, and the newest run here (80) against the one before it (50) =
    // 80-50 = 30.0.
    logRun({ label: 'improve-1', cases: 60, counts: {}, metrics: baseMetrics(80) });
    const listing = listRuns({ limit: 10 });
    assert.equal(listing.total_runs, 3);
    assert.equal(listing.runs[0].label, 'improve-1', 'listRuns must return newest first');
    assert.equal(listing.runs[0].metrics.containment_percent, 80);
    assert.equal(listing.runs[0].change_from_previous_run_points.containment, 30, 'delta = current (80) - previous (50) = 30, hand-verified against the two runs actually logged');

    assert.equal(listing.runs[1].label, null); // the second logRun call above, which had no label
    assert.equal(listing.runs[1].change_from_previous_run_points.containment, -25, 'delta = current (50) - previous (75) = -25');

    assert.equal(listing.runs[2].label, 'baseline');
    assert.ok(!('change_from_previous_run_points' in listing.runs[2]), 'the oldest run has no run before it, so it must carry no change_from_previous_run_points key at all');
  }
  ok('listRuns orders runs newest-first and computes each one\'s change_from_previous_run_points as (this run\'s metric) - (the run logged immediately before it), with no delta key on the oldest run');

  // ---- listRuns: delta is null (not NaN) when either side is null --------
  {
    logRun({ cases: 10, counts: {}, metrics: { containment_percent: null, accuracy_on_contained_percent: null, false_containment_percent: 0, over_escalation_percent: 0 } });
    const listing = listRuns({ limit: 1 });
    assert.equal(listing.runs[0].change_from_previous_run_points.containment, null, 'a null current or previous metric must produce a null delta, not NaN');
  }
  ok('listRuns\' delta is null rather than NaN when the current or previous run\'s metric value is null (e.g. from an empty regression run)');

  // ---- listRuns: limit truncates the returned list but not total_runs ----
  {
    const listing = listRuns({ limit: 2 });
    assert.equal(listing.runs.length, 2);
    assert.equal(listing.total_runs, 4, 'total_runs must report the full stored count, independent of the limit applied to the returned page');
  }
  ok('listRuns\' limit truncates the runs array returned but total_runs still reports the full stored count');

  // ---- RUNS_FILE points at the isolated XDG_CONFIG_HOME used by this test ----
  {
    assert.ok(RUNS_FILE.startsWith(tmpConfigHome), 'the store must be writing under the isolated XDG_CONFIG_HOME set for this test, not a real user config directory');
    assert.ok(fs.existsSync(RUNS_FILE), 'the runs file must actually have been written to disk');
  }
  ok('RUNS_FILE resolves under XDG_CONFIG_HOME and the file exists on disk after logging runs');

  // ---- the 500-run retention cap: cross it and confirm it actually caps --
  // logRun's updater does `runs.unshift(record); return { items: runs.slice(0, 500), ... }`.
  // 4 runs are already stored above; log enough more to push the total past
  // 500 and confirm the store truncates there rather than growing unbounded.
  {
    const alreadyLogged = listRuns({ limit: 1 }).total_runs;
    const target = 505; // comfortably past the 500 cap from wherever we start
    for (let i = alreadyLogged; i < target; i++) {
      logRun({ label: `bulk-${i}`, cases: 10, counts: {}, metrics: baseMetrics(i % 100) });
    }
    const listing = listRuns({ limit: 1 });
    assert.equal(listing.total_runs, 500, 'the store must cap at exactly 500 retained runs, discarding the oldest ones past the cap');
    assert.equal(listing.runs[0].label, `bulk-${target - 1}`, 'the newest run must still be the most recently logged one after the cap kicks in');
  }
  ok('the run history is capped at exactly 500 retained runs (verified by actually logging past the cap), with the newest run always preserved');

  console.log(`\n${passed} runs.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
