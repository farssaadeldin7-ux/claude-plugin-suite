#!/usr/bin/env node
/**
 * Regression tests for scripts/check-regressions.mjs itself — proving it
 * doesn't have the two specific false-positive holes an earlier version of
 * this idea had: matching a keyword in application source instead of a
 * test, and matching a loose pattern against unrelated English prose.
 * Built against synthetic fixtures in a scratch directory, independent of
 * this repo's real manifest.
 *
 *   node test/check-regressions.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateEntry, isTestFile, matchesNearAssert } from '../scripts/check-regressions.mjs';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'check-regressions-test-'));
const write = (rel, content) => {
  const abs = path.join(scratch, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};

try {
  // ---- isTestFile itself -----------------------------------------------
  assert.equal(isTestFile('services/billing/server.js'), false);
  assert.equal(isTestFile('services/billing/test/e2e.mjs'), true);
  assert.equal(isTestFile('plugins/ghost-post-preview/mcp/server.js'), false);
  assert.equal(isTestFile('plugins/ghost-post-preview/mcp/test/fold.test.mjs'), true);
  assert.equal(isTestFile('test/build.test.mjs'), true);
  ok('isTestFile accepts only files under a test/ directory or named *.test.mjs');

  // ---- bug #1: a keyword in application source must never count --------
  // Regression test: the original tool searched source files too, so
  // `nosniff` appearing in the server's own header-setting code — not a
  // test asserting the header is present — counted as coverage for a
  // security header that had, in fact, no test at all.
  {
    write('services/billing/server.js', `res.setHeader('x-content-type-options', 'nosniff'); // real source, no test`);
    // No test file exists for this finding at all.
    const entry = { id: 'fake-nosniff', summary: 'nosniff header present', testFiles: ['services/billing/server.js'], pattern: /nosniff/ };
    const result = evaluateEntry(entry, scratch);
    assert.equal(result.covered, false, 'a match inside application source must never be reported as coverage');
  }
  ok('a pattern matching only inside application source is reported as a gap, not coverage');

  {
    // Now add a real test file that actually asserts on it — this must be
    // picked up once it exists.
    write('services/billing/test/e2e.mjs', `
      import assert from 'node:assert/strict';
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    `.trim());
    const entry = {
      id: 'fake-nosniff-2',
      summary: 'nosniff header present',
      testFiles: ['services/billing/test/e2e.mjs'],
      pattern: /nosniff/,
    };
    // This synthetic "test" file isn't runnable node (no real assertions
    // executed, `res` undefined) — evaluateEntry must still require it to
    // actually run and pass, not just contain the word.
    const result = evaluateEntry(entry, scratch);
    assert.equal(result.covered, false, 'a test file that does not actually run and pass must not count as coverage either');
  }
  ok('a matching test file that does not actually pass is still reported as a gap');

  // ---- bug #2: a keyword far from any real assertion must never count ---
  // Regression test: `minLength|maxLength|pattern` was satisfied by the
  // English word "patterns" in a completely unrelated escalation test —
  // the word appeared nowhere near an actual assertion, just in a log
  // line, yet counted as coverage. A realistic fixture: a real test file,
  // with a real assert elsewhere for something unrelated, and the
  // colliding word sitting only in a comment/log line far from it.
  {
    write('plugins/customer-sales-support/mcp/test/unrelated.test.mjs', `
      #!/usr/bin/env node
      import assert from 'node:assert/strict';

      // Checking escalation patterns for the legal category. Nothing here
      // is about schema validation of any kind — this whole block is far
      // away from the assertion below on purpose.
      const label = 'legal escalation patterns';
      console.log(label);



      assert.equal(1 + 1, 2, 'an unrelated real assertion, far from the comment above');
      console.log('1 unrelated checks passed');
    `.trim());
    const looseEntry = {
      id: 'fake-loose',
      summary: 'schema minLength/maxLength/pattern enforced',
      testFiles: ['plugins/customer-sales-support/mcp/test/unrelated.test.mjs'],
      pattern: /minLength|maxLength|pattern/, // the exact buggy pattern from the audit
    };
    assert.equal(
      matchesNearAssert(fs.readFileSync(path.join(scratch, looseEntry.testFiles[0]), 'utf8'), looseEntry.pattern),
      false,
      'the word "patterns" sits nowhere near a real assertion, so even this loose pattern must not count as coverage'
    );
    const looseResult = evaluateEntry(looseEntry, scratch);
    assert.equal(looseResult.covered, false, 'a keyword match far from any assertion is a gap, not coverage, regardless of how loose the pattern is');
  }
  ok('a pattern matching only far from a real assertion is rejected, closing the exact "patterns" false positive');

  // ---- a genuine match right next to a real assertion is accepted -------
  {
    write('plugins/customer-sales-support/mcp/test/real.test.mjs', `
      #!/usr/bin/env node
      import assert from 'node:assert/strict';
      // a schema declaring minLength must actually be enforced
      assert.match(errorMessage, /minLength/);
      console.log('1 real checks passed');
    `.trim());
    const realEntry = {
      id: 'fake-real',
      summary: 'schema minLength enforced',
      testFiles: ['plugins/customer-sales-support/mcp/test/real.test.mjs'],
      pattern: /minLength/,
    };
    assert.equal(
      matchesNearAssert(fs.readFileSync(path.join(scratch, realEntry.testFiles[0]), 'utf8'), realEntry.pattern),
      true,
      'a keyword right next to (or inside) a real assert call must be recognised'
    );
  }
  ok('a genuine match sitting next to a real assertion is recognised as coverage');

  console.log(`\n${passed} check-regressions.mjs checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
