#!/usr/bin/env node
/**
 * Regression tests for lib/genres.js and lib/symptoms.js.
 *
 * Both files are mostly static reference tables (the genre axes and the
 * symptom-to-cause table, ported verbatim from the skill's reference docs)
 * with no arithmetic worth re-deriving — copying every string out of the
 * table into an assertion would just restate the data, not check anything.
 * The one piece of real logic in each file is its id-lookup function
 * (genreFor / symptomFor), and both carry the same deliberate safety fix,
 * called out in their own comments: using `Object.hasOwn` rather than
 * `GENRES[key] ?? null`, specifically so that looking up an inherited
 * property name like "constructor" returns null instead of
 * Object.prototype.constructor (which is truthy, so `?? null` would not
 * catch it). That is exactly the kind of edge case worth locking down.
 *
 *   node plugins/five-minute-fluency/mcp/test/lookups.test.mjs
 */
import assert from 'node:assert/strict';
import { GENRES, genreFor } from '../lib/genres.js';
import { SYMPTOMS, symptomFor } from '../lib/symptoms.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- genreFor: normalization and unknown ids -----------------------------
  {
    assert.equal(genreFor('moba'), GENRES.moba);
    assert.equal(genreFor('MOBA'), GENRES.moba, 'lookup must be case-insensitive');
    assert.equal(genreFor('  moba  '), GENRES.moba, 'lookup must trim whitespace');
    assert.equal(genreFor('tactical_fps'), GENRES.tactical_fps);
    assert.equal(genreFor('not_a_real_genre'), null, 'an unrecognised genre id must return null, not guess');
    assert.equal(genreFor(''), null);
    assert.equal(genreFor(undefined), null);
    assert.equal(genreFor(null), null);
  }
  ok('genreFor looks up every genre case- and whitespace-insensitively and returns null for an unrecognised id');

  // ---- genreFor: an inherited property name must not leak the prototype ---
  {
    assert.equal(genreFor('constructor'), null, 'Object.prototype.constructor must not be returned as if it were a genre entry');
    assert.equal(genreFor('toString'), null);
    assert.equal(genreFor('hasOwnProperty'), null);
  }
  ok('genreFor returns null for inherited Object.prototype property names rather than leaking the prototype chain');

  // ---- symptomFor: normalization and unknown ids ---------------------------
  {
    assert.equal(symptomFor('keep_dying'), SYMPTOMS.keep_dying);
    assert.equal(symptomFor('Keep_Dying'), SYMPTOMS.keep_dying, 'lookup must be case-insensitive');
    assert.equal(symptomFor('  tilt  '), SYMPTOMS.tilt, 'lookup must trim whitespace');
    assert.equal(symptomFor('not_a_real_symptom'), null);
    assert.equal(symptomFor(''), null);
    assert.equal(symptomFor(undefined), null);
  }
  ok('symptomFor looks up every symptom case- and whitespace-insensitively and returns null for an unrecognised id');

  // ---- symptomFor: the same inherited-property-name trap ------------------
  {
    assert.equal(symptomFor('constructor'), null, 'Object.prototype.constructor must not be returned as if it were a symptom entry');
    assert.equal(symptomFor('toString'), null);
  }
  ok('symptomFor returns null for inherited Object.prototype property names rather than leaking the prototype chain');

  // ---- structural completeness: every genre/symptom entry the skill promises ----
  // SKILL.md step 2 names exactly these six genres and references/genre-axes.md
  // documents no others; step 1 sends the reader to symptom-to-cause.md's
  // named complaints. This is a coarse "the table did not lose an entry"
  // check, not a re-transcription of each entry's content.
  {
    assert.deepEqual(Object.keys(GENRES).sort(), ['fighting', 'hero_shooter', 'moba', 'racing', 'rts_autobattler', 'tactical_fps']);
    assert.deepEqual(Object.keys(SYMPTOMS).sort(),
      ['inconsistent', 'keep_dying', 'lose_early_game', 'no_damage', 'plateau', 'tilt', 'win_lane_lose_match']);
  }
  ok('GENRES and SYMPTOMS carry exactly the entries named in SKILL.md and the reference docs — no genre or symptom silently dropped');

  console.log(`\n${passed} genres.js/symptoms.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
