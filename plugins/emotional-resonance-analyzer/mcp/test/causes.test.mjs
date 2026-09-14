#!/usr/bin/env node
/**
 * Regression tests for lib/causes.js: the causeFor lookup and the priority
 * table it and tells.js agree on.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/causes.test.mjs
 */
import assert from 'node:assert/strict';
import { causeFor, CAUSES, OVERLAP_PRIORITY } from '../lib/causes.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- causeFor: normal lookup, case- and whitespace-insensitive ---------
  {
    assert.equal(causeFor('tonal_monotony').label, 'Tonal monotony');
    assert.equal(causeFor('TONAL_MONOTONY').label, 'Tonal monotony', 'lookup must be case-insensitive');
    assert.equal(causeFor('  tonal_monotony  ').label, 'Tonal monotony', 'lookup must trim whitespace');
    assert.equal(causeFor('no_question_open').label, 'No question open');
    assert.equal(causeFor('stakes_not_personalised').label, 'Stakes not personalised');
    assert.equal(causeFor('premature_resolution').label, 'Premature resolution');
    assert.equal(causeFor('texture_starvation').label, 'Texture starvation');
  }
  ok('causeFor looks up every one of the five causes, case- and whitespace-insensitively');

  // ---- causeFor: unknown id returns null, not undefined or a guess -------
  {
    assert.equal(causeFor('not_a_real_cause'), null);
    assert.equal(causeFor(''), null);
    assert.equal(causeFor(undefined), null);
    assert.equal(causeFor(null), null);
  }
  ok('causeFor returns null for an unrecognised id rather than guessing');

  // ---- causeFor: prototype-pollution guard --------------------------------
  // Object.hasOwn, not `?? null`: an inherited property name like
  // "constructor" or "toString" resolves through the prototype chain and is
  // truthy, so a naive `CAUSES[key] ?? null` would return the Object
  // prototype's own constructor function instead of rejecting the lookup.
  {
    assert.equal(causeFor('constructor'), null, '"constructor" must not resolve to Object.prototype.constructor');
    assert.equal(causeFor('toString'), null, '"toString" must not resolve to Object.prototype.toString');
    assert.equal(causeFor('hasOwnProperty'), null);
  }
  ok('causeFor rejects inherited prototype property names instead of returning Object.prototype members');

  // ---- CAUSES has exactly the five documented causes ----------------------
  {
    assert.deepEqual(Object.keys(CAUSES).sort(), [
      'no_question_open',
      'premature_resolution',
      'stakes_not_personalised',
      'texture_starvation',
      'tonal_monotony',
    ]);
    for (const key of Object.keys(CAUSES)) {
      const cause = CAUSES[key];
      assert.ok(cause.label && cause.summary && cause.tell && cause.threshold && cause.how_to_check && cause.standard_fix && cause.worked_example,
        `cause "${key}" must carry every documented field`);
    }
  }
  ok('CAUSES contains exactly the five documented drop-off causes, each with every required field populated');

  // ---- OVERLAP_PRIORITY matches the priority order tells.js implements ---
  // dropoff-causes.md's own priority table, in order: premature resolution
  // (always highest), no-question+monotony (the classic sag), stakes not
  // personalised in the first 90s (feed-based urgency), texture starvation
  // alone (lowest). tells.js's priorityOf() returns 1/2/3/5 in that exact
  // order (with everything else falling to 4 in between) — cross-checked
  // here against the reference table this module carries.
  {
    assert.equal(OVERLAP_PRIORITY.length, 4);
    assert.match(OVERLAP_PRIORITY[0].overlap, /Premature resolution/);
    assert.match(OVERLAP_PRIORITY[0].treat_as, /Highest priority, always/);
    assert.match(OVERLAP_PRIORITY[1].overlap, /No question open plus tonal monotony/);
    assert.match(OVERLAP_PRIORITY[2].overlap, /Stakes not personalised in the first 90 seconds/);
    assert.match(OVERLAP_PRIORITY[3].overlap, /Texture starvation alone/);
    assert.match(OVERLAP_PRIORITY[3].treat_as, /Lowest/);
  }
  ok('OVERLAP_PRIORITY lists the four documented overlap rules in the same order tells.js\'s priorityOf() implements: premature resolution highest, texture starvation alone lowest');

  console.log(`\n${passed} causes.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
