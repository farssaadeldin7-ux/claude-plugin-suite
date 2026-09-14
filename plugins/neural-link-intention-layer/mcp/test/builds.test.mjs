#!/usr/bin/env node
/**
 * Regression tests for lib/builds.js: the build log behind the two-week
 * re-measure (recordBuild, recordFollowup, reviewBuilds).
 *
 *   node plugins/neural-link-intention-layer/mcp/test/builds.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// builds.js creates its JSON-array store (and resolves the config directory)
// at import time via createJsonArrayStore(), so XDG_CONFIG_HOME must be set
// — and builds.js dynamically imported — before that happens. A static
// import here would be hoisted ahead of this assignment regardless of source
// order, and would point every test run at the real user's config directory.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'neural-link-intention-layer-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

const { recordBuild, recordFollowup, reviewBuilds, BUILDS_FILE } = await import('../lib/builds.js');

try {
  // ---- recordBuild: fields are stored, absent optional fields default to null ----
  {
    const b = recordBuild({ mechanism: 'Actions', application: 'photoshop', sequence: 'new_layer -> fill_50_grey', predicted_f_per_week: 32, payback_weeks: 1.1, notes: 'dodge and burn' });
    assert.match(b.id, /^build_[0-9a-f]{12}$/);
    assert.equal(b.mechanism, 'Actions');
    assert.equal(b.application, 'photoshop');
    assert.equal(b.predicted_f_per_week, 32);
    assert.equal(b.observed_f_per_week, null, 'a freshly recorded build has no observed rate yet');
    assert.equal(typeof b.created_at, 'string');

    const b2 = recordBuild({});
    assert.equal(b2.mechanism, null);
    assert.equal(b2.application, null);
    assert.equal(b2.sequence, null);
    assert.equal(b2.predicted_f_per_week, null);
    assert.equal(b2.payback_weeks, null);
    assert.equal(b2.notes, null);
  }
  ok('recordBuild stores the given fields and defaults every omitted optional field to null, not undefined');

  // ---- recordBuild: ids are unique across records ---------------------------
  {
    const ids = new Set();
    for (let i = 0; i < 20; i++) ids.add(recordBuild({ mechanism: `m${i}` }).id);
    assert.equal(ids.size, 20);
  }
  ok('recordBuild assigns a distinct id to every record');

  // ---- reviewBuilds: newest first, total/unchecked counts -------------------
  {
    const review = reviewBuilds({ limit: 100 });
    // 1 (dodge and burn) + 1 (empty) + 20 (unique-id loop) = 22 builds so far.
    assert.equal(review.total_builds, 22);
    assert.equal(review.unchecked, 22, 'no build has an observed rate yet, so every one is unchecked');
    assert.match(review.note, /No build has an observed firing rate yet/);
    assert.equal(review.recent[0].mechanism, 'm19', 'recordBuild must unshift, so the most recently recorded build is first');
    assert.equal(review.stored_at, BUILDS_FILE);
  }
  ok('reviewBuilds reports total/unchecked counts, the "no observed rate yet" note, and lists most-recent-first');

  // ---- recordFollowup: unknown id is a no-op that returns null --------------
  {
    const result = recordFollowup('build_does_not_exist', { observed_f_per_week: 10 });
    assert.equal(result, null);
    assert.equal(reviewBuilds().total_builds, 22, 'a followup for an unknown id must not add or corrupt a record');
  }
  ok('recordFollowup returns null and changes nothing for an id that does not exist');

  // ---- recordFollowup + reviewBuilds: observed_over_predicted is hand-verified ----
  {
    const b = recordBuild({ mechanism: 'Actions', predicted_f_per_week: 32 });
    const followed = recordFollowup(b.id, { observed_f_per_week: 24, notes: 'underfiring a bit' });
    assert.equal(followed.observed_f_per_week, 24);
    assert.equal(followed.followup_notes, 'underfiring a bit');
    assert.equal(typeof followed.followed_up_at, 'string');

    const review = reviewBuilds({ limit: 100 });
    const row = review.recent.find((r) => r.id === b.id);
    // 24 / 32 = 0.75 exactly.
    assert.equal(row.observed_over_predicted, 0.75);
    assert.equal(review.unchecked, 22, 'exactly one of the 23 builds now has both rates recorded');
  }
  ok('recordFollowup records the observed rate and notes, and reviewBuilds computes observed/predicted (24/32 = 0.75) correctly');

  // ---- recordFollowup: notes is optional and does not overwrite with a falsy value ----
  {
    const b = recordBuild({ mechanism: 'Keymap', predicted_f_per_week: 10 });
    const followed = recordFollowup(b.id, { observed_f_per_week: 10 });
    assert.equal(followed.observed_f_per_week, 10);
    assert.equal('followup_notes' in followed, false, 'omitting notes must not add a followup_notes field at all');
  }
  ok('recordFollowup without notes leaves followup_notes absent rather than set to an empty or null value');

  // ---- reviewBuilds: predicted_f_per_week of 0 is "checked" but must not divide by zero ----
  // Regression-shaped: reviewBuilds counts a build as checked whenever both
  // rates are `!= null` (0 counts, since it is not null/undefined), but the
  // observed_over_predicted mapping instead guards with a truthy check on
  // predicted_f_per_week — deliberately, because 0 && anything is falsy and
  // skips the division entirely. Losing that distinction (e.g. switching the
  // mapping's guard to `!= null` to match the counting guard) would produce
  // Infinity for a macro that was predicted to fire zero times a week.
  {
    const b = recordBuild({ mechanism: 'never fires', predicted_f_per_week: 0 });
    recordFollowup(b.id, { observed_f_per_week: 5 });
    const review = reviewBuilds({ limit: 100 });
    const checkedCount = review.total_builds - review.unchecked;
    const row = review.recent.find((r) => r.id === b.id);
    assert.equal('observed_over_predicted' in row, false, 'predicted_f_per_week of 0 must omit the ratio rather than report Infinity');
    // The build still counts as "checked" for the total/unchecked tally,
    // since predicted_f_per_week (0) and observed_f_per_week (5) are both
    // present (!= null) even though 0 is falsy.
    assert.ok(checkedCount >= 1);
  }
  ok('a build predicted to fire 0 times a week is counted as checked but its observed_over_predicted ratio is omitted, not reported as Infinity');

  console.log(`\n${passed} builds.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
