#!/usr/bin/env node
/**
 * Regression tests for lib/yield.js.
 *
 *   node plugins/five-minute-fluency/mcp/test/yield.test.mjs
 */
import assert from 'node:assert/strict';
import { scoreChanges } from '../lib/yield.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- a selected candidate is never accompanied by "nothing scores" -----
  // Regression test: the note fired whenever every yield was <= 1.5, but
  // the band table (and each candidate's own verdict) treats exactly 1.5 as
  // "fill_only" — usable — not "cut". A candidate scoring exactly 1.5 could
  // be selected onto the sheet in the very same result that told the reader
  // nothing scored well enough for the sheet to matter.
  {
    const result = scoreChanges([{ change: 'x', impact: 3, transfer: 1, cost: 2 }]); // yield = 1.5 exactly
    assert.equal(result.top_three.length, 1);
    assert.equal(result.top_three[0].verdict, 'fill_only');
    assert.equal(result.note, undefined, 'a candidate that was just selected onto the sheet must not be reported alongside "nothing scores above 1.5"');
  }
  ok('a candidate scoring exactly the 1.5 fill-only boundary is selected without a contradictory "nothing scores" note');

  // ---- the note still fires when everything genuinely is a cut -----------
  {
    const result = scoreChanges([{ change: 'x', impact: 1, transfer: 1, cost: 5 }]); // yield = 0.2
    assert.equal(result.top_three.length, 0);
    assert.ok(result.note, 'a log where everything is genuinely below the cut line should still get the note');
  }
  ok('the "nothing scores" note still fires when every candidate is genuinely below 1.5');

  console.log(`\n${passed} yield.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
