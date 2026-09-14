#!/usr/bin/env node
/**
 * Regression tests for lib/archetypes.js: the transcript scan that finds the
 * seven archetypes' literal tells, plus archetypeFor lookup.
 *
 * The scan is pattern-matching, not arithmetic, so the "worked example" here
 * is reasoning out by hand — from the PHRASE_TELLS/ENUMERATION_TELLS tables
 * and the digit/two-marker conditions stated in the module's own comments —
 * exactly which turns of a hand-built transcript should and should not match,
 * before running it, rather than trusting whatever the scan happens to emit.
 *
 *   node plugins/podcast-video-studio/mcp/test/archetypes.test.mjs
 */
import assert from 'node:assert/strict';
import { ARCHETYPES, archetypeFor, scanCandidates } from '../lib/archetypes.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- archetypeFor: lookup is case/whitespace-insensitive, unknown -> null ----
  {
    assert.equal(archetypeFor('contrarian_claim').name, 'The contrarian claim');
    assert.equal(archetypeFor('  Say_That_Again  ').id, 'say_that_again', 'lookup must trim and lowercase');
    assert.equal(archetypeFor('not_an_archetype'), null);
    assert.equal(ARCHETYPES.length, 7, 'sanity-check: the table documents exactly seven archetypes');
  }
  ok('archetypeFor looks up a known id case- and whitespace-insensitively, and returns null for an unrecognised one');

  // ---- a transcript with no timecodes anywhere: scan still runs, but flags it ----
  {
    const result = scanCandidates('Guest: Everyone thinks pricing should be simple.');
    assert.equal(result.timecodes_found, false);
    assert.match(result.timecode_note, /No timecodes were found/);
    assert.equal(result.candidates_found, 1);
    assert.equal(result.candidates[0].archetypes[0].archetype, 'contrarian_claim');
  }
  ok('scanCandidates still matches tells with no timecodes present, but reports timecodes_found=false with the no-timecodes note');

  // ---- specific_number requires a digit in the SAME sentence as the phrase ----
  // "it costs" with no digit anywhere in that sentence must not count as a
  // specific_number tell -- the module's own comment says the tell is "digits
  // alongside these phrases, not the phrases alone."
  {
    const noDigit = scanCandidates('Guest: It costs a lot to hire well.');
    assert.equal(noDigit.candidates_found, 0, 'a number-phrase with no digit in the sentence must not match specific_number');

    const withDigit = scanCandidates('Guest: We went from three thousand to one hundred and twenty thousand dollars in 2019.');
    assert.equal(withDigit.candidates_found, 1);
    assert.deepEqual(withDigit.candidates[0].archetypes, [{ archetype: 'specific_number', tells: ['we went from'] }]);
  }
  ok('scanCandidates requires a digit in the same sentence as a specific_number phrase, and matches once that digit is present');

  // ---- practical_how_to enumeration needs TWO distinct markers in one turn ----
  {
    const oneMarker = scanCandidates('Guest: First, we look at the data.');
    assert.equal(oneMarker.candidates_found, 0, 'a single enumeration marker ("first" alone) must not trigger practical_how_to');

    const twoMarkers = scanCandidates('Guest: First we cut costs. Then we doubled down on referrals.');
    assert.equal(twoMarkers.candidates_found, 1);
    assert.deepEqual(twoMarkers.candidates[0].archetypes, [{ archetype: 'practical_how_to', tells: ['first', 'then'] }]);
    assert.equal(twoMarkers.candidates[0].evidence, 'First we cut costs.', 'evidence must be the sentence containing the first named tell, not the whole turn');
  }
  ok('scanCandidates requires two distinct enumeration markers in one turn for practical_how_to, and one marker alone does not trigger it');

  // ---- practical_how_to direct-address phrase triggers alone, no count needed ----
  {
    const result = scanCandidates('Guest: What you do is send a follow-up within an hour.');
    assert.equal(result.candidates_found, 1);
    assert.deepEqual(result.candidates[0].archetypes, [{ archetype: 'practical_how_to', tells: ['what you do is'] }]);
  }
  ok('scanCandidates treats a single direct-address phrase as sufficient for practical_how_to, unlike the enumeration markers which need two');

  // ---- host_disagreement: multiple tells in one turn, including the [crosstalk] marker ----
  {
    const result = scanCandidates("Host: Hold on, no, but that's not right at all. [crosstalk]");
    assert.equal(result.candidates_found, 1);
    const [entry] = result.candidates[0].archetypes;
    assert.equal(entry.archetype, 'host_disagreement');
    assert.deepEqual(entry.tells.sort(), ['[crosstalk]', 'hold on', 'no, but'].sort());
    assert.equal(result.transcript_markers.crosstalk, 1, 'the [crosstalk] marker must also be tallied separately in transcript_markers');
  }
  ok('scanCandidates finds every host_disagreement tell present in a turn, including [crosstalk], and tallies the crosstalk marker count separately');

  // ---- say_that_again tells and the [laughs] marker tally --------------------
  {
    const result = scanCandidates('Guest: Wait, how much? [laughs]');
    assert.equal(result.candidates_found, 1);
    assert.deepEqual(result.candidates[0].archetypes[0].tells.sort(), ['[laughs]', 'wait, how much?'].sort());
    assert.equal(result.transcript_markers.laughs, 1);
    assert.equal(result.transcript_markers.inaudible, 0);
  }
  ok('scanCandidates matches say_that_again tells including [laughs], and tallies the laughs marker count correctly when absent elsewhere');

  // ---- a turn matching no tell at all produces no candidate ------------------
  {
    const result = scanCandidates('Guest: We had a good conversation about the weather today.');
    assert.equal(result.candidates_found, 0);
    assert.equal(result.turns_scanned, 1, 'the turn is still scanned, it just matches nothing');
  }
  ok('scanCandidates leaves a turn with no matching tell out of candidates entirely, rather than emitting an empty-archetypes entry');

  // ---- evidence is truncated at 240 characters with an ellipsis --------------
  {
    const longSentence = `It's like ${'a'.repeat(400)}.`;
    const result = scanCandidates(`Guest: ${longSentence}`);
    assert.equal(result.candidates_found, 1);
    const evidence = result.candidates[0].evidence;
    assert.equal(evidence.length, 241, '240 kept characters plus one ellipsis character');
    assert.ok(evidence.endsWith('…'), 'a truncated quote must end with an ellipsis');
    assert.equal(evidence.slice(0, 240), longSentence.slice(0, 240));
  }
  ok('scanCandidates truncates an evidence quote longer than 240 characters and appends an ellipsis rather than returning the full run-on sentence');

  // ---- multi-turn transcript with timecodes: turns_scanned and timecode note ----
  {
    const transcript = [
      '[00:01:15] Guest: Everyone thinks pricing should be simple.',
      '',
      '[00:02:03] Guest: We had a good chat about nothing in particular.',
    ].join('\n');
    const result = scanCandidates(transcript);
    assert.equal(result.turns_scanned, 2);
    assert.equal(result.candidates_found, 1);
    assert.equal(result.candidates[0].timecode, '00:01:15');
    assert.equal(result.timecodes_found, true);
    assert.match(result.timecode_note, /drift/);
  }
  ok('scanCandidates attaches the nearest preceding timecode to a matched turn and reports timecodes_found=true with the drift note when timecodes are present');

  console.log(`\n${passed} archetypes.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
