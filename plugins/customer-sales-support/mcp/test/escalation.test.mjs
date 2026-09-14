#!/usr/bin/env node
/**
 * Regression tests for lib/escalation.js: every trigger family in TRIGGERS
 * (pattern lists, the requires_both cancellation+anger pair, and the three
 * state-based triggers), the not_evaluable reasons for state triggers with
 * missing inputs, and the fired/not-fired rule and handover_format wiring.
 *
 *   node plugins/customer-sales-support/mcp/test/escalation.test.mjs
 */
import assert from 'node:assert/strict';
import { screenMessage, HANDOVER_FORMAT, FAILED_TURNS_LIMIT } from '../lib/escalation.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const screen = (args) => screenMessage(typeof args === 'string' ? { message: args } : args);
const firedIds = (text) => screen(text).fired.map((f) => f.trigger);

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

  // ---- every plain pattern-list trigger fires on its documented detection phrase ----
  {
    assert.ok(firedIds('I was charged twice for this order').includes('billing_dispute'));
    assert.ok(firedIds('I never authorised this payment').includes('billing_dispute'));
    assert.ok(firedIds('I am considering a chargeback').includes('chargeback'));
    assert.ok(firedIds('I will raise a dispute with my bank').includes('chargeback'));
    assert.ok(firedIds('please delete my account').includes('data_deletion'));
    assert.ok(firedIds('this is a GDPR request').includes('data_deletion'));
    assert.ok(firedIds('my solicitor will be in touch').includes('legal_regulatory'));
    assert.ok(firedIds('I use a screen reader and this is inaccessible').includes('accessibility'));
    assert.ok(firedIds('I have a disability and need an accommodation').includes('accessibility'));
    assert.ok(firedIds('the product caught fire and I was injured').includes('safety'));
    assert.ok(firedIds('I want to speak to a human').includes('explicit_request'));
    assert.ok(firedIds('let me talk to a manager').includes('explicit_request'));
    assert.ok(firedIds('I am posting a review about this').includes('public_complaint'));
    assert.ok(firedIds('nothing to see here, order shipped fine').length === 0, 'ordinary text must not fire any trigger');
  }
  ok('every plain pattern-list trigger (billing_dispute, chargeback, data_deletion, legal_regulatory, accessibility, safety, explicit_request, public_complaint) fires on its documented detection phrase and stays silent on ordinary text');

  // ---- smart quotes are normalised before matching -----------------------
  // screenMessage rewrites curly quotes to straight ones before testing
  // patterns like /did ?n[o']t authori[sz]e/i — pasted customer text (e.g.
  // from a browser or email client) commonly uses curly apostrophes.
  {
    assert.ok(firedIds("I didn't authorise this charge").includes('billing_dispute'), 'straight apostrophe must match as a baseline');
    assert.ok(firedIds('I didn’t authorise this charge').includes('billing_dispute'), 'curly right single quote (’) must be normalised to a straight apostrophe before matching, exactly like the straight-quote version');
    assert.ok(firedIds('the customer said “this is a scam”').length >= 0, 'curly double quotes must not throw, even though no pattern here depends on them');
  }
  ok('curly apostrophes in the incoming message are normalised to straight ones before pattern matching, so a pasted "didn’t authorise" still fires billing_dispute');

  // ---- cancellation_with_anger requires BOTH halves to match -------------
  {
    const both = screen('This is ridiculous, cancel my subscription!!');
    assert.ok(both.fired.map((f) => f.trigger).includes('cancellation_with_anger'));
    const cancellationFired = both.fired.find((f) => f.trigger === 'cancellation_with_anger');
    assert.match(cancellationFired.matched, /with/, 'the matched text reports both halves, quoted');

    // Cancellation language alone, calmly phrased, must not fire — but it is
    // reported as not_evaluable with the sentiment caveat, not silently dropped.
    const cancelOnly = screen('Please cancel my subscription, thank you');
    assert.ok(!firedIds('Please cancel my subscription, thank you').includes('cancellation_with_anger'));
    const notEvalEntry = cancelOnly.not_evaluable.find((n) => n.trigger === 'cancellation_with_anger');
    assert.ok(notEvalEntry, 'a calm cancellation must be reported as not_evaluable, not silently skipped');
    assert.match(notEvalEntry.reason, /not sentiment/);

    // Anger language alone, with no cancellation intent, must not fire and
    // must produce no not_evaluable entry either (the code only reports
    // not_evaluable when the cancellation half alone matched).
    const angerOnly = screen('This is absolutely ridiculous and unacceptable!!');
    assert.ok(!firedIds('This is absolutely ridiculous and unacceptable!!').includes('cancellation_with_anger'));
    assert.ok(!angerOnly.not_evaluable.some((n) => n.trigger === 'cancellation_with_anger'), 'anger with no cancellation intent must not even appear in not_evaluable');
  }
  ok('cancellation_with_anger fires only when both the cancellation phrase and the anger phrase match, reports a calm cancellation as not_evaluable, and says nothing at all about anger-only text');

  // ---- cancellation_with_anger: the !{2,} anger pattern is a boundary itself ----
  {
    assert.ok(!firedIds('cancel my subscription!').includes('cancellation_with_anger'), 'a single "!" must not count as the anger half');
    assert.ok(firedIds('cancel my subscription!!').includes('cancellation_with_anger'), 'two or more "!" must count as the anger half');
  }
  ok('the anger half\'s bare-punctuation pattern requires at least two exclamation marks, not one');

  // ---- three_failed_turns: >= FAILED_TURNS_LIMIT (3), both sides of the boundary ----
  {
    assert.equal(FAILED_TURNS_LIMIT, 3);
    assert.ok(!firedIds({ message: 'still stuck', turns_without_resolution: 2 }).includes('three_failed_turns'), '2 turns without resolution must not fire — below the documented "three" limit');
    assert.ok(firedIds({ message: 'still stuck', turns_without_resolution: 3 }).includes('three_failed_turns'), '3 turns without resolution must fire — "three failed turns" is inclusive of the third');
    assert.ok(firedIds({ message: 'still stuck', turns_without_resolution: 4 }).includes('three_failed_turns'));

    const missing = screen({ message: 'still stuck' });
    assert.ok(!firedIds({ message: 'still stuck' }).includes('three_failed_turns'));
    assert.ok(missing.not_evaluable.find((n) => n.trigger === 'three_failed_turns'), 'omitting turns_without_resolution must be reported as not_evaluable, not treated as zero');
  }
  ok('three_failed_turns fires at exactly the documented limit of three turns and not at two, and is reported as not_evaluable rather than silently false when the count is not supplied');

  // ---- refund_above_threshold: strictly greater-than, both sides of the boundary ----
  {
    assert.ok(!firedIds({ message: 'refund please', refund_amount: 30, refund_threshold: 30 }).includes('refund_above_threshold'), 'an amount exactly at the threshold must not fire — the rule is "above", not "at or above"');
    assert.ok(firedIds({ message: 'refund please', refund_amount: 30.01, refund_threshold: 30 }).includes('refund_above_threshold'), 'one cent above the threshold must fire');
    assert.ok(!firedIds({ message: 'refund please', refund_amount: 29.99, refund_threshold: 30 }).includes('refund_above_threshold'));

    const partial = screen({ message: 'refund please', refund_amount: 100 });
    assert.ok(partial.not_evaluable.find((n) => n.trigger === 'refund_above_threshold'), 'refund_amount with no refund_threshold must be not_evaluable, never assumed');
    const fired = screen({ message: 'refund please', refund_amount: 40, refund_threshold: 30 }).fired.find((f) => f.trigger === 'refund_above_threshold');
    assert.equal(fired.matched, 'refund_amount 40 > threshold 30');
  }
  ok('refund_above_threshold fires only strictly above the threshold (30 itself does not fire, 30.01 does), and is not_evaluable rather than guessed when either value is missing');

  // ---- vip_account: only `true` fires; missing is not_evaluable, `false` is a clean no ----
  {
    assert.ok(firedIds({ message: 'hello', vip_account: true }).includes('vip_account'));
    assert.ok(!firedIds({ message: 'hello', vip_account: false }).includes('vip_account'));
    const missing = screen({ message: 'hello' });
    assert.ok(!firedIds({ message: 'hello' }).includes('vip_account'));
    assert.ok(missing.not_evaluable.find((n) => n.trigger === 'vip_account'), 'an unsupplied vip_account flag must be not_evaluable, not treated as false');
  }
  ok('vip_account fires only when explicitly true, is a clean non-fire when explicitly false, and is not_evaluable rather than assumed false when omitted');

  // ---- with no state supplied, all three state-based triggers report not_evaluable ----
  // refund_above_threshold needs BOTH refund_amount and refund_threshold, so
  // it is not_evaluable even when neither was mentioned at all — it is not
  // treated as "silently not applicable" just because nothing was supplied.
  {
    const bare = screen('just a normal question with no special language');
    assert.equal(bare.fired.length, 0);
    const notEvalTriggers = bare.not_evaluable.map((n) => n.trigger).sort();
    assert.deepEqual(notEvalTriggers, ['refund_above_threshold', 'three_failed_turns', 'vip_account'].sort());
  }
  ok('an ordinary message with no conversation state supplied at all reports all three state-based triggers (three_failed_turns, refund_above_threshold, vip_account) as not_evaluable rather than silently clean');

  // ---- the top-level rule and handover_format only appear when something fired ----
  {
    const clean = screen('just a normal question');
    assert.match(clean.rule, /No literal detection phrase matched/);
    assert.ok(!('handover_format' in clean), 'handover_format must be absent when nothing fired');

    const hot = screen('I want to speak to a human');
    assert.match(hot.rule, /A hard trigger fired/);
    assert.equal(hot.handover_format, HANDOVER_FORMAT);
  }
  ok('the returned rule text and the presence of handover_format both depend on whether any trigger actually fired');

  // ---- caveats are always present regardless of outcome -------------------
  {
    assert.equal(screen('anything').caveats.length, 2);
  }
  ok('caveats are always returned, whether or not a trigger fired');

  console.log(`\n${passed} escalation.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
