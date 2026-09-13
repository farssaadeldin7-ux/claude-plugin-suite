#!/usr/bin/env node
/**
 * Regression tests for lib/score.js.
 *
 *   node plugins/neural-link-intention-layer/mcp/test/score.test.mjs
 */
import assert from 'node:assert/strict';
import { scoreCandidate } from '../lib/score.js';
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

  console.log(`\n${passed} score.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
