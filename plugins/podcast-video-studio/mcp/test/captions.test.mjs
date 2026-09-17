#!/usr/bin/env node
/**
 * Regression tests for lib/captions.js: the verbatim first-sentence hook, the
 * character counts against each destination's caption spec, truncation and
 * hard-limit reporting with actual counts, and the hashtag rule checks. All
 * deterministic — captionPack structures what it is given and writes nothing.
 *
 *   node plugins/podcast-video-studio/mcp/test/captions.test.mjs
 */
import assert from 'node:assert/strict';
import { firstSentence, captionPack } from '../lib/captions.js';
import { CAPTION_RULES, DESTINATIONS } from '../lib/destinations.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- every destination has a caption rule ----------------------------------
  {
    assert.deepEqual(Object.keys(CAPTION_RULES).sort(), Object.keys(DESTINATIONS).sort());
    for (const [id, rule] of Object.entries(CAPTION_RULES)) {
      assert.ok(rule.truncation_chars <= rule.max_chars, `${id}: truncation cannot exceed the hard limit`);
      assert.ok(rule.hashtags.max >= 1, `${id}: hashtag rule present`);
    }
  }
  ok('every destination in the spec table has a caption rule, and truncation never exceeds the hard limit');

  // ---- firstSentence is verbatim --------------------------------------------
  {
    assert.equal(firstSentence('We stopped hiring senior people entirely. And it worked.'), 'We stopped hiring senior people entirely.');
    assert.equal(firstSentence('Wait, say that again?  Sure.'), 'Wait, say that again?');
    assert.equal(firstSentence('no terminal punctuation at all'), 'no terminal punctuation at all');
    assert.equal(firstSentence('  spaced   out.  next'), 'spaced out.', 'whitespace collapses, words never change');
  }
  ok('firstSentence returns the clip\'s first sentence verbatim, or the whole text when there is none');

  // ---- captionPack: hook verbatim, counts real --------------------------------
  {
    const text = 'We stopped hiring senior people entirely. Every one of our last nine hires was a first-time engineer.';
    const pack = captionPack({ transcript: text, destination: 'tiktok' });
    assert.equal(pack.hook_line.text, 'We stopped hiring senior people entirely.');
    assert.equal(pack.hook_line.chars, pack.hook_line.text.length, 'the reported count is the actual count');
    assert.equal(pack.hook_line.fits_before_truncation, true);
    assert.equal(pack.spec.max_chars, 2200);
    assert.equal(pack.spec.truncation_chars, 100);
    assert.equal(pack.counts.remaining_after_hook, 2200 - pack.hook_line.chars - 1);
    const hookSlot = pack.scaffold.find((s) => s.slot === 'line_1_hook');
    assert.equal(hookSlot.text, pack.hook_line.text, 'the scaffold carries the same verbatim hook');
    const fillSlot = pack.scaffold.find((s) => s.slot === 'line_2_context_or_position');
    assert.ok(fillSlot.fill && !fillSlot.text, 'the judgement line is a slot to fill, never invented copy');
  }
  ok('captionPack quotes the hook verbatim, counts characters for real and leaves judgement lines as slots');

  // ---- truncation overflow is reported, not rewritten -------------------------
  {
    const long = `${'The point nobody in this industry wants to hear is that '.repeat(3)}it ends.`;
    const pack = captionPack({ transcript: long, destination: 'tiktok' });
    assert.equal(pack.hook_line.fits_before_truncation, false);
    assert.equal(pack.hook_line.over_truncation_by, pack.hook_line.chars - 100);
    assert.equal(pack.hook_line.visible_before_truncation, pack.hook_line.text.slice(0, 100), 'the visible part is a slice, not a rewrite');
  }
  ok('a hook past the truncation point is reported with the actual overflow, never shortened for the user');

  // ---- the X hard limit ------------------------------------------------------
  {
    const long = `${'Character limits on this platform are a real constraint and this sentence keeps going to prove it, '.repeat(3)}done.`;
    const pack = captionPack({ transcript: long, destination: 'x' });
    assert.ok(pack.hook_line.chars > 280);
    assert.equal(pack.hook_line.over_hard_limit_by, pack.hook_line.chars - 280);
    assert.ok(pack.hook_line.hard_limit_note, 'over the hard limit must say it cannot ship as-is');
    assert.equal(pack.counts.remaining_after_hook, 0, 'remaining budget never goes negative');
  }
  ok('a hook over X\'s 280-character hard limit is flagged with the exact overflow');

  // ---- hashtag rule checks -----------------------------------------------------
  {
    const pack = captionPack({
      transcript: 'Hiring is broken. Here is the fix.',
      destination: 'linkedin',
      hashtags: ['#hiring', '#startups', '#engineering', '#work'],
    });
    const tags = pack.scaffold.find((s) => s.slot === 'hashtags');
    assert.equal(tags.count, 4);
    assert.equal(tags.problems.length, 1);
    assert.match(tags.problems[0], /at most 3/);

    const fine = captionPack({
      transcript: 'Hiring is broken. Here is the fix.',
      destination: 'linkedin',
      hashtags: ['#hiring', '#startups'],
    });
    assert.deepEqual(fine.scaffold.find((s) => s.slot === 'hashtags').problems, []);

    const malformed = captionPack({
      transcript: 'Hiring is broken.',
      destination: 'x',
      hashtags: ['hiring', '#two words'],
    });
    assert.equal(malformed.scaffold.find((s) => s.slot === 'hashtags').problems.length, 2);
  }
  ok('supplied hashtags are checked against the destination\'s count rule and basic well-formedness');

  // ---- refusals ----------------------------------------------------------------
  {
    assert.throws(() => captionPack({ transcript: 'Fine.', destination: 'myspace' }), (e) => e.code === 'unknown_destination');
    assert.throws(() => captionPack({ transcript: '   ', destination: 'tiktok' }), (e) => e.code === 'empty_transcript');
    assert.throws(() => captionPack({ transcript: 'Fine.', destination: 'constructor' }), (e) => e.code === 'unknown_destination');
  }
  ok('captionPack refuses an unknown destination (including prototype keys) and an empty transcript');

  console.log(`\n${passed} captions.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
