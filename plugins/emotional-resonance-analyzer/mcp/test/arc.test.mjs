#!/usr/bin/env node
/**
 * Regression tests for lib/arc.js.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/arc.test.mjs
 */
import assert from 'node:assert/strict';
import { monotonyStretches, plotArc } from '../lib/arc.js';
import { normaliseScenes } from '../lib/scenes.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const scene = (position, start, end, valence, intensity = 3) => ({ position, start, end, valence, intensity });

try {
  // ---- two flat stretches on either side of a real jump are not merged ---
  // Regression test: the merge check only compared scene-index adjacency
  // (`left <= last.toIndex + 1`), which two genuinely different flat levels
  // satisfy whenever they sit right next to each other in the scene list —
  // reporting one falsely-merged stretch that claims no meaningful valence
  // movement across a span that actually jumps from 0 to 5.
  {
    const scenes = [0, 0, 0, 5, 5, 5].map((v, i) => scene(i + 1, i * 200, (i + 1) * 200, v));
    const stretches = monotonyStretches(scenes);
    assert.equal(stretches.length, 2, `expected two separate flat stretches, got: ${JSON.stringify(stretches.map((s) => s.scores))}`);
    assert.deepEqual(stretches[0].scores, [0, 0, 0]);
    assert.deepEqual(stretches[1].scores, [5, 5, 5]);
  }
  ok('two adjacent flat stretches at different valence levels are reported separately, not merged into one falsely-flat span');

  // ---- a genuinely continuous flat stretch still merges across checkpoints
  {
    const scenes = Array.from({ length: 10 }, (_, i) => scene(i + 1, i * 200, (i + 1) * 200, 2));
    const stretches = monotonyStretches(scenes);
    assert.equal(stretches.length, 1, 'ten scenes at a constant valence must still be reported as one continuous stretch');
    assert.equal(stretches[0].scores.length, 10);
  }
  ok('a genuinely continuous flat run is still merged into a single stretch');

  // ---- MONOTONY_SHIFT boundary: a shift of exactly 2 breaks flatness -----
  // arc.js documents the tell as "no shift of two or more valence points" and
  // implements the window check as `range(left, right) >= shift` — hand-traced
  // below, since this is exactly the kind of `>` vs `>=` the codebase has
  // gotten wrong at a documented boundary before.
  //
  // Values 0,0,0,2,2,2 at 200s apart (1200s total): the window can never
  // legally span both plateaus (their range is exactly 2, the shift itself),
  // so the two three-scene runs must come back as two separate 600s-ish
  // stretches, not one.
  {
    const scenes = [0, 0, 0, 2, 2, 2].map((v, i) => scene(i + 1, i * 200, (i + 1) * 200, v));
    const stretches = monotonyStretches(scenes);
    assert.equal(stretches.length, 2, `a shift of exactly 2 must split the stretch, got: ${JSON.stringify(stretches.map((s) => s.scores))}`);
    assert.deepEqual(stretches[0].scores, [0, 0, 0]);
    assert.deepEqual(stretches[1].scores, [2, 2, 2]);
  }
  ok('MONOTONY_SHIFT boundary: a valence shift of exactly 2 (the documented "two or more") breaks a flat stretch in two, rather than being tolerated as still-flat');

  // ---- the same series with a shift of only 1 must NOT break flatness ----
  // Values 0,0,0,1,1,1 never move by 2 anywhere inside any window, so by the
  // same "no shift of two or more" rule the whole run is one flat stretch —
  // the mirror case of the test above, hand-traced the same way.
  {
    const scenes = [0, 0, 0, 1, 1, 1].map((v, i) => scene(i + 1, i * 200, (i + 1) * 200, v));
    const stretches = monotonyStretches(scenes);
    assert.equal(stretches.length, 1, `a shift of only 1 must never break flatness, got: ${JSON.stringify(stretches.map((s) => s.scores))}`);
    assert.deepEqual(stretches[0].scores, [0, 0, 0, 1, 1, 1]);
  }
  ok('a valence shift of only 1 (below the documented threshold) does not break a flat stretch, even repeated across the whole series');

  // ---- MONOTONY_WINDOW_SECONDS boundary: exactly 300s counts, 299s doesn't
  {
    const atBoundary = [scene(1, 0, 150, 0), scene(2, 150, 300, 0)];
    const justUnder = [scene(1, 0, 149, 0), scene(2, 149, 299, 0)];
    assert.equal(monotonyStretches(atBoundary).length, 1, 'a flat span of exactly 300 seconds (five minutes) must be reported');
    assert.equal(monotonyStretches(justUnder).length, 0, 'a flat span of 299 seconds must not be reported — it is one second short of the documented five-minute window');
  }
  ok('MONOTONY_WINDOW_SECONDS boundary: a flat span of exactly 300 seconds is reported, 299 seconds is not');

  // ---- plotArc against the 12-scene worked example in references/arc-scoring.md ----
  // Timecodes, durations, valence and intensity are copied verbatim from the
  // "Worked example — 12-scene short doc, 11:40" table. Every scene's
  // start+duration was hand-checked to land exactly on the next scene's own
  // timecode (and the last on the stated 11:40 total) before using it here,
  // so normaliseScenes has nothing to silently paper over.
  const rawWorkedExample = [
    { timecode: '00:00', valence: -1, intensity: 2, duration: '0:35' }, // 1: dawn, radio news
    { timecode: '00:35', valence: 0, intensity: 2, duration: '0:50' },  // 2: Dan opens up
    { timecode: '01:25', valence: 0, intensity: 2, duration: '1:40' },  // 3: history, archive
    { timecode: '03:05', valence: 0, intensity: 2, duration: '1:20' },  // 4: economics, expert
    { timecode: '04:25', valence: 0, intensity: 2, duration: '1:10' },  // 5: council planning
    { timecode: '05:35', valence: 1, intensity: 3, duration: '0:45' },  // 6: the ledger book
    { timecode: '06:20', valence: -2, intensity: 4, duration: '1:50' }, // 7: Dan on his father
    { timecode: '08:10', valence: -2, intensity: 4, duration: '0:40' }, // 8: buyer's letter
    { timecode: '08:50', valence: -1, intensity: 4, duration: '0:55' }, // 9: argument in the shed
    { timecode: '09:45', valence: 3, intensity: 5, duration: '0:35' },  // 10: the vote
    { timecode: '10:20', valence: 2, intensity: 3, duration: '0:50' },  // 11: celebration
    { timecode: '11:10', valence: 2, intensity: 2, duration: '0:30' },  // 12: dawn again, credits
  ];
  const { scenes: weScenes, runtime: weRuntime } = normaliseScenes(rawWorkedExample, { totalRuntime: '11:40' });
  assert.equal(weRuntime, 700, 'sanity check: 11:40 must read as 700 seconds before anything downstream is trusted');
  const weArc = plotArc(weScenes, weRuntime);

  // ---- largest_valence_gap: hand-derived from the same table (the doc's own
  // prose doesn't state a number for this figure, so this is independent
  // arithmetic over the doc's data, not a value copied from the doc or from
  // running the code). Valence deltas of >=2 occur only at scene 7 (1 -> -2,
  // a jump of 3, at 06:20/380s) and scene 10 (-1 -> 3, a jump of 4, at
  // 09:45/585s). Boundaries are [0, 380, 585, 700]; the gaps are 380, 205 and
  // 115 seconds, so the largest is 0:00-06:20, 380s, which exceeds the
  // 300-second "look here first" threshold.
  {
    const gap = weArc.largest_valence_gap;
    assert.equal(gap.from, '00:00');
    assert.equal(gap.to, '06:20');
    assert.equal(gap.duration_seconds, 380);
    assert.equal(gap.valence_changes_of_two_or_more, 2);
    assert.equal(gap.look_here_first, true, '380s exceeds the 300s ("five minutes") threshold, so look_here_first must be true');
  }
  ok('plotArc.largest_valence_gap on the worked 12-scene example matches hand-derived boundaries: the 06:20 gap (380s) beats the other two (205s, 115s) and trips look_here_first');

  // ---- intensity_peaks: scene 10 (the only intensity-5 scene) is followed
  // by intensities 3 then 2, never dropping to 1 or below before the film
  // ends — "no landing", exactly as the doc's prose states.
  {
    const peaks = weArc.intensity_peaks;
    assert.equal(peaks.count, 1);
    assert.equal(peaks.scale_drift, false, 'one intensity-5 scene is nowhere near the >3 scale-drift threshold');
    assert.equal(peaks.peaks.length, 1);
    assert.equal(peaks.peaks[0].scene, 10);
    assert.equal(peaks.peaks[0].timecode, '09:45');
    assert.equal(peaks.peaks[0].landed, false);
    assert.equal(peaks.peaks[0].no_landing, true);
    assert.deepEqual(peaks.peaks[0].intensities_after, [3, 2]);
  }
  ok('plotArc.intensity_peaks flags scene 10\'s intensity-5 peak as not landed, matching the doc\'s "never dropping to 1 — no landing" reading');

  // ---- whiplash: two valence swings of 3+ (scene 6->7: 1 to -2, a swing of
  // 3; scene 9->10: -1 to 3, a swing of 4), but they are not adjacent to each
  // other, so the longest *consecutive* run of such swings is 1, not 2.
  {
    assert.equal(weArc.whiplash.valence_swings_of_three_or_more, 2);
    assert.equal(weArc.whiplash.longest_consecutive_run_of_such_swings, 1, 'the two big swings (scenes 6-7 and 9-10) are separated by two calmer scenes, so they must not count as one consecutive run');
  }
  ok('plotArc.whiplash counts both valence swings of 3+ in the worked example but correctly does not treat them as one consecutive run');

  // ---- intensity_flat_3_to_4 (fatigue): the only intensity-3/4 band run in
  // this table is scenes 6-9 (positions 6,7,8,9 hold 3,4,4,4), spanning
  // 05:35 (335s) to 08:50-end (585s) — 250 seconds, short of the 300-second
  // window used for this pattern, so it must not be reported.
  {
    assert.deepEqual(weArc.intensity_flat_3_to_4.stretches, [], 'the only 3-4 intensity band run in the worked example is 250 seconds, 50 short of the 300-second window, so it must not be flagged');
  }
  ok('plotArc.intensity_flat_3_to_4 does not flag the worked example\'s one 3-4 band run because it falls short of the 300-second window');

  // ---- last_quarter_intensity: runtime 700s, last quarter starts at 525s
  // (0.75 x 700). Scenes starting at or after 525s are positions 9-12
  // (530, 585, 620, 670), with intensities 4, 5, 3, 2 — not non-decreasing
  // (5 -> 3 drops), so rising_throughout must be false.
  {
    assert.deepEqual(weArc.last_quarter_intensity.intensities, [4, 5, 3, 2]);
    assert.equal(weArc.last_quarter_intensity.rising_throughout, false, 'intensity drops from 5 to 3 within the last quarter, so it is not rising throughout');
  }
  ok('plotArc.last_quarter_intensity picks the correct four scenes at the 0.75-runtime cutoff and correctly reports them as not monotonically rising');

  // ---- monotony_stretches on the full 12-scene series. NOTE ON A DOC
  // DISCREPANCY: the reference's prose says "Valence sits at exactly 0 from
  // 00:35 to 05:35" (positions 2-5 only), but the *formal* rule stated in the
  // very same document — "no shift of two or more valence points between any
  // two scenes inside a five-minute window" — is more permissive than
  // "constant value". Position 1 (valence -1) sits only 1 point from the 0s
  // that follow it, and position 6 (valence +1) is only 1 point above them
  // too, so neither breaks the >=2-shift rule, and the sliding window
  // legitimately extends to include them. Hand-tracing the algorithm here
  // rather than copying its output: at right=4 (position 5, end=335) the
  // window [0,4] first reaches 300s with range 1 (<2), producing stretch
  // {0-4} = positions 1-5 (335s); at right=5 (position 6, end=380) the range
  // over [0,5] is 2 (>=shift), so left shrinks to 1, giving window [1,5] =
  // positions 2-6 (345s) with range 1 (<2) — and this does NOT merge with
  // {0-4} because range(0,5) is 2, not <2. So the code (correctly, per its
  // own formal rule) reports two overlapping stretches wider than the doc's
  // narrower "00:35-05:35" prose describes. This is flagged as a
  // documentation-clarity gap, not a code bug — the code matches the formal
  // rule the same doc states.
  {
    const stretches = weArc.monotony_stretches;
    assert.equal(stretches.length, 2, `expected two overlapping flat-window stretches per the formal >=2-shift rule, got: ${JSON.stringify(stretches)}`);
    assert.equal(stretches[0].from, '00:00');
    assert.equal(stretches[0].to, '05:35');
    assert.equal(stretches[0].scenes, '1–5');
    assert.equal(stretches[0].duration_seconds, 335);
    assert.deepEqual(stretches[0].scores, [-1, 0, 0, 0, 0]);
    assert.equal(stretches[1].from, '00:35');
    assert.equal(stretches[1].to, '06:20');
    assert.equal(stretches[1].scenes, '2–6');
    assert.equal(stretches[1].duration_seconds, 345);
    assert.deepEqual(stretches[1].scores, [0, 0, 0, 0, 1]);
  }
  ok('plotArc.monotony_stretches on the worked example matches a hand-trace of the sliding-window algorithm (wider than the reference doc\'s narrower prose description — see comment, a doc-clarity gap not a code bug)');

  // ---- scale_drift boundary: exactly three intensity-5 peaks is fine, a
  // fourth trips the "scale has drifted" flag documented in scoring.js and
  // arc-scoring.md ("More than three 5s means the scale has drifted").
  {
    const threePeaks = [5, 0, 5, 0, 5, 0].map((iv, i) => scene(i + 1, i * 100, (i + 1) * 100, 0, iv));
    const three = plotArc(threePeaks, 600).intensity_peaks;
    assert.equal(three.count, 3);
    assert.equal(three.scale_drift, false, 'exactly three intensity-5 scenes must not trip scale_drift — the rule is "more than three"');
    assert.equal(three.scale_drift_note, undefined);

    const fourPeaks = [5, 0, 5, 0, 5, 0, 5, 0].map((iv, i) => scene(i + 1, i * 100, (i + 1) * 100, 0, iv));
    const four = plotArc(fourPeaks, 800).intensity_peaks;
    assert.equal(four.count, 4);
    assert.equal(four.scale_drift, true, 'a fourth intensity-5 scene must trip scale_drift');
    assert.match(four.scale_drift_note, /scale has drifted/);
  }
  ok('scale_drift boundary: three intensity-5 peaks do not trip the "scale has drifted" flag, a fourth does');

  // ---- last_quarter rising_throughout: non-decreasing-but-flat and a real
  // decrease must both read as false; only a genuine rise reads as true.
  {
    const rising = plotArc([scene(1, 0, 25, 0, 1), scene(2, 25, 50, 0, 1), scene(3, 75, 90, 0, 2), scene(4, 90, 100, 0, 4)], 100);
    assert.deepEqual(rising.last_quarter_intensity.intensities, [2, 4]);
    assert.equal(rising.last_quarter_intensity.rising_throughout, true);

    const flat = plotArc([scene(1, 0, 25, 0, 1), scene(2, 25, 50, 0, 1), scene(3, 75, 90, 0, 2), scene(4, 90, 100, 0, 2)], 100);
    assert.deepEqual(flat.last_quarter_intensity.intensities, [2, 2]);
    assert.equal(flat.last_quarter_intensity.rising_throughout, false, 'two equal intensities are non-decreasing but the last is not greater than the first, so this is not a rise');

    const falling = plotArc([scene(1, 0, 25, 0, 1), scene(2, 25, 50, 0, 1), scene(3, 75, 90, 0, 4), scene(4, 90, 100, 0, 2)], 100);
    assert.deepEqual(falling.last_quarter_intensity.intensities, [4, 2]);
    assert.equal(falling.last_quarter_intensity.rising_throughout, false);
  }
  ok('last_quarter_intensity.rising_throughout requires a genuine, monotonic rise: flat (equal) and falling last quarters both read as false');

  // ---- intensity_flat_3_to_4: the band is inclusive of exactly 3 and 4, and
  // the same 300-second window boundary as monotony applies. Scenes at
  // intensity 2 and 5 flank a 3-then-4 run whose duration is exactly 300s.
  {
    const atBoundary = plotArc([
      scene(1, 0, 10, 0, 2),
      scene(2, 10, 160, 0, 3),
      scene(3, 160, 310, 0, 4),
      scene(4, 310, 320, 0, 5),
    ], 320).intensity_flat_3_to_4;
    assert.equal(atBoundary.stretches.length, 1, 'a 3-then-4 band run of exactly 300 seconds must be reported');
    assert.deepEqual(atBoundary.stretches[0].intensities, [3, 4], 'the flanking intensity-2 and intensity-5 scenes must not be swept into the band run');
    assert.equal(atBoundary.stretches[0].duration_seconds, 300);

    const justUnder = plotArc([
      scene(1, 0, 10, 0, 2),
      scene(2, 10, 160, 0, 3),
      scene(3, 160, 309, 0, 4),
      scene(4, 309, 320, 0, 5),
    ], 320).intensity_flat_3_to_4;
    assert.deepEqual(justUnder.stretches, [], 'a 299-second band run must not be reported — one second short of the 300-second window');
  }
  ok('intensity_flat_3_to_4 band is inclusive of intensity 3 and 4 only, and applies the same 300-second boundary as monotony (300s reported, 299s not)');

  console.log(`\n${passed} arc.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
