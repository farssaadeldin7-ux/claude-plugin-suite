#!/usr/bin/env node
/**
 * Regression tests for lib/cases.js's local case-history store: the
 * candidate-trimming saveCase does on write, listCases' query filter and
 * limit, getCase/updateCase, and priorOutcomes' tally/match/sort logic.
 *
 * No reference doc covers this module (it is bookkeeping over locally-saved
 * technician notes, not domain arithmetic), so every expected value here is
 * computed by hand from the function bodies themselves before being asserted
 * -- not copied from a run of the code.
 *
 *   node plugins/diagnose-by-sound/mcp/test/cases.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// The store resolves its config directory (and thus its file path) at
// import time, from XDG_CONFIG_HOME -- so that must be set, and lib/cases.js
// dynamically imported, before that happens. A static import here would be
// hoisted ahead of this assignment regardless of source order.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnose-by-sound-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { saveCase, listCases, getCase, updateCase, priorOutcomes } = await import('../lib/cases.js');

try {
  // ---- saveCase trims candidates to the first five, and to four fields ---
  {
    const sevenCandidates = Array.from({ length: 7 }, (_, i) => ({
      id: `sig${i}`, label: `Label ${i}`, confidence: i * 10, severity: 'low',
      extra_field_from_the_caller: 'must not be persisted',
    }));
    const record = saveCase({ ranked: sevenCandidates, chosen: 'sig0' });
    assert.equal(record.candidates.length, 5, 'only the first five ranked candidates are kept, not all seven');
    assert.deepEqual(record.candidates.map((c) => c.id), ['sig0', 'sig1', 'sig2', 'sig3', 'sig4'], 'the first five in the given order, not re-sorted');
    assert.deepEqual(Object.keys(record.candidates[0]).sort(), ['confidence', 'id', 'label', 'severity'], 'only the four named fields are kept per candidate');
  }
  ok('saveCase trims a candidate list to the first five entries and strips every field but id/label/confidence/severity');

  // ---- saveCase defaults absent fields to null rather than undefined -----
  {
    const record = saveCase({});
    assert.equal(record.vehicle, null);
    assert.equal(record.observation, null);
    assert.equal(record.chosen, null);
    assert.equal(record.outcome, null);
    assert.deepEqual(record.candidates, []);
    assert.match(record.id, /^case_[0-9a-f]{12}$/);
  }
  ok('saveCase defaults every omitted field to null (not undefined) and generates a case_<12-hex> id');

  // ---- getCase / updateCase ------------------------------------------------
  {
    const record = saveCase({ vehicle: { make: 'Toyota' }, notes: 'first note' });
    assert.equal(getCase(record.id).notes, 'first note');
    assert.equal(getCase('not-a-real-id'), null, 'a missing case id must return null, not throw or return undefined');

    const updated = updateCase(record.id, { notes: 'revised note' });
    assert.equal(updated.notes, 'revised note');
    assert.ok(updated.updated_at, 'updateCase must stamp updated_at');
    assert.equal(updated.vehicle.make, 'Toyota', 'updateCase must merge the patch, not replace the whole record');
    assert.equal(updateCase('not-a-real-id', { notes: 'x' }), null, 'updating a missing case must return null, not throw');
  }
  ok('getCase returns null for an unknown id, and updateCase merges a patch and stamps updated_at while returning null for an unknown id');

  // ---- listCases: query is a case-insensitive substring over the whole record
  {
    saveCase({ notes: 'customer mentioned a SQUEAK near the dashboard' });
    saveCase({ notes: 'totally unrelated case about brakes' });

    const found = listCases({ query: 'squeak' });
    assert.equal(found.length, 1, 'the query must match case-insensitively even though the stored text has different casing');
    assert.match(found[0].notes, /SQUEAK/);

    const notFound = listCases({ query: 'this text appears nowhere' });
    assert.deepEqual(notFound, []);
  }
  ok('listCases filters by a case-insensitive substring match over the JSON of the whole case, not just one field');

  // ---- listCases: newest-first order and limit ----------------------------
  {
    const a = saveCase({ notes: 'order-test A' });
    const b = saveCase({ notes: 'order-test B' });
    const c = saveCase({ notes: 'order-test C' });
    const recent = listCases({ query: 'order-test', limit: 2 });
    assert.equal(recent.length, 2, 'limit must cap the result even though 3 cases match the query');
    assert.deepEqual(recent.map((r) => r.id), [c.id, b.id], 'results are newest-saved first, so limit 2 keeps C then B, dropping the oldest (A)');
  }
  ok('listCases returns newest-first and limit caps the result without disturbing that order');

  // ---- priorOutcomes: tally, case-insensitive make match, signature match
  // via either "chosen" or presence in "candidates", and exclusion of cases
  // with no recorded outcome -- worked by hand and cross-checked:
  //   caseA: Toyota Corolla, chosen wheel-bearing, has outcome     -> counts
  //   caseB: toyota corolla (lowercase), chosen wheel-bearing, outcome -> counts
  //   caseC: Toyota Camry, chosen tyre-cupping but candidates include
  //          wheel-bearing, has outcome                            -> counts
  //          (signatureId matches via candidates even though not chosen)
  //   caseD: Honda Civic, chosen wheel-bearing, NO outcome         -> excluded (unresolved)
  //   caseE: Honda Civic, chosen wheel-bearing, has outcome        -> excluded (make filter)
  // Expected: matching_cases 3, tally {wheel-bearing: 2, tyre-cupping: 1},
  // recent in newest-first save order [C, B, A].
  {
    const a = saveCase({ vehicle: { make: 'Toyota', model: 'Corolla' }, chosen: 'wheel-bearing', outcome: 'confirmed bearing' });
    const b = saveCase({ vehicle: { make: 'toyota', model: 'corolla' }, chosen: 'wheel-bearing', outcome: 'confirmed again' });
    const c = saveCase({
      vehicle: { make: 'Toyota', model: 'Camry' }, chosen: 'tyre-cupping', outcome: 'was cupping',
      ranked: [{ id: 'wheel-bearing', label: 'WB', confidence: 40, severity: 'high' }],
    });
    saveCase({ vehicle: { make: 'Honda', model: 'Civic' }, chosen: 'wheel-bearing', outcome: null }); // unresolved
    saveCase({ vehicle: { make: 'Honda', model: 'Civic' }, chosen: 'wheel-bearing', outcome: 'unrelated make' });

    const result = priorOutcomes({ signatureId: 'wheel-bearing', make: 'TOYOTA' });
    assert.equal(result.matching_cases, 3, 'the two Honda cases must be excluded: one has no outcome at all, the other fails the make filter');
    assert.deepEqual(result.confirmed_causes, [
      { cause: 'wheel-bearing', count: 2 },
      { cause: 'tyre-cupping', count: 1 },
    ], 'tallied by "chosen" and sorted by count descending -- caseC still counts toward matching_cases via candidates, but its own tally bucket is "tyre-cupping" (its chosen), not wheel-bearing');
    assert.deepEqual(result.recent.map((r) => r.id), [c.id, b.id, a.id], 'newest-saved first');
    assert.equal(result.recent[0].vehicle, 'Toyota Camry');
  }
  ok('priorOutcomes tallies confirmed causes, matches a signature via "chosen" or via presence in "candidates", matches make case-insensitively, and excludes cases with no recorded outcome');

  // ---- priorOutcomes: the "recent" list is capped at five ------------------
  {
    const ids = [];
    for (let i = 0; i < 6; i += 1) {
      ids.push(saveCase({ vehicle: { make: 'Ford', model: 'Focus' }, chosen: 'wheel-bearing', outcome: `outcome ${i}` }).id);
    }
    const result = priorOutcomes({ make: 'Ford', model: 'Focus' });
    assert.equal(result.matching_cases, 6, 'all six matching cases are counted');
    assert.equal(result.recent.length, 5, 'but "recent" is capped at five, newest first');
    assert.deepEqual(result.recent.map((r) => r.id), [ids[5], ids[4], ids[3], ids[2], ids[1]]);
  }
  ok('priorOutcomes counts every matching case in matching_cases but caps the "recent" list at five, newest first');

  console.log(`\n${passed} cases.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
