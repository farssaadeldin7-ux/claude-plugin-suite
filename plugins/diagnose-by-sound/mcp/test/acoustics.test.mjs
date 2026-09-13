#!/usr/bin/env node
/**
 * Regression tests for lib/acoustics.js's checkCapture.
 *
 *   node plugins/diagnose-by-sound/mcp/test/acoustics.test.mjs
 */
import assert from 'node:assert/strict';
import { checkCapture } from '../lib/acoustics.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- nothing described must never read as a clean five-of-five ---------
  // Regression test: `flag(condition === false, ...)` only fires on an
  // explicit false, so an unset field silently reads the same as one
  // confirmed good — calling checkCapture with nothing at all described
  // reported "No capture-rule failures", a clean pass, rather than saying
  // none of the five conditions were actually checked.
  {
    const result = checkCapture();
    assert.equal(result.conditions_checked, 0);
    assert.equal(result.conditions_not_described.length, 5);
    assert.notEqual(result.verdict, 'No capture-rule failures in the described conditions.', 'a checklist run with nothing described must not read as a clean pass');
  }
  ok('checkCapture with nothing described reports zero conditions checked, not a clean five-of-five');

  // ---- an explicit, fully-described clean capture still passes cleanly ---
  {
    const result = checkCapture({
      windows_closed: true, hvac_off: true, radio_off: true, phone_mounted: true, reproduced_live: true,
    });
    assert.equal(result.conditions_checked, 5);
    assert.equal(result.conditions_not_described, undefined);
    assert.equal(result.verdict, 'No capture-rule failures in the described conditions.');
  }
  ok('a fully and explicitly described clean capture still reports a genuine five-of-five pass');

  // ---- a partially described capture is neither a false pass nor silent --
  {
    const result = checkCapture({ windows_closed: false });
    assert.equal(result.conditions_checked, 1);
    assert.deepEqual(result.conditions_not_described.sort(), ['hvac_off', 'phone_mounted', 'radio_off', 'reproduced_live'].sort());
    assert.equal(result.findings.length, 1);
  }
  ok('a partially described capture reports exactly what was checked and names what was not');

  console.log(`\n${passed} acoustics.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
