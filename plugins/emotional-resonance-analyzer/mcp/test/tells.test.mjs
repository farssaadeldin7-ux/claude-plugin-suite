#!/usr/bin/env node
/**
 * Regression tests for lib/tells.js: the five mechanical drop-off checks,
 * the Q&A ledger findings, and the overlap/priority pass.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/tells.test.mjs
 */
import assert from 'node:assert/strict';
import { normaliseQuestions, checkTells } from '../lib/tells.js';
import { normaliseScenes } from '../lib/scenes.js';
import { formFor } from '../lib/forms.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const throws = (fn, codeMatch) => {
  try {
    fn();
    return null;
  } catch (err) {
    if (codeMatch && err.code !== codeMatch) throw new Error(`expected code "${codeMatch}", got "${err.code}": ${err.message}`);
    return err;
  }
};

try {
  // =========================================================================
  // The 12-scene worked example from references/arc-scoring.md, run through
  // the full checkTells pipeline. The scene table's timecode/valence/
  // intensity columns are copied verbatim (see arc.test.mjs for the
  // hand-check that start+duration lines up scene-to-scene). information_only,
  // person_with_want and longest_talking_head_seconds are not columns in the
  // printed table, so they are set here to match the doc's own prose exactly:
  // "Scenes 3, 4 and 5 are three consecutive information-only scenes" and
  // "keep the subject a topic rather than a person" -> information_only and
  // person_with_want=false on scenes 3-5; "Scene 7 runs 1:50 unbroken on a
  // single frame" -> longest_talking_head_seconds = 1:50 on scene 7. The Q&A
  // ledger (Q1/Q2/Q3) is copied verbatim from the doc's ledger table.
  // =========================================================================
  const rawWorkedScenes = [
    { timecode: '00:00', valence: -1, intensity: 2, duration: '0:35', information_only: false, person_with_want: true },
    { timecode: '00:35', valence: 0, intensity: 2, duration: '0:50', information_only: false, person_with_want: true },
    { timecode: '01:25', valence: 0, intensity: 2, duration: '1:40', information_only: true, person_with_want: false },
    { timecode: '03:05', valence: 0, intensity: 2, duration: '1:20', information_only: true, person_with_want: false },
    { timecode: '04:25', valence: 0, intensity: 2, duration: '1:10', information_only: true, person_with_want: false },
    { timecode: '05:35', valence: 1, intensity: 3, duration: '0:45', information_only: false, person_with_want: true },
    { timecode: '06:20', valence: -2, intensity: 4, duration: '1:50', information_only: false, person_with_want: true, longest_talking_head_seconds: '1:50' },
    { timecode: '08:10', valence: -2, intensity: 4, duration: '0:40', information_only: false, person_with_want: true },
    { timecode: '08:50', valence: -1, intensity: 4, duration: '0:55', information_only: false, person_with_want: true },
    { timecode: '09:45', valence: 3, intensity: 5, duration: '0:35', information_only: false, person_with_want: true },
    { timecode: '10:20', valence: 2, intensity: 3, duration: '0:50', information_only: false, person_with_want: true },
    { timecode: '11:10', valence: 2, intensity: 2, duration: '0:30', information_only: false, person_with_want: true },
  ];
  const { scenes: weScenes, runtime: weRuntime } = normaliseScenes(rawWorkedScenes, { totalRuntime: '11:40' });
  const weQuestions = normaliseQuestions([
    { id: 'Q1', question: 'Will the yard reopen?', opens: '00:15', closes: '09:45', how: 'on_screen', weight: 'central' },
    { id: 'Q2', question: 'Why did Dan stay?', opens: '00:40', closes: '06:20', how: 'implied', weight: 'major' },
    { id: 'Q3', question: 'What is in the ledger book?', opens: '05:50', weight: 'minor' },
  ], weRuntime);
  const shortDoc = formFor('short_doc');
  const { result: weResult } = checkTells({ scenes: weScenes, questions: weQuestions, runtime: weRuntime, form: shortDoc });

  // ---- no_question_open: scenes 3-5, 01:25 to 05:35, 4:10 exposed --------
  {
    const t = weResult.tells.no_question_open;
    assert.equal(t.tripped, true);
    assert.equal(t.information_only_scene_runs.length, 1);
    const run = t.information_only_scene_runs[0];
    assert.equal(run.from, '01:25');
    assert.equal(run.to, '05:35');
    assert.equal(run.scenes, '3–5');
    assert.equal(run.duration_seconds, 250, '335 - 85 = 250 seconds = 4:10, exactly as the doc states');
    assert.equal(run.consecutive_information_only_scenes, 3);
    // The Q&A ledger itself covers the whole film with no 90s+ gap (Q1 spans
    // 00:15-09:45 and Q3 is still open at the end), so the ledger-coverage
    // path must find nothing — only the information_only-flag path trips
    // this tell, exactly as the doc's own "how to check it" describes.
    assert.deepEqual(t.stretches_with_nothing_open, []);
  }
  ok('checkTells.no_question_open: scenes 3-5 (01:25-05:35, 4:10 exposed) trip the tell via the information_only flags, matching the worked example exactly; the ledger-coverage path correctly finds no separate gap');

  // ---- stakes_not_personalised: same scenes 3-5, 4:10 ---------------------
  {
    const t = weResult.tells.stakes_not_personalised;
    assert.equal(t.tripped, true);
    assert.equal(t.stretches.length, 1);
    assert.equal(t.stretches[0].from, '01:25');
    assert.equal(t.stretches[0].to, '05:35');
    assert.equal(t.stretches[0].duration_seconds, 250);
  }
  ok('checkTells.stakes_not_personalised trips on the same scenes 3-5 span the worked example describes');

  // ---- tonal_monotony: delegates to arc.js's monotonyStretches -----------
  {
    assert.equal(weResult.tells.tonal_monotony.tripped, true);
    assert.equal(weResult.tells.tonal_monotony.stretches.length, 2, 'see arc.test.mjs for the full hand-trace of these two overlapping windows');
  }
  ok('checkTells.tonal_monotony is tripped and matches arc.js\'s own monotonyStretches output for the worked example');

  // ---- premature_resolution: Q1 closes at 585/700 = 0.8357 -> 0.84, inside
  // the short_doc window [0.70, 0.85] -> NOT tripped, as the doc states ----
  {
    const t = weResult.tells.premature_resolution;
    assert.equal(t.central_question, 'Q1');
    assert.equal(t.closes_at, '09:45');
    assert.equal(t.close_ratio, 0.84, '585/700 = 0.835714... which rounds to 0.84, matching the doc\'s stated ratio');
    assert.equal(t.tripped, false, 'ratio 0.84 sits inside the short_doc central-close window of 0.70-0.85, so this must not trip — "No premature resolution" per the doc');
    assert.equal(t.late_close_note, undefined, '0.84 does not exceed the window\'s 0.85 upper bound');
  }
  ok('checkTells.premature_resolution computes ratio 0.84 for Q1 and correctly does not trip against the short_doc 0.70-0.85 window, matching the doc\'s "No premature resolution"');

  // ---- texture_starvation: scene 7, 1:50 unbroken > short_doc's 30s limit
  {
    const t = weResult.tells.texture_starvation;
    assert.equal(t.tripped, true);
    assert.equal(t.limit_seconds, 30);
    assert.equal(t.blocks.length, 1);
    assert.equal(t.blocks[0].scene, 7);
    assert.equal(t.blocks[0].timecode, '06:20');
    assert.equal(t.blocks[0].unbroken_talking_head, '01:50');
  }
  ok('checkTells.texture_starvation trips on scene 7\'s 1:50 unbroken block against the short_doc 30-second limit, matching the worked example');

  // ---- ledger findings: Q3 never closes (Minor, "often fine") ------------
  {
    assert.equal(weResult.ledger_findings.length, 1);
    assert.equal(weResult.ledger_findings[0].question, 'Q3');
    assert.equal(weResult.ledger_findings[0].finding, 'open_at_end_credits');
    assert.match(weResult.ledger_findings[0].reading, /often fine/);
  }
  ok('checkTells.ledger_findings flags only Q3 (never closed, Minor) and reads it as "often fine", not as a defect — no other ledger finding fires on the worked example');

  // ---- overlaps: no_question_open + tonal_monotony is priority 2, texture
  // starvation alone is priority 5 (lowest) -- hand-traced in full in
  // arc-scoring reasoning; see the long comment in the source for the
  // interval-merge trace that produced these two exact groups.
  {
    const groups = weResult.overlaps.stretches;
    assert.equal(groups.length, 2);
    assert.equal(groups[0].from, '00:00');
    assert.equal(groups[0].to, '06:20');
    assert.equal(groups[0].priority, 2);
    assert.deepEqual([...groups[0].causes].sort(), ['no_question_open', 'stakes_not_personalised', 'tonal_monotony']);
    assert.equal(groups[1].from, '06:20');
    assert.equal(groups[1].to, '08:10');
    assert.equal(groups[1].priority, 5);
    assert.deepEqual(groups[1].causes, ['texture_starvation']);
    // total_exposed_runtime is the union of [0,380] and [380,490] = 490s.
    assert.equal(weResult.total_exposed_runtime, '08:10');
  }
  ok('checkTells.overlaps merges the worked example\'s tripped stretches into two groups (00:00-06:20 at priority 2, three causes; 06:20-08:10 at priority 5, texture alone) and total_exposed_runtime sums their 490-second union correctly');

  // =========================================================================
  // Boundary tests, each isolated from the worked example and hand-verified
  // against the exact operator the reference docs describe.
  // =========================================================================

  const minimalScenes = (n, extra = {}) => normaliseScenes(
    Array.from({ length: Math.max(n, 2) }, (_, i) => ({ timecode: String(i * 100), valence: 0, intensity: 0, ...extra })),
  ).scenes;

  // ---- no_question_scene_run boundary: exactly 3 consecutive info-only
  // scenes trips it, 2 does not (BASELINES.no_question_scene_run = 3) -----
  {
    const scenes = [true, true, true, false].map((info, i) => ({ timecode: String(i * 100), valence: 0, intensity: 0, information_only: info }));
    const { scenes: norm, runtime } = normaliseScenes(scenes, { totalRuntime: '500' });
    const { result } = checkTells({ scenes: norm, questions: [], runtime, form: null });
    assert.equal(result.tells.no_question_open.information_only_scene_runs.length, 1, 'exactly 3 consecutive information_only scenes must trip the tell');
    assert.equal(result.tells.no_question_open.information_only_scene_runs[0].consecutive_information_only_scenes, 3);
  }
  {
    const scenes = [true, true, false, false].map((info, i) => ({ timecode: String(i * 100), valence: 0, intensity: 0, information_only: info }));
    const { scenes: norm, runtime } = normaliseScenes(scenes, { totalRuntime: '500' });
    const { result } = checkTells({ scenes: norm, questions: [], runtime, form: null });
    assert.deepEqual(result.tells.no_question_open.information_only_scene_runs, [], 'only 2 consecutive information_only scenes must not trip the tell — the documented threshold is 3 in a row');
  }
  ok('no_question_scene_run boundary: exactly 3 consecutive information-only scenes trips the tell, 2 does not');

  // ---- no_question_stretch_seconds (ledger gap) boundary: >=90 trips, <90
  // does not (uncoveredStretches uses `from - coveredTo >= minimumSeconds`) -
  {
    // A single question open [0,10], runtime 100: the gap from 10 to 100 is
    // 90 seconds exactly.
    const q = normaliseQuestions([{ opens: '0', closes: '10', how: 'on_screen', weight: 'minor' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: null });
    assert.equal(result.tells.no_question_open.stretches_with_nothing_open.length, 1, 'a 90-second uncovered gap must trip the tell — the code uses >=');
    assert.equal(result.tells.no_question_open.stretches_with_nothing_open[0].duration_seconds, 90);
  }
  {
    const q = normaliseQuestions([{ opens: '0', closes: '11', how: 'on_screen', weight: 'minor' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: null });
    assert.deepEqual(result.tells.no_question_open.stretches_with_nothing_open, [], 'an 89-second uncovered gap must not trip the tell');
  }
  ok('no_question_stretch_seconds (ledger gap) boundary: a gap of exactly 90 seconds trips the tell (>=), 89 seconds does not');

  // ---- stakes_stretch_seconds boundary: STRICTLY greater than 90 trips it,
  // exactly 90 does NOT (the code uses `duration_seconds > BASELINES...`,
  // matching dropoff-causes.md's "over 90 seconds" wording exactly — a
  // different operator than the no_question_stretch gap check above, which
  // is intentional and worth telling apart explicitly). --------------------
  {
    const scenes = normaliseScenes([
      { timecode: '0', valence: 0, intensity: 0, person_with_want: false },
      { timecode: '90', valence: 0, intensity: 0, person_with_want: true },
    ], { totalRuntime: '90' }).scenes;
    const { result } = checkTells({ scenes, questions: [], runtime: 90, form: null });
    assert.deepEqual(result.tells.stakes_not_personalised.stretches, [], 'a stakes stretch of exactly 90 seconds must NOT trip — the documented rule is "over" 90 seconds, strictly');
  }
  {
    const scenes = normaliseScenes([
      { timecode: '0', valence: 0, intensity: 0, person_with_want: false },
      { timecode: '91', valence: 0, intensity: 0, person_with_want: true },
    ], { totalRuntime: '91' }).scenes;
    const { result } = checkTells({ scenes, questions: [], runtime: 91, form: null });
    assert.equal(result.tells.stakes_not_personalised.stretches.length, 1, 'a stakes stretch of 91 seconds (strictly over 90) must trip');
  }
  ok('stakes_stretch_seconds boundary: a stretch of exactly 90 seconds does not trip (strict >), 91 seconds does — distinct from the no-question gap\'s inclusive >= at the same 90-second baseline');

  // ---- stakes: not checkable when no scene carries the flag ---------------
  {
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: [], runtime: 200, form: null });
    assert.equal(result.tells.stakes_not_personalised.tripped, null, 'with no person_with_want flag on any scene, this must read as not-checkable (null), not false');
  }
  ok('stakes_not_personalised reports tripped: null (not checkable) rather than false when no scene carries the person_with_want flag');

  // ---- premature_resolution: generic baseline (2/3 = 0.6667) boundary,
  // using the doc's own "Below 0.66" phrasing: ratio 0.66 trips, 0.67 does
  // not (the ratio is rounded to 2dp before comparison, so this is the real
  // effective boundary, not 0.6667 itself) -----------------------------------
  {
    const q = normaliseQuestions([{ opens: '0', closes: '66', how: 'on_screen', weight: 'central' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: null });
    assert.equal(result.tells.premature_resolution.close_ratio, 0.66);
    assert.equal(result.tells.premature_resolution.tripped, true, 'ratio 0.66 is "below 0.66"\'s threshold once compared to the true 2/3 baseline (0.66 < 0.6667)');
  }
  {
    const q = normaliseQuestions([{ opens: '0', closes: '67', how: 'on_screen', weight: 'central' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: null });
    assert.equal(result.tells.premature_resolution.close_ratio, 0.67);
    assert.equal(result.tells.premature_resolution.tripped, false, 'ratio 0.67 must not trip — 0.67 is not below 2/3 (0.6667)');
  }
  ok('premature_resolution generic-baseline boundary: close ratio 0.66 trips, 0.67 does not, matching dropoff-causes.md\'s "Below 0.66" against the true 2/3 threshold');

  // ---- premature_resolution: "most_urgent" boundary is STRICTLY below 0.5
  {
    const q = normaliseQuestions([{ opens: '0', closes: '50', how: 'on_screen', weight: 'central' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: null });
    assert.equal(result.tells.premature_resolution.close_ratio, 0.5);
    assert.equal(result.tells.premature_resolution.tripped, true);
    assert.equal(result.tells.premature_resolution.most_urgent, undefined, 'ratio exactly 0.5 must NOT be flagged most_urgent — the doc says "Below 0.5", strictly');
  }
  {
    const q = normaliseQuestions([{ opens: '0', closes: '49', how: 'on_screen', weight: 'central' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: null });
    assert.equal(result.tells.premature_resolution.close_ratio, 0.49);
    assert.equal(result.tells.premature_resolution.most_urgent, true, 'ratio 0.49 is strictly below 0.5 and must be flagged most_urgent');
  }
  ok('premature_resolution most_urgent boundary: ratio exactly 0.5 is tripped but not most_urgent, 0.49 is both — matching the doc\'s "Below 0.5" strict wording');

  // ---- premature_resolution: form-specific window boundary (short_doc
  // earliest=0.70). This is the assertion the revert-and-check below targets.
  {
    const q = normaliseQuestions([{ opens: '0', closes: '70', how: 'on_screen', weight: 'central' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: shortDoc });
    assert.equal(result.tells.premature_resolution.close_ratio, 0.70);
    assert.equal(result.tells.premature_resolution.tripped, false, 'ratio exactly 0.70 must NOT trip against short_doc\'s window (earliest 0.70) — the comparison is strict <');
  }
  {
    const q = normaliseQuestions([{ opens: '0', closes: '69', how: 'on_screen', weight: 'central' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: shortDoc });
    assert.equal(result.tells.premature_resolution.tripped, true, 'ratio 0.69 must trip against short_doc\'s 0.70 earliest bound');
  }
  ok('premature_resolution form-window boundary: ratio exactly at short_doc\'s 0.70 earliest bound does not trip, 0.69 does (strict <)');

  // ---- premature_resolution: late_close_note boundary at the window's
  // latest bound (short_doc 0.85) -- strict > --------------------------------
  {
    const q = normaliseQuestions([{ opens: '0', closes: '85', how: 'on_screen', weight: 'central' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: shortDoc });
    assert.equal(result.tells.premature_resolution.late_close_note, undefined, 'ratio exactly 0.85 (the latest bound itself) must not trigger the late-close note');
  }
  {
    const q = normaliseQuestions([{ opens: '0', closes: '86', how: 'on_screen', weight: 'central' }], 100);
    const scenes = minimalScenes(2);
    const { result } = checkTells({ scenes, questions: q, runtime: 100, form: shortDoc });
    assert.match(result.tells.premature_resolution.late_close_note, /0.85 upper bound/, 'ratio 0.86 (past the latest bound) must trigger the late-close note');
  }
  ok('premature_resolution late_close_note boundary: ratio exactly at the 0.85 latest bound does not warn, 0.86 does');

  // ---- premature_resolution: zero or two-plus central questions ----------
  {
    const q0 = normaliseQuestions([{ opens: '0', closes: '10', how: 'on_screen', weight: 'major' }], 100);
    const r0 = checkTells({ scenes: minimalScenes(2), questions: q0, runtime: 100, form: null }).result;
    assert.equal(r0.tells.premature_resolution.tripped, null);
    assert.equal(r0.tells.premature_resolution.central_question_count, 0);

    const q2 = normaliseQuestions([
      { opens: '0', closes: '10', how: 'on_screen', weight: 'central' },
      { opens: '5', closes: '20', how: 'on_screen', weight: 'central' },
    ], 100);
    const r2 = checkTells({ scenes: minimalScenes(2), questions: q2, runtime: 100, form: null }).result;
    assert.equal(r2.tells.premature_resolution.tripped, null);
    assert.equal(r2.tells.premature_resolution.central_question_count, 2);
  }
  ok('premature_resolution reports tripped: null (uncheckable) with the actual central_question_count when there are zero or two-plus Central questions, rather than picking one arbitrarily');

  // ---- premature_resolution: a Central question that never closes is the
  // opposite flag, not premature resolution ----------------------------------
  {
    const q = normaliseQuestions([{ opens: '0', weight: 'central' }], 100);
    const r = checkTells({ scenes: minimalScenes(2), questions: q, runtime: 100, form: null }).result;
    assert.equal(r.tells.premature_resolution.tripped, false);
    assert.match(r.tells.premature_resolution.note, /opposite flag/);
  }
  ok('a never-closing Central question is reported as tripped: false with the "opposite flag" note, not as premature resolution');

  // ---- texture_starvation boundary: strictly greater than the limit ------
  {
    const atLimit = normaliseScenes([
      { timecode: '0', valence: 0, intensity: 0, longest_talking_head_seconds: '40' },
      { timecode: '100', valence: 0, intensity: 0 },
    ], { totalRuntime: '200' }).scenes;
    const r1 = checkTells({ scenes: atLimit, questions: [], runtime: 200, form: null }).result;
    assert.deepEqual(r1.tells.texture_starvation.blocks, [], 'a talking-head block of exactly 40 seconds (the generic baseline) must not trip — the code uses strict >, matching "beyond 40 seconds"');

    const overLimit = normaliseScenes([
      { timecode: '0', valence: 0, intensity: 0, longest_talking_head_seconds: '41' },
      { timecode: '100', valence: 0, intensity: 0 },
    ], { totalRuntime: '200' }).scenes;
    const r2 = checkTells({ scenes: overLimit, questions: [], runtime: 200, form: null }).result;
    assert.equal(r2.tells.texture_starvation.blocks.length, 1, 'a talking-head block of 41 seconds must trip');
  }
  ok('texture_starvation boundary: a block of exactly the 40-second generic limit does not trip, 41 seconds does — matching "beyond 40 seconds"');

  // ---- ledger: more_than_four_open boundary is STRICTLY more than 4 ------
  const questionsOpenAt = (n, overlapMore) => Array.from({ length: n }, (_, i) => ({ id: `Q${i}`, opens: '0', closes: String(100 + i), how: 'on_screen', weight: 'minor' }));
  {
    const q4 = normaliseQuestions(questionsOpenAt(4), 200);
    const r4 = checkTells({ scenes: minimalScenes(2), questions: q4, runtime: 200, form: null }).result;
    assert.deepEqual(r4.ledger_findings.filter((f) => f.finding === 'more_than_four_open'), [], 'exactly 4 questions open at once must not trip the overload finding — the rule is "more than four"');

    const q5 = normaliseQuestions(questionsOpenAt(5), 200);
    const r5 = checkTells({ scenes: minimalScenes(2), questions: q5, runtime: 200, form: null }).result;
    assert.equal(r5.ledger_findings.filter((f) => f.finding === 'more_than_four_open').length, 1, '5 questions open at once must trip the overload finding');
  }
  ok('ledger more_than_four_open boundary: exactly 4 simultaneously open questions does not trip, 5 does');

  // ---- ledger: closed_off_screen is always flagged ------------------------
  {
    const q = normaliseQuestions([{ opens: '0', closes: '10', how: 'off_screen', weight: 'major' }], 100);
    const r = checkTells({ scenes: minimalScenes(2), questions: q, runtime: 100, form: null }).result;
    const finding = r.ledger_findings.find((f) => f.finding === 'closed_off_screen');
    assert.ok(finding, 'a question closed off-screen must be flagged');
    assert.match(finding.reading, /plot hole/);
  }
  ok('ledger closed_off_screen finding fires for a question marked how: off_screen, with the "reads as a plot hole" reading');

  // ---- input validation: normaliseQuestions ---------------------------------
  {
    assert.ok(throws(() => normaliseQuestions([{ opens: 'garbage' }], 100), 'invalid_question'));
    assert.ok(throws(() => normaliseQuestions([{ opens: '0', closes: 'garbage' }], 100), 'invalid_question'));
    assert.ok(throws(() => normaliseQuestions([{ opens: '0', weight: 'huge' }], 100), 'invalid_question'));
    assert.ok(throws(() => normaliseQuestions([{ opens: '0', how: 'sideways' }], 100), 'invalid_question'));
    assert.equal(normaliseQuestions(null, 100).length, 0, 'a non-array input degrades to no questions rather than throwing');
    assert.equal(normaliseQuestions([{ opens: '0' }], 100)[0].weight, 'minor', 'weight defaults to minor when omitted');
  }
  ok('normaliseQuestions rejects an unreadable opens/closes timecode and an invalid weight/how value, defaults weight to minor, and treats a non-array input as empty');

  console.log(`\n${passed} tells.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
