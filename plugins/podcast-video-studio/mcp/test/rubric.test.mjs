#!/usr/bin/env node
/**
 * Regression tests for lib/rubric.js: the four-axis scoring arithmetic,
 * the terminal premise-0 rule, the threshold table (including the
 * no-axis-below-2 condition at total 9), and the validity/lookup helpers.
 *
 * scoreClip's worked-example cases reproduce the four scored examples
 * printed verbatim in rubric.js's own WORKED_EXAMPLES (also served by the
 * scoring_rubric tool) — hand-verified against the threshold table the same
 * module states before being encoded here as assertions, so this checks the
 * code against an independently-computed reference rather than restating
 * the code's own math.
 *
 *   node plugins/podcast-video-studio/mcp/test/rubric.test.mjs
 */
import assert from 'node:assert/strict';
import { AXES, scoreClip, scoreIsValid, disqualifierFor, WORKED_EXAMPLES } from '../lib/rubric.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- worked example: "We stopped hiring senior people entirely" (12/12) ----
  // From WORKED_EXAMPLES[0]: premise 3, tension 3, payoff 3, boundaries 3,
  // total 12. Hand check: 3+3+3+3 = 12 >= 10 -> publish_candidate.
  {
    const { scores, verdict } = WORKED_EXAMPLES[0];
    const result = scoreClip({ ...scores });
    assert.equal(result.disqualified, false);
    assert.equal(result.total, 12);
    assert.equal(result.action, 'publish_candidate');
    assert.match(verdict, /12\/12/, 'sanity-check the fixture still reads 12/12 in the source doc');
  }
  ok('scoreClip reproduces WORKED_EXAMPLES[0] ("We stopped hiring senior people entirely"): 3+3+3+3=12 publishes outright');

  // ---- worked example: the 40-second pricing walkthrough (10/12) --------------
  // From WORKED_EXAMPLES[2]: premise 3, tension 1, payoff 3, boundaries 3,
  // total 10. Hand check: 3+1+3+3 = 10 >= 10 -> publish_candidate, even
  // though tension (1) is well below 2 -- the >=10 branch does not apply
  // the no-axis-below-2 condition; that only guards the total-9 boundary.
  {
    const { scores } = WORKED_EXAMPLES[2];
    const result = scoreClip({ ...scores });
    assert.equal(result.total, 10);
    assert.equal(result.action, 'publish_candidate', 'total 10 publishes outright regardless of a low tension axis');
  }
  ok('scoreClip reproduces WORKED_EXAMPLES[2] (pricing walkthrough): total 10 publishes despite tension=1, because the no-axis-below-2 condition is total-9-only');

  // ---- worked example: the near-miss confession, exactly on the 9/lowest=2 boundary ----
  // From WORKED_EXAMPLES[3]: premise 3, tension 2, payoff 2, boundaries 2,
  // total 9. Hand check: 3+2+2+2 = 9; lowest axis = 2, which is exactly the
  // ">=2" boundary the doc's own verdict states ("9/12, no axis below 2, so
  // it publishes") -> publish_candidate_conditional.
  {
    const { scores, verdict } = WORKED_EXAMPLES[3];
    const result = scoreClip({ ...scores });
    assert.equal(result.total, 9);
    assert.equal(result.action, 'publish_candidate_conditional', 'lowest axis is exactly 2, which the doc places inside the publishing bucket, not outside it');
    assert.match(verdict, /no axis below 2/, 'sanity-check the fixture still states the no-axis-below-2 condition');
  }
  ok('scoreClip reproduces WORKED_EXAMPLES[3] (near-miss confession): total 9 with lowest axis exactly 2 publishes conditionally, matching the doc\'s own boundary wording');

  // ---- total=9 with the lowest axis one point under the boundary ------------
  {
    const result = scoreClip({ premise: 3, tension: 3, payoff: 1, boundaries: 2 }); // total 9, lowest 1
    assert.equal(result.total, 9);
    assert.equal(result.action, 'rework_list', 'lowest axis 1 is one point below the >=2 boundary and must not publish');
    assert.deepEqual(result.lowest_axes, ['payoff']);
    assert.equal(result.lowest_score, 1);
    assert.match(result.rule, /below 2/);
    assert.equal(result.payoff_note, AXES[2].note, 'a payoff score of exactly 1 must carry the payoff axis note');
  }
  ok('scoreClip at total=9 with lowest axis=1 (one below the boundary) falls through to rework_list, and a payoff score of 1 attaches the payoff-axis note');

  // ---- total threshold boundaries: 10/9, 7/6 ---------------------------------
  {
    // total exactly 10 (publish) vs 9 without the low-axis carve-out applying oddly
    assert.equal(scoreClip({ premise: 3, tension: 3, payoff: 2, boundaries: 2 }).action, 'publish_candidate'); // 10
    assert.equal(scoreClip({ premise: 3, tension: 2, payoff: 2, boundaries: 1 }).action, 'rework_list'); // 8, lowest irrelevant here
    // total exactly 7 (rework) vs 6 (leave in episode)
    const at7 = scoreClip({ premise: 2, tension: 2, payoff: 2, boundaries: 1 }); // total 7
    assert.equal(at7.total, 7);
    assert.equal(at7.action, 'rework_list', 'total 7 is the rework-list lower boundary');
    const at6 = scoreClip({ premise: 2, tension: 2, payoff: 1, boundaries: 1 }); // total 6
    assert.equal(at6.total, 6);
    assert.equal(at6.action, 'leave_in_episode', 'total 6, one below the rework-list floor, leaves it in the episode');
  }
  ok('scoreClip places total=7 in rework_list and total=6 (one below) in leave_in_episode, matching the threshold table\'s stated bands');

  // ---- lowest-axis ties are all named, not just the first ------------------
  {
    const result = scoreClip({ premise: 3, tension: 1, payoff: 1, boundaries: 3 }); // total 8
    assert.equal(result.action, 'rework_list');
    assert.deepEqual(result.lowest_axes.sort(), ['payoff', 'tension'].sort(), 'both axes tied at the minimum must be named, not just one');
  }
  ok('scoreClip names every axis tied for the lowest score, not only the first one found');

  // ---- terminal premise-0 rule overrides the total, even a high one --------
  // WORKED_EXAMPLES[1] documents this qualitatively ("disqualified on
  // unresolved referent before scoring"); this is the numeric-scoring analog:
  // a genuine premise=0 with an otherwise strong total (0+3+3+3=9) must still
  // be terminal, not merely score low.
  {
    const result = scoreClip({ premise: 0, tension: 3, payoff: 3, boundaries: 3 });
    assert.equal(result.disqualified, true);
    assert.equal(result.scored, true, 'a premise-0 disqualification still reports the scores that were computed, unlike a tell-based disqualifier');
    assert.equal(result.total, 9);
    assert.equal(result.reason, AXES[0].descriptors[0]);
    assert.equal(result.action, undefined, 'a terminal premise-0 result must not also carry a threshold action');
  }
  ok('scoreClip treats premise=0 as terminal even when the raw total (9) would otherwise publish conditionally');

  // ---- tell-based disqualifiers bypass scoring entirely --------------------
  {
    const result = scoreClip({ premise: 3, tension: 3, payoff: 3, boundaries: 3, disqualifiers: ['unresolved_referent', 'callback'] });
    assert.equal(result.disqualified, true);
    assert.equal(result.scored, false, 'a tell-based disqualifier never reaches scoring, unlike premise=0');
    assert.equal(result.total, undefined);
    assert.deepEqual(result.by.map((d) => d.id), ['unresolved_referent', 'callback']);
  }
  ok('scoreClip short-circuits on tell-based disqualifiers before computing any score, even with a perfect 12/12 set of axis scores supplied');

  // ---- scoreIsValid: integer 0-3 boundaries ---------------------------------
  {
    assert.equal(scoreIsValid(0), true);
    assert.equal(scoreIsValid(3), true);
    assert.equal(scoreIsValid(-1), false, 'one below the floor');
    assert.equal(scoreIsValid(4), false, 'one above the ceiling');
    assert.equal(scoreIsValid(1.5), false, 'must be an integer, not merely in range');
    assert.equal(scoreIsValid(NaN), false);
    assert.equal(scoreIsValid('2'), false, 'a numeric string is not a number');
    assert.equal(scoreIsValid(undefined), false);
  }
  ok('scoreIsValid accepts exactly the integers 0 through 3 and rejects everything outside or non-integer');

  // ---- disqualifierFor: lookup is case/whitespace-insensitive, unknown -> null ----
  {
    assert.equal(disqualifierFor('unresolved_referent').id, 'unresolved_referent');
    assert.equal(disqualifierFor('  CALLBACK  ').id, 'callback', 'lookup must trim and lowercase');
    assert.equal(disqualifierFor('not_a_real_id'), null);
    assert.equal(disqualifierFor(undefined), null);
  }
  ok('disqualifierFor looks up a known id case- and whitespace-insensitively and returns null for an unrecognised one');

  console.log(`\n${passed} rubric.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
