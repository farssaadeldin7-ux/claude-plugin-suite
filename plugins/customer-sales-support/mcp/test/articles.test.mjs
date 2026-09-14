#!/usr/bin/env node
/**
 * Regression tests for lib/articles.js's lintArticle: every finding it can
 * raise, the MAX_ARTICLE_WORDS boundary, and — the strongest checks here —
 * the ANTI_PATTERNS "before"/"after" pairs baked into the same file. Those
 * pairs are the closest thing this plugin has to a reference doc's worked
 * example: a human wrote a "before" text and asserted what is wrong with it,
 * and an "after" text and asserted it is fixed. Feeding both through
 * lintArticle and checking the finding appears on "before" and not on
 * "after" is a stronger check than test text invented from scratch.
 *
 *   node plugins/customer-sales-support/mcp/test/articles.test.mjs
 */
import assert from 'node:assert/strict';
import { lintArticle, MAX_ARTICLE_WORDS, ANTI_PATTERNS } from '../lib/articles.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const checks = (result) => result.findings.map((f) => f.check);
const anti = (id) => ANTI_PATTERNS.find((a) => a.id === id);

// ANTI_PATTERNS' before/after strings are doc shorthand — "# <title> —
// "<quoted body>" <meta-commentary about why>" — not literal article bodies.
// A raw string starting with "# " reads as a markdown heading and gets
// stripped from prose entirely by lintArticle's own heading filter before
// sentence-splitting even runs, which would make a test asserting on
// sentence-level findings (like the preamble check) vacuously pass with an
// empty sentence list rather than actually exercising the check. Extracting
// the quoted body text — the part that represents what the article itself
// would say — is what makes the anti-pattern's stated verdict a real,
// checkable claim about lintArticle's behaviour.
const quotedBody = (s) => (/—\s*"([^"]*)"/.exec(s) ?? [])[1] ?? s;

// A well-formed article, shaped exactly like ARTICLE_TEMPLATE, used as a
// "should have no findings" control.
const CLEAN_BODY = `# How do I return an item?

Applies to: all customers   Kind: policy
Owner: Priya   Last reviewed: 2026-01-15   Review by: 2026-07-15

You have 30 days from delivery to return an item, unworn, with tags attached.

## Preconditions
- Order delivered within the last 30 days
- Item unworn with tags attached

## Exact strings and codes
- "Return window closed" (err_return_4041)

## If this does not apply
Escalate to a human.`;

try {
  // ---- MAX_ARTICLE_WORDS boundary: exactly 400 words is fine, 401 is not ----
  {
    assert.equal(MAX_ARTICLE_WORDS, 400);
    const words400 = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const body400 = `Applies to: all customers   Kind: policy\nOwner: A   Last reviewed: 2026-01-01\n\n${words400}`;
    const r400 = lintArticle({ title: 'How does this work?', body: body400 });
    assert.equal(r400.metrics.word_count, 400);
    assert.ok(!checks(r400).includes('over_length'), 'exactly 400 words must not be flagged as over length');

    const words401 = Array.from({ length: 401 }, (_, i) => `word${i}`).join(' ');
    const body401 = `Applies to: all customers   Kind: policy\nOwner: A   Last reviewed: 2026-01-01\n\n${words401}`;
    const r401 = lintArticle({ title: 'How does this work?', body: body401 });
    assert.equal(r401.metrics.word_count, 401);
    assert.ok(checks(r401).includes('over_length'), '401 words must be flagged as over length — one word past the documented 400-word limit');
  }
  ok('lintArticle flags over_length starting exactly one word past the documented 400-word limit, and not at 400 itself');

  // ---- a well-formed article (shaped like ARTICLE_TEMPLATE) has no findings ----
  {
    const r = lintArticle({ title: 'How do I return an item?', body: CLEAN_BODY, kind: 'policy' });
    assert.deepEqual(r.findings, [], `expected no findings, got: ${JSON.stringify(r.findings)}`);
    assert.equal(r.metrics.metadata.owner, 'Priya');
    // The "Applies to:" regex captures the rest of its line greedily, so
    // when "Kind:" shares the line (as the template itself shows), it rides
    // along in applies_to too — worth pinning down explicitly since it is
    // easy to assume the two fields are parsed independently.
    assert.equal(r.metrics.metadata.applies_to, 'all customers   Kind: policy');
    assert.equal(r.metrics.metadata.last_reviewed, '2026-01-15');
    assert.equal(r.metrics.metadata.kind, 'policy');
    assert.equal(r.metrics.sections_present.preconditions, true);
    assert.equal(r.metrics.sections_present.steps, false, 'this article has no numbered procedure, so steps must read false');
    assert.equal(r.metrics.sections_present.exact_strings, true);
    assert.equal(r.metrics.sections_present.if_this_does_not_apply, true);
    assert.deepEqual(r.metrics.exact_strings_and_codes_found, ['err_return_4041']);
  }
  ok('a well-formed article shaped exactly like ARTICLE_TEMPLATE produces no findings and reports its metadata, sections and exact-code metrics correctly');

  // ---- buried_answer anti-pattern: the reference's own before/after pair ----
  {
    const pattern = anti('buried_answer');
    const before = lintArticle({ title: 'Returns', body: `Owner: A   Last reviewed: 2026-01-01\n\n${quotedBody(pattern.before)}` });
    assert.ok(checks(before).includes('preamble_before_answer'), 'the buried_answer "before" text\'s quoted body from ANTI_PATTERNS must be caught as a preamble');
    assert.ok(checks(before).includes('title_not_a_question'), 'the "before" title "Returns" is a noun phrase, not a question, matching the anti-pattern\'s own stated diagnosis');

    const after = lintArticle({ title: 'How do I return an item?', body: `Owner: A   Last reviewed: 2026-01-01\n\n${quotedBody(pattern.after)}` });
    assert.ok(!checks(after).includes('preamble_before_answer'), 'the buried_answer "after" text\'s quoted body must NOT be flagged as a preamble — it opens with the answer, exactly as the anti-pattern claims');
  }
  ok('lintArticle reproduces the buried_answer anti-pattern\'s own verdict: its "before" text (a preamble with no answer) is flagged, and its "after" text (the answer first) is not');

  // ---- unqualified_regional_answer anti-pattern: missing-qualifier finding ----
  {
    const pattern = anti('unqualified_regional_answer');
    const before = lintArticle({ title: 'Shipping?', body: `Owner: A   Last reviewed: 2026-01-01\n\n${pattern.before}` });
    assert.ok(checks(before).includes('possible_missing_qualifier'), 'a regional word ("Ireland") appearing with no "Applies to:" line must be flagged as a possible missing qualifier');

    // The "after" text is itself a per-destination table naming multiple
    // regions, so the region-word pattern still matches its prose either
    // way — the check is not "does the body mention a region" but "does
    // 'Applies to' claim everyone (or say nothing) while the body names
    // one". An "Applies to" that starts with "all customers" still reads as
    // a universal claim even with extra words after it, so the fix only
    // lands when "Applies to" actually names the regions instead.
    const afterStillUniversal = lintArticle({
      title: 'What are the shipping costs and times by destination?',
      body: `Applies to: all customers, per-destination table below   Kind: policy\nOwner: A   Last reviewed: 2026-01-01\n\n${pattern.after}`,
    });
    assert.ok(checks(afterStillUniversal).includes('possible_missing_qualifier'), 'an "Applies to" line that still starts with "all customers" must keep flagging, even with the fixed per-region body — the leading words are what the check reads');

    const afterProperlyQualified = lintArticle({
      title: 'What are the shipping costs and times by destination?',
      body: `Applies to: UK, Highlands & Islands, Ireland and EU destinations (per-destination table below)   Kind: policy\nOwner: A   Last reviewed: 2026-01-01\n\n${pattern.after}`,
    });
    assert.ok(!checks(afterProperlyQualified).includes('possible_missing_qualifier'), 'once "Applies to" actually names the regions instead of claiming "all customers", the same per-region body must not be flagged');
  }
  ok('lintArticle reproduces the unqualified_regional_answer anti-pattern\'s "before" verdict (flagged), and shows the "after" fix only clears the flag once "Applies to" stops reading as a universal claim — restating the fixed body under an "Applies to: all customers..." line still flags it');

  // ---- missing_error_string anti-pattern: no literal code quoted ---------
  {
    const pattern = anti('missing_error_string');
    const before = lintArticle({ title: 'Why did my payment fail?', body: `Owner: A   Last reviewed: 2026-01-01\n\n${pattern.before}` });
    assert.ok(checks(before).includes('no_exact_error_string'), 'text that discusses a payment failure but quotes no literal code must be flagged');

    const after = lintArticle({ title: 'Why did my payment fail?', body: `Owner: A   Last reviewed: 2026-01-01\n\n${pattern.after}` });
    assert.ok(!checks(after).includes('no_exact_error_string'), 'text that quotes the literal error codes verbatim must not be flagged for a missing error string');
    assert.ok(after.metrics.exact_strings_and_codes_found.length > 0, 'the literal codes from the anti-pattern\'s "after" text must actually be extracted');
  }
  ok('lintArticle reproduces the missing_error_string anti-pattern\'s own verdict: its "before" text (no literal code) is flagged, and its "after" text (codes quoted verbatim) is not, with the codes actually extracted');

  // ---- missing metadata: applies_to, owner, review date, each independently ----
  {
    const noAppliesTo = lintArticle({ title: 'How do I reset my password?', body: 'Owner: A   Last reviewed: 2026-01-01\n\nGo to settings and click reset.' });
    assert.ok(checks(noAppliesTo).includes('missing_applies_to'));

    const noOwner = lintArticle({ title: 'How do I reset my password?', body: 'Applies to: all customers   Last reviewed: 2026-01-01\n\nGo to settings and click reset.' });
    assert.ok(checks(noOwner).includes('missing_owner'));

    const noReview = lintArticle({ title: 'How do I reset my password?', body: 'Applies to: all customers   Owner: A\n\nGo to settings and click reset.' });
    assert.ok(checks(noReview).includes('missing_review_date'));
  }
  ok('lintArticle independently flags a missing "Applies to:", a missing "Owner:" and a missing "Last reviewed:" line');

  // ---- owner extraction stops at the two-space gap before the next field ----
  // The owner regex is /owner:\s*(\S.*?)(?:\s{2,}|$)/im — a non-greedy
  // capture up to a run of 2+ spaces or end of line, matching the template's
  // "Owner: <name>   Last reviewed: ..." layout on one line.
  {
    const r = lintArticle({ title: 'How do I reset my password?', body: 'Applies to: all customers\nOwner: Priya Singh   Last reviewed: 2026-01-01\n\nGo to settings and click reset.' });
    assert.equal(r.metrics.metadata.owner, 'Priya Singh', 'the owner name (including its internal space) must be captured in full, without swallowing the following field');
  }
  ok('the owner metadata line is captured up to the two-or-more-space field separator, not truncated mid-name and not swallowing the next field');

  // ---- title_not_a_question: only flagged when a title is actually present ----
  {
    const withQuestion = lintArticle({ title: 'Why was my card declined?', body: 'Applies to: all customers\nOwner: A   Last reviewed: 2026-01-01\n\nYour card was declined.' });
    assert.ok(!checks(withQuestion).includes('title_not_a_question'));

    const nounPhrase = lintArticle({ title: 'Payment troubleshooting', body: 'Applies to: all customers\nOwner: A   Last reviewed: 2026-01-01\n\nYour card was declined.' });
    assert.ok(checks(nounPhrase).includes('title_not_a_question'), 'a noun-phrase title with no "?" must be flagged, matching the style rule\'s own example');

    const noTitle = lintArticle({ title: '', body: 'Applies to: all customers\nOwner: A   Last reviewed: 2026-01-01\n\nYour card was declined.' });
    assert.ok(!checks(noTitle).includes('title_not_a_question'), 'an empty title is not itself flagged as "not a question" — the check only fires when a non-empty title is present, an interaction worth pinning down explicitly');
  }
  ok('title_not_a_question fires for a noun-phrase title and not for a real question, and an empty title is not treated as a noun-phrase title');

  // ---- policy_value_in_procedure: only for declared kind "procedure" -----
  {
    const procedureWithValue = lintArticle({
      title: 'How do I request a refund?',
      body: 'Applies to: all customers   Kind: procedure\nOwner: A   Last reviewed: 2026-01-01\n\nRequest a refund within 30 days of purchase by emailing support.',
    });
    assert.ok(checks(procedureWithValue).includes('policy_value_in_procedure'), 'a procedure article restating a duration ("30 days") must be flagged as a policy-split candidate');

    const policyWithValue = lintArticle({
      title: 'What is the refund window?',
      body: 'Applies to: all customers   Kind: policy\nOwner: A   Last reviewed: 2026-01-01\n\nRefunds are available within 30 days of purchase.',
    });
    assert.ok(!checks(policyWithValue).includes('policy_value_in_procedure'), 'the same duration in a policy article (its rightful home) must not be flagged');
  }
  ok('policy_value_in_procedure fires only when the article is declared kind "procedure" and states a duration or currency value, not when the same value appears in a policy article');

  // ---- no_exact_error_string: not flagged when a literal code is present -
  {
    const withCode = lintArticle({
      title: 'Why did my payment fail?',
      body: 'Applies to: all customers\nOwner: A   Last reviewed: 2026-01-01\n\nYour payment failed with "Card declined" (err_card_2041).',
    });
    assert.ok(!checks(withCode).includes('no_exact_error_string'));
  }
  ok('no_exact_error_string is not flagged when a literal error code accompanies failure language');

  // ---- references count: markdown links and "(see: ...)" pointers --------
  {
    const r = lintArticle({
      title: 'How do I cancel my plan?',
      body: 'Applies to: all customers\nOwner: A   Last reviewed: 2026-01-01\n\nCancel from account settings (see: billing FAQ) or read the [cancellation policy](https://example.com/cancel).',
    });
    assert.equal(r.metrics.references, 2);
  }
  ok('the references metric counts both "(see: ...)" pointers and markdown links');

  console.log(`\n${passed} articles.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
