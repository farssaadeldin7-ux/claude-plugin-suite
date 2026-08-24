import { ToolError } from '../mcp-lite.js';
import { toSeconds, toTimecode } from './timecode.js';
import { spanRange } from './scenes.js';
import { monotonyStretches } from './arc.js';
import { BASELINES } from './forms.js';
import { CORRELATE_NOTE, OVERLAP_NOTE } from './causes.js';

/**
 * The five drop-off tells, checked mechanically against the scored scene
 * table and the Q&A ledger the editor supplies. Each check is threshold
 * arithmetic from the skill's references — nothing here reads the film, and a
 * tripped tell is a stretch worth watching again, not a proven defect.
 */

const HOW_CLOSES = ['on_screen', 'implied', 'off_screen', 'never'];
const WEIGHTS = ['central', 'major', 'minor'];

export function normaliseQuestions(rawQuestions, runtime) {
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions.map((raw, index) => {
    const label = raw.id ?? `Q${index + 1}`;
    const opens = toSeconds(raw.opens);
    if (opens == null) {
      throw new ToolError('invalid_question', `Question ${label}: opens "${raw.opens}" is not a readable timecode.`);
    }
    const closes = raw.closes != null ? toSeconds(raw.closes) : null;
    if (raw.closes != null && closes == null) {
      throw new ToolError('invalid_question', `Question ${label}: closes "${raw.closes}" is not a readable timecode.`);
    }
    const weight = String(raw.weight ?? 'minor').toLowerCase();
    if (!WEIGHTS.includes(weight)) {
      throw new ToolError('invalid_question', `Question ${label}: weight "${raw.weight}" is not one of ${WEIGHTS.join(', ')}.`);
    }
    const how = raw.how != null ? String(raw.how).toLowerCase() : closes == null ? 'never' : null;
    if (how != null && !HOW_CLOSES.includes(how)) {
      throw new ToolError('invalid_question', `Question ${label}: how "${raw.how}" is not one of ${HOW_CLOSES.join(', ')}.`);
    }
    return {
      id: label,
      question: raw.question ?? null,
      opens,
      closes,
      how,
      weight,
      endsOpen: closes == null || how === 'never',
    };
  });
}

/** Stretches of the timeline with no question open, from the ledger. */
function uncoveredStretches(questions, runtime, minimumSeconds) {
  const intervals = questions
    .map((q) => [q.opens, q.endsOpen ? runtime : q.closes])
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let coveredTo = 0;
  for (const [from, to] of intervals) {
    if (from - coveredTo >= minimumSeconds) gaps.push([coveredTo, from]);
    coveredTo = Math.max(coveredTo, to);
  }
  if (runtime - coveredTo >= minimumSeconds) gaps.push([coveredTo, runtime]);
  return gaps.map(([from, to]) => ({
    from: toTimecode(from),
    to: toTimecode(to),
    duration: toTimecode(to - from),
    duration_seconds: Math.round(to - from),
    _from: from,
    _to: to,
  }));
}

/** Runs of consecutive scenes where a boolean flag holds, as stretches. */
function flaggedRuns(scenes, holds) {
  const runs = [];
  let start = null;
  for (let i = 0; i <= scenes.length; i++) {
    const on = i < scenes.length && holds(scenes[i]);
    if (on && start == null) start = i;
    if (!on && start != null) {
      runs.push({ fromIndex: start, toIndex: i - 1 });
      start = null;
    }
  }
  return runs;
}

/**
 * Check all five tells across the whole timeline. `form` is a normalised
 * entry from forms.js, or null — in which case the generic baselines from the
 * skill's tell table apply and the output says so.
 */
export function checkTells({ scenes, questions, runtime, form }) {
  const thresholds = {
    no_question_scene_run: BASELINES.no_question_scene_run,
    no_question_stretch_seconds: BASELINES.no_question_stretch_seconds,
    stakes_stretch_seconds: BASELINES.stakes_stretch_seconds,
    monotony_window_seconds: BASELINES.monotony_window_seconds,
    talking_head_limit_seconds: form?.talking_head_limit_seconds ?? BASELINES.talking_head_limit_seconds,
    central_close: form
      ? form.central_close_window
        ? `${form.central_close_window.earliest}–${form.central_close_window.latest} of run-time (${form.label})`
        : form.central_close_note
      : `before ${BASELINES.central_close_ratio.toFixed(2)} of run-time (generic baseline — name a form to use its window)`,
  };

  const stretches = []; // every tripped stretch, for the overlap pass
  const addStretch = (cause, from, to, detail) => {
    stretches.push({ cause, from, to, ...detail });
  };

  // ---- 1. No question open -----------------------------------------------
  const gapStretches = uncoveredStretches(questions, runtime, BASELINES.no_question_stretch_seconds);
  for (const gap of gapStretches) addStretch('no_question_open', gap._from, gap._to, {});

  const hasInfoFlags = scenes.some((s) => s.information_only !== null);
  const infoRuns = hasInfoFlags
    ? flaggedRuns(scenes, (s) => s.information_only === true)
        .filter((r) => r.toIndex - r.fromIndex + 1 >= BASELINES.no_question_scene_run)
        .map((r) => {
          const range = spanRange(scenes, r.fromIndex, r.toIndex);
          addStretch('no_question_open', scenes[r.fromIndex].start, scenes[r.toIndex].end, {});
          return { ...range, consecutive_information_only_scenes: r.toIndex - r.fromIndex + 1 };
        })
    : null;

  const noQuestionOpen = {
    tripped: gapStretches.length > 0 || Boolean(infoRuns?.length),
    stretches_with_nothing_open: gapStretches.map(({ _from, _to, ...rest }) => rest),
    information_only_scene_runs: hasInfoFlags
      ? infoRuns
      : 'Not checkable: no scene carries an information_only flag. The 90-second coverage check above still ran from the ledger.',
  };

  // ---- 2. Stakes not personalised ----------------------------------------
  const hasPersonFlags = scenes.some((s) => s.person_with_want !== null);
  let stakes;
  if (hasPersonFlags) {
    const runs = flaggedRuns(scenes, (s) => s.person_with_want === false)
      .map((r) => ({ ...spanRange(scenes, r.fromIndex, r.toIndex), _from: scenes[r.fromIndex].start, _to: scenes[r.toIndex].end }))
      .filter((r) => r.duration_seconds > BASELINES.stakes_stretch_seconds);
    for (const r of runs) addStretch('stakes_not_personalised', r._from, r._to, { in_first_90_seconds: r._from < 90 });
    stakes = {
      tripped: runs.length > 0,
      stretches: runs.map(({ _from, _to, ...rest }) => rest),
    };
  } else {
    stakes = {
      tripped: null,
      note: 'Not checkable: no scene carries a person_with_want flag. Mark each scene true where a named individual with a want is on screen or in voice.',
    };
  }

  // ---- 3. Tonal monotony --------------------------------------------------
  const monotony = monotonyStretches(scenes);
  for (const m of monotony) addStretch('tonal_monotony', toSeconds(m.from), toSeconds(m.to), {});
  const tonalMonotony = { tripped: monotony.length > 0, stretches: monotony };

  // ---- 4. Premature resolution -------------------------------------------
  const centralQuestions = questions.filter((q) => q.weight === 'central');
  let premature;
  if (centralQuestions.length !== 1) {
    premature = {
      tripped: null,
      central_question_count: centralQuestions.length,
      note: centralQuestions.length === 0
        ? 'No question is marked Central, so the close ratio cannot be computed. If no single Central question can be identified, that is the finding — a film with two central questions and no hierarchy will read as two films.'
        : 'More than one question is marked Central. Exactly one question is Central; that is the finding to report before anything else.',
    };
  } else {
    const central = centralQuestions[0];
    if (central.closes == null) {
      premature = {
        tripped: false,
        central_question: central.id,
        closes: null,
        note: 'The Central question never closes. That is not premature resolution — it is the opposite flag: an unclosed Central question at the end credits is the whole note.',
      };
    } else {
      const ratio = Number((central.closes / runtime).toFixed(2));
      const window = form?.central_close_window ?? null;
      const earliest = window ? window.earliest : BASELINES.central_close_ratio;
      const tripped = window || !form ? ratio < earliest : null;
      if (tripped) {
        // Everything after the close is the exposed run-time.
        addStretch('premature_resolution', central.closes, runtime, {});
      }
      premature = {
        tripped,
        central_question: central.id,
        closes_at: toTimecode(central.closes),
        close_ratio: ratio,
        judged_against: thresholds.central_close,
        ...(tripped ? { exposed_runtime: toTimecode(runtime - central.closes) } : {}),
        ...(tripped && ratio < 0.5 ? { most_urgent: true, note: 'Below 0.5 — treat as the most urgent finding in the report.' } : {}),
        ...(window && ratio > window.latest
          ? { late_close_note: `Closes after the form's ${window.latest} upper bound. Not one of the five drop-off causes, but outside the form's window.` }
          : {}),
        ...(tripped === null ? { note: thresholds.central_close } : {}),
      };
    }
  }

  // ---- 5. Texture starvation ---------------------------------------------
  const limit = thresholds.talking_head_limit_seconds;
  const hasTextureData = scenes.some((s) => s.longest_talking_head_seconds !== null);
  let texture;
  if (hasTextureData) {
    const blocks = scenes
      .filter((s) => (s.longest_talking_head_seconds ?? 0) > limit)
      .map((s) => {
        addStretch('texture_starvation', s.start, s.end, {});
        return {
          scene: s.position,
          timecode: toTimecode(s.start),
          unbroken_talking_head: toTimecode(s.longest_talking_head_seconds),
          limit_for_form: toTimecode(limit),
        };
      });
    texture = { tripped: blocks.length > 0, limit_seconds: limit, blocks };
  } else {
    texture = {
      tripped: null,
      limit_seconds: limit,
      note: 'Not checkable: no scene carries longest_talking_head_seconds — the longest unbroken talking-head run in the scene, where a static wide of the same room does not reset the clock.',
    };
  }

  // ---- Ledger findings ----------------------------------------------------
  const ledgerFindings = [];
  const openAtEnd = questions.filter((q) => q.endsOpen);
  for (const q of openAtEnd) {
    ledgerFindings.push({
      question: q.id,
      weight: q.weight,
      finding: 'open_at_end_credits',
      reading: q.weight === 'central'
        ? 'An unclosed Central question at the end credits is the whole note.'
        : q.weight === 'minor'
          ? 'Unsatisfying unless deliberately ambiguous and earned. An unclosed Minor question is often fine and occasionally deliberate.'
          : 'Unsatisfying, unless deliberately ambiguous and earned.',
    });
  }
  for (const q of questions.filter((x) => x.how === 'off_screen')) {
    ledgerFindings.push({
      question: q.id,
      weight: q.weight,
      finding: 'closed_off_screen',
      reading: 'A question closed off-screen, never acknowledged, reads as a plot hole even in non-fiction.',
    });
  }
  // More than four questions open at once is load, not intrigue.
  const events = questions
    .flatMap((q) => [
      { at: q.opens, delta: 1 },
      ...(q.endsOpen ? [] : [{ at: q.closes, delta: -1 }]),
    ])
    .sort((a, b) => a.at - b.at || a.delta - b.delta);
  let open = 0, overloadFrom = null;
  for (const event of events) {
    open += event.delta;
    if (open > 4 && overloadFrom == null) overloadFrom = event.at;
    if (open <= 4 && overloadFrom != null) {
      ledgerFindings.push({
        finding: 'more_than_four_open',
        from: toTimecode(overloadFrom),
        to: toTimecode(event.at),
        reading: 'More than four questions open at once is load, not intrigue — the viewer stops tracking.',
      });
      overloadFrom = null;
    }
  }
  if (overloadFrom != null) {
    ledgerFindings.push({
      finding: 'more_than_four_open',
      from: toTimecode(overloadFrom),
      to: toTimecode(runtime),
      reading: 'More than four questions open at once is load, not intrigue — the viewer stops tracking.',
    });
  }

  // ---- Overlaps and priority ---------------------------------------------
  const overlaps = overlapReport(stretches, form);

  const trippedStretches = stretches.map((s) => ({
    cause: s.cause,
    from: toTimecode(s.from),
    to: toTimecode(s.to),
    duration_seconds: Math.round(s.to - s.from),
  }));

  const exposedSeconds = mergedDuration(stretches);

  return {
    result: {
      tells: {
        no_question_open: noQuestionOpen,
        stakes_not_personalised: stakes,
        tonal_monotony: tonalMonotony,
        premature_resolution: premature,
        texture_starvation: texture,
      },
      ledger_findings: ledgerFindings,
      overlaps,
      total_exposed_runtime: toTimecode(exposedSeconds),
      exposed_runtime_note:
        'Exposed run-time is run-time currently sitting under a flag. It is not a prediction of watch time gained, and this analysis does not produce one.',
      thresholds_used: thresholds,
      note: CORRELATE_NOTE,
    },
    stretches,
  };
}

/** Total seconds covered by at least one tripped stretch, overlaps merged. */
function mergedDuration(stretches) {
  const sorted = stretches.map((s) => [s.from, s.to]).sort((a, b) => a[0] - b[0]);
  let total = 0, coveredTo = -Infinity;
  for (const [from, to] of sorted) {
    total += Math.max(0, to - Math.max(from, coveredTo));
    coveredTo = Math.max(coveredTo, to);
  }
  return total;
}

/**
 * Where two causes overlap on the same stretch, report both and raise the
 * priority — overlapping tells are where films actually die. Priority order
 * is the table from the causes reference.
 */
function overlapReport(stretches, form) {
  // Classic interval merge: sorted by start, a stretch can only ever touch
  // the group in progress, so nothing straddles two groups.
  const groups = [];
  for (const stretch of [...stretches].sort((a, b) => a.from - b.from || a.to - b.to)) {
    const last = groups[groups.length - 1];
    if (last && stretch.from < last.to) {
      last.to = Math.max(last.to, stretch.to);
      if (!last.causes.includes(stretch.cause)) last.causes.push(stretch.cause);
    } else {
      groups.push({ from: stretch.from, to: stretch.to, causes: [stretch.cause] });
    }
  }

  const priorityOf = (g) => {
    if (g.causes.includes('premature_resolution')) return 1;
    if (g.causes.includes('no_question_open') && g.causes.includes('tonal_monotony')) return 2;
    if (g.causes.includes('stakes_not_personalised') && g.from < 90) return 3;
    if (g.causes.length === 1 && g.causes[0] === 'texture_starvation') return 5;
    return 4;
  };

  return {
    stretches: groups
      .map((g) => ({
        from: toTimecode(g.from),
        to: toTimecode(g.to),
        causes: g.causes,
        priority: priorityOf(g),
        ...(g.causes.includes('stakes_not_personalised') && g.from < 90 && form?.feed_based
          ? { note: 'Stakes not personalised in the first 90 seconds — urgent in feed-based forms.' }
          : {}),
      }))
      .sort((a, b) => a.priority - b.priority),
    priority_order: [
      '1 — premature resolution anywhere: it invalidates the back half',
      '2 — no question open plus tonal monotony: the classic mid-film sag',
      '3 — stakes not personalised in the first 90 seconds: urgent in feed-based forms',
      'then everything else; texture starvation alone last — real, but cheap to fix and rarely fatal',
    ],
    note: OVERLAP_NOTE,
  };
}
