import { ToolError } from '../mcp-lite.js';
import { toSeconds, toTimecode } from './timecode.js';

/**
 * Normalise the scored scene table the editor supplies. The scores are the
 * skill's reading of the cut, not this server's — everything here is
 * validation and timecode arithmetic, so the threshold checks downstream run
 * on clean numbers.
 */

const isInteger = (value) => Number.isInteger(value);

export function normaliseScenes(rawScenes, { totalRuntime } = {}) {
  if (!Array.isArray(rawScenes) || rawScenes.length < 2) {
    throw new ToolError('invalid_scenes', 'Supply at least two scored scenes as an array.');
  }

  const runtimeSeconds = totalRuntime != null ? toSeconds(totalRuntime) : null;
  if (totalRuntime != null && runtimeSeconds == null) {
    throw new ToolError('invalid_runtime', `Could not read total_runtime "${totalRuntime}" as a timecode.`);
  }

  const scenes = rawScenes.map((raw, index) => {
    const position = index + 1;
    const start = toSeconds(raw.timecode);
    if (start == null) {
      throw new ToolError('invalid_scene', `Scene ${position}: timecode "${raw.timecode}" is not readable. Use "MM:SS", "H:MM:SS" or seconds.`);
    }
    if (!isInteger(raw.valence) || raw.valence < -3 || raw.valence > 3) {
      throw new ToolError('invalid_scene', `Scene ${position}: valence must be an integer from -3 to +3, got ${raw.valence}.`);
    }
    if (!isInteger(raw.intensity) || raw.intensity < 0 || raw.intensity > 5) {
      throw new ToolError('invalid_scene', `Scene ${position}: intensity must be an integer from 0 to 5, got ${raw.intensity}.`);
    }
    const duration = raw.duration != null ? toSeconds(raw.duration) : null;
    if (raw.duration != null && duration == null) {
      throw new ToolError('invalid_scene', `Scene ${position}: duration "${raw.duration}" is not readable.`);
    }
    return {
      position,
      start,
      duration,
      valence: raw.valence,
      intensity: raw.intensity,
      description: raw.description ?? null,
      opens: Array.isArray(raw.opens) ? raw.opens : [],
      closes: Array.isArray(raw.closes) ? raw.closes : [],
      information_only: typeof raw.information_only === 'boolean' ? raw.information_only : null,
      person_with_want: typeof raw.person_with_want === 'boolean' ? raw.person_with_want : null,
      longest_talking_head_seconds:
        raw.longest_talking_head_seconds != null ? toSeconds(raw.longest_talking_head_seconds) : null,
    };
  });

  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].start < scenes[i - 1].start) {
      throw new ToolError('invalid_scenes',
        `Scene ${i + 1} starts at ${toTimecode(scenes[i].start)}, before scene ${i} at ${toTimecode(scenes[i - 1].start)}. Scenes must be in timeline order.`);
    }
  }

  // Fill missing durations from the next scene's start; the last scene from
  // the total run-time where one was given.
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].duration == null) {
      const nextStart = i + 1 < scenes.length ? scenes[i + 1].start : runtimeSeconds;
      scenes[i].duration = nextStart != null ? Math.max(0, nextStart - scenes[i].start) : null;
    }
    scenes[i].end = scenes[i].duration != null ? scenes[i].start + scenes[i].duration : scenes[i].start;
  }

  const runtime = runtimeSeconds ?? scenes[scenes.length - 1].end;

  // 8 to 30 is guidance from the scoring reference, not a hard gate — the
  // derivative of a 5-scene table is still arithmetic, just weak evidence.
  const sceneCountNote =
    scenes.length < 8
      ? `Only ${scenes.length} scenes. Aim for 8 to 30 — fewer than 8 and the derivative is meaningless.`
      : scenes.length > 30
        ? `${scenes.length} scenes. Aim for 8 to 30 — more than 30 and you are scoring shots.`
        : null;

  return { scenes, runtime, sceneCountNote };
}

/** Duration in seconds of the span from scene i to scene j inclusive. */
export function spanDuration(scenes, i, j) {
  return Math.max(0, scenes[j].end - scenes[i].start);
}

export function spanRange(scenes, i, j) {
  return {
    from: toTimecode(scenes[i].start),
    to: toTimecode(scenes[j].end),
    scenes: `${scenes[i].position}–${scenes[j].position}`,
    duration: toTimecode(spanDuration(scenes, i, j)),
    duration_seconds: spanDuration(scenes, i, j),
  };
}
