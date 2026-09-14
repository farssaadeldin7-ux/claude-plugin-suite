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

  // ---- the three-month boundary on a non-month-end date -------------------
  // Same rule, checked on a date that never touches the "no such day in that
  // month" clamping logic at all, so this exercises the plain equality
  // boundary (`>` addThreeMonths) independently of the clamp path above.
  {
    const onBoundary = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-01-15', review_due: '2026-04-15',
    }, { today: new Date('2026-01-16T00:00:00Z') });
    assert.equal(onBoundary.valid, true, `expected valid exactly three months out, got: ${JSON.stringify(onBoundary.findings)}`);

    const oneDayPast = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-01-15', review_due: '2026-04-16',
    }, { today: new Date('2026-01-16T00:00:00Z') });
    assert.equal(oneDayPast.valid, false);
    assert.ok(oneDayPast.findings.some((f) => /more than three months/.test(f)));
  }
  ok('review_due exactly three calendar months after a non-month-end verified_on is accepted; one day further is rejected');

  // ---- verified_on strictly in the future is rejected; "today" itself is not
  {
    const exactlyToday = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-09-14', review_due: '2026-12-14',
    }, { today: new Date('2026-09-14T00:00:00Z') });
    assert.equal(exactlyToday.valid, true, `verified_on equal to today must not be "in the future", got: ${JSON.stringify(exactlyToday.findings)}`);

    const tomorrow = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-09-15', review_due: '2026-12-15',
    }, { today: new Date('2026-09-14T00:00:00Z') });
    assert.equal(tomorrow.valid, false);
    assert.ok(tomorrow.findings.some((f) => /in the future/.test(f)));
  }
  ok('verified_on dated exactly today is accepted (not "in the future"); one day ahead of today is rejected');

  // ---- review_due strictly in the past is stale; "today" itself is not ----
  {
    const dueToday = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-06-14', review_due: '2026-09-14',
    }, { today: new Date('2026-09-14T00:00:00Z') });
    assert.equal(dueToday.valid, true, `review_due equal to today must not be stale, got: ${JSON.stringify(dueToday.findings)}`);

    const dueYesterday = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-06-13', review_due: '2026-09-13',
    }, { today: new Date('2026-09-14T00:00:00Z') });
    assert.equal(dueYesterday.valid, false);
    assert.ok(dueYesterday.findings.some((f) => /Stale/.test(f)));
  }
  ok('review_due dated exactly today is not stale; one day in the past is stale');

  // ---- review_due must be strictly after verified_on -----------------------
  {
    const sameDay = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-06-01', review_due: '2026-06-01',
    }, { today: new Date('2026-06-02T00:00:00Z') });
    assert.equal(sameDay.valid, false);
    assert.ok(sameDay.findings.some((f) => /not after/.test(f)));

    const nextDay = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '2026-06-01', review_due: '2026-06-02',
    }, { today: new Date('2026-06-02T00:00:00Z') });
    assert.equal(nextDay.valid, true, `expected valid, got: ${JSON.stringify(nextDay.findings)}`);
  }
  ok('review_due equal to verified_on is rejected as "not after"; one day later is accepted');

  // ---- shape checks: missing fields, non-object, bad services -------------
  {
    assert.equal(checkResourceConfig(null).valid, false);
    assert.ok(checkResourceConfig(null).findings.some((f) => /not an object/.test(f)));
    assert.equal(checkResourceConfig([1, 2]).valid, false, 'an array must not pass as a valid config object');
    assert.equal(checkResourceConfig('x').valid, false);

    const missingFields = checkResourceConfig({ services: validServices, verified_on: '2026-01-01', review_due: '2026-02-01' });
    assert.ok(missingFields.findings.some((f) => /"region"/.test(f)));
    assert.ok(missingFields.findings.some((f) => /"verified_by"/.test(f)));

    const badDateShape = checkResourceConfig({
      region: 'us', verified_by: 'ops', services: validServices,
      verified_on: '01/01/2026', review_due: '2026-04-01',
    });
    assert.ok(badDateShape.findings.some((f) => /"verified_on" is not a date/.test(f)));

    const noServices = checkResourceConfig({
      region: 'us', verified_by: 'ops', verified_on: '2026-01-01', review_due: '2026-02-01', services: [],
    });
    assert.ok(noServices.findings.some((f) => /non-empty array/.test(f)));

    const badService = checkResourceConfig({
      region: 'us', verified_by: 'ops', verified_on: '2026-01-01', review_due: '2026-02-01',
      services: [{ name: 'Crisis Line', contact: '000' }], // missing "hours"
    });
    assert.ok(badService.findings.some((f) => /services\[0\] is missing "hours"/.test(f)));

    const nonObjectService = checkResourceConfig({
      region: 'us', verified_by: 'ops', verified_on: '2026-01-01', review_due: '2026-02-01',
      services: ['not an object'],
    });
    assert.ok(nonObjectService.findings.some((f) => /services\[0\] is not an object/.test(f)));
  }
  ok('checkResourceConfig reports every missing/malformed field individually rather than stopping at the first: region/verified_by, a non-YYYY-MM-DD date, an empty or malformed services array, and a non-object block or array passed in its place');

  console.log(`\n${passed} resources.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
