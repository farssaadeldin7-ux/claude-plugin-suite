#!/usr/bin/env node
/**
 * Regression tests for lib/checkin.js: the literal-phrase message screen,
 * the deployment gate, and the supervisor-summary drafter over the audit log.
 *
 *   node plugins/mental-health-chatbot/mcp/test/checkin.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// draftSummary reads the audit log via lib/audit.js's on-disk store, which
// resolves its config directory at import time — set XDG_CONFIG_HOME before
// dynamically importing either module, same as the pilot's domain.test.mjs.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mental-health-chatbot-checkin-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { recordSession } = await import('../lib/audit.js');
const { screenMessage, checkDeployment, draftSummary } = await import('../lib/checkin.js');

try {
  // ---- screenMessage: a literal phrase in any category triggers ------------
  {
    const r = screenMessage({ message: 'Sometimes I think I want to kill myself.' });
    assert.equal(r.triggered, true);
    assert.equal(r.matches.length, 1);
    assert.equal(r.matches[0].category, 1);
    assert.deepEqual(r.matches[0].matched_phrases, ['kill myself']);
    assert.match(r.action, /Escalate now/);
  }
  ok('screenMessage matches a literal category-1 phrase, quotes it, and returns an "escalate now" action');

  // ---- screenMessage: matching is case-insensitive --------------------------
  {
    const r = screenMessage({ message: 'I WANT TO HURT HIM tonight.' });
    assert.equal(r.triggered, true);
    assert.equal(r.matches[0].category, 2);
  }
  ok('screenMessage matching is case-insensitive');

  // ---- screenMessage: a message can hit more than one category -------------
  {
    const r = screenMessage({ message: 'I want to kill myself and I also want to hurt him.' });
    assert.equal(r.matches.length, 2);
    const categories = r.matches.map((m) => m.category).sort();
    assert.deepEqual(categories, [1, 2]);
  }
  ok('screenMessage reports every category a message matches, not just the first');

  // ---- screenMessage: no literal match is explicitly not clearance --------
  {
    const r = screenMessage({ message: 'The weather has been nice this week.' });
    assert.equal(r.triggered, false);
    assert.deepEqual(r.matches, []);
    assert.match(r.action, /not clearance/);
  }
  ok('screenMessage returns triggered:false with an explicit "not clearance" action when nothing literally matches');

  // ---- screenMessage: substrings must be real substrings, not near-misses -
  {
    const r = screenMessage({ message: 'I would like to speak with someone about this.' });
    // Category 9's list has "speak to someone", not "speak with someone" —
    // this message must not false-positive on a phrase that merely overlaps.
    const nineMatch = r.matches.find((m) => m.category === 9);
    assert.equal(nineMatch, undefined, 'a phrase must match as an exact substring, not a loose paraphrase');
  }
  ok('screenMessage does not match a category-9 phrase on a paraphrase that is not a literal substring of the list');

  // ---- screenMessage: input validation --------------------------------------
  {
    assert.throws(() => screenMessage({ message: '' }), /Pass "message"/);
    assert.throws(() => screenMessage({ message: '   ' }), /Pass "message"/);
    assert.throws(() => screenMessage({}), /Pass "message"/);
    assert.throws(() => screenMessage({ message: 42 }), /Pass "message"/);
  }
  ok('screenMessage rejects a missing, blank or non-string message');

  // ---- checkDeployment: a fully valid deployment is ready -------------------
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const verifiedOn = iso(today);
  const reviewDue = iso(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)); // 30 days out, well inside 3 months

  const validDeployment = () => ({
    scope_statement: { in_scope: ['reflective listening'], out_of_scope: ['diagnosis'], hard_stop_confirmed: true, published: true },
    escalation_route: { team: 'Crisis Team', hours: '24/7', out_of_hours_fallback: 'External Line', fallback_staffed: true },
    resource_block: {
      region: 'us', verified_by: 'ops', verified_on: verifiedOn, review_due: reviewDue,
      services: [{ name: 'Crisis Line', contact: '000', hours: '24/7' }],
    },
    confidentiality_notice: {
      who_reads: 'the ops team', retention: '90 days', employer_sees: 'aggregate only',
      disclosure_triggers: 'imminent risk of harm', shown_before_first_message: true,
    },
  });

  {
    const r = checkDeployment(validDeployment());
    assert.equal(r.ready, true, `expected ready, got findings: ${JSON.stringify(r.findings)}`);
    assert.deepEqual(r.findings, []);
  }
  ok('checkDeployment reports ready:true with no findings for a fully valid set of four artefacts');

  // ---- checkDeployment: each artefact missing entirely is its own finding --
  {
    for (const field of ['scope_statement', 'escalation_route', 'resource_block', 'confidentiality_notice']) {
      const deployment = validDeployment();
      delete deployment[field];
      const r = checkDeployment(deployment);
      assert.equal(r.ready, false, `missing ${field} must fail the gate`);
      assert.ok(r.findings.some((f) => f.startsWith(`${field}:`)), `expected a ${field} finding, got: ${JSON.stringify(r.findings)}`);
    }
  }
  ok('checkDeployment fails the gate and names the artefact when any of the four is missing entirely');

  // ---- checkDeployment: the boolean attestations must be exactly true -----
  {
    const noHardStop = validDeployment();
    noHardStop.scope_statement.hard_stop_confirmed = false;
    assert.ok(checkDeployment(noHardStop).findings.some((f) => /hard_stop_confirmed must be true/.test(f)));

    const notPublished = validDeployment();
    notPublished.scope_statement.published = false;
    assert.ok(checkDeployment(notPublished).findings.some((f) => /published must be true/.test(f)));

    const unstaffedFallback = validDeployment();
    unstaffedFallback.escalation_route.fallback_staffed = false;
    assert.ok(checkDeployment(unstaffedFallback).findings.some((f) => /fallback_staffed must be true/.test(f)));

    const notShown = validDeployment();
    notShown.confidentiality_notice.shown_before_first_message = false;
    assert.ok(checkDeployment(notShown).findings.some((f) => /shown_before_first_message must be true/.test(f)));
  }
  ok('checkDeployment fails each of the four boolean attestations (hard_stop_confirmed, published, fallback_staffed, shown_before_first_message) when set to false');

  // ---- checkDeployment: an invalid resource_block surfaces resource_findings
  {
    const badResources = validDeployment();
    badResources.resource_block = { region: 'us', verified_by: 'ops', verified_on: verifiedOn, review_due: reviewDue, services: [] };
    const r = checkDeployment(badResources);
    assert.equal(r.ready, false);
    assert.ok(r.findings.some((f) => /fails resource_config_check/.test(f)));
    assert.equal(r.resource_findings.valid, false);
    assert.ok(r.resource_findings.findings.some((f) => /non-empty array/.test(f)));
  }
  ok('checkDeployment surfaces resource_config_check\'s own findings under resource_findings when the resource block is invalid');

  // ---- checkDeployment: an empty array field is treated as missing --------
  {
    const emptyInScope = validDeployment();
    emptyInScope.scope_statement.in_scope = [];
    assert.ok(checkDeployment(emptyInScope).findings.some((f) => /missing "in_scope"/.test(f)), 'an empty array must not satisfy the "has content" requirement');
  }
  ok('checkDeployment treats an empty in_scope/out_of_scope array as a missing field, not a present-but-empty one');

  // ---- draftSummary: requires "since" -------------------------------------
  {
    assert.throws(() => draftSummary({}), /Pass "since"/);
  }
  ok('draftSummary refuses to draft without a stated reporting window ("since")');

  // ---- draftSummary: quantitative sections over a hand-counted audit log --
  // Six sessions, same hand-counted shape as audit.test.mjs's reviewAudit
  // coverage, seeded fresh into this file's own store:
  //   S1 no trigger,   completed
  //   S2 cat 2, esc,   escalated   (recorded 2nd -> appears before S5 in unshift order... see below)
  //   S3 cat 1, missed user_left
  //   S4 no trigger,   declined
  //   S5 cat 2, esc,   escalated
  //   S6 no trigger,   completed
  const seedBase = { config_version: 'v1', messages: 3 };
  recordSession({ ...seedBase, session_date: '2026-02-01', ended: 'completed' });
  const s2 = recordSession({ ...seedBase, session_date: '2026-02-02', trigger_category: 2, escalated: true, handover_packet_delivered: true, ended: 'escalated' });
  recordSession({ ...seedBase, session_date: '2026-02-03', trigger_category: 1, escalated: false, ended: 'user_left' });
  recordSession({ ...seedBase, session_date: '2026-02-04', ended: 'declined' });
  const s5 = recordSession({ ...seedBase, session_date: '2026-02-05', trigger_category: 2, escalated: true, handover_packet_delivered: true, ended: 'escalated' });
  recordSession({ ...seedBase, session_date: '2026-02-06', ended: 'completed' });

  {
    const summary = draftSummary({
      since: '2026-02-01', until: '2026-02-28', config_version: 'v1',
      themes: [{ theme: 'workload', sessions_behind: 5 }, { theme: 'sleep', sessions_behind: 4 }],
    });
    assert.equal(summary.reporting_window.sessions, 6);
    assert.deepEqual(summary.participation.endings, { completed: 2, escalated: 2, user_left: 1, declined: 1 });
    assert.equal(summary.escalations.total, 2);
    assert.deepEqual(summary.escalations.by_category, { 2: 2 });
    // The audit log is newest-first (unshift on each record), so the more
    // recently recorded escalation (S5) appears before the earlier one (S2).
    assert.deepEqual(summary.escalations.case_ids_for_receiving_team, [s5.case_id, s2.case_id]);
    assert.deepEqual(summary.themes, [{ theme: 'workload', sessions_behind: 5 }]);
    assert.deepEqual(summary.themes_withheld, [{ theme: 'sleep', sessions_behind: 4, reason: 'Below the 5-session minimum — reporting it risks identifying individuals.' }]);
    assert.equal(summary.missed_escalations.count, 1);
    assert.equal(summary.standing_caveat, 'Themes in this summary are conversational patterns, not clinical findings.');
  }
  ok('draftSummary assembles participation, escalations (by case id, newest first), themes at/above the minimum, and the missed-escalations note from a hand-counted six-session log');

  // ---- draftSummary: THEME_MIN_SESSIONS boundary is exactly 5, inclusive --
  {
    const atFive = draftSummary({ since: '2026-02-01', until: '2026-02-28', themes: [{ theme: 'x', sessions_behind: 5 }] });
    assert.equal(atFive.themes.length, 1, '5 sessions behind is the documented minimum and must be reported, not withheld');
    assert.equal(atFive.themes_withheld, undefined);

    const atFour = draftSummary({ since: '2026-02-01', until: '2026-02-28', themes: [{ theme: 'x', sessions_behind: 4 }] });
    assert.equal(atFour.themes.length, 0, '4 sessions behind is one below the minimum and must be withheld');
    assert.equal(atFour.themes_withheld.length, 1);
  }
  ok('draftSummary\'s theme-withholding boundary sits exactly at THEME_MIN_SESSIONS=5: 5 is reported, 4 is withheld');

  // ---- draftSummary: a theme cannot claim more sessions than the window ---
  {
    assert.throws(
      () => draftSummary({ since: '2026-02-01', until: '2026-02-28', themes: [{ theme: 'x', sessions_behind: 7 }] }),
      /claims 7 sessions behind it, but the window holds 6/,
    );
    // The boundary itself — claiming exactly the window's total — is legitimate.
    const atTotal = draftSummary({ since: '2026-02-01', until: '2026-02-28', themes: [{ theme: 'x', sessions_behind: 6 }] });
    assert.equal(atTotal.themes.length, 1);
  }
  ok('draftSummary rejects a theme whose sessions_behind exceeds the window\'s total sessions, and accepts a theme claiming exactly the total');

  // ---- draftSummary: theme shape validation ---------------------------------
  {
    assert.throws(() => draftSummary({ since: '2026-02-01', themes: [{ sessions_behind: 5 }] }), /needs \{ theme, sessions_behind \}/);
    assert.throws(() => draftSummary({ since: '2026-02-01', themes: [{ theme: 'x', sessions_behind: -1 }] }), /needs \{ theme, sessions_behind \}/);
    assert.throws(() => draftSummary({ since: '2026-02-01', themes: [{ theme: '   ', sessions_behind: 5 }] }), /needs \{ theme, sessions_behind \}/);
  }
  ok('draftSummary rejects a theme missing its label, with a negative sessions_behind, or with a blank label');

  console.log(`\n${passed} checkin.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
