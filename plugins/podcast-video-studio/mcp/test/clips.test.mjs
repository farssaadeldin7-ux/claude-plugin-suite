#!/usr/bin/env node
/**
 * Regression tests for lib/clips.js: the local clip log and the footage-pass
 * tally that turns the skill's "assume around a third fail" assumption into
 * a measured count.
 *
 * clips.js creates its JSON-array store (and resolves the config directory)
 * at import time, so XDG_CONFIG_HOME must be set — and the module
 * dynamically imported — before that happens, exactly as the
 * professor-mind-reader pilot does for its audits.js. A static import here
 * would be hoisted ahead of this assignment regardless of source order.
 *
 *   node plugins/podcast-video-studio/mcp/test/clips.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-video-studio-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { logClip, recordFootagePass, reviewClips, footageResultIsValid } = await import('../lib/clips.js');

try {
  // ---- footageResultIsValid: exactly the two real results -------------------
  {
    assert.equal(footageResultIsValid('passed'), true);
    assert.equal(footageResultIsValid('failed'), true);
    assert.equal(footageResultIsValid('pending'), false);
    assert.equal(footageResultIsValid(''), false);
    assert.equal(footageResultIsValid(undefined), false);
  }
  ok('footageResultIsValid accepts exactly "passed" and "failed" and nothing else');

  // ---- logClip: defaults unset optional fields to null, not undefined -------
  {
    const record = logClip({ in_point: '00:14:22', out_point: '00:15:08' });
    assert.match(record.id, /^clip_[0-9a-f]{12}$/);
    assert.equal(record.episode, null);
    assert.equal(record.duration_seconds, null);
    assert.equal(record.footage_pass, null);
    assert.equal(record.in_point, '00:14:22');
  }
  ok('logClip stamps a clip_ id and defaults every omitted optional field to null rather than leaving it undefined');

  // ---- recordFootagePass: updates the matching record, unknown id -> null ---
  {
    const clip = logClip({ in_point: '00:01:00', out_point: '00:01:40' });
    const updated = recordFootagePass(clip.id, { result: 'failed', reason: 'framing was off-centre' });
    assert.equal(updated.footage_pass, 'failed');
    assert.equal(updated.footage_pass_reason, 'framing was off-centre');
    assert.ok(updated.resolved_at, 'a resolved clip must record when it was resolved');

    assert.equal(recordFootagePass('clip_doesnotexist', { result: 'passed' }), null, 'an unknown clip id must return null, not throw or create a record');
  }
  ok('recordFootagePass updates the matching clip\'s footage_pass, reason and resolved_at, and returns null for an unknown id');

  // ---- reviewClips: the tally is a fresh, deterministic count ---------------
  // Reset to a known state: three fresh clips, one passed, one failed, one
  // left unresolved. Hand check: awaiting = 3 - 2 = 1; resolved = 2;
  // passed = 2 - 1(failed) = 1; failed = 1.
  {
    const home2 = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-video-studio-test2-'));
    process.env.XDG_CONFIG_HOME = home2;
    const mod2 = await import(`../lib/clips.js?cachebust=${home2}`);

    const a = mod2.logClip({ in_point: '00:00:00', out_point: '00:00:30' });
    const b = mod2.logClip({ in_point: '00:01:00', out_point: '00:01:30' });
    mod2.logClip({ in_point: '00:02:00', out_point: '00:02:30' }); // left unresolved

    mod2.recordFootagePass(a.id, { result: 'passed' });
    mod2.recordFootagePass(b.id, { result: 'failed', reason: 'audio clipped' });

    const review = mod2.reviewClips();
    assert.equal(review.total_clips, 3);
    assert.equal(review.awaiting_footage_pass, 1);
    assert.equal(review.footage_pass.resolved, 2);
    assert.equal(review.footage_pass.passed, 1);
    assert.equal(review.footage_pass.failed, 1);

    fs.rmSync(home2, { recursive: true, force: true });
  }
  ok('reviewClips tallies total_clips, awaiting_footage_pass, and the passed/failed split correctly against a known set of logged and resolved clips');

  // ---- reviewClips: no resolved clips reports the note, not a bogus tally ---
  {
    const home3 = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-video-studio-test3-'));
    process.env.XDG_CONFIG_HOME = home3;
    const mod3 = await import(`../lib/clips.js?cachebust=${home3}`);
    mod3.logClip({ in_point: '00:00:00', out_point: '00:00:20' });

    const review = mod3.reviewClips();
    assert.equal(review.total_clips, 1);
    assert.equal(review.awaiting_footage_pass, 1);
    assert.equal(review.footage_pass.resolved, 0);
    assert.equal(review.footage_pass.passed, undefined, 'with zero resolved clips, there must be no passed/failed counts to misread as real data');
    assert.match(review.footage_pass.note, /record_footage_pass/);

    fs.rmSync(home3, { recursive: true, force: true });
  }
  ok('reviewClips reports an explicit "none resolved yet" note instead of a zero-filled passed/failed tally when nothing has a recorded footage-pass result');

  console.log(`\n${passed} clips.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
