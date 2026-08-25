import { ToolError } from '../mcp-lite.js';
import { toSeconds, toTimecode } from './timecode.js';

/**
 * Reconcile the model's tripped tells with a real retention curve. The curve
 * always wins: this classifies each measured drop against the tripped
 * stretches and says plainly where the model explains nothing and where it
 * flagged something the audience never minded. Classification is timecode
 * proximity only — no flag is moved to fit the curve.
 */

const DEFAULT_AFTER_WINDOW_SECONDS = 15;

export function reconcileDrops({ drops, stretches, afterWindowSeconds }) {
  const window = afterWindowSeconds ?? DEFAULT_AFTER_WINDOW_SECONDS;

  const parsed = drops.map((raw, index) => {
    const at = toSeconds(raw.timecode);
    if (at == null) {
      throw new ToolError('invalid_drop', `Drop ${index + 1}: timecode "${raw.timecode}" is not readable.`);
    }
    return { at, note: raw.note ?? null };
  });

  const matchedStretches = new Set();
  const classified = parsed.map(({ at, note }) => {
    // "Explained" means the drop lands on or just after a tripped tell —
    // operationalised as inside the stretch or within the after-window of
    // its end, and the window used is reported.
    const matches = stretches.filter((s) => at >= s.from && at <= s.to + window);
    matches.forEach((s) => matchedStretches.add(s));
    if (matches.length) {
      return {
        drop_at: toTimecode(at),
        ...(note ? { note } : {}),
        classification: 'explained',
        causes: [...new Set(matches.map((s) => s.cause))],
        stretches: matches.map((s) => ({ from: toTimecode(s.from), to: toTimecode(s.to), cause: s.cause })),
        next_step: 'Say which cause, and hand the editor the standard fix — dropoff_causes has it.',
      };
    }
    return {
      drop_at: toTimecode(at),
      ...(note ? { note } : {}),
      classification: 'unexplained',
      reading:
        'A real drop with no structural tell. This is usually performance, music, sound, grade or a ' +
        'shot that does not work, and this analysis cannot see any of those. Point the editor at the ' +
        'moment and let them watch it.',
    };
  });

  // Model-only: a tell with no drop in the data. The model was wrong here.
  const modelOnly = stretches
    .filter((s) => !matchedStretches.has(s))
    .map((s) => ({
      from: toTimecode(s.from),
      to: toTimecode(s.to),
      cause: s.cause,
      reading: 'A tell with no drop in the data. The model was wrong here — say so, and drop it down the ranking.',
    }));

  return {
    drops: classified,
    model_only_tells: modelOnly,
    explained_window_seconds: window,
    window_note:
      `"On or just after a tripped tell" is operationalised as inside the stretch or within ${window} ` +
      'seconds after it ends. Pass after_window_seconds to change it.',
    rule: 'Real data on a real audience outranks the model, always. Never adjust the model\'s flags to fit the curve retrospectively and present the result as agreement.',
  };
}
