#!/usr/bin/env node
/**
 * Regression tests for lib/escalation.js's one piece of real logic:
 * triggerCategory's numeric lookup. TRIGGER_CATEGORIES/RESPONSE_CONSTRAINTS/
 * etc. are static protocol text with no computation, so they are not
 * covered here — see the report for why.
 *
 *   node plugins/mental-health-chatbot/mcp/test/escalation.test.mjs
 */
import assert from 'node:assert/strict';
import { triggerCategory, TRIGGER_CATEGORIES } from '../lib/escalation.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- the category table itself is exactly 1..9, contiguous --------------
  // detection_phrases (lib/checkin.js) and every trigger-category argument
  // elsewhere in this plugin assume this shape; a gap or duplicate here
  // would silently orphan a phrase list or a screen result.
  {
    const numbers = TRIGGER_CATEGORIES.map((c) => c.category).sort((a, b) => a - b);
    assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  ok('TRIGGER_CATEGORIES is exactly the nine categories numbered 1 through 9, contiguous with no gap or duplicate');

  // ---- triggerCategory: lookup, numeric coercion, and unknown -> null -----
  {
    assert.equal(triggerCategory(1).name, 'Suicide and self-harm');
    assert.equal(triggerCategory(9).name, 'Conversational');
    assert.equal(triggerCategory('3').name, 'Abuse and violence', 'a numeric string must coerce and still resolve');
    assert.equal(triggerCategory(0), null, 'category 0 does not exist');
    assert.equal(triggerCategory(10), null, 'category 10 does not exist');
    assert.equal(triggerCategory(3.5), null, 'a non-integer category must not fuzzily match a real one');
    assert.equal(triggerCategory(undefined), null, 'Number(undefined) is NaN, which must not match anything');
    assert.equal(triggerCategory('not a number'), null);
  }
  ok('triggerCategory resolves categories 1-9 (including from a numeric string) and returns null for anything outside the table, including NaN input');

  console.log(`\n${passed} escalation.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
