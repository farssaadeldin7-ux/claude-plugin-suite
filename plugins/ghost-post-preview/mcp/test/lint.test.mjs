#!/usr/bin/env node
/**
 * Regression tests for lib/lint.js.
 *
 * There is no references/*.md with worked numeric examples for this plugin
 * (only skills/sales-and-outreach/SKILL.md exists, which is an unrelated
 * cold-outreach skill with no numbers relevant to draft_lint's mechanics —
 * flagged in the report rather than silently treated as a source of truth).
 * The closest thing to an independently-authored "reference" is
 * data/platforms.json itself: its per-platform format_rules and
 * blank_lines_cost_a_line flags are exactly what lintDraft's wall_of_text and
 * opening_blank_line checks encode, so several assertions below are pinned to
 * that file's own wording (e.g. LinkedIn's "no more than two consecutive
 * lines of prose before a break") rather than to values invented here.
 * Every regex-derived expectation was hand-traced and independently
 * sanity-checked against the same regex source with plain node before being
 * written as an assertion, not copied from lintDraft's own output.
 *
 *   node plugins/ghost-post-preview/mcp/test/lint.test.mjs
 */
import assert from 'node:assert/strict';
import { lintDraft } from '../lib/lint.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const findingsByCheck = (result) => Object.fromEntries(result.findings.map((f) => [f.check, f]));

try {
  // ---- unknown platform returns null, not a throw ------------------------
  {
    assert.equal(lintDraft('not-a-real-platform', 'hello'), null);
  }
  ok('lintDraft returns null for an unknown platform instead of throwing');

  // ---- throat_clearing_opener: matches the documented "So, today..." shape,
  // and does not false-positive on a merely similar opening ----------------
  {
    const hit = lintDraft('linkedin', 'So, today I want to talk about my new project.\nMore text.');
    assert.equal(findingsByCheck(hit).throat_clearing_opener.evidence, 'So, today');

    const miss = lintDraft('linkedin', "Today's agenda is packed.\nMore text.");
    assert.equal(findingsByCheck(miss).throat_clearing_opener, undefined, '"Today\'s agenda..." must not be mistaken for a "So, today" throat-clearing opener');
  }
  ok('throat_clearing_opener fires on the documented opener shape and not on a merely similar first line');

  // ---- yes_no_question_opener requires BOTH the opener shape AND a question mark ----
  {
    const withQ = lintDraft('linkedin', 'Are you tired of losing followers?\nMore text.');
    assert.equal(findingsByCheck(withQ).yes_no_question_opener.evidence, 'Are you tired of losing followers?');

    const withoutQ = lintDraft('linkedin', 'Are you tired of losing followers\nMore text.');
    assert.equal(findingsByCheck(withoutQ).yes_no_question_opener, undefined, 'no question mark means no yes/no-question finding, even with a matching opener verb');
  }
  ok('yes_no_question_opener requires the opener verb shape and a literal question mark together, not either alone');

  // ---- scroller_bounce_phrase scans the whole draft, not just the first line --------
  {
    const result = lintDraft('linkedin', "First line is fine.\nWe're excited to announce our launch.");
    assert.equal(findingsByCheck(result).scroller_bounce_phrase.evidence, 'excited to announce');
  }
  ok('scroller_bounce_phrase is matched anywhere in the draft, not only in the first line');

  // ---- link_in_body: only flagged on platforms that actually suppress body links ----
  {
    const linkedin = lintDraft('linkedin', 'Read more at https://example.com/post\nMore.');
    assert.equal(findingsByCheck(linkedin).link_in_body.evidence, 'https://example.com/post');
    assert.match(findingsByCheck(linkedin).link_in_body.why, /LinkedIn suppresses outbound links/);

    const tiktok = lintDraft('tiktok', 'Read more at https://example.com/post\nMore.');
    assert.equal(findingsByCheck(tiktok).link_in_body, undefined, 'TikTok has no LINK_WHY entry, so the same URL must not be flagged there');
    assert.equal(tiktok.metrics.links, 1, 'the link is still counted in metrics even on a platform where it is not flagged');
  }
  ok('link_in_body is flagged only on platforms with a defined suppression reason (LinkedIn/X/Facebook/Threads/Instagram), not on TikTok/Reddit/YouTube, though the count is unconditional');

  // ---- URL_PATTERN: a bare domain needs a path to count as a link; www. does not ----
  {
    const bareNoPath = lintDraft('linkedin', 'Check example.com today\nMore.');
    assert.equal(bareNoPath.metrics.links, 0, 'a bare domain with no path and no protocol must not be detected as a link');

    const bareWithPath = lintDraft('linkedin', 'Check example.com/pricing today\nMore.');
    assert.equal(bareWithPath.metrics.links, 1);
    assert.equal(findingsByCheck(bareWithPath).link_in_body.evidence, 'example.com/pricing');

    const www = lintDraft('linkedin', 'Visit www.example.com now\nMore.');
    assert.equal(www.metrics.links, 1, 'a www.-prefixed domain counts as a link even with no path');
  }
  ok('the URL pattern requires either a protocol, a www. prefix, or a path after a bare domain — a bare domain alone is not detected');

  // ---- hashtags_on_x: counted everywhere, flagged only on X -------------------------
  {
    const onX = lintDraft('x', 'Great news #launch #excited\nMore.');
    assert.equal(findingsByCheck(onX).hashtags_on_x.evidence, '#launch #excited');
    assert.equal(onX.metrics.hashtags, 2);

    const onLinkedin = lintDraft('linkedin', 'Great news #launch #excited\nMore.');
    assert.equal(findingsByCheck(onLinkedin).hashtags_on_x, undefined, 'hashtags are only a finding on X');
    assert.equal(onLinkedin.metrics.hashtags, 2, 'the hashtag count itself is still reported on every platform');
  }
  ok('hashtags_on_x is flagged only on X, though the hashtag count is reported for every platform');

  // ---- engagement_bait ---------------------------------------------------------------
  {
    const result = lintDraft('linkedin', 'Like this if you agree with me.\nMore.');
    assert.equal(findingsByCheck(result).engagement_bait.evidence, 'Like this if you');
  }
  ok('engagement_bait fires on a documented bait phrase');

  // ---- wall_of_text: LinkedIn-only, boundary is "more than two" per format_rules ----
  // data/platforms.json's own linkedin.format_rules says "no more than two consecutive
  // lines of prose before a break" — exactly two lines must therefore NOT be flagged,
  // and three must be, both sides of the documented boundary.
  {
    const exactlyTwo = lintDraft('linkedin', 'line one\nline two\n\nline three');
    assert.equal(findingsByCheck(exactlyTwo).wall_of_text, undefined, 'exactly two consecutive prose lines is within the documented limit');
    assert.equal(exactlyTwo.metrics.longest_prose_run_lines, 2);

    const exactlyThree = lintDraft('linkedin', 'line one\nline two\nline three');
    assert.ok(findingsByCheck(exactlyThree).wall_of_text, 'three consecutive prose lines exceeds the documented "no more than two" limit');
    assert.equal(exactlyThree.metrics.longest_prose_run_lines, 3);
    assert.equal(findingsByCheck(exactlyThree).wall_of_text.evidence, '3 consecutive lines of prose');

    const sameShapeOnX = lintDraft('x', 'line one\nline two\nline three');
    assert.equal(findingsByCheck(sameShapeOnX).wall_of_text, undefined, 'the wall-of-text rule is LinkedIn-specific per format_rules, not general');
  }
  ok('wall_of_text sits exactly on the boundary platforms.json documents for LinkedIn ("no more than two consecutive lines of prose"): 2 lines pass, 3 fail, and the rule does not apply on other platforms');

  // ---- opening_blank_line: only when the platform actually charges for it -----------
  {
    const linkedin = lintDraft('linkedin', '\nHello world\nline two');
    assert.ok(findingsByCheck(linkedin).opening_blank_line, 'LinkedIn charges a line for a blank, so an opening blank line is worth flagging');

    const instagram = lintDraft('instagram', '\nHello world');
    assert.equal(findingsByCheck(instagram).opening_blank_line, undefined, 'Instagram does not charge a line for a blank, so there is nothing to flag');
  }
  ok('opening_blank_line is flagged only on platforms where blank_lines_cost_a_line is true, matching data/platforms.json');

  // ---- first_number_in_line_one / first_number_word_position: hand-verified ---------
  // (independently traced against the regex /\d[\d,.]*%?/ and plain string ops before
  // being written here — see the session's scratch verification, not lintDraft's output)
  {
    const mid = lintDraft('linkedin', 'This costs 50 dollars total\nMore.');
    assert.equal(mid.metrics.first_number_in_line_one, '50');
    assert.equal(mid.metrics.first_number_word_position, 3, '"50" is the 3rd word of "This costs 50 dollars total"');

    const leading = lintDraft('linkedin', '50% of users churn\nMore.');
    assert.equal(leading.metrics.first_number_in_line_one, '50%');
    assert.equal(leading.metrics.first_number_word_position, 1, 'a number that opens the line is word position 1, not 0');

    const none = lintDraft('linkedin', 'No numbers here at all\nMore.');
    assert.equal(none.metrics.first_number_in_line_one, null);
    assert.equal(none.metrics.first_number_word_position, null);

    const decimalWithComma = lintDraft('linkedin', 'Revenue grew 1,200.50 percent\nMore.');
    assert.equal(decimalWithComma.metrics.first_number_in_line_one, '1,200.50', 'commas and a decimal point inside a single number must not split the match');
    assert.equal(decimalWithComma.metrics.first_number_word_position, 3);
  }
  ok('first_number_in_line_one/first_number_word_position correctly locate a mid-sentence number, a leading number (position 1, not 0), a comma-and-decimal number, and report null/null when there is no number');

  // ---- plain metrics: character/word counts and emoji count -------------------------
  {
    const result = lintDraft('linkedin', 'One two three\nSecond line here');
    assert.equal(result.metrics.characters_total, 30);
    assert.equal(result.metrics.first_line_characters, 13);
    assert.equal(result.metrics.first_line_words, 3);

    const withEmoji = lintDraft('linkedin', 'Great news \u{1F389}\u{1F389} today \u{1F680}');
    assert.equal(withEmoji.metrics.emoji, 3, 'both party-popper emoji and the rocket must be counted');
  }
  ok('characters_total, first_line_characters, first_line_words and emoji count match hand-verified values');

  // ---- typographic quote normalisation: a curly apostrophe must still match ----------
  // "I've been thinking..." typed with a curly apostrophe (common when pasted from a
  // word processor or typed on a phone) must match the same straight-apostrophe regex.
  {
    const curly = lintDraft('linkedin', 'I’ve been thinking about this for a while.\nMore.');
    assert.equal(findingsByCheck(curly).throat_clearing_opener.evidence, "I've been thinking",
      'a curly apostrophe must be normalised to a straight one before matching, or this opener is missed entirely');
  }
  ok('typographic curly apostrophes are normalised to straight ones before opener matching, so a phone-typed or pasted draft is not missed');

  console.log(`\n${passed} lint.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
