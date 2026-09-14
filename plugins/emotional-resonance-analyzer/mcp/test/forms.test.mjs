#!/usr/bin/env node
/**
 * Regression tests for lib/forms.js: the formFor lookup and the generic
 * BASELINES table used when no form is named.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/forms.test.mjs
 */
import assert from 'node:assert/strict';
import { formFor, FORMS, BASELINES } from '../lib/forms.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- formFor: normal lookup, case- and whitespace-insensitive ----------
  {
    assert.equal(formFor('short_doc').label, 'Short doc, under 10 minutes');
    assert.equal(formFor('SHORT_DOC').label, 'Short doc, under 10 minutes', 'lookup must be case-insensitive');
    assert.equal(formFor('  short_doc  ').label, 'Short doc, under 10 minutes', 'lookup must trim whitespace');
    assert.equal(formFor('feature_doc').label, 'Feature doc, 70–110 minutes');
    assert.equal(formFor('branded').label, 'Branded film, 2–8 minutes');
    assert.equal(formFor('youtube_longform').label, 'YouTube long-form, 12–40 minutes');
    assert.equal(formFor('broadcast').label, 'Broadcast with ad breaks');
  }
  ok('formFor looks up every one of the five documented forms, case- and whitespace-insensitively');

  // ---- formFor: unknown id / prototype-pollution guard --------------------
  {
    assert.equal(formFor('installation_piece'), null, 'an unencoded form must return null, not a guessed nearest row');
    assert.equal(formFor(''), null);
    assert.equal(formFor(undefined), null);
    assert.equal(formFor('constructor'), null, '"constructor" must not resolve to Object.prototype.constructor');
    assert.equal(formFor('toString'), null);
  }
  ok('formFor returns null for an unrecognised or inherited-prototype id, rather than guessing or leaking Object.prototype');

  // ---- cross-form quick-reference table values, per form-conventions.md --
  {
    assert.deepEqual(FORMS.short_doc.central_close_window, { earliest: 0.70, latest: 0.85 });
    assert.equal(FORMS.short_doc.talking_head_limit_seconds, 30);
    assert.equal(FORMS.short_doc.question_must_open_by_seconds, 20);

    assert.deepEqual(FORMS.feature_doc.central_close_window, { earliest: 0.80, latest: 0.90 });
    assert.equal(FORMS.feature_doc.talking_head_limit_seconds, 60);
    assert.equal(FORMS.feature_doc.question_must_open_by_seconds, 300);

    assert.deepEqual(FORMS.branded.central_close_window, { earliest: 0.75, latest: 0.85 });
    assert.equal(FORMS.branded.talking_head_limit_seconds, 25);
    assert.equal(FORMS.branded.feed_based, true);

    assert.deepEqual(FORMS.youtube_longform.central_close_window, { earliest: 0.85, latest: 0.95 });
    assert.equal(FORMS.youtube_longform.talking_head_limit_seconds, 40);
    assert.equal(FORMS.youtube_longform.feed_based, true);

    // Broadcast's central close is explicitly "last segment only" and not a
    // ratio — the field must be null, not a guessed number, since it cannot
    // be checked without the break timecodes.
    assert.equal(FORMS.broadcast.central_close_window, null);
    assert.equal(FORMS.broadcast.talking_head_limit_seconds, 45);
    assert.equal(FORMS.broadcast.feed_based, undefined, 'broadcast is not documented as feed-based');
  }
  ok('FORMS carries the exact central_close_window and talking_head_limit_seconds from the cross-form quick-reference table for every form, including broadcast\'s deliberate null window');

  // ---- BASELINES matches the generic tell table used when no form is named
  {
    assert.equal(BASELINES.talking_head_limit_seconds, 40, 'the generic baseline matches the tell table\'s "beyond 40 seconds"');
    assert.equal(BASELINES.central_close_ratio, 2 / 3, 'the generic baseline is 2/3, consistent with dropoff-causes.md\'s "below 0.66" once the computed ratio is rounded to 2dp before comparison');
    assert.equal(BASELINES.no_question_stretch_seconds, 90);
    assert.equal(BASELINES.no_question_scene_run, 3);
    assert.equal(BASELINES.stakes_stretch_seconds, 90);
    assert.equal(BASELINES.monotony_window_seconds, 300);
  }
  ok('BASELINES matches the generic (no-form) thresholds documented in dropoff-causes.md and arc-scoring.md');

  console.log(`\n${passed} forms.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
