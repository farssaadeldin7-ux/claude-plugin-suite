#!/usr/bin/env node
/**
 * Regression tests for lib/destinations.js: destination lookup (including
 * the prototype-pollution guard the source comments call out explicitly)
 * and the length-band-fit arithmetic, with every documented band boundary
 * checked on both sides.
 *
 * Bands, from DESTINATIONS (seconds, inclusive both ends per destinationFit's
 * >= / <= comparisons):
 *   vertical_short_form (youtube_shorts, instagram_reels, tiktok): 20-60
 *   linkedin:        45-90
 *   x:                30-140
 *   youtube_chapter: 180-480
 * There is a genuine gap with no destination at all: 141-179 seconds.
 *
 *   node plugins/podcast-video-studio/mcp/test/destinations.test.mjs
 */
import assert from 'node:assert/strict';
import { DESTINATIONS, FLOOR_NOTE, destinationFor, destinationFit } from '../lib/destinations.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const idsOf = (result) => result.fits_length_band_of.map((f) => f.id);

try {
  // ---- destinationFor: case-insensitive lookup, unknown -> null -------------
  {
    assert.equal(destinationFor('TikTok').label, 'TikTok');
    assert.equal(destinationFor('  LinkedIn  ').label, 'LinkedIn native', 'lookup must trim and lowercase');
    assert.equal(destinationFor('linkedin').label, 'LinkedIn native');
    assert.equal(destinationFor('not_a_destination'), null);
  }
  ok('destinationFor looks up a known id case- and whitespace-insensitively and returns null for an unrecognised one');

  // ---- destinationFor: the hasOwn guard against inherited Object.prototype keys ----
  // The source comments this deliberately: `?? null` would let an inherited
  // property like "constructor" fall through and return
  // Object.prototype.constructor (the Object function itself, truthy), not
  // null. This is exactly the kind of guard that regresses silently if
  // someone "simplifies" destinationFor back to `DESTINATIONS[key] ?? null`.
  {
    assert.equal(destinationFor('constructor'), null, 'an inherited prototype key must not resolve to a truthy non-destination value');
    assert.equal(destinationFor('toString'), null);
    assert.equal(destinationFor('hasOwnProperty'), null);
  }
  ok('destinationFor returns null for inherited Object.prototype keys instead of leaking the inherited value');

  // ---- destinationFit: vertical_short_form floor (20s), inclusive -----------
  {
    const at20 = destinationFit(20);
    assert.ok(idsOf(at20).includes('youtube_shorts') && idsOf(at20).includes('instagram_reels') && idsOf(at20).includes('tiktok'), '20s is the documented floor and must fit the vertical short-form group');
    assert.equal(at20.floor_note, undefined, 'exactly on the floor must not trigger the below-floor note');

    const at19 = destinationFit(19);
    assert.ok(!idsOf(at19).includes('tiktok'), '19s is one below the vertical floor and must not fit it');
    assert.equal(at19.fits_length_band_of.length, 0, 'nothing else has a floor at or below 19s either');
    assert.ok(at19.no_fit_note, 'no destination fits 19s, so no_fit_note must be present');
    assert.equal(at19.floor_note, FLOOR_NOTE, 'below the 20s floor must attach the floor note');
  }
  ok('destinationFit treats the vertical short-form 20s floor as inclusive: fits at 20s, does not at 19s, and 19s also trips the floor note');

  // ---- destinationFit: vertical_short_form ceiling (60s), inclusive ---------
  {
    const at60 = destinationFit(60);
    assert.ok(idsOf(at60).includes('tiktok'), '60s is the documented vertical ceiling and must still fit');
    const at61 = destinationFit(61);
    assert.ok(!idsOf(at61).includes('tiktok'), '61s is one past the vertical ceiling and must not fit it');
  }
  ok('destinationFit treats the vertical short-form 60s ceiling as inclusive: fits at 60s, does not at 61s');

  // ---- destinationFit: x's floor (30s) sits inside the vertical band --------
  // 30s is within vertical_short_form's own 20-60 band too, so the clean
  // boundary signal is specifically whether "x" enters the fit set.
  {
    assert.ok(!idsOf(destinationFit(29)).includes('x'), '29s is one below x\'s 30s floor');
    assert.ok(idsOf(destinationFit(30)).includes('x'), '30s is exactly x\'s floor and must fit');
  }
  ok('destinationFit treats x\'s 30s floor as inclusive, distinguishing it from the overlapping vertical band at the same duration');

  // ---- destinationFit: x's ceiling (140s) -------------------------------------
  {
    const at140 = destinationFit(140);
    assert.deepEqual(idsOf(at140), ['x'], '140s is past every other band\'s ceiling and exactly at x\'s, so x must be the only fit');
    const at141 = destinationFit(141);
    assert.equal(at141.fits_length_band_of.length, 0, '141s is one past x\'s ceiling and falls into the 141-179s gap with no destination at all');
    assert.ok(at141.no_fit_note);
    assert.equal(at141.floor_note, undefined, '141s is well above the 20s floor and must not trigger the floor note');
  }
  ok('destinationFit treats x\'s 140s ceiling as inclusive, and the 141s just past it falls into the genuine coverage gap before youtube_chapter');

  // ---- destinationFit: linkedin's floor (45s) and ceiling (90s) -------------
  {
    assert.ok(!idsOf(destinationFit(44)).includes('linkedin'), '44s is one below linkedin\'s 45s floor');
    assert.ok(idsOf(destinationFit(45)).includes('linkedin'), '45s is exactly linkedin\'s floor and must fit');
    assert.ok(idsOf(destinationFit(90)).includes('linkedin'), '90s is exactly linkedin\'s ceiling and must fit');
    assert.ok(!idsOf(destinationFit(91)).includes('linkedin'), '91s is one past linkedin\'s 90s ceiling');
  }
  ok('destinationFit treats linkedin\'s 45-90s band as inclusive on both ends');

  // ---- destinationFit: youtube_chapter's floor (180s) and ceiling (480s) ----
  {
    assert.deepEqual(idsOf(destinationFit(180)), ['youtube_chapter'], '180s is exactly the chapter floor, and nothing else\'s band reaches this far');
    assert.equal(destinationFit(179).fits_length_band_of.length, 0, '179s is one below the chapter floor and still inside the coverage gap');
    assert.deepEqual(idsOf(destinationFit(480)), ['youtube_chapter'], '480s is exactly the chapter ceiling');
    assert.equal(destinationFit(481).fits_length_band_of.length, 0, '481s is one past every band\'s ceiling');
  }
  ok('destinationFit treats youtube_chapter\'s 180-480s band as inclusive on both ends, with nothing else reaching into it');

  console.log(`\n${passed} destinations.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
