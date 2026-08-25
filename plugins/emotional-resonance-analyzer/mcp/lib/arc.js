import { toTimecode } from './timecode.js';
import { spanDuration, spanRange } from './scenes.js';

/**
 * Pacing arithmetic on the valence/intensity series: the derivative reading
 * from the arc-scoring reference, computed mechanically. Flat stretches are
 * the problem, not low stretches, so everything here works on differences
 * between consecutive scenes, not levels. No output is a score of the film —
 * the scores come in from the editor, and only their shape is computed.
 */

const MONOTONY_WINDOW_SECONDS = 300; // "no valence change across five minutes"
const MONOTONY_SHIFT = 2; // "no shift of two or more valence points"

/**
 * Maximal stretches of consecutive scenes where a value never moves by
 * `shift` or more, lasting at least `windowSeconds`. Used for the
 * tonal-monotony tell (valence) and the fatigue pattern (intensity).
 */
function flatStretches(scenes, valueOf, { shift, windowSeconds }) {
  const found = [];
  let left = 0;
  for (let right = 0; right < scenes.length; right++) {
    // Shrink from the left until the window's value range is under the shift.
    const range = (a, b) => {
      let min = Infinity, max = -Infinity;
      for (let k = a; k <= b; k++) {
        min = Math.min(min, valueOf(scenes[k]));
        max = Math.max(max, valueOf(scenes[k]));
      }
      return max - min;
    };
    while (range(left, right) >= shift) left++;
    if (spanDuration(scenes, left, right) >= windowSeconds) {
      const last = found[found.length - 1];
      if (last && left <= last.toIndex + 1) {
        last.toIndex = right;
      } else {
        found.push({ fromIndex: left, toIndex: right });
      }
    }
  }
  return found.map(({ fromIndex, toIndex }) => ({
    ...spanRange(scenes, fromIndex, toIndex),
    // Quote the scores themselves to show the absence of movement, rather
    // than asserting that the section feels slow.
    score_at_start: valueOf(scenes[fromIndex]),
    score_at_end: valueOf(scenes[toIndex]),
    scores: scenes.slice(fromIndex, toIndex + 1).map(valueOf),
  }));
}

export function monotonyStretches(scenes) {
  return flatStretches(scenes, (s) => s.valence, {
    shift: MONOTONY_SHIFT,
    windowSeconds: MONOTONY_WINDOW_SECONDS,
  });
}

/**
 * The largest gap between valence changes of two or more points — the single
 * most useful derived figure. Change points are scene boundaries where the
 * valence moves by two or more; the gaps are measured between consecutive
 * change points, and from the film's start and end.
 */
function largestValenceGap(scenes, runtime) {
  const changePoints = [];
  for (let i = 1; i < scenes.length; i++) {
    if (Math.abs(scenes[i].valence - scenes[i - 1].valence) >= 2) {
      changePoints.push(scenes[i].start);
    }
  }
  const boundaries = [scenes[0].start, ...changePoints, runtime];
  let largest = { from: null, to: null, seconds: 0 };
  for (let i = 1; i < boundaries.length; i++) {
    const seconds = boundaries[i] - boundaries[i - 1];
    if (seconds > largest.seconds) {
      largest = { from: boundaries[i - 1], to: boundaries[i], seconds };
    }
  }
  return {
    from: toTimecode(largest.from),
    to: toTimecode(largest.to),
    duration: toTimecode(largest.seconds),
    duration_seconds: Math.round(largest.seconds),
    valence_changes_of_two_or_more: changePoints.length,
    look_here_first: largest.seconds > MONOTONY_WINDOW_SECONDS,
    note: 'The largest gap between valence changes of two or more points. If it exceeds five minutes, look there first.',
  };
}

/**
 * Intensity-5 peaks and whether each one lands: a 5 should be followed by a
 * drop to 1 or below before the next peak, or the peak is wasted. A peak that
 * is the film's final scene has nothing after it and is not flagged.
 */
function peaks(scenes) {
  const peakIndexes = scenes
    .map((s, i) => (s.intensity === 5 ? i : -1))
    .filter((i) => i !== -1);

  const list = peakIndexes.map((index, n) => {
    const nextPeak = peakIndexes[n + 1] ?? scenes.length;
    const after = scenes.slice(index + 1, nextPeak);
    const landed = after.some((s) => s.intensity <= 1);
    return {
      scene: scenes[index].position,
      timecode: toTimecode(scenes[index].start),
      landed: after.length ? landed : null,
      ...(after.length && !landed
        ? { no_landing: true, intensities_after: after.map((s) => s.intensity) }
        : {}),
    };
  });

  return {
    count: list.length,
    // "More than three 5s means the scale has drifted. Rescore rather than
    // argue with the flags that result."
    scale_drift: list.length > 3,
    ...(list.length > 3
      ? { scale_drift_note: 'More than three intensity-5 scenes means the scale has drifted. Rescore rather than argue with the flags that result.' }
      : {}),
    peaks: list,
  };
}

/**
 * The full derivative reading. Precisely defined patterns are computed;
 * where the reference leaves a pattern loosely stated ("a long stretch"),
 * the operationalisation used here is named in the output so the skill can
 * override it with judgement.
 */
export function plotArc(scenes, runtime) {
  const rows = scenes.map((s, i) => ({
    scene: s.position,
    timecode: toTimecode(s.start),
    duration: s.duration != null ? toTimecode(s.duration) : null,
    ...(s.description ? { description: s.description } : {}),
    valence: s.valence,
    intensity: s.intensity,
    valence_change: i ? s.valence - scenes[i - 1].valence : null,
    intensity_change: i ? s.intensity - scenes[i - 1].intensity : null,
  }));

  const valenceDeltas = rows.slice(1).map((r) => Math.abs(r.valence_change));
  let swingRun = 0, longestSwingRun = 0;
  for (const delta of valenceDeltas) {
    swingRun = delta >= 3 ? swingRun + 1 : 0;
    longestSwingRun = Math.max(longestSwingRun, swingRun);
  }

  // Intensity flat at 3-4: the reference says "a long stretch" without a
  // number; operationalised here at the same five minutes as the valence
  // window, and the output says so.
  const fatigue = [];
  let runStart = null;
  for (let i = 0; i <= scenes.length; i++) {
    const inBand = i < scenes.length && scenes[i].intensity >= 3 && scenes[i].intensity <= 4;
    if (inBand && runStart == null) runStart = i;
    if (!inBand && runStart != null) {
      if (spanDuration(scenes, runStart, i - 1) >= MONOTONY_WINDOW_SECONDS) {
        fatigue.push({
          ...spanRange(scenes, runStart, i - 1),
          intensities: scenes.slice(runStart, i).map((s) => s.intensity),
        });
      }
      runStart = null;
    }
  }

  // Rising intensity across the last quarter — correct for nearly every form.
  const lastQuarter = scenes.filter((s) => s.start >= runtime * 0.75);
  const lastQuarterIntensities = lastQuarter.map((s) => s.intensity);
  const rising = lastQuarterIntensities.length >= 2
    && lastQuarterIntensities.every((v, i) => i === 0 || v >= lastQuarterIntensities[i - 1])
    && lastQuarterIntensities[lastQuarterIntensities.length - 1] > lastQuarterIntensities[0];

  return {
    total_runtime: toTimecode(runtime),
    plot: rows,
    monotony_stretches: monotonyStretches(scenes),
    largest_valence_gap: largestValenceGap(scenes, runtime),
    intensity_peaks: peaks(scenes),
    intensity_flat_3_to_4: {
      operationalised_as: 'a stretch of at least five minutes; the reference says "a long stretch" without a number',
      stretches: fatigue,
    },
    whiplash: {
      valence_swings_of_three_or_more: valenceDeltas.filter((d) => d >= 3).length,
      longest_consecutive_run_of_such_swings: longestSwingRun,
      reading_if_every_scene_swings: 'Whiplash; nothing accumulates.',
    },
    last_quarter_intensity: lastQuarterIntensities.length
      ? {
          intensities: lastQuarterIntensities,
          rising_throughout: rising,
          reading: 'Rising intensity across the last quarter is correct for nearly every form.',
        }
      : null,
  };
}
