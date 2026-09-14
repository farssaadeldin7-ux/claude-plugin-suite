#!/usr/bin/env node
/**
 * Regression tests for lib/scenes.js: normalisation and validation of the
 * scored scene table, plus the span-arithmetic helpers other modules build on.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/scenes.test.mjs
 */
import assert from 'node:assert/strict';
import { normaliseScenes, spanDuration, spanRange } from '../lib/scenes.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const throws = (fn, codeMatch) => {
  try {
    fn();
    return null;
  } catch (err) {
    if (codeMatch && err.code !== codeMatch) {
      throw new Error(`expected ToolError code "${codeMatch}", got "${err.code}": ${err.message}`);
    }
    return err;
  }
};

try {
  // ---- at least two scenes are required -----------------------------------
  {
    assert.ok(throws(() => normaliseScenes([]), 'invalid_scenes'));
    assert.ok(throws(() => normaliseScenes([{ timecode: '0:00', valence: 0, intensity: 0 }]), 'invalid_scenes'), 'a single scene must be rejected — the derivative needs at least two points');
    assert.ok(throws(() => normaliseScenes(null), 'invalid_scenes'));
  }
  ok('normaliseScenes rejects fewer than two scenes');

  // ---- valence boundary: -3 and +3 accepted, -4 and +4 rejected ----------
  const two = (overrides) => [
    { timecode: '0:00', valence: 0, intensity: 0 },
    { timecode: '1:00', valence: 0, intensity: 0, ...overrides },
  ];
  {
    assert.equal(normaliseScenes(two({ valence: -3 })).scenes[1].valence, -3);
    assert.equal(normaliseScenes(two({ valence: 3 })).scenes[1].valence, 3);
    assert.ok(throws(() => normaliseScenes(two({ valence: -4 })), 'invalid_scene'), 'valence -4 is out of range and must be rejected');
    assert.ok(throws(() => normaliseScenes(two({ valence: 4 })), 'invalid_scene'), 'valence +4 is out of range and must be rejected');
    assert.ok(throws(() => normaliseScenes(two({ valence: 1.5 })), 'invalid_scene'), 'a non-integer valence must be rejected');
  }
  ok('normaliseScenes accepts valence -3..+3 inclusive and rejects -4, +4 and non-integers');

  // ---- intensity boundary: 0 and 5 accepted, -1 and 6 rejected ------------
  {
    assert.equal(normaliseScenes(two({ intensity: 0 })).scenes[1].intensity, 0);
    assert.equal(normaliseScenes(two({ intensity: 5 })).scenes[1].intensity, 5);
    assert.ok(throws(() => normaliseScenes(two({ intensity: -1 })), 'invalid_scene'), 'intensity -1 is out of range and must be rejected');
    assert.ok(throws(() => normaliseScenes(two({ intensity: 6 })), 'invalid_scene'), 'intensity 6 is out of range and must be rejected');
    assert.ok(throws(() => normaliseScenes(two({ intensity: 2.5 })), 'invalid_scene'), 'a non-integer intensity must be rejected');
  }
  ok('normaliseScenes accepts intensity 0..5 inclusive and rejects -1, 6 and non-integers');

  // ---- unreadable timecode / duration --------------------------------------
  {
    assert.ok(throws(() => normaliseScenes(two({ timecode: 'not-a-time' })), 'invalid_scene'));
    assert.ok(throws(() => normaliseScenes(two({ duration: 'not-a-time' })), 'invalid_scene'));
    assert.ok(throws(() => normaliseScenes(two({}), { totalRuntime: 'not-a-time' }), 'invalid_runtime'));
  }
  ok('normaliseScenes rejects an unreadable scene timecode, scene duration, or total_runtime');

  // ---- scenes must be in timeline order ------------------------------------
  {
    const err = throws(() => normaliseScenes([
      { timecode: '2:00', valence: 0, intensity: 0 },
      { timecode: '1:00', valence: 0, intensity: 0 },
    ]), 'invalid_scenes');
    assert.ok(err);
    assert.match(err.message, /before scene 1/);
  }
  ok('normaliseScenes rejects scenes that are not in ascending timeline order');

  // ---- duration filling: from the next scene's start, and from totalRuntime
  // for the last scene ----
  {
    const { scenes, runtime } = normaliseScenes([
      { timecode: '0:00', valence: 0, intensity: 0 },
      { timecode: '1:00', valence: 0, intensity: 0 },
      { timecode: '2:30', valence: 0, intensity: 0 },
    ], { totalRuntime: '4:00' });
    assert.equal(scenes[0].duration, 60, 'scene 1 duration is filled from scene 2\'s start (0 -> 60)');
    assert.equal(scenes[0].end, 60);
    assert.equal(scenes[1].duration, 90, 'scene 2 duration is filled from scene 3\'s start (60 -> 150)');
    assert.equal(scenes[2].duration, 90, 'the last scene\'s duration is filled from total_runtime (150 -> 240)');
    assert.equal(scenes[2].end, 240);
    assert.equal(runtime, 240);
  }
  ok('normaliseScenes fills a missing duration from the next scene\'s start, and the last scene\'s from total_runtime');

  // ---- without total_runtime, runtime falls back to the last scene's end,
  // and a missing final duration leaves end == start rather than guessing ---
  {
    const { scenes, runtime } = normaliseScenes([
      { timecode: '0:00', valence: 0, intensity: 0 },
      { timecode: '1:00', valence: 0, intensity: 0 },
    ]);
    assert.equal(scenes[1].duration, null, 'the last scene has nothing to derive a duration from and must not guess one');
    assert.equal(scenes[1].end, 60, 'with no duration, end falls back to start rather than being undefined');
    assert.equal(runtime, 60, 'runtime falls back to the last scene\'s own end when no total_runtime is given');
  }
  ok('with no total_runtime, runtime is the last scene\'s end, and its duration/end are start-based rather than guessed');

  // ---- explicit per-scene duration overrides the next-start default ------
  {
    const { scenes } = normaliseScenes([
      { timecode: '0:00', valence: 0, intensity: 0, duration: '0:10' },
      { timecode: '1:00', valence: 0, intensity: 0 },
    ]);
    assert.equal(scenes[0].duration, 10, 'an explicit duration must not be overwritten by the next scene\'s start');
    assert.equal(scenes[0].end, 10);
  }
  ok('an explicitly supplied duration is kept as given, not replaced by the next-scene gap');

  // ---- sceneCountNote boundary: 8 and 30 are silent, 7 and 31 warn --------
  const nScenes = (n) => Array.from({ length: n }, (_, i) => ({ timecode: String(i * 10), valence: 0, intensity: 0 }));
  {
    assert.equal(normaliseScenes(nScenes(8)).sceneCountNote, null, 'exactly 8 scenes is the documented lower bound and must not warn');
    assert.match(normaliseScenes(nScenes(7)).sceneCountNote, /Only 7 scenes/, 'fewer than 8 scenes must warn — the derivative is meaningless below the documented minimum');
    assert.equal(normaliseScenes(nScenes(30)).sceneCountNote, null, 'exactly 30 scenes is the documented upper bound and must not warn');
    assert.match(normaliseScenes(nScenes(31)).sceneCountNote, /31 scenes/, 'more than 30 scenes must warn — the documented guidance says you are scoring shots by then');
  }
  ok('sceneCountNote boundary: 8 and 30 scenes are silent (the documented 8-30 range), 7 and 31 both warn');

  // ---- optional flags pass through, defaulting sanely ----------------------
  {
    const { scenes } = normaliseScenes([
      { timecode: '0:00', valence: 0, intensity: 0, opens: ['Q1'], information_only: true, person_with_want: false, longest_talking_head_seconds: '0:45' },
      { timecode: '1:00', valence: 0, intensity: 0 },
    ]);
    assert.deepEqual(scenes[0].opens, ['Q1']);
    assert.deepEqual(scenes[0].closes, []);
    assert.equal(scenes[0].information_only, true);
    assert.equal(scenes[0].person_with_want, false);
    assert.equal(scenes[0].longest_talking_head_seconds, 45);
    assert.equal(scenes[1].information_only, null, 'a scene with no information_only flag must read as null (not checkable), not false');
    assert.equal(scenes[1].person_with_want, null);
    assert.equal(scenes[1].longest_talking_head_seconds, null);
    assert.deepEqual(scenes[1].opens, []);
  }
  ok('normaliseScenes passes through opens/closes/information_only/person_with_want/longest_talking_head_seconds, defaulting an absent boolean flag to null rather than false');

  // ---- spanDuration / spanRange --------------------------------------------
  // Scene 1: 0:00-0:35 (0-35). Scene 2: 0:35-1:25 (35-85). Scene 3: 1:25-3:05
  // (85-185). spanDuration(0,2) = scene3.end - scene1.start = 185 - 0 = 185.
  {
    const { scenes } = normaliseScenes([
      { timecode: '0:00', valence: -1, intensity: 2, duration: '0:35' },
      { timecode: '0:35', valence: 0, intensity: 2, duration: '0:50' },
      { timecode: '1:25', valence: 0, intensity: 2, duration: '1:40' },
    ]);
    assert.equal(spanDuration(scenes, 0, 2), 185);
    assert.equal(spanDuration(scenes, 1, 2), 150, 'scene3.end(185) - scene2.start(35) = 150');
    assert.equal(spanDuration(scenes, 0, 0), 35);

    const range = spanRange(scenes, 0, 2);
    assert.equal(range.from, '00:00');
    assert.equal(range.to, '03:05');
    assert.equal(range.scenes, '1–3');
    assert.equal(range.duration, '03:05');
    assert.equal(range.duration_seconds, 185);
  }
  ok('spanDuration and spanRange compute inclusive-index span arithmetic correctly against a hand-checked three-scene table');

  console.log(`\n${passed} scenes.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
