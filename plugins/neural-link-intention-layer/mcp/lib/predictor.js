/**
 * The n-gram predictor and its honest evaluation. Counting pairs and triples
 * of action names and dividing — nothing else. The evaluation rules (last 20%
 * held out chronologically, self-transitions excluded, baseline always
 * reported, 10-point lift required) come from references/sequence-analysis.md.
 */

import { ToolError } from '../mcp-lite.js';
import { MIN_LOG_SIZES, EXPECTED_ACCURACY, CONFIDENCE_FLOOR, REFIT_RULE, REFIT_AFTER_DAYS, floorForK } from './method.js';

export const CONTEXT_MIN = 20; // use an order only where its context was seen 20+ times
export const BACKOFF_DISCOUNT = 0.4; // per level dropped
export const HELD_OUT_FRACTION = 0.2;
export const LIFT_REQUIRED_POINTS = 10;
export const BUG_THRESHOLD_TOP1 = 70;

// The on-disk shape of a saved model. Bumped whenever the counts layout or
// the prediction maths changes incompatibly, so a stale file is refused with
// an instruction to refit rather than silently misread.
export const SAVED_MODEL_FORMAT = 1;

// Actions never surfaced as suggestions at any confidence, per the skill:
// destructive or hard to undo. Matched by name; matches are reported, not
// silently dropped.
export const DESTRUCTIVE_PATTERN = /flatten|merge|delete|close|overwrite/i;

function countModels(sequences, trainLimit) {
  const uni = new Map();
  const bi = new Map(); // "a" -> Map(next -> count)
  const tri = new Map(); // "a b" -> Map(next -> count)
  const vocab = new Set();
  let index = 0;

  const bump = (map, ctx, next) => {
    let inner = map.get(ctx);
    if (!inner) map.set(ctx, (inner = new Map()));
    inner.set(next, (inner.get(next) ?? 0) + 1);
  };

  for (const seq of sequences) {
    for (let i = 0; i < seq.length; i++, index++) {
      if (index >= trainLimit) continue; // held out
      const a = seq[i].action;
      vocab.add(a);
      uni.set(a, (uni.get(a) ?? 0) + 1);
      if (i >= 1) bump(bi, seq[i - 1].action, a);
      if (i >= 2) bump(tri, `${seq[i - 2].action} ${seq[i - 1].action}`, a);
    }
  }
  return { uni, bi, tri, vocab };
}

function total(inner) {
  let n = 0;
  for (const c of inner.values()) n += c;
  return n;
}

/** Add-1-smoothed distribution over the vocabulary for one seen context. */
function smoothed(inner, vocabSize) {
  const t = total(inner) + vocabSize;
  return (candidate) => ((inner.get(candidate) ?? 0) + 1) / t;
}

/**
 * Rank every continuation for (prev2, prev1) using the highest order whose
 * context has been seen CONTEXT_MIN times, discounting BACKOFF_DISCOUNT per
 * level dropped, add-1 smoothing throughout. Self-transitions (candidate
 * equal to prev1) are excluded. This is the one implementation of the
 * prediction maths: the held-out evaluation in fitPredictor and the live
 * predictFromRecord both go through it, so the accuracy quoted at fit time
 * is measured on exactly the arithmetic that later predicts.
 */
function rankContinuations(models, prev2, prev1) {
  const vocabSize = models.vocab.size || 1;
  const highestOrder = prev2 != null ? 3 : 2;
  let inner;
  let order;

  const triCtx = prev2 != null ? models.tri.get(`${prev2} ${prev1}`) : null;
  const biCtx = models.bi.get(prev1);
  if (triCtx && total(triCtx) >= CONTEXT_MIN) {
    inner = triCtx;
    order = 3;
  } else if (biCtx && total(biCtx) >= CONTEXT_MIN) {
    inner = biCtx;
    order = 2;
  } else {
    inner = models.uni;
    order = 1;
  }
  const discount = BACKOFF_DISCOUNT ** (highestOrder - order);

  const p = smoothed(inner, vocabSize);
  const candidates = [...models.vocab]
    .filter((c) => c !== prev1)
    .map((c) => ({ action: c, p: p(c) * discount }))
    .sort((a, b) => b.p - a.p);
  return { order, highestOrder, discount, candidates };
}

/** The top-N continuations only — the shape the held-out evaluation needs. */
function predict(models, prev2, prev1, topN) {
  return rankContinuations(models, prev2, prev1).candidates.slice(0, topN);
}

/**
 * Fit on the first 80% (chronologically), evaluate on the last 20%. Reports
 * the four numbers the method requires every time: baseline top-1, model top-1
 * with self-transitions excluded, model top-3, and the log's date range and
 * size — plus the including-self baseline as the footnote figure.
 */
export function fitPredictor(normalised) {
  const { sequences, tokens, rawCount, dateRange, sessions } = normalised;

  if (tokens < 2000) {
    throw new ToolError(
      'log_too_small',
      `Only ${tokens} actions after normalisation — under the 2,000 floor for bigram statistics, so no model may be fitted. Keep recording.`,
      { actions_after_normalisation: tokens, minimum_log_sizes: MIN_LOG_SIZES }
    );
  }

  const trainLimit = Math.floor(tokens * (1 - HELD_OUT_FRACTION));
  const models = countModels(sequences, trainLimit);

  // Baseline: always predict the single most frequent training action —
  // excluding the current one for the headline figure.
  const ranked = [...models.uni.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);

  // Footnote figure: the including-self baseline over raw (run-expanded)
  // counts, which is what an uncollapsed log would score by always predicting
  // the most frequent action.
  const rawCounts = new Map();
  for (const seq of sequences) {
    for (const tok of seq) rawCounts.set(tok.action, (rawCounts.get(tok.action) ?? 0) + tok.run);
  }
  const rawTop = Math.max(0, ...rawCounts.values());

  let evaluated = 0;
  let baselineHits = 0;
  let top1Hits = 0;
  let top3Hits = 0;
  let index = 0;
  for (const seq of sequences) {
    for (let i = 0; i < seq.length; i++, index++) {
      if (index < trainLimit || i < 1) continue;
      const prev1 = seq[i - 1].action;
      const prev2 = i >= 2 ? seq[i - 2].action : null;
      const actual = seq[i].action; // never equals prev1 — runs are collapsed
      evaluated++;

      const baselineGuess = ranked.find((a) => a !== prev1);
      if (baselineGuess === actual) baselineHits++;

      const top = predict(models, prev2, prev1, 3);
      if (top[0]?.action === actual) top1Hits++;
      if (top.some((c) => c.action === actual)) top3Hits++;
    }
  }

  if (!evaluated) {
    throw new ToolError('no_held_out_events', 'The held-out slice contained no evaluable transitions.');
  }

  const pct = (n) => +(100 * n / evaluated).toFixed(1);
  const baseline = pct(baselineHits);
  const top1 = pct(top1Hits);
  const lift = +(top1 - baseline).toFixed(1);

  return {
    model: 'trigram with backoff (context seen 20+ times, discount 0.4 per level dropped, add-1 smoothing)',
    log: {
      actions_after_normalisation: tokens,
      raw_actions: rawCount,
      sessions,
      date_range: dateRange,
      train_actions: trainLimit,
      held_out_actions: tokens - trainLimit,
      split: 'chronological, last 20% held out',
    },
    ...(tokens < 5000
      ? { provisional: 'Under the 5,000-action floor for trigram fitting — these figures are provisional; re-fit once the log crosses it.' }
      : {}),
    accuracy: {
      baseline_top1_excluding_self_transitions: `${baseline}%`,
      model_top1_excluding_self_transitions: `${top1}%`,
      model_top3_excluding_self_transitions: `${pct(top3Hits)}%`,
      footnote_baseline_top1_including_self_transitions: `${+(100 * rawTop / rawCount).toFixed(1)}%`,
      evaluated_transitions: evaluated,
    },
    lift_over_baseline_points: lift,
    learnable_structure: lift >= LIFT_REQUIRED_POINTS,
    ...(lift < LIFT_REQUIRED_POINTS
      ? { note: `Lift under ${LIFT_REQUIRED_POINTS} points absolute — this log contains no learnable sequence structure. Proceed with the audit alone.` }
      : {}),
    ...(top1 > BUG_THRESHOLD_TOP1
      ? { warning: `Top-1 above ${BUG_THRESHOLD_TOP1}% is a bug until disproved — nearly always leaked test data or uncollapsed runs.` }
      : {}),
    expected_ranges: EXPECTED_ACCURACY,
  };
}

/**
 * The contexts that clear the confidence floor: for every context seen 20+
 * times in the whole normalised log, the top continuation and its smoothed
 * conditional probability, kept only where it exceeds the floor. Destructive
 * continuations are listed separately and never surfaced, at any confidence.
 */
export function confidentContexts(normalised, { k } = {}) {
  const { sequences, tokens } = normalised;

  if (tokens < 2000) {
    throw new ToolError(
      'log_too_small',
      `Only ${tokens} actions after normalisation — under the 2,000 floor for bigram statistics. Keep recording.`,
      { actions_after_normalisation: tokens, minimum_log_sizes: MIN_LOG_SIZES }
    );
  }
  const kValue = k ?? CONFIDENCE_FLOOR.default_k;
  if (!(kValue > 0)) throw new ToolError('invalid_k', 'k must be a positive number.');
  const floor = floorForK(kValue);

  // Whole-log counts: surfacing candidates is not a held-out evaluation.
  const models = countModels(sequences, Infinity);
  const vocabSize = models.vocab.size || 1;
  const useTrigrams = tokens >= 5000;

  const surfaced = [];
  const suppressed = [];
  const scan = (map, order) => {
    for (const [ctx, inner] of map) {
      const t = total(inner);
      if (t < CONTEXT_MIN) continue;
      const p = smoothed(inner, vocabSize);
      const last = ctx.split(' ').pop();
      const best = [...inner.entries()]
        .filter(([a]) => a !== last)
        .map(([a]) => ({ action: a, p: p(a) }))
        .sort((a, b) => b.p - a.p)[0];
      if (!best || best.p <= floor) continue;
      const row = {
        context: ctx.split(' '),
        order,
        seen: t,
        predicted_next: best.action,
        p: +best.p.toFixed(3),
      };
      if (DESTRUCTIVE_PATTERN.test(best.action)) suppressed.push(row);
      else surfaced.push(row);
    }
  };
  if (useTrigrams) scan(models.tri, 3);
  scan(models.bi, 2);
  surfaced.sort((a, b) => b.p - a.p);
  suppressed.sort((a, b) => b.p - a.p);

  return {
    k: kValue,
    floor: +floor.toFixed(2),
    floor_rule: CONFIDENCE_FLOOR.rule,
    orders_used: useTrigrams ? [3, 2] : [2],
    ...(tokens < 5000
      ? { note: 'Under the 5,000-action floor for trigrams — bigram contexts only.' }
      : {}),
    surfaced,
    suppressed_destructive: {
      rule: CONFIDENCE_FLOOR.never,
      matched_by: String(DESTRUCTIVE_PATTERN),
      rows: suppressed,
    },
    never_auto_execute:
      'Surface these as accelerators needing a deliberate keystroke. Never auto-execute a predicted action.',
  };
}

// ----------------------------------------------------------------- persistence

/** The count Maps as plain JSON-serialisable objects. */
function serialiseCounts(models) {
  const flatten = (map) => {
    const out = {};
    for (const [ctx, inner] of map) out[ctx] = Object.fromEntries(inner);
    return out;
  };
  return {
    unigrams: Object.fromEntries(models.uni),
    bigrams: flatten(models.bi),
    trigrams: flatten(models.tri),
    vocabulary: [...models.vocab],
  };
}

/** The inverse: a saved counts object back into the Maps predict() reads. */
function deserialiseCounts(counts) {
  const inflate = (obj) => {
    const map = new Map();
    for (const [ctx, inner] of Object.entries(obj)) map.set(ctx, new Map(Object.entries(inner)));
    return map;
  };
  return {
    uni: new Map(Object.entries(counts.unigrams)),
    bi: inflate(counts.bigrams),
    tri: inflate(counts.trigrams),
    vocab: new Set(counts.vocabulary),
  };
}

/**
 * The record fit_predictor persists when asked to save: the count tables the
 * backoff predictor reads, refitted over the whole normalised log, plus the
 * fit metadata and the holdout accuracy from the 80/20 chronological split —
 * the number predict_next later quotes so a caller knows how far to trust it.
 */
export function buildModelRecord(normalised, fit) {
  const models = countModels(normalised.sequences, Infinity);
  return {
    format: SAVED_MODEL_FORMAT,
    fitted_at: new Date().toISOString(),
    model: fit.model,
    log: fit.log,
    vocabulary_size: models.vocab.size,
    holdout_accuracy: fit.accuracy,
    lift_over_baseline_points: fit.lift_over_baseline_points,
    learnable_structure: fit.learnable_structure,
    ...(fit.provisional ? { provisional: fit.provisional } : {}),
    ...(fit.note ? { note: fit.note } : {}),
    counts_over:
      'the whole normalised log — the holdout accuracy above was measured on a model trained ' +
      'on the first 80% only, per the evaluation rules',
    counts: serialiseCounts(models),
  };
}

function requireCurrentFormat(record) {
  if (record.format !== SAVED_MODEL_FORMAT || !record.counts) {
    throw new ToolError(
      'model_format_unsupported',
      `The saved model uses format ${record.format ?? 'unknown'}; this version reads format ${SAVED_MODEL_FORMAT}. Refit and save again: fit_predictor with { log, save: true }.`,
      { saved_format: record.format ?? null, supported_format: SAVED_MODEL_FORMAT }
    );
  }
}

/**
 * Live prediction from a saved model: the top-k continuations of the user's
 * most recent actions, through exactly the same backoff arithmetic the
 * holdout evaluation measured. Destructive continuations are listed
 * separately and never surfaced, at any confidence; everything else carries
 * its probability and whether it clears the confidence floor.
 */
export function predictFromRecord(record, recentActions, { top_k, k } = {}) {
  requireCurrentFormat(record);

  const actions = (recentActions ?? []).map((a) => String(a).trim()).filter(Boolean);
  if (!actions.length) {
    throw new ToolError('invalid_request', 'recent_actions needs at least one normalised action name — there is no context to predict from.');
  }
  const topK = top_k ?? 3;
  if (!Number.isInteger(topK) || topK < 1) {
    throw new ToolError('invalid_request', 'top_k must be a positive integer.');
  }
  const kValue = k ?? CONFIDENCE_FLOOR.default_k;
  if (!(kValue > 0)) throw new ToolError('invalid_k', 'k must be a positive number.');
  const floor = floorForK(kValue);

  const models = deserialiseCounts(record.counts);
  const prev1 = actions[actions.length - 1];
  const prev2 = actions.length >= 2 ? actions[actions.length - 2] : null;
  const unseen = [...new Set([prev2, prev1].filter((a) => a != null && !models.vocab.has(a)))];

  const ranked = rankContinuations(models, prev2, prev1);
  const surfaced = [];
  const suppressed = [];
  for (const candidate of ranked.candidates) {
    if (surfaced.length >= topK) break;
    if (DESTRUCTIVE_PATTERN.test(candidate.action)) {
      // Ranked above the cut but destructive: reported, never surfaced.
      suppressed.push(candidate);
    } else {
      surfaced.push(candidate);
    }
  }

  const row = ({ action, p }) => ({ action, p: +p.toFixed(3), clears_floor: p > floor });
  const topClears = surfaced.length > 0 && surfaced[0].p > floor;

  return {
    model: record.model,
    fitted_at: record.fitted_at,
    context: {
      used: prev2 != null ? [prev2, prev1] : [prev1],
      order_used: ranked.order,
      backoff_discount_applied: +ranked.discount.toFixed(3),
      ...(unseen.length
        ? { note: `Never seen in the fitted log: ${unseen.join(', ')}. The prediction backed off to lower-order statistics.` }
        : {}),
    },
    predictions: surfaced.map(row),
    confidence_floor: {
      k: kValue,
      floor: +floor.toFixed(2),
      rule: CONFIDENCE_FLOOR.rule,
      verdict: topClears
        ? `surface the top prediction — p ${+surfaced[0].p.toFixed(3)} clears the ${+floor.toFixed(2)} floor`
        : `do not surface — no prediction clears the ${+floor.toFixed(2)} floor; the correct outcome for most contexts`,
    },
    suppressed_destructive: {
      rule: CONFIDENCE_FLOOR.never,
      matched_by: String(DESTRUCTIVE_PATTERN),
      rows: suppressed.map(({ action, p }) => ({ action, p: +p.toFixed(3) })),
    },
    model_trust: {
      holdout_accuracy: record.holdout_accuracy,
      lift_over_baseline_points: record.lift_over_baseline_points,
      learnable_structure: record.learnable_structure,
      log_date_range: record.log?.date_range ?? null,
      ...(record.learnable_structure === false
        ? { warning: 'The fitted log contained no learnable sequence structure (lift under 10 points) — treat every prediction here as noise.' }
        : {}),
      ...(record.provisional ? { provisional: record.provisional } : {}),
    },
    never_auto_execute:
      'Surface a prediction as an accelerator needing a deliberate keystroke. Never auto-execute a predicted action.',
  };
}

/**
 * What model_status reports about a saved model: fit date, log size,
 * vocabulary size, holdout accuracy, and the staleness verdict against the
 * refit rule's eight weeks — measured from the log's newest timestamp where
 * the log carried timestamps, from the fit date otherwise.
 */
export function describeModelRecord(record) {
  requireCurrentFormat(record);

  const now = Date.now();
  const days = (iso) => {
    const at = Date.parse(iso ?? '');
    return Number.isFinite(at) ? +((now - at) / 86_400_000).toFixed(1) : null;
  };
  const modelAgeDays = days(record.fitted_at);
  const logAgeDays = days(record.log?.date_range?.to);
  const ageForVerdict = logAgeDays ?? modelAgeDays;

  return {
    fitted_at: record.fitted_at ?? null,
    model: record.model,
    log: {
      actions_after_normalisation: record.log?.actions_after_normalisation ?? null,
      raw_actions: record.log?.raw_actions ?? null,
      sessions: record.log?.sessions ?? null,
      date_range: record.log?.date_range ?? null,
    },
    vocabulary_size: record.vocabulary_size ?? null,
    holdout_accuracy: record.holdout_accuracy,
    lift_over_baseline_points: record.lift_over_baseline_points,
    learnable_structure: record.learnable_structure,
    ...(record.provisional ? { provisional: record.provisional } : {}),
    age: {
      model_days: modelAgeDays,
      log_end_days: logAgeDays,
      ...(logAgeDays == null
        ? { note: 'The fitted log carried no timestamps, so age is measured from the fit date instead of the log itself.' }
        : {}),
    },
    refit_rule: REFIT_RULE,
    staleness:
      ageForVerdict == null
        ? 'The saved model carries no readable fit date, so no staleness verdict can be given.'
        : ageForVerdict > REFIT_AFTER_DAYS
          ? `Stale: the ${logAgeDays == null ? 'model' : 'log'} is ${ageForVerdict} days old, past the ${REFIT_AFTER_DAYS}-day (eight-week) refit window. Record a fresh log and refit before trusting predictions.`
          : `Within the ${REFIT_AFTER_DAYS}-day (eight-week) refit window.`,
  };
}
