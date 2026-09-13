#!/usr/bin/env node
/**
 * Regression tests for lib/fold.js.
 *
 *   node plugins/ghost-post-preview/mcp/test/fold.test.mjs
 */
import assert from 'node:assert/strict';
import { foldTest } from '../lib/fold.js';

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

  console.log(`\n${passed} fold.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
