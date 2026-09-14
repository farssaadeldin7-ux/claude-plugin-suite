#!/usr/bin/env node
/**
 * Regression tests for lib/runs.js: the change-control run record and its
 * ship/do-not-ship tally.
 *
 *   node plugins/mental-health-chatbot/mcp/test/runs.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mental-health-chatbot-runs-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { recordRun, reviewRuns } = await import('../lib/runs.js');

try {
  // ---- an empty log tallies to all zeros, not an error ---------------------
  {
    const r = reviewRuns();
    assert.equal(r.total_runs, 0);
    assert.equal(r.gate_ship, 0);
    assert.equal(r.gate_do_not_ship, 0);
    assert.deepEqual(r.recent, []);
  }
  ok('reviewRuns tallies an empty log as all zeros rather than erroring');

  // ---- recordRun stores the record and reviewRuns tallies gate outcomes ---
  // Three runs, hand-counted: ship, do_not_ship, ship -> 2 shipped, 1 not.
  const r1 = recordRun({ version: 'v1', counts: { a: 1 }, gate: 'ship', approved_by: 'alice' });
  const r2 = recordRun({ version: 'v2', counts: { a: 2 }, gate: 'do_not_ship' });
  const r3 = recordRun({ version: 'v3', counts: { a: 3 }, gate: 'ship', approved_by: 'bob' });

  {
    assert.match(r1.id, /^run_/);
    assert.equal(r1.approved_by, 'alice');
    assert.equal(r2.approved_by, null, 'approved_by defaults to null, not undefined, when omitted');
    assert.equal(r2.change, null);
    assert.equal(r2.notes, null);

    const review = reviewRuns();
    assert.equal(review.total_runs, 3);
    assert.equal(review.gate_ship, 2, '2 of the 3 recorded runs have gate:"ship"');
    assert.equal(review.gate_do_not_ship, 1, 'total minus shipped must equal the 1 do_not_ship run');
  }
  ok('recordRun stores each run (defaulting optional fields to null) and reviewRuns tallies gate_ship / gate_do_not_ship correctly across three runs');

  // ---- runs are newest-first, and "recent" respects its limit --------------
  {
    const review = reviewRuns({ limit: 2 });
    assert.equal(review.total_runs, 3, 'the limit narrows "recent" only, not the total count');
    assert.equal(review.recent.length, 2);
    assert.deepEqual(review.recent.map((r) => r.id), [r3.id, r2.id], 'the most recently recorded run must be first');
  }
  ok('reviewRuns lists "recent" newest-first and respects its limit independently of total_runs');

  console.log(`\n${passed} runs.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
