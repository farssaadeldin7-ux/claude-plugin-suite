#!/usr/bin/env node
/**
 * Regression tests for lib/fold.js.
 *
 *   node plugins/ghost-post-preview/mcp/test/fold.test.mjs
 */
import assert from 'node:assert/strict';
import { foldTest, foldSpec, platformFor } from '../lib/fold.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- truncated and characters_hidden must never disagree ----------------
  // Regression test: when the content past the cut is purely blank lines,
  // stripping leading newlines for the human-readable preview left an empty
  // "hidden" string — which `truncated` was derived from — while
  // characters_hidden (derived from the raw, unstripped length difference)
  // still reported a nonzero count for the very same cut. The report
  // claimed nothing was truncated while simultaneously saying otherwise.
  {
    // "x" on this platform: 280 chars, no line cap. A 280-char line exactly
    // fills the cap; a trailing blank line then gets cut entirely.
    const text = 'x'.repeat(280) + '\n';
    const result = foldTest('x', text);
    assert.equal(result.truncated, true);
    assert.ok(result.truncated_by, 'truncated_by must be set whenever truncated is true');
    assert.ok(result.characters_hidden > 0, 'characters_hidden must be nonzero whenever truncated is true');
  }
  ok('truncated, truncated_by and characters_hidden agree even when everything past the cut is blank');

  // ---- an untruncated draft reports no hidden content at all -------------
  {
    const result = foldTest('x', 'short post');
    assert.equal(result.truncated, false);
    assert.equal(result.truncated_by, null);
    assert.equal(result.characters_hidden, 0);
    assert.equal(result.first_hidden_line, null);
  }
  ok('a draft well under the cap reports no truncation and no hidden characters at all');

  // ---- a genuinely truncated draft still names its first hidden line -----
  // linkedin caps at 3 lines, so a 4th short line is dropped whole by the
  // line cap rather than cut mid-line by the char cap.
  {
    const result = foldTest('linkedin', 'line one\nline two\nline three\nline four');
    assert.equal(result.truncated, true);
    assert.equal(result.truncated_by, 'line_cap');
    assert.equal(result.first_hidden_line, 'line four');
  }
  ok('a genuine truncation with real hidden text still reports the first hidden line');

  // ---- a char-cap cut cannot split a character in half ---------------------
  // Regression test: .slice() counts UTF-16 code units, not characters — an
  // astral character (an emoji, here) is two code units, and a cut landing
  // between them left a lone, invalid surrogate at the end of visible_text,
  // which renders as a broken character rather than being cleanly dropped.
  {
    const text = 'a'.repeat(279) + '\u{1F44D}' + 'rest of text'; // 👍, a surrogate pair
    const result = foldTest('x', text); // "x": 280 char cap
    for (const ch of result.visible_text) {
      const code = ch.codePointAt(0);
      assert.ok(code < 0xd800 || code > 0xdfff, `visible_text must contain no lone surrogate, found U+${code.toString(16)}`);
    }
    assert.equal(result.visible_text, 'a'.repeat(279), 'the incomplete character must be dropped entirely, not left half-cut');
  }
  ok('a char-cap cut that would split a surrogate pair drops the whole character instead of leaving it broken');

  // ---- char_cap: the documented boundary is inclusive (exactly at the cap survives) ----
  // TikTok's cap is 100 chars, 1 line (data/platforms.json). Boundary test both sides:
  // a draft exactly at the cap must NOT be truncated (the `>` check, not `>=`), one char
  // over must be. This is exactly the off-by-one shape the codebase has had before.
  {
    const atCap = foldTest('tiktok', 'a'.repeat(100));
    assert.equal(atCap.truncated, false, 'a draft exactly at the 100-char cap must not be reported as truncated');
    assert.equal(atCap.characters_hidden, 0);
    assert.equal(atCap.visible_text, 'a'.repeat(100));

    const overCap = foldTest('tiktok', 'a'.repeat(101));
    assert.equal(overCap.truncated, true, 'one character past the cap must be truncated');
    assert.equal(overCap.truncated_by, 'char_cap');
    assert.equal(overCap.visible_text, 'a'.repeat(100));
    assert.equal(overCap.characters_hidden, 1);
  }
  ok('char_cap boundary is inclusive: exactly 100 chars on a 100-char-cap platform is not truncated, 101 is, by exactly one character');

  // ---- line_cap: the documented boundary is inclusive (exactly at the cap survives) ----
  // LinkedIn's cap is 3 lines. Three short non-blank lines must all survive; this is the
  // mirror of the existing "line four" test above, which checks the over-the-cap side —
  // together they cover both sides of the same boundary.
  {
    const atCap = foldTest('linkedin', 'line one\nline two\nline three');
    assert.equal(atCap.truncated, false, 'exactly 3 lines on a 3-line-cap platform must not be reported as truncated');
    assert.equal(atCap.visible_text, 'line one\nline two\nline three');
  }
  ok('line_cap boundary is inclusive: exactly 3 lines on a 3-line-cap platform is not truncated (mirrors the existing 4-line/line_cap test from the other side)');

  // ---- char_cap wins over line_cap when it bites first, within the line budget --------
  // LinkedIn: 200 chars, 3 lines. A single first line over 200 chars trips the char cap
  // on line 1, well inside the 3-line budget — line_cap must not shadow it.
  {
    const result = foldTest('linkedin', 'a'.repeat(210));
    assert.equal(result.truncated_by, 'char_cap');
    assert.equal(result.characters_visible, 200);
    assert.equal(result.characters_hidden, 10);
  }
  ok('char_cap truncates a too-long first line even though only 1 of 3 available lines was used');

  // ---- blank_lines_cost_a_line: true actually spends part of the line budget ----------
  // LinkedIn (blank_lines_cost_a_line: true, lines: 3): "line one", a blank line, "line
  // two" already spend all 3 slots, so a following "line three" is pushed out by the
  // blank line — it would otherwise easily fit in 3 lines of real content.
  {
    const result = foldTest('linkedin', 'line one\n\nline two\nline three');
    assert.equal(result.truncated, true);
    assert.equal(result.truncated_by, 'line_cap');
    assert.equal(result.visible_text, 'line one\n\nline two', 'the blank line must consume one of the 3 line slots');
    assert.equal(result.first_hidden_line, 'line three');
  }
  ok('blank_lines_cost_a_line:true spends a line slot on a blank line, pushing real content past the cap earlier than it otherwise would be');

  // ---- blank_lines_cost_a_line: false does not spend the line budget ------------------
  // Instagram (blank_lines_cost_a_line: false, lines: 2): the same shape of draft — one
  // real line, a blank, another real line — fits entirely, because the blank line is free.
  {
    const result = foldTest('instagram', 'line one\n\nline two');
    assert.equal(result.truncated, false, 'a free blank line must not count against the 2-line cap, so both real lines fit');
    assert.equal(result.visible_text, 'line one\n\nline two');
  }
  ok('blank_lines_cost_a_line:false does not spend a line slot on a blank line, unlike the same-shaped LinkedIn draft above');

  // ---- opening_blank_lines is always counted, but the advisory note only fires when ----
  // ---- blank lines actually cost something on that platform ---------------------------
  {
    const linkedinBlank = foldTest('linkedin', '\n\nHello world'); // blanks cost a line here
    assert.equal(linkedinBlank.opening_blank_lines, 2);
    assert.equal(linkedinBlank.note, 'The draft opens with a blank line, which spends part of the visible allowance on nothing.');

    const instagramBlank = foldTest('instagram', '\n\nHello world'); // blanks are free here
    assert.equal(instagramBlank.opening_blank_lines, 2, 'opening_blank_lines is counted the same way regardless of whether blanks cost anything');
    assert.equal('note' in instagramBlank, false, 'no advisory note when blank lines do not cost anything on this platform');

    const noBlank = foldTest('linkedin', 'Hello world');
    assert.equal(noBlank.opening_blank_lines, 0);
    assert.equal('note' in noBlank, false);
  }
  ok('opening_blank_lines is reported for every platform, but the advisory note is present only when blank_lines_cost_a_line is true and there actually is one');

  // ---- a char-cap cut leaves the exact leftover fragment, not rounded to a word -------
  // Deterministic mechanics only (per fold.js's own comment): the cut can land mid-word,
  // and first_hidden_line must show exactly what's left, not something word-aligned.
  {
    const text = 'a'.repeat(97) + 'BCDEFG'; // 103 chars, single line, cap is 100 (tiktok)
    const result = foldTest('tiktok', text);
    assert.equal(result.visible_text, 'a'.repeat(97) + 'BCD');
    assert.equal(result.characters_visible, 100);
    assert.equal(result.characters_hidden, 3);
    assert.equal(result.first_hidden_line, 'EFG', 'the hidden fragment is exactly what is left after the cut, mid-word');
  }
  ok('a char-cap cut reports the exact leftover fragment mid-word, with no word-boundary rounding');

  // ---- reddit/youtube: title and body fold separately, single-spec platforms don't ----
  {
    const title = foldTest('reddit', 'A short title', 'title');
    assert.equal(title.applies_to, 'title');
    assert.equal(title.part_note, null);
    assert.equal(title.fold_limits.characters, 300);
    assert.equal(title.fold_limits.lines, null);

    const body = foldTest('reddit', 'Body text here', 'body');
    assert.equal(body.applies_to, 'body');
    assert.match(body.part_note, /Reddit/);
    assert.equal(body.fold_limits.characters, null);
    assert.equal(body.fold_limits.lines, 3);

    const single = foldTest('linkedin', 'Just a post');
    assert.equal('applies_to' in single, false, 'a single-spec platform must not report applies_to at all');
    assert.equal('part_note' in single, false);
  }
  ok('reddit/youtube report which part (title/body) a fold_test result applies to and note to also check the other; single-spec platforms report neither key');

  // ---- platformFor: case/whitespace-insensitive lookup, and no prototype leakage -----
  {
    assert.equal(platformFor('  LinkedIn  ').label, 'LinkedIn', 'lookup must trim and lower-case');
    assert.equal(platformFor('constructor'), null, 'an inherited Object.prototype name must not resolve to a fake platform');
    assert.equal(platformFor('not-a-real-platform'), null);
    assert.equal(platformFor(undefined), null);
    assert.equal(foldTest('not-a-real-platform', 'hello'), null, 'foldTest itself must return null, not throw, for an unknown platform');
  }
  ok('platformFor resolves case- and whitespace-insensitively and never treats an inherited Object.prototype key as a platform');

  // ---- foldSpec: single-spec platforms return the whole fold object with part:null ----
  {
    const linkedin = platformFor('linkedin');
    const { spec, part } = foldSpec(linkedin);
    assert.equal(part, null);
    assert.equal(spec.chars, 200);
    assert.equal(spec.lines, 3);
  }
  ok('foldSpec returns part:null for a platform whose fold is a single spec, not split by title/body');

  console.log(`\n${passed} fold.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
