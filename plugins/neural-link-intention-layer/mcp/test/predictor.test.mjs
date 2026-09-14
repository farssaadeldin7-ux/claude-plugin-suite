#!/usr/bin/env node
/**
 * Regression tests for lib/predictor.js: fitPredictor (the trigram-with-
 * backoff model and its honest held-out evaluation) and confidentContexts
 * (the confidence-floor-filtered suggestion list).
 *
 *   node plugins/neural-link-intention-layer/mcp/test/predictor.test.mjs
 */
import assert from 'node:assert/strict';
import { fitPredictor, confidentContexts, CONTEXT_MIN, BACKOFF_DISCOUNT, HELD_OUT_FRACTION, LIFT_REQUIRED_POINTS, BUG_THRESHOLD_TOP1, DESTRUCTIVE_PATTERN } from '../lib/predictor.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

function tok(action) { return { action, run: 1, t: null }; }

try {
  // ================= constants match the reference doc =========================
  {
    assert.equal(CONTEXT_MIN, 20);
    assert.equal(BACKOFF_DISCOUNT, 0.4);
    assert.equal(HELD_OUT_FRACTION, 0.2);
    assert.equal(LIFT_REQUIRED_POINTS, 10);
    assert.equal(BUG_THRESHOLD_TOP1, 70);
    assert.ok(DESTRUCTIVE_PATTERN.test('flatten_image'));
    assert.ok(DESTRUCTIVE_PATTERN.test('merge_down'));
    assert.ok(DESTRUCTIVE_PATTERN.test('delete_layer'));
    assert.ok(DESTRUCTIVE_PATTERN.test('close_document'));
    assert.ok(DESTRUCTIVE_PATTERN.test('overwrite_export'));
    assert.ok(!DESTRUCTIVE_PATTERN.test('select_layer'));
  }
  ok('the module\'s exported constants (context minimum 20, backoff discount 0.4, 20% held out, 10-point lift, 70% bug threshold) and the destructive-action pattern match the reference doc');

  // ================= fitPredictor: the 2,000-action floor, both sides ==========
  {
    assert.throws(
      () => fitPredictor({ tokens: 1999 }),
      (err) => err instanceof ToolError && err.code === 'log_too_small'
    );
  }
  ok('fitPredictor throws log_too_small under exactly 2,000 actions');

  // ================= fitPredictor: a deliberately too-clean synthetic log ======
  // A strict X,Y,X,Y,... alternation, 2,000 tokens, one sequence. With only
  // two distinct actions and self-transitions excluded from every candidate
  // set, both the baseline (always guess the other of the two actions) and
  // the trigram model predict the true next action on every single held-out
  // step - by hand: trainLimit = floor(2000 x 0.8) = 1,600, evaluated =
  // 2000-1600 = 400 held-out transitions, all 400 hits for both baseline and
  // model, so baseline=model=100%, lift=0. This is exactly the shape the
  // module itself calls out as a bug smell (BUG_THRESHOLD_TOP1's own comment:
  // "nearly always leaked test data or uncollapsed runs") - it is used here
  // deliberately to hand-verify both the bug-threshold warning and the
  // learnable_structure/no-lift branch land correctly at once.
  {
    const actions = [];
    for (let i = 0; i < 2000; i++) actions.push(i % 2 === 0 ? 'X' : 'Y');
    const normalised = {
      sequences: [actions.map(tok)],
      sessions: 1,
      tokens: 2000,
      rawCount: 2000,
      dateRange: null,
    };
    const result = fitPredictor(normalised);
    assert.equal(result.log.train_actions, 1600);
    assert.equal(result.log.held_out_actions, 400);
    assert.equal(result.accuracy.evaluated_transitions, 400);
    assert.equal(result.accuracy.baseline_top1_excluding_self_transitions, '100%');
    assert.equal(result.accuracy.model_top1_excluding_self_transitions, '100%');
    assert.equal(result.lift_over_baseline_points, 0);
    assert.equal(result.learnable_structure, false, 'lift of 0 is under the 10-point requirement, even though accuracy itself is perfect');
    assert.match(result.note, /no learnable sequence structure/);
    assert.match(result.warning, /Top-1 above 70% is a bug until disproved/);
    assert.equal(result.provisional, 'Under the 5,000-action floor for trigram fitting — these figures are provisional; re-fit once the log crosses it.');
  }
  ok('fitPredictor on a hand-verified 2,000-token strict-alternation log reports exactly 1,600/400 train/held-out, 100%/100% baseline/model accuracy, lift=0, learnable_structure=false, and the top-1-above-70% bug warning');

  // ================= confidentContexts: the 2,000-action floor ================
  {
    assert.throws(
      () => confidentContexts({ tokens: 1999 }),
      (err) => err instanceof ToolError && err.code === 'log_too_small'
    );
  }
  ok('confidentContexts throws log_too_small under exactly 2,000 actions');

  // ================= confidentContexts: invalid k ==============================
  {
    assert.throws(() => confidentContexts({ tokens: 2000, sequences: [] }, { k: 0 }), (err) => err instanceof ToolError && err.code === 'invalid_k');
    assert.throws(() => confidentContexts({ tokens: 2000, sequences: [] }, { k: -1 }), (err) => err instanceof ToolError && err.code === 'invalid_k');
  }
  ok('confidentContexts rejects a non-positive k rather than computing a nonsensical or negative floor');

  // ================= confidentContexts: floor comparison, hand-verified =========
  // Six independent bigram contexts, each built as its own run of isolated
  // two-token sequences (context -> next) so no context's outgoing count can
  // leak into another context's incoming count and no context's "next" token
  // ever itself accumulates enough occurrences to register as a context of
  // its own (a length-2 sequence ends right after the "next" token, so it
  // never becomes a bi-map key). One shared "FILLER" action padded in as
  // single-token sequences brings the log to the 2,000-action floor while
  // adding exactly one entry to the vocabulary (single-token sequences never
  // populate the bigram map at all). With those 15 distinct actions total
  // (A1,T1,A2,T2,A2_OTHER,A3,T3,A3_OTHER,A4,flatten_image,A5,T5,A6,T6,FILLER)
  // the smoothed probability for a context seen `n->target` out of `t` total
  // is p = (n+1)/(t+15) by hand:
  //   A1: 79 -> T1 (79/79)          p = 80/94  = 0.851064...
  //   A2: 17 -> T2, 4 -> A2_OTHER   p = 18/36  = 0.5 exactly   (t=21)
  //   A3: 18 -> T3, 3 -> A3_OTHER   p = 19/36  = 0.527778...   (t=21)
  //   A4: 60 -> flatten_image       p = 61/75  = 0.813333...
  //   A5: 20 -> T5 (exactly the CONTEXT_MIN floor)   p = 21/35 = 0.6
  //   A6: 19 -> T6 (one short of the floor, but ALL to T6) -- excluded by count alone
  const seqPairs = (count, from, to) => Array.from({ length: count }, () => [tok(from), tok(to)]);
  const sequences = [
    ...seqPairs(79, 'A1', 'T1'),
    ...seqPairs(17, 'A2', 'T2'), ...seqPairs(4, 'A2', 'A2_OTHER'),
    ...seqPairs(18, 'A3', 'T3'), ...seqPairs(3, 'A3', 'A3_OTHER'),
    ...seqPairs(60, 'A4', 'flatten_image'),
    ...seqPairs(20, 'A5', 'T5'),
    ...seqPairs(19, 'A6', 'T6'),
  ];
  const realTokens = sequences.reduce((n, s) => n + s.length, 0); // 79+21+21+60+20+19, x2 = 440
  const fillerNeeded = 2000 - realTokens;
  for (let i = 0; i < fillerNeeded; i++) sequences.push([tok('FILLER')]);
  const normalised = { sequences, sessions: 1, tokens: 2000, rawCount: 2000, dateRange: null };

  {
    // ---- default k (4), floor = 0.8 exactly ----
    const result = confidentContexts(normalised);
    assert.equal(result.k, 4);
    assert.equal(result.floor, 0.8);
    assert.equal(result.orders_used.length, 1);
    assert.deepEqual(result.orders_used, [2], 'under the 5,000-action floor, trigram contexts must not be scanned');

    const surfacedA1 = result.surfaced.find((r) => r.context[0] === 'A1');
    assert.ok(surfacedA1, 'A1 (p=0.851) must clear the default 0.8 floor');
    assert.equal(surfacedA1.seen, 79);
    assert.equal(surfacedA1.predicted_next, 'T1');
    assert.equal(surfacedA1.p, 0.851);

    assert.ok(!result.surfaced.some((r) => r.context[0] === 'A2'), 'A2 (p=0.5) must not clear the default 0.8 floor');
    assert.ok(!result.surfaced.some((r) => r.context[0] === 'A3'), 'A3 (p=0.528) must not clear the default 0.8 floor');
    assert.ok(!result.surfaced.some((r) => r.context[0] === 'A5'), 'A5 (p=0.6) must not clear the default 0.8 floor');

    const suppressedA4 = result.suppressed_destructive.rows.find((r) => r.context[0] === 'A4');
    assert.ok(suppressedA4, 'A4 (p=0.813, predicting a destructive action) must clear the floor and be listed as suppressed, not silently dropped');
    assert.equal(suppressedA4.predicted_next, 'flatten_image');
    assert.equal(suppressedA4.p, 0.813);
    assert.ok(!result.surfaced.some((r) => r.context[0] === 'A4'), 'a destructive prediction must never appear in surfaced, at any confidence');

    assert.ok(!result.surfaced.some((r) => r.context[0] === 'A6') && !result.suppressed_destructive.rows.some((r) => r.context[0] === 'A6'),
      'A6, seen only 19 times, must be excluded from both lists regardless of how confident its (single-candidate) prediction would be');
  }
  ok('confidentContexts at the default floor (k=4, 0.8) surfaces A1 (p=0.851), suppresses the destructive A4 (p=0.813) rather than dropping it, and excludes A2/A3/A5 (all below 0.8) and A6 (below the 20-occurrence floor)');

  {
    // ---- k=1, floor = 0.5 exactly: the strict "> floor" boundary itself ----
    const result = confidentContexts(normalised, { k: 1 });
    assert.equal(result.floor, 0.5);
    assert.ok(!result.surfaced.some((r) => r.context[0] === 'A2'),
      'A2\'s probability is 18/36 = 0.5 exactly, equal to the floor — the rule is p > floor, so an exact match must be excluded, not surfaced');
    const surfacedA3 = result.surfaced.find((r) => r.context[0] === 'A3');
    assert.ok(surfacedA3, 'A3\'s probability is 19/36 = 0.527778..., a hair above the same 0.5 floor, and must be surfaced');
    assert.equal(surfacedA3.p, 0.528);
    const surfacedA5 = result.surfaced.find((r) => r.context[0] === 'A5');
    assert.ok(surfacedA5, 'A5, seen exactly 20 times (the CONTEXT_MIN floor itself), must be included — the count check is t < 20, not t <= 20');
    assert.equal(surfacedA5.p, 0.6);
  }
  ok('confidentContexts\' floor comparison is a strict ">": a context whose probability lands exactly on the floor (A2, p=0.5 at k=1) is excluded, while one a hair above it (A3) is surfaced');

  console.log(`\n${passed} predictor.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
