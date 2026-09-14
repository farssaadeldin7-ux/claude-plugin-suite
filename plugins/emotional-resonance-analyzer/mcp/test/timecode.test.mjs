#!/usr/bin/env node
/**
 * Regression tests for lib/timecode.js: parsing "SS" / "M:SS" / "H:MM:SS" /
 * plain-number seconds, and formatting back.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/timecode.test.mjs
 */
import assert from 'node:assert/strict';
import { toSeconds, toTimecode } from '../lib/timecode.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- toSeconds: the three accepted shapes -------------------------------
  {
    assert.equal(toSeconds(125), 125, 'a plain number is passed through');
    assert.equal(toSeconds('125'), 125, 'a numeric string is read as seconds');
    assert.equal(toSeconds('45.5'), 45.5, 'a fractional numeric string is accepted');
    assert.equal(toSeconds('1:05'), 65, 'M:SS');
    assert.equal(toSeconds('11:40'), 700, 'M:SS — the worked-example runtime');
    assert.equal(toSeconds('1:05:09'), 3909, 'H:MM:SS');
    assert.equal(toSeconds('0:00'), 0);
  }
  ok('toSeconds reads plain numbers, numeric strings, M:SS and H:MM:SS correctly');

  // ---- toSeconds: rejects out-of-range minute/second components ----------
  // The regex only accepts 0-59 for the minutes-of-hour and seconds fields
  // ([0-5]?\d); "1:60" is not a real M:SS value and must not silently read
  // as some other number of seconds.
  {
    assert.equal(toSeconds('1:59'), 119, '59 seconds is the last valid value in the field');
    assert.equal(toSeconds('1:60'), null, '60 is not a valid seconds-field value — must not parse');
    assert.equal(toSeconds('1:05:60'), null, '60 is not a valid seconds value in H:MM:SS either');
    assert.equal(toSeconds('1:60:00'), null, '60 is not a valid minutes value in H:MM:SS');
  }
  ok('toSeconds rejects an out-of-range minutes/seconds component (60) rather than mis-parsing it');

  // ---- toSeconds: negative numbers and garbage are rejected ---------------
  {
    assert.equal(toSeconds(-5), null, 'a negative plain number is not a valid timecode');
    assert.equal(toSeconds('-5'), null, 'a negative numeric string is not a valid timecode');
    assert.equal(toSeconds('abc'), null);
    assert.equal(toSeconds(''), null);
    assert.equal(toSeconds(null), null);
    assert.equal(toSeconds(undefined), null);
    assert.equal(toSeconds(NaN), null);
    assert.equal(toSeconds(Infinity), null);
  }
  ok('toSeconds rejects negative numbers, non-finite numbers and unreadable strings, returning null rather than guessing');

  // ---- toSeconds: whitespace is trimmed -----------------------------------
  {
    assert.equal(toSeconds('  90  '), 90);
    assert.equal(toSeconds('  1:30  '), 90);
  }
  ok('toSeconds trims surrounding whitespace before parsing');

  // ---- toTimecode: formatting, including the hour cutover ----------------
  {
    assert.equal(toTimecode(0), '00:00');
    assert.equal(toTimecode(59), '00:59');
    assert.equal(toTimecode(60), '01:00', '60 seconds must roll over into the minutes field');
    assert.equal(toTimecode(335), '05:35');
    assert.equal(toTimecode(3599), '59:59', 'one second short of an hour must still be M:SS, not H:MM:SS');
    assert.equal(toTimecode(3600), '1:00:00', 'exactly one hour must switch to H:MM:SS');
    assert.equal(toTimecode(3661), '1:01:01');
  }
  ok('toTimecode formats M:SS below an hour and switches to H:MM:SS at exactly 3600 seconds');

  // ---- toTimecode: rounding and clamping ----------------------------------
  {
    assert.equal(toTimecode(59.6), '01:00', 'fractional seconds are rounded, not truncated');
    assert.equal(toTimecode(-5), '00:00', 'a negative value is clamped to zero rather than producing a negative timecode');
    assert.equal(toTimecode(null), null);
    assert.equal(toTimecode(NaN), null);
    assert.equal(toTimecode(Infinity), null);
  }
  ok('toTimecode rounds fractional seconds, clamps negatives to zero, and returns null for non-finite input');

  // ---- round-trip on the worked-example timecodes -------------------------
  {
    for (const tc of ['00:00', '00:35', '01:25', '05:35', '06:20', '09:45', '11:10', '11:40']) {
      assert.equal(toTimecode(toSeconds(tc)), tc, `round-trip must be exact for ${tc}`);
    }
  }
  ok('toSeconds/toTimecode round-trip exactly for every timecode used in the arc-scoring worked example');

  console.log(`\n${passed} timecode.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
