/**
 * The n-gram predictor and its honest evaluation. Counting pairs and triples
 * of action names and dividing — nothing else. The evaluation rules (last 20%
 * held out chronologically, self-transitions excluded, baseline always
 * reported, 10-point lift required) come from references/sequence-analysis.md.
 */

import { ToolError } from '../mcp-lite.js';
import { MIN_LOG_SIZES, EXPECTED_ACCURACY, CONFIDENCE_FLOOR, floorForK } from './method.js';

export const CONTEXT_MIN = 20; // use an order only where its context was seen 20+ times
export const BACKOFF_DISCOUNT = 0.4; // per level dropped
export const HELD_OUT_FRACTION = 0.2;
export const LIFT_REQUIRED_POINTS = 10;
export const BUG_THRESHOLD_TOP1 = 70;

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
 * Predict the ranked continuations for (prev2, prev1) using the highest order
 * whose context has been seen CONTEXT_MIN times, discounting BACKOFF_DISCOUNT
 * per level dropped, add-1 smoothing throughout. Self-transitions (candidate
 * equal to prev1) are excluded.
 */
function predict(models, prev2, prev1, topN) {
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
  return [...models.vocab]
    .filter((c) => c !== prev1)
    .map((c) => ({ action: c, p: p(c) * discount }))
    .sort((a, b) => b.p - a.p)
    .slice(0, topN);
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
