#!/usr/bin/env node
/**
 * Regression tests for lib/score.js.
 *
 *   node plugins/neural-link-intention-layer/mcp/test/score.test.mjs
 */
import assert from 'node:assert/strict';
import { scoreCandidate } from '../lib/score.js';
import { SCORING } from '../lib/method.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- setup_seconds and R cannot both be zero -----------------------------
  // Regression test: `value = F x (K + C) / (S + R)` divided by zero when
  // setup_seconds was 0 and no wrong-fire terms were supplied (R defaults
  // to 0), producing Infinity with no error.
  assert.throws(
    () => scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 0 }),
    (err) => err instanceof ToolError && err.code === 'invalid_term'
  );
  ok('setup_seconds of zero with no wrong-fire risk to offset it is rejected instead of dividing by zero');

  // ---- a reliable automation (high correct_fire_p) gets a small risk term -
  // Regression test-adjacent: the parameter is named for what it actually
  // means (probability of firing *correctly*) rather than "wrong_fire_p",
  // which read the other way round would multiply a caller's small,
  // intended-to-be-reassuring number straight into a large risk instead of
  // a small one.
  {
    const reliable = scoreCandidate({
      f_per_week: 10, k_seconds: 1.5, setup_seconds: 180,
      correct_fire_p: 0.95, wrong_fire_severity_seconds: 30,
    });
    const unreliable = scoreCandidate({
      f_per_week: 10, k_seconds: 1.5, setup_seconds: 180,
      correct_fire_p: 0.5, wrong_fire_severity_seconds: 30,
    });
    assert.ok(reliable.terms.R < unreliable.terms.R, 'a higher correct_fire_p must produce a lower wrong-fire risk term, never a higher one');
    assert.equal(reliable.terms.R, 1.5); // (1 - 0.95) * 30
  }
  ok('R = (1 - correct_fire_p) x severity: higher correct_fire_p means lower risk, as the formula and its own reference table both state');

  // ---- f_per_week and k_seconds+c_seconds must both be above zero ----------
  assert.throws(
    () => scoreCandidate({ f_per_week: 0, k_seconds: 1.5, setup_seconds: 180 }),
    (err) => err instanceof ToolError && err.code === 'invalid_term'
  );
  assert.throws(
    () => scoreCandidate({ f_per_week: 10, k_seconds: 0, c_seconds: 0, setup_seconds: 180 }),
    (err) => err instanceof ToolError && err.code === 'invalid_term'
  );
  ok('f_per_week of zero and k_seconds+c_seconds of zero are both rejected — the payback is undefined in either case');

  // ---- negative or non-numeric terms are rejected, including c_seconds -----
  for (const bad of [{ f_per_week: -1, k_seconds: 1, setup_seconds: 1 },
    { f_per_week: 1, k_seconds: -1, setup_seconds: 1 },
    { f_per_week: 1, k_seconds: 1, setup_seconds: -1 },
    { f_per_week: 1, k_seconds: 1, c_seconds: -1, setup_seconds: 1 },
    { f_per_week: '10', k_seconds: 1, setup_seconds: 1 },
    { f_per_week: 1, k_seconds: 1, setup_seconds: NaN }]) {
    assert.throws(() => scoreCandidate(bad), (err) => err instanceof ToolError && err.code === 'invalid_term');
  }
  ok('negative, non-numeric and non-finite terms (including a negative c_seconds) are all rejected');

  // ---- correct_fire_p / wrong_fire_severity_seconds must be supplied together, and in range ----
  assert.throws(
    () => scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 180, correct_fire_p: 0.9 }),
    (err) => err instanceof ToolError && err.code === 'invalid_term'
  );
  assert.throws(
    () => scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 180, wrong_fire_severity_seconds: 30 }),
    (err) => err instanceof ToolError && err.code === 'invalid_term'
  );
  assert.throws(
    () => scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 180, correct_fire_p: 1.01, wrong_fire_severity_seconds: 30 }),
    (err) => err instanceof ToolError && err.code === 'invalid_term'
  );
  assert.throws(
    () => scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 180, correct_fire_p: -0.01, wrong_fire_severity_seconds: 30 }),
    (err) => err instanceof ToolError && err.code === 'invalid_term'
  );
  assert.throws(
    () => scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 180, correct_fire_p: 0.9, wrong_fire_severity_seconds: -1 }),
    (err) => err instanceof ToolError && err.code === 'invalid_term'
  );
  // correct_fire_p is inclusive at both 0 and 1 — the reference table's own
  // typical values ("severity unbounded if destructive") imply p itself may
  // legitimately be a certainty at either end, so 0 and 1 must not be rejected.
  assert.doesNotThrow(() => scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 180, correct_fire_p: 0, wrong_fire_severity_seconds: 30 }));
  assert.doesNotThrow(() => scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 180, correct_fire_p: 1, wrong_fire_severity_seconds: 30 }));
  ok('correct_fire_p and wrong_fire_severity_seconds must be supplied together and in range, with 0 and 1 accepted as the inclusive ends of correct_fire_p');

  // ---- payback_weeks: the build/do-not-build boundary is exclusive at 8 ----
  // Regression-shaped: `payback_weeks < 8` must stay strict. S=8, F=1, K=1.3,
  // C=0 gives payback_weeks = 8 x 1.3 / (1 x 1.3) = 8.0 exactly by hand;
  // S=7.9 with the same F/K gives 7.9 exactly. The build_rule text itself
  // reads "under 8 weeks", so 8.0 exactly must NOT count as under it.
  {
    const atBoundary = scoreCandidate({ f_per_week: 1, k_seconds: 1.3, setup_seconds: 8 });
    assert.equal(atBoundary.payback_weeks, 8);
    assert.equal(atBoundary.payback_under_8_weeks, false, '8.0 weeks exactly is documented as "8 weeks or more", not under the threshold');
    assert.match(atBoundary.verdict, /^do_not_build — payback is 8 weeks or more$/);

    const justUnder = scoreCandidate({ f_per_week: 1, k_seconds: 1.3, setup_seconds: 7.9 });
    assert.equal(justUnder.payback_weeks, 7.9);
    assert.equal(justUnder.payback_under_8_weeks, true);
  }
  ok('payback_weeks = S x 1.3 / (F x (K + C)) is hand-verified at exactly 8 weeks and just under it, and the under-8-weeks boundary is exclusive at 8');

  // ---- verdict text depends on stable_across_log once payback clears 8 weeks ----
  {
    const args = { f_per_week: 1, k_seconds: 1.3, setup_seconds: 7.9 };
    assert.match(scoreCandidate({ ...args, stable_across_log: true }).verdict, /^build — payback under 8 weeks/);
    assert.match(scoreCandidate({ ...args, stable_across_log: false }).verdict, /^do_not_build — payback clears the threshold but the sequence is not stable/);
    assert.match(scoreCandidate(args).verdict, /^threshold_met_stability_unconfirmed/, 'omitting stable_across_log must not silently guess build or do_not_build');
  }
  ok('verdict reads build/do_not_build/unconfirmed correctly from stable_across_log (true/false/omitted) once payback is under 8 weeks');

  // ---- value formula, hand-verified with concrete numbers -------------------
  // value = F x (K + C) / (S + R). F=10, K=1.5, C=0.5, S=180, correct_fire_p=0.9,
  // severity=20 -> R = 0.1 x 20 = 2. value = 10 x 2 / 182 = 20/182 = 0.10989...
  {
    const r = scoreCandidate({
      f_per_week: 10, k_seconds: 1.5, c_seconds: 0.5, setup_seconds: 180,
      correct_fire_p: 0.9, wrong_fire_severity_seconds: 20,
    });
    assert.equal(r.terms.R, 2);
    assert.equal(r.terms.K, 1.5);
    assert.equal(r.terms.C, 0.5);
    assert.equal(r.value, 0.11, 'value = 10 x (1.5+0.5) / (180+2) = 20/182 = 0.10989... which toFixed(3) rounds to 0.110');
    assert.equal(r.seconds_saved_per_week, 20); // F x (K+C) = 10 x 2
  }
  ok('value = F x (K + C) / (S + R) matches a hand-computed example with a non-zero context-switch cost and wrong-fire risk term');

  // ---- pass-through fields come from method.js's SCORING constant, not duplicated data ----
  {
    const r = scoreCandidate({ f_per_week: 10, k_seconds: 1.5, setup_seconds: 180 });
    assert.deepEqual(r.formulas, SCORING.formulas);
    assert.equal(r.build_rule, SCORING.build_rule);
    assert.deepEqual(r.typical_term_values, SCORING.terms);
    assert.equal(r.context_switch_note, SCORING.context_switch_note);
  }
  ok('formulas, build_rule, typical_term_values and context_switch_note are passed through from method.js\'s single SCORING source, not restated');

  console.log(`\n${passed} score.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
