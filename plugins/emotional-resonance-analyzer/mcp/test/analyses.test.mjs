#!/usr/bin/env node
/**
 * Regression tests for lib/analyses.js: the local analysis log.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/analyses.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// analyses.js creates its store (and resolves the config directory) at
// import time via local-store.js, so XDG_CONFIG_HOME must be set — and
// analyses.js dynamically imported — before that happens. A static import at
// the top of this file would be hoisted ahead of this assignment regardless
// of source order.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emotional-resonance-analyzer-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { logAnalysis, getAnalysis, reviewAnalyses } = await import('../lib/analyses.js');

try {
  // ---- logAnalysis: defaults and required-field passthrough ---------------
  {
    const record = logAnalysis({ film: 'The Boatyard', findings_summary: 'no_question_open, tonal_monotony' });
    assert.match(record.id, /^arc_[0-9a-f]{12}$/);
    assert.equal(record.film, 'The Boatyard');
    assert.equal(record.version, null);
    assert.equal(record.form, null);
    assert.equal(record.retention_data_supplied, false, 'omitted retention_data_supplied must default to false, not undefined');
    assert.deepEqual(record.cuts, []);
    assert.ok(record.created_at);
  }
  ok('logAnalysis fills in every optional field with a sane default (null / false / []) rather than leaving them undefined');

  // ---- logAnalysis: booleans are coerced, not just passed through --------
  {
    const record = logAnalysis({ film: 'Flood Defence', retention_data_supplied: 'yes' });
    assert.equal(record.retention_data_supplied, true, 'a truthy non-boolean retention_data_supplied must be coerced to true via Boolean()');
  }
  ok('retention_data_supplied is coerced with Boolean(), so a truthy non-boolean value still records true');

  // ---- getAnalysis: round-trip by id, and unknown id returns null --------
  {
    const record = logAnalysis({ film: 'Wrongful Dismissal', form: 'short_doc' });
    const fetched = getAnalysis(record.id);
    assert.deepEqual(fetched, record);
    assert.equal(getAnalysis('arc_doesnotexist'), null);
  }
  ok('getAnalysis retrieves a logged analysis by id exactly, and returns null for an unknown id');

  // ---- reviewAnalyses: newest first (unshift, not push) -------------------
  {
    const a = logAnalysis({ film: 'First' });
    const b = logAnalysis({ film: 'Second' });
    const review = reviewAnalyses({ limit: 2 });
    assert.equal(review.analyses[0].id, b.id, 'the most recently logged analysis must come first');
    assert.equal(review.analyses[1].id, a.id);
  }
  ok('reviewAnalyses returns analyses newest-first');

  // ---- reviewAnalyses: film filter is case-insensitive substring match ---
  {
    logAnalysis({ film: 'The Medical Device Story' });
    const review = reviewAnalyses({ film: 'medical device' });
    assert.ok(review.analyses.length >= 1);
    assert.ok(review.analyses.every((a) => a.film.toLowerCase().includes('medical device')));
    assert.equal(review.film_filter, 'medical device');
    assert.equal(review.matching, review.analyses.length, 'with no limit hit, matching must equal the number of rows actually returned');

    const noMatch = reviewAnalyses({ film: 'no such film exists anywhere' });
    assert.equal(noMatch.matching, 0);
    assert.deepEqual(noMatch.analyses, []);
  }
  ok('reviewAnalyses filters by film as a case-insensitive substring match, reporting a distinct matching count from total_logged');

  // ---- reviewAnalyses: limit caps the returned rows but not the count ----
  {
    const before = reviewAnalyses({ limit: 1000 }).total_logged;
    for (let i = 0; i < 5; i++) logAnalysis({ film: `Batch ${i}` });
    const review = reviewAnalyses({ limit: 3 });
    assert.equal(review.analyses.length, 3, 'limit must cap the returned rows');
    assert.equal(review.total_logged, before + 5, 'total_logged must count everything, not just the returned page');
  }
  ok('reviewAnalyses caps returned rows at the given limit while total_logged still reflects every logged analysis');

  // ---- cuts array passes through untouched, version/form pass through ----
  {
    const cuts = [
      { rank: 1, change: 'Cut scenes 3-5 to 2:00 total', effort: 2, exposed_runtime: '4:10' },
      { rank: 2, change: 'Reframe scene 7 at 07:00', effort: 1, exposed_runtime: '1:50' },
    ];
    const record = logAnalysis({ film: 'The Boatyard', version: 'v3', cuts });
    assert.deepEqual(record.cuts, cuts);
    assert.equal(record.version, 'v3');
    const review = reviewAnalyses({ film: 'boatyard' });
    const row = review.analyses.find((a) => a.id === record.id);
    assert.equal(row.cuts, 2, 'reviewAnalyses summarises cuts to a count, not the full array, in the list view');
  }
  ok('logAnalysis stores the cuts array and version verbatim; reviewAnalyses\' list view summarises cuts to a count');

  console.log(`\n${passed} analyses.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
