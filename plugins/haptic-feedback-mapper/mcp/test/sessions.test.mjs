#!/usr/bin/env node
/**
 * Regression tests for lib/sessions.js: the local before/after session log,
 * its per-phase averages, the checks-did-not-drop flag and the
 * crying-wolf trust flag.
 *
 * sessions.js creates its JSON-array store (and resolves the config
 * directory) the moment it is imported, so each scenario below gets its own
 * XDG_CONFIG_HOME *and* a fresh module instance (via a cache-busting query
 * string on the import specifier) — otherwise every scenario would share one
 * on-disk log and their numbers would contaminate each other.
 *
 *   node plugins/haptic-feedback-mapper/mcp/test/sessions.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const tmpDirs = [];
let importSeq = 0;
async function freshSessionsLib() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haptic-feedback-mapper-sessions-test-'));
  tmpDirs.push(dir);
  process.env.XDG_CONFIG_HOME = dir;
  importSeq += 1;
  return import(`../lib/sessions.js?instance=${importSeq}`);
}

try {
  // ---- logSession request-shape and consistency validation ----------------
  {
    const { logSession } = await freshSessionsLib();
    assert.throws(() => logSession({ phase: 'mid', duration_minutes: 10, checks: 1 }), (e) => e instanceof ToolError && e.code === 'invalid_phase');
    assert.throws(() => logSession({ phase: 'baseline', duration_minutes: 0, checks: 1 }), (e) => e instanceof ToolError && e.code === 'invalid_request', 'duration_minutes of exactly 0 must be rejected');
    assert.throws(() => logSession({ phase: 'baseline', duration_minutes: 10, checks: -1 }), (e) => e instanceof ToolError && e.code === 'invalid_request', 'a negative checks count must be rejected');
    assert.doesNotThrow(() => logSession({ phase: 'baseline', duration_minutes: 10, checks: 0 }), 'zero checks is a legitimate (very good) session, not an error');
    assert.throws(
      () => logSession({ phase: 'after', duration_minutes: 10, checks: 1, haptics_acted_on: 2 }),
      (e) => e instanceof ToolError && e.code === 'invalid_request',
      'haptics_acted_on without haptics_delivered must be rejected',
    );
    assert.throws(
      () => logSession({ phase: 'after', duration_minutes: 10, checks: 1, haptics_delivered: 3, haptics_acted_on: 4 }),
      (e) => e instanceof ToolError && e.code === 'invalid_request',
      'haptics_acted_on exceeding haptics_delivered must be rejected',
    );
    assert.doesNotThrow(() => logSession({ phase: 'after', duration_minutes: 10, checks: 1, haptics_delivered: 4, haptics_acted_on: 4 }), 'acted equal to delivered is the boundary and must be accepted');
    assert.throws(
      () => logSession({ phase: 'baseline', duration_minutes: 10, checks: 1, haptics_delivered: 2 }),
      (e) => e instanceof ToolError && e.code === 'invalid_request',
      'a baseline session predates the mapping and cannot carry delivered haptics',
    );
    assert.throws(() => logSession({ phase: 'baseline', duration_minutes: 10, checks: 1, session_date: '2026-13-40' }), (e) => e instanceof ToolError && e.code === 'invalid_date');
  }
  ok('logSession rejects an unknown phase, non-positive duration, negative checks, haptics_acted_on given without haptics_delivered or exceeding it, delivered haptics on a baseline session, and a malformed date — accepting the acted==delivered boundary and a zero-checks session');

  // ---- MIN_SESSIONS sample_note boundary: fewer than 3 vs exactly 3 -------
  {
    const { logSession } = await freshSessionsLib();
    const r1 = logSession({ phase: 'baseline', duration_minutes: 60, checks: 10 });
    assert.equal(r1.sessions_in_phase, 1);
    assert.match(r1.sample_note, /Fewer than 3/, '1 session is below MIN_SESSIONS and must carry the noise warning');

    const r2 = logSession({ phase: 'baseline', duration_minutes: 60, checks: 10 });
    assert.equal(r2.sessions_in_phase, 2);
    assert.match(r2.sample_note, /Fewer than 3/, '2 sessions is still below MIN_SESSIONS');

    const r3 = logSession({ phase: 'baseline', duration_minutes: 60, checks: 10 });
    assert.equal(r3.sessions_in_phase, 3);
    assert.equal(r3.sample_note, undefined, 'exactly 3 sessions meets MIN_SESSIONS and must not warn');
  }
  ok('logSession\'s sample_note fires below MIN_SESSIONS (1, 2 sessions) and stops exactly at the 3-session boundary');

  // ---- reviewSessions: a hand-verified happy-path before/after pair -------
  // 3 baseline sessions at 60 min / 20 checks each -> 180 min, 60 checks,
  // checks_per_hour = 60/180*60 = 20.0. 3 "after" sessions at 60 min / 8
  // checks, each delivering 4 haptics and 3 acted-on -> 180 min, 24 checks,
  // checks_per_hour = 24/180*60 = 8.0. drop_share = (20-8)/20 = 0.6.
  // trust: delivered 4x3=12, acted 3x3=9, action_rate = 9/12 = 0.75 (well
  // above TRUST_FLOOR, and delivered>=10 so the flag condition is even
  // eligible to fire, but the rate is nowhere near the floor) -> no flags.
  {
    const { logSession, reviewSessions } = await freshSessionsLib();
    for (let i = 0; i < 3; i += 1) logSession({ phase: 'baseline', duration_minutes: 60, checks: 20 });
    for (let i = 0; i < 3; i += 1) logSession({ phase: 'after', duration_minutes: 60, checks: 8, haptics_delivered: 4, haptics_acted_on: 3 });

    const review = reviewSessions();
    assert.equal(review.total_sessions, 6);
    assert.equal(review.baseline.checks_per_hour, 20);
    assert.equal(review.baseline.sample_note, undefined);
    assert.equal(review.after.checks_per_hour, 8);
    assert.equal(review.delta.drop_share, 0.6);
    assert.equal(review.trust.haptics_delivered, 12);
    assert.equal(review.trust.haptics_acted_on, 9);
    assert.equal(review.trust.action_rate, 0.75);
    assert.deepEqual(review.flags, [], 'a healthy 60%-drop, 75%-trust pair must raise no flags');
  }
  ok('reviewSessions computes the hand-verified checks_per_hour, drop_share and action_rate for a 3-baseline/3-after session log, with no flags raised');

  // ---- checks_did_not_drop boundary: drop_share <= 0 in each direction ----
  {
    const { logSession, reviewSessions } = await freshSessionsLib();
    logSession({ phase: 'baseline', duration_minutes: 30, checks: 5 }); // cph 10
    logSession({ phase: 'after', duration_minutes: 30, checks: 5 }); // cph 10 -> drop_share exactly 0
    const flat = reviewSessions();
    assert.equal(flat.delta.drop_share, 0);
    assert.equal(flat.flags.some((f) => f.flag === 'checks_did_not_drop'), true, 'a drop_share of exactly 0 must be flagged (the rule is <= 0)');
  }
  {
    const { logSession, reviewSessions } = await freshSessionsLib();
    logSession({ phase: 'baseline', duration_minutes: 30, checks: 5 }); // cph 10
    logSession({ phase: 'after', duration_minutes: 30, checks: 6 }); // cph 12 -> checks got worse, drop_share negative
    const worse = reviewSessions();
    assert.equal(worse.delta.drop_share, -0.2);
    assert.equal(worse.flags.some((f) => f.flag === 'checks_did_not_drop'), true, 'checks going up must also be flagged, not just staying flat');
  }
  {
    const { logSession, reviewSessions } = await freshSessionsLib();
    logSession({ phase: 'baseline', duration_minutes: 30, checks: 5 }); // cph 10
    logSession({ phase: 'after', duration_minutes: 30, checks: 4 }); // cph 8 -> drop_share 0.2, just past the boundary
    const dropped = reviewSessions();
    assert.equal(dropped.delta.drop_share, 0.2);
    assert.equal(dropped.flags.some((f) => f.flag === 'checks_did_not_drop'), false, 'any real positive drop must not be flagged');
  }
  ok('reviewSessions flags checks_did_not_drop at drop_share <= 0 (both exactly flat and a regression), and not for a real positive drop, matching the <= 0 rule at its boundary');

  // ---- vocabulary_crying_wolf boundary: delivered>=10 AND action_rate<0.5 -
  {
    const { logSession, reviewSessions } = await freshSessionsLib();
    logSession({ phase: 'after', duration_minutes: 10, checks: 1, haptics_delivered: 10, haptics_acted_on: 5 }); // rate exactly 0.5
    const atFloor = reviewSessions();
    assert.equal(atFloor.trust.action_rate, 0.5);
    assert.equal(atFloor.flags.some((f) => f.flag === 'vocabulary_crying_wolf'), false, 'an action_rate of exactly 0.5 (the floor) must not be flagged -- the rule is strictly below the floor');
  }
  {
    const { logSession, reviewSessions } = await freshSessionsLib();
    logSession({ phase: 'after', duration_minutes: 10, checks: 1, haptics_delivered: 10, haptics_acted_on: 4 }); // rate 0.4, just under the floor
    const belowFloor = reviewSessions();
    assert.equal(belowFloor.trust.action_rate, 0.4);
    assert.equal(belowFloor.flags.some((f) => f.flag === 'vocabulary_crying_wolf'), true, 'an action_rate just below 0.5 with 10+ delivered haptics must be flagged');
  }
  {
    const { logSession, reviewSessions } = await freshSessionsLib();
    logSession({ phase: 'after', duration_minutes: 10, checks: 1, haptics_delivered: 9, haptics_acted_on: 0 }); // rate 0, but under the 10-delivered floor
    const tooFewDelivered = reviewSessions();
    assert.equal(tooFewDelivered.trust.action_rate, 0);
    assert.equal(tooFewDelivered.flags.some((f) => f.flag === 'vocabulary_crying_wolf'), false, 'even a 0% action rate must not be flagged below the 10-delivered sample floor');
  }
  ok('reviewSessions\' vocabulary_crying_wolf flag requires both the 10-delivered sample floor and an action_rate strictly below 0.5, tested at both boundaries independently');

  console.log(`\n${passed} sessions.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
}
