#!/usr/bin/env node
/**
 * Regression tests for lib/escalation.js.
 *
 *   node plugins/customer-sales-support/mcp/test/escalation.test.mjs
 */
import assert from 'node:assert/strict';
import { screenMessage } from '../lib/escalation.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const firedIds = (text) => screenMessage({ message: text }).fired.map((f) => f.trigger);

try {
  // ---- the ADR trigger is case-insensitive like every other pattern in it -
  // Regression test: /\bADR\b/ was the one pattern in the legal_regulatory
  // list missing the `i` flag, so "adr" or "Adr" raised no escalation while
  // "ADR" did — a customer's own capitalisation should not decide whether a
  // legal-exposure escalation fires.
  assert.ok(firedIds('I want to go through ADR').includes('legal_regulatory'));
  assert.ok(firedIds('I want to go through adr').includes('legal_regulatory'), 'lowercase "adr" must escalate exactly like uppercase "ADR" does');
  assert.ok(firedIds('I want to go through Adr').includes('legal_regulatory'));
  ok('the ADR escalation trigger fires regardless of the message\'s capitalisation');

  console.log(`\n${passed} escalation.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
