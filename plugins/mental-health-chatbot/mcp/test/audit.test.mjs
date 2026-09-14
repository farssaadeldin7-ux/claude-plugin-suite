#!/usr/bin/env node
/**
 * Regression tests for lib/audit.js: recordSession's validation rules and
 * reviewAudit's tallies over the session log.
 *
 *   node plugins/mental-health-chatbot/mcp/test/audit.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// The store resolves its config directory (via createJsonArrayStore) at
// import time, so XDG_CONFIG_HOME must be set — and audit.js dynamically
// imported — before that happens, exactly as the professor-mind-reader
// pilot's domain.test.mjs does for its own on-disk store.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mental-health-chatbot-audit-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { recordSession, reviewAudit } = await import('../lib/audit.js');

const base = { config_version: 'v1', messages: 3, ended: 'completed' };

try {
  // ---- session_date: a date that does not exist is never accepted ---------
  // Regression test: Date.parse("2024-02-30") does not return NaN — it
  // silently rolls the date forward to 1 March — so the original isoDayOf
  // (checking only the regex shape plus Date.parse) let a session claim a
  // session_date that never happened on the calendar. This is the same bug
  // class resources.test.mjs already covers for verified_on/review_due, and
  // it was live here too: audit.js's isoDayOf did not do the round-trip
  // check resources.js's parseDate does. Fixed to match.
  {
    assert.throws(
      () => recordSession({ ...base, session_date: '2024-02-30' }),
      /"2024-02-30" is not a date/,
      'a session_date of Feb 30 must be rejected, not silently stored as-is or rolled over',
    );
    // The correct boundary — a real leap day — must still be accepted, and a
    // non-leap-year Feb 29 (2023 is not a leap year) must still be rejected,
    // so the fix is neither too strict nor too loose.
    const leap = recordSession({ ...base, session_date: '2024-02-29' });
    assert.equal(leap.recorded, true);
    assert.throws(() => recordSession({ ...base, session_date: '2023-02-29' }), /is not a date/);
  }
  ok('recordSession rejects a session_date that does not exist on the calendar (Feb 30, and Feb 29 in a non-leap year), while a real leap day is still accepted');

  // ---- session_date: malformed shape is rejected too -----------------------
  {
    assert.throws(() => recordSession({ ...base, session_date: '01/01/2026' }), /is not a date/);
    assert.throws(() => recordSession({ ...base, session_date: 'not-a-date' }), /is not a date/);
  }
  ok('recordSession rejects a session_date that is not in YYYY-MM-DD shape at all');

  // ---- messages: must be a positive count, boundary at exactly 1 ----------
  {
    const atOne = recordSession({ ...base, messages: 1 });
    assert.equal(atOne.recorded, true, 'messages: 1 is the documented minimum and must be accepted');
    assert.throws(() => recordSession({ ...base, messages: 0 }), /messages must be a positive count/);
    assert.throws(() => recordSession({ ...base, messages: -1 }), /messages must be a positive count/);
    assert.throws(() => recordSession({ ...base, messages: 'three' }), /messages must be a positive count/);
  }
  ok('recordSession requires messages >= 1, rejecting exactly 0, negative counts, and non-numeric input');

  // ---- trigger_category: must be one of the nine numbered categories ------
  {
    const catNine = recordSession({ ...base, trigger_category: 9, escalated: true, handover_packet_delivered: true, ended: 'escalated' });
    assert.equal(catNine.recorded, true, 'category 9 is the highest real category and must be accepted');
    const catOne = recordSession({ ...base, trigger_category: 1, escalated: true, handover_packet_delivered: true, ended: 'escalated' });
    assert.equal(catOne.recorded, true, 'category 1 is the lowest real category and must be accepted');
    assert.throws(() => recordSession({ ...base, trigger_category: 0 }), /is not a trigger category/);
    assert.throws(() => recordSession({ ...base, trigger_category: 10 }), /is not a trigger category/);
    // trigger_category omitted entirely is legitimate (a session with no trigger).
    const noCat = recordSession({ ...base });
    assert.equal(noCat.recorded, true);
    assert.equal(noCat.flag, undefined, 'no trigger category means nothing was missed — no flag');
  }
  ok('recordSession accepts trigger_category 1 through 9 and rejects anything outside that range, while an omitted category is legitimate');

  // ---- ended must be a real session ending; "escalated" requires escalated:true
  {
    assert.throws(() => recordSession({ ...base, ended: 'left_early' }), /is not a session ending/);
    assert.throws(
      () => recordSession({ ...base, ended: 'escalated', escalated: false }),
      /ended "escalated" requires escalated: true/,
    );
    assert.throws(
      () => recordSession({ ...base, ended: 'escalated' }), // escalated omitted entirely
      /ended "escalated" requires escalated: true/,
    );
  }
  ok('recordSession rejects an unrecognised ending, and rejects ended:"escalated" unless escalated:true is also passed');

  // ---- an escalated session must record handover_packet_delivered ---------
  // handover_packet_delivered is stored only when it is exactly `true` —
  // any other truthy value (a string, a number) is treated as "not
  // delivered", matching the same strict-equality convention `escalated ===
  // true` uses elsewhere in this file.
  {
    assert.throws(
      () => recordSession({ ...base, trigger_category: 2, escalated: true, ended: 'escalated' }), // handover_packet_delivered omitted
      /An escalated session must record handover_packet_delivered/,
    );
    const deliveredFalse = recordSession({
      ...base, trigger_category: 2, escalated: true, handover_packet_delivered: false, ended: 'escalated',
    });
    assert.equal(deliveredFalse.recorded, true, 'explicitly recording false is allowed — the log must capture a failed handover, not just a successful one');

    const deliveredTruthyString = recordSession({
      ...base, trigger_category: 2, escalated: true, handover_packet_delivered: 'yes', ended: 'escalated',
    });
    assert.equal(deliveredTruthyString.recorded, true);
    const review = reviewAudit({ limit: 1 });
    assert.equal(review.sessions[0].handover_packet_delivered, false, 'a non-boolean truthy value must not be recorded as delivered');

    // A non-escalated session must not require the field at all, and stores it as null.
    const notEscalated = recordSession({ ...base });
    const review2 = reviewAudit({ limit: 1 });
    assert.equal(review2.sessions[0].handover_packet_delivered, null);
  }
  ok('recordSession requires handover_packet_delivered on every escalated session (false is a valid, distinct answer from omitted), stores non-true values as false, and stores null when the session never escalated');

  // ---- resources_shown: negative or missing is clamped to 0, not stored raw
  {
    const zero = recordSession({ ...base, resources_shown: 0 });
    assert.equal(zero.recorded, true);
    let review = reviewAudit({ limit: 1 });
    assert.equal(review.sessions[0].resources_shown, 0, '0 is a legitimate count and must round-trip as 0, not fall through to the clamp');

    recordSession({ ...base, resources_shown: -3 });
    review = reviewAudit({ limit: 1 });
    assert.equal(review.sessions[0].resources_shown, 0, 'a negative count must be clamped to 0, not stored as -3');

    recordSession({ ...base }); // resources_shown omitted
    review = reviewAudit({ limit: 1 });
    assert.equal(review.sessions[0].resources_shown, 0);
  }
  ok('recordSession stores resources_shown as given when it is 0 or positive, and clamps a negative or missing value to 0');

  // ---- a trigger recorded without an escalation is flagged, not hidden ----
  {
    const missed = recordSession({ ...base, trigger_category: 1, escalated: false, ended: 'user_left' });
    assert.equal(missed.flag, 'missed_escalation');

    const caught = recordSession({ ...base, trigger_category: 1, escalated: true, handover_packet_delivered: true, ended: 'escalated' });
    assert.equal(caught.flag, undefined);
  }
  ok('recordSession flags a session with a trigger category but no escalation as missed_escalation, and does not flag one that did escalate');

  // ---- config_version is required and non-blank ----------------------------
  {
    assert.throws(() => recordSession({ ...base, config_version: undefined }), /config_version is required/);
    assert.throws(() => recordSession({ ...base, config_version: '   ' }), /config_version is required/);
  }
  ok('recordSession requires a non-blank config_version');

  console.log(`\n${passed} audit.js recordSession checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
  process.exit(1);
}

// ---- reviewAudit: date-range filtering and tallies, in a fresh store ------
// A separate, fresh store: the assertions below need an exact, hand-counted
// set of records, which the mutations above would otherwise pollute.
const tmpConfigHome2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mental-health-chatbot-audit-test2-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome2;
const { recordSession: recordSession2, reviewAudit: reviewAudit2 } = await import(`../lib/audit.js?fresh=${Date.now()}`);

try {
  // Six sessions, hand-counted by ending / trigger / escalation / resources:
  //   S1 2026-01-05  no trigger   completed   resources 1
  //   S2 2026-01-06  cat 2 esc    escalated   resources 0
  //   S3 2026-01-07  cat 1 miss   user_left   resources 0   <- missed escalation
  //   S4 2026-01-08  no trigger   declined    resources 2
  //   S5 2026-01-09  cat 2 esc    escalated   resources 1
  //   S6 2026-01-10  no trigger   completed   resources 0
  // endings: completed=2, escalated=2, user_left=1, declined=1 (sums to 6)
  // escalations: total=2, by_category={2:2}; missed=1 (S3); resources sum=4
  recordSession2({ ...base, session_date: '2026-01-05', ended: 'completed', resources_shown: 1 });
  const s2 = recordSession2({ ...base, session_date: '2026-01-06', trigger_category: 2, escalated: true, handover_packet_delivered: true, ended: 'escalated', resources_shown: 0 });
  const s3 = recordSession2({ ...base, session_date: '2026-01-07', trigger_category: 1, escalated: false, ended: 'user_left', resources_shown: 0 });
  recordSession2({ ...base, session_date: '2026-01-08', ended: 'declined', resources_shown: 2 });
  const s5 = recordSession2({ ...base, session_date: '2026-01-09', trigger_category: 2, escalated: true, handover_packet_delivered: true, ended: 'escalated', resources_shown: 1 });
  recordSession2({ ...base, session_date: '2026-01-10', ended: 'completed', resources_shown: 0 });

  {
    const review = reviewAudit2({});
    assert.equal(review.total_sessions, 6);
    assert.deepEqual(review.endings, { completed: 2, escalated: 2, user_left: 1, declined: 1 });
    assert.equal(review.escalations.total, 2);
    assert.deepEqual(review.escalations.by_category, { 2: 2 });
    assert.equal(review.resources_shown, 4);
    assert.equal(review.missed_escalations.count, 1);
    assert.equal(review.missed_escalations.cases[0].case_id, s3.case_id);
    assert.notEqual(review.missed_escalations.note, undefined, 'a non-zero missed count must carry the incident note');
  }
  ok('reviewAudit tallies endings, escalations by category, resources shown and missed escalations correctly across a hand-counted set of six sessions');

  // ---- since/until filtering is inclusive on both boundaries --------------
  {
    const inWindow = reviewAudit2({ since: '2026-01-06', until: '2026-01-09' });
    // Excludes S1 (01-05, before since) and S6 (01-10, after until);
    // includes S2 (01-06, == since) and S5 (01-09, == until).
    assert.equal(inWindow.total_sessions, 4);
    assert.equal(inWindow.escalations.total, 2);

    const exactSinceOnly = reviewAudit2({ since: '2026-01-06', until: '2026-01-06' });
    assert.equal(exactSinceOnly.total_sessions, 1, 'since == until must still match the one session dated exactly there');

    const beforeAll = reviewAudit2({ until: '2026-01-04' });
    assert.equal(beforeAll.total_sessions, 0);
  }
  ok('reviewAudit\'s since/until filter includes both boundary dates (>= since, <= until), not just the interior');

  {
    const missedNote = reviewAudit2({ since: '2026-01-01', until: '2026-01-01' });
    assert.equal(missedNote.missed_escalations.count, 0);
    assert.equal(missedNote.missed_escalations.note, undefined, 'a zero missed count must not carry the incident note');
  }
  ok('reviewAudit omits the missed-escalations incident note when the count is zero');

  console.log(`\n${passed} audit.js checks passed in total`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
  fs.rmSync(tmpConfigHome2, { recursive: true, force: true });
}
