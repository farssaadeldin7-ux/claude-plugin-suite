#!/usr/bin/env node
/**
 * Regression tests for lib/lint.js: the mechanical format checks on a
 * drafted sheet (fixed sections, three changes, five-word triggers, a
 * ten-minute drill cap, a numbered success check, a three-line cut list).
 *
 * The first check runs the *actual* worked sheet from the "The sheet:"
 * block in references/cheat-sheet-template.md through lintSheet() and
 * requires zero findings — that worked example is presented in the doc as
 * a correct, sendable sheet, so the lint must agree with the doc's own
 * verdict on it. Every other check targets one threshold at its exact
 * boundary (the value the rule allows, and the next value that breaks it),
 * built from small hand-written sheets rather than the doc's example,
 * since the doc's worked sheet stays within every limit and so cannot
 * exercise the "over the line" side of any of them.
 *
 *   node plugins/five-minute-fluency/mcp/test/lint.test.mjs
 */
import assert from 'node:assert/strict';
import { lintSheet } from '../lib/lint.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const findingChecks = (result) => result.findings.map((f) => f.check);

// A minimal sheet that satisfies every rule lintSheet checks, so each test
// below can flip exactly one thing away from a known-clean baseline.
function baseSheet({
  changes = ['1. Change one.\n   Trigger: "Do this now"\n   Why: because.',
    '2. Change two.\n   Trigger: "Check that"\n   Why: because.',
    '3. Change three.\n   Trigger: "Ask this"\n   Why: because.'],
  stopDoing = 'Stop doing X.\nTrigger: "Stop it"',
  drillHeading = 'Drill — 10 minutes',
  drillBody = 'Do the drill.',
  successCheck = 'Pass if fewer than 4 mistakes.',
  cutList = 'Cut: item one — reason one.\nitem two — reason two.',
  includeStopDoing = true,
  includeDrillSection = true,
  includeSuccessSection = true,
} = {}) {
  const sections = [
    `## Situation\nTest player, gold rank.\nDiagnosis: test cause.\nPatch: test.`,
    `## Three changes\n\n${changes.join('\n\n')}`,
  ];
  if (includeStopDoing) sections.push(`## One thing to stop doing\n${stopDoing}`);
  if (includeDrillSection) sections.push(`## ${drillHeading}\n${drillBody}`);
  if (includeSuccessSection) sections.push(`## Success check — next session\n${successCheck}`);
  return `${sections.join('\n\n')}\n\n${cutList}`;
}

try {
  // ---- the worked example in references/cheat-sheet-template.md lints clean ----
  {
    const sheet = `## Situation
Tactical FPS, mid ranked, entry-ish role. Aim is not the problem — duels are being won.
Diagnosis: you are taking first contact where nobody can trade you, so winning half your
duels still loses the round.
Patch: current season per your report — no numbers on this sheet need verifying.

## Three changes

1. Before any first contact, find the teammate who can trade you within two seconds.
   No trade partner, no contact — wait or reposition.
   Trigger: "Who trades me?"
   Why: turns a 50/50 duel from a coin flip on the round into a guaranteed even trade.

2. One piece of utility into the space before you step into it. Every time, even when
   the space looks empty.
   Trigger: "Nade first, feet second"
   Why: cheap information, and it delays the duel until your team has caught up.

3. Say the entry out loud a beat before you make it, so the trade is arranged rather
   than hoped for.
   Trigger: "Say it, then go"
   Why: a trade only happens if someone is already looking at your fight.

## One thing to stop doing
Stop re-peeking the same angle after a trade goes badly. That second peek is the death
that ends the round.
Trigger: "Once only"

## Drill — 6 minutes
Load one map you play often. Walk the two most common entry routes and, at each first
contact point, stop and name out loud where your trade partner would have to stand.
Six positions, no shooting.

## Success check — next session
Count untraded deaths. Under 4 across the session is a pass. Anything you die to with a
teammate within two seconds of you does not count.

Cut: crosshair placement drill — real, but Cost 5, and it is not what is killing you.
Off-angles — matchup-narrow. Next session: retake role on eco rounds (Yield 3.0).`;

    const result = lintSheet(sheet);
    assert.deepEqual(result.findings, [], `expected no findings, got: ${JSON.stringify(result.findings)}`);
    assert.equal(result.counts.sections_found, 5);
    assert.equal(result.counts.changes, 3);
    assert.equal(result.counts.trigger_phrases, 4, '3 change triggers + 1 stop-doing trigger');
    assert.equal(result.counts.verify_markers, 0);
    assert.equal(result.counts.cut_list_lines, 2);
  }
  ok('lintSheet finds zero problems in the actual worked sheet from references/cheat-sheet-template.md, agreeing with the doc\'s own presentation of it as correct');

  // ---- baseline: the hand-built minimal sheet also lints clean ------------
  {
    const result = lintSheet(baseSheet());
    assert.deepEqual(result.findings, []);
  }
  ok('the hand-built baseline sheet (used as the starting point for every boundary test below) itself lints clean');

  // ---- missing_section: a fixed section absent entirely -------------------
  {
    const result = lintSheet(baseSheet({ includeStopDoing: false }));
    assert.ok(findingChecks(result).includes('missing_section'));
    const finding = result.findings.find((f) => f.check === 'missing_section');
    assert.match(finding.evidence, /One thing to stop doing/);
  }
  ok('lintSheet flags missing_section when one of the five fixed sections is absent');

  // ---- unknown_section: a heading outside the fixed five -------------------
  {
    const withExtra = baseSheet().replace('## Situation', '## Extra Notes\nSomething irrelevant.\n\n## Situation');
    const result = lintSheet(withExtra);
    assert.ok(findingChecks(result).includes('unknown_section'));
  }
  ok('lintSheet flags unknown_section for a heading that is not one of the five fixed sections');

  // ---- sections_out_of_order: fixed sections present but reordered --------
  {
    const base = baseSheet();
    // Swap "Three changes" and "One thing to stop doing" by locating their
    // headings — pull the whole "Three changes" block out and reinsert it
    // after the stop-doing block.
    const situationEnd = base.indexOf('## Three changes');
    const stopDoingStart = base.indexOf('## One thing to stop doing');
    const drillStart = base.indexOf('## Drill');
    const situation = base.slice(0, situationEnd);
    const threeChanges = base.slice(situationEnd, stopDoingStart);
    const stopDoing = base.slice(stopDoingStart, drillStart);
    const rest = base.slice(drillStart);
    const reordered = situation + stopDoing + threeChanges + rest;

    const result = lintSheet(reordered);
    assert.ok(findingChecks(result).includes('sections_out_of_order'));
  }
  ok('lintSheet flags sections_out_of_order when all five fixed sections are present but not in Situation/Three changes/Stop doing/Drill/Success check order');

  // ---- change_count: exactly 3 is clean; 4 (the core "never four" rule) and 2 both flag ----
  {
    const four = lintSheet(baseSheet({
      changes: ['1. Change one.\n   Trigger: "Do this now"\n   Why: because.',
        '2. Change two.\n   Trigger: "Check that"\n   Why: because.',
        '3. Change three.\n   Trigger: "Ask this"\n   Why: because.',
        '4. Change four.\n   Trigger: "Also this"\n   Why: because.'],
    }));
    const fourFinding = four.findings.find((f) => f.check === 'change_count');
    assert.ok(fourFinding, 'a fourth numbered change must be flagged — this is the skill\'s one hard rule');
    assert.equal(fourFinding.evidence, '4 numbered changes');
    assert.match(fourFinding.rule, /Never four/);

    const two = lintSheet(baseSheet({
      changes: ['1. Change one.\n   Trigger: "Do this now"\n   Why: because.',
        '2. Change two.\n   Trigger: "Check that"\n   Why: because.'],
    }));
    const twoFinding = two.findings.find((f) => f.check === 'change_count');
    assert.ok(twoFinding, 'only two numbered changes must also be flagged, not silently accepted');
    assert.equal(twoFinding.evidence, '2 numbered changes');
  }
  ok('lintSheet flags change_count on both sides of the boundary: a fourth change (with the "never four" rule text) and a missing third change');

  // ---- trigger_too_long: exactly 5 words is clean, 6 words flags -----------
  {
    const atFive = lintSheet(baseSheet({
      changes: ['1. Change one.\n   Trigger: "One two three four five"\n   Why: because.',
        '2. Change two.\n   Trigger: "Check that"\n   Why: because.',
        '3. Change three.\n   Trigger: "Ask this"\n   Why: because.'],
    }));
    assert.ok(!findingChecks(atFive).includes('trigger_too_long'), 'a 5-word trigger is documented as the upper limit, not a violation');

    const atSix = lintSheet(baseSheet({
      changes: ['1. Change one.\n   Trigger: "One two three four five six"\n   Why: because.',
        '2. Change two.\n   Trigger: "Check that"\n   Why: because.',
        '3. Change three.\n   Trigger: "Ask this"\n   Why: because.'],
    }));
    const finding = atSix.findings.find((f) => f.check === 'trigger_too_long');
    assert.ok(finding, 'a 6-word trigger must be flagged as too long');
    assert.match(finding.evidence, /6 words/);
  }
  ok('lintSheet places the trigger-length boundary at exactly 5 words: 5 is clean, 6 is trigger_too_long');

  // ---- missing_trigger: a change without its own Trigger line -------------
  {
    const result = lintSheet(baseSheet({
      changes: ['1. Change one.\n   Why: because.', // no Trigger line
        '2. Change two.\n   Trigger: "Check that"\n   Why: because.',
        '3. Change three.\n   Trigger: "Ask this"\n   Why: because.'],
    }));
    const finding = result.findings.find((f) => f.check === 'missing_trigger');
    assert.ok(finding, 'three changes plus a stop-doing item expect 4 triggers; only 3 are present here');
    assert.equal(finding.evidence, '3 of 4 Trigger lines found');
  }
  ok('lintSheet flags missing_trigger when fewer Trigger lines are present than changes-plus-stop-doing requires');

  // ---- drill minutes: exactly 10 is clean, 11 flags, and a missing count flags ----
  {
    const atTen = lintSheet(baseSheet({ drillHeading: 'Drill — 10 minutes' }));
    assert.ok(!findingChecks(atTen).includes('drill_over_ten_minutes'), 'exactly 10 minutes is documented as "under 10 minutes" territory, not a violation');

    const atEleven = lintSheet(baseSheet({ drillHeading: 'Drill — 11 minutes' }));
    assert.ok(findingChecks(atEleven).includes('drill_over_ten_minutes'), '11 minutes must be flagged as over the ten-minute cap');

    const noMinutes = lintSheet(baseSheet({ drillHeading: 'Drill' }));
    assert.ok(findingChecks(noMinutes).includes('drill_minutes_missing'), 'a drill heading with no stated minute count must be flagged');
  }
  ok('lintSheet places the drill-length boundary at exactly 10 minutes: 10 is clean, 11 is drill_over_ten_minutes, and an unstated length is drill_minutes_missing');

  // ---- success_check_has_no_number -----------------------------------------
  {
    const withNumber = lintSheet(baseSheet({ successCheck: 'Fewer than 4 deaths.' }));
    assert.ok(!findingChecks(withNumber).includes('success_check_has_no_number'));

    const withoutNumber = lintSheet(baseSheet({ successCheck: 'Felt more confident.' }));
    assert.ok(findingChecks(withoutNumber).includes('success_check_has_no_number'),
      'a success check with no digit at all must be flagged, echoing the "Felt more confident" not-countable example from template.js');
  }
  ok('lintSheet flags success_check_has_no_number exactly when the Success check section body contains no digit');

  // ---- cut list: no_cut_list, and the 3-line boundary ----------------------
  {
    const noCut = lintSheet(baseSheet({ cutList: '' }));
    assert.ok(findingChecks(noCut).includes('no_cut_list'), 'a sheet with no "Cut:" line at all must be flagged');

    const threeLines = lintSheet(baseSheet({ cutList: 'Cut: item one — reason.\nitem two — reason.\nitem three — reason.' }));
    assert.ok(!findingChecks(threeLines).includes('cut_list_too_long'), 'exactly three lines is the documented maximum, not a violation');

    const fourLines = lintSheet(baseSheet({ cutList: 'Cut: item one — reason.\nitem two — reason.\nitem three — reason.\nitem four — reason.' }));
    const finding = fourLines.findings.find((f) => f.check === 'cut_list_too_long');
    assert.ok(finding, 'a fourth cut-list line must be flagged as too long');
    assert.equal(finding.evidence, '4 lines');
  }
  ok('lintSheet flags no_cut_list when the sheet has no Cut: line, and places the length boundary at exactly 3 lines (clean) vs 4 (cut_list_too_long)');

  console.log(`\n${passed} lint.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
