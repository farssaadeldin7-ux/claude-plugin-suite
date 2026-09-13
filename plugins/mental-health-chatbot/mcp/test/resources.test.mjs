#!/usr/bin/env node
/**
 * Regression tests for lib/resources.js's date handling.
 *
 *   node plugins/mental-health-chatbot/mcp/test/resources.test.mjs
 */
import assert from 'node:assert/strict';
import { checkResourceConfig } from '../lib/resources.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const validServices = [{ name: 'Crisis Line', contact: '000', hours: '24/7' }];

try {
  // ---- a date that does not exist is never accepted as verified ---------
  // Regression test: `new Date("2024-02-30T00:00:00Z")` silently rolls over
  // to March 1 instead of being invalid, so a block could claim it was
  // verified on a calendar date that never happened.
  {
    const result = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2024-02-30', review_due: '2024-05-01',
    });
    assert.equal(result.valid, false);
    assert.ok(result.findings.some((f) => /not a date/.test(f)), `expected a "not a date" finding, got: ${JSON.stringify(result.findings)}`);
  }
  ok('a verified_on date that does not exist on the calendar (Feb 30) is rejected, not silently rolled over');

  // ---- the quarterly window cannot silently stretch past three months ---
  // Regression test: adding three calendar months to 30 November naively
  // gives "30 February", which Date rolls forward into March — letting a
  // review_due of 2027-03-02 pass as "within three months" of 2026-11-30
  // when it is actually five days too late.
  {
    const stretched = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-11-30', review_due: '2027-03-02',
    }, { today: new Date('2026-12-01T00:00:00Z') });
    assert.equal(stretched.valid, false);
    assert.ok(stretched.findings.some((f) => /more than three months/.test(f)), `expected a "more than three months" finding, got: ${JSON.stringify(stretched.findings)}`);

    // The correctly clamped boundary (28 Feb 2027, a non-leap year) must
    // still be accepted — the fix must not become overly strict.
    const atBoundary = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-11-30', review_due: '2027-02-28',
    }, { today: new Date('2026-12-01T00:00:00Z') });
    assert.equal(atBoundary.valid, true, `expected valid at the exact three-month boundary, got: ${JSON.stringify(atBoundary.findings)}`);
  }
  ok('a review_due more than three real calendar months after a month-end verified_on is rejected, and the correct boundary is still accepted');

  console.log(`\n${passed} resources.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
