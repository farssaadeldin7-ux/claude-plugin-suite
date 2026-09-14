#!/usr/bin/env node
/**
 * Regression tests for lib/yield.js.
 *
 *   node plugins/five-minute-fluency/mcp/test/yield.test.mjs
 */
import assert from 'node:assert/strict';
import { scoreChanges, candidateProblems } from '../lib/yield.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- scoreChanges: the worked example from references/cheat-sheet-template.md ----
  // The "Candidate changes, scored" table in the worked example. Each yield
  // hand-verified here against Yield = Impact x Transfer / Cost before being
  // encoded, independently of the doc's own "Yield" column:
  //   7.5 = 5x3/2, 6.0 = 4x3/2, 4.0 = 4x3/3, 3.0 = 3x2/2,
  //   1.2 = 3x2/5, 1.8 = 3x3/5, 1.3 = round1(2x2/3 = 1.333...).
  // The doc's own "Verdict" column ("In" / "Candidate" / "Cut") turns out to
  // encode something narrower than the code's per-candidate `verdict` field:
  // "In" = sheet_candidate AND selected onto the final three; "Candidate" =
  // sheet_candidate but crowded out of the top three by higher yields (the
  // eco-round retake, yield exactly 3.0 — the >=3 boundary); "Cut" covers
  // both genuinely-below-1.5 items (1.2) AND the crosshair drill at 1.8,
  // which is in the 1.5-to-3.0 fill_only band by the threshold table but
  // never gets pulled in because the top three are already full of
  // sheet_candidate items with no unfilled slot left. That is a doc
  // simplification (the human-facing sheet just calls anything that did not
  // make the final three "cut"), not a code bug: the per-candidate verdict
  // for that item is asserted as 'fill_only' below, exactly as the threshold
  // table states, while it still lands in cut_list because no slot was open.
  {
    const result = scoreChanges([
      { change: 'Never take first contact without a trade partner within ~2s', impact: 5, transfer: 3, cost: 2 },
      { change: 'Throw one piece of utility before entering, every time', impact: 4, transfer: 3, cost: 2 },
      { change: 'Call the death before it happens', impact: 4, transfer: 3, cost: 3 },
      { change: 'Play the retake rather than the entry on eco rounds', impact: 3, transfer: 2, cost: 2 },
      { change: 'Learn the off-angle spots on each map', impact: 3, transfer: 2, cost: 5 },
      { change: 'Crosshair placement drill, 15 min daily', impact: 3, transfer: 3, cost: 5 },
      { change: 'Tighten the buy discipline on force rounds', impact: 2, transfer: 2, cost: 3 },
    ]);

    assert.equal(result.scored.length, 7);
    const byChange = Object.fromEntries(result.scored.map((c) => [c.change, c]));
    assert.equal(byChange['Never take first contact without a trade partner within ~2s'].yield, 7.5);
    assert.equal(byChange['Throw one piece of utility before entering, every time'].yield, 6.0);
    assert.equal(byChange['Call the death before it happens'].yield, 4.0);
    assert.equal(byChange['Play the retake rather than the entry on eco rounds'].yield, 3.0);
    assert.equal(byChange['Learn the off-angle spots on each map'].yield, 1.2);
    assert.equal(byChange['Crosshair placement drill, 15 min daily'].yield, 1.8);
    assert.equal(byChange['Tighten the buy discipline on force rounds'].yield, 1.3);

    assert.equal(byChange['Play the retake rather than the entry on eco rounds'].verdict, 'sheet_candidate',
      'the eco-round retake sits exactly on the 3.0 sheet_candidate boundary, matching the doc\'s "Candidate" (not "Cut") label');
    assert.equal(byChange['Crosshair placement drill, 15 min daily'].verdict, 'fill_only',
      'yield 1.8 is in the 1.5-to-3.0 band per the threshold table, even though the doc\'s narrative cut list calls it "Cut" because no slot was open for it');
    assert.equal(byChange['Learn the off-angle spots on each map'].verdict, 'cut');
    assert.equal(byChange['Tighten the buy discipline on force rounds'].verdict, 'cut');

    // Top three: the highest three sheet_candidate yields fill every slot,
    // so the fill_only band (1.8) never gets a chance to contribute.
    assert.deepEqual(result.top_three.map((c) => c.change), [
      'Never take first contact without a trade partner within ~2s',
      'Throw one piece of utility before entering, every time',
      'Call the death before it happens',
    ]);
    assert.deepEqual(result.top_three.map((c) => c.verdict), ['sheet_candidate', 'sheet_candidate', 'sheet_candidate']);

    // Costs on the selected three are 2, 2, 3 — no Cost 4/5 item at all, and
    // at least one Cost <=2 item, so neither hard constraint is triggered.
    assert.deepEqual(result.constraint_violations, []);

    assert.equal(result.note, undefined, 'three items clear 3.0, so the "nothing scores" note must not appear');
  }
  ok('scoreChanges reproduces the worked "Candidate changes, scored" table in references/cheat-sheet-template.md: all seven yields, each candidate\'s verdict (including the 3.0 sheet_candidate boundary and the 1.8 fill_only-but-crowded-out case), the selected top three, and no constraint violations');

  // ---- verdict boundary: exactly 3.0 is sheet_candidate, just under is fill_only ----
  {
    const at = scoreChanges([{ change: 'x', impact: 3, transfer: 1, cost: 1 }]); // yield = 3.0 exactly
    assert.equal(at.scored[0].verdict, 'sheet_candidate', '3.0 exactly must be sheet_candidate, not fill_only');
    const under = scoreChanges([{ change: 'x', impact: 29, transfer: 1, cost: 10 }]); // yield = 2.9
    assert.equal(under.scored[0].verdict, 'fill_only', '2.9 must be fill_only, not sheet_candidate');
  }
  ok('scoreChanges places the 3.0 sheet_candidate/fill_only boundary on the sheet_candidate side, matching the "3.0 and above" wording in the threshold table');

  // ---- constraint: at most one Cost 4-or-5 change in the selected three ----
  {
    // Two Cost>=4 items among the top three -> violation.
    const violating = scoreChanges([
      { change: 'cheap-yield', impact: 3, transfer: 3, cost: 1 },  // yield 9, cost 1
      { change: 'motor-a', impact: 5, transfer: 3, cost: 4 },      // yield 3.75, cost 4
      { change: 'motor-b', impact: 5, transfer: 3, cost: 5 },      // yield 3.0, cost 5
    ]);
    assert.equal(violating.top_three.length, 3);
    const motorViolation = violating.constraint_violations.find((v) => v.constraint === 'one_motor_skill');
    assert.ok(motorViolation, 'two Cost>=4 items in the selected three must trigger one_motor_skill');
    assert.deepEqual(motorViolation.offending.sort(), ['motor-a', 'motor-b']);

    // Exactly one Cost>=4 item (Cost 3 is not "4 or 5") -> no violation.
    const notViolating = scoreChanges([
      { change: 'cheap-yield', impact: 3, transfer: 3, cost: 1 },  // yield 9, cost 1
      { change: 'mid-cost', impact: 5, transfer: 3, cost: 3 },     // yield 5, cost 3
      { change: 'motor-a', impact: 5, transfer: 3, cost: 4 },      // yield 3.75, cost 4
    ]);
    assert.equal(notViolating.constraint_violations.find((v) => v.constraint === 'one_motor_skill'), undefined,
      'a single Cost-4 item, with Cost 3 (not 4 or 5) alongside it, must not trigger one_motor_skill');
  }
  ok('one_motor_skill fires only once two or more Cost>=4 items land in the selected three, with Cost 3 correctly on the safe side of the 4-or-5 boundary');

  // ---- constraint: at least one Cost 1-or-2 change in the selected three ----
  {
    // All three selected at Cost 3 (none <=2) -> violation.
    const violating = scoreChanges([
      { change: 'a', impact: 5, transfer: 3, cost: 3 }, // yield 5
      { change: 'b', impact: 4, transfer: 3, cost: 3 }, // yield 4
      { change: 'c', impact: 3, transfer: 3, cost: 3 }, // yield 3
    ]);
    const cheapViolation = violating.constraint_violations.find((v) => v.constraint === 'one_cheap');
    assert.ok(cheapViolation, 'no Cost<=2 item among the selected three must trigger one_cheap');
    assert.deepEqual(cheapViolation.offending.sort(), ['a', 'b', 'c']);

    // One Cost-2 item present (Cost 2 counts as cheap) -> no violation.
    const notViolating = scoreChanges([
      { change: 'a', impact: 5, transfer: 3, cost: 3 }, // yield 5
      { change: 'b', impact: 4, transfer: 3, cost: 3 }, // yield 4
      { change: 'c', impact: 3, transfer: 2, cost: 2 }, // yield 3, cost 2
    ]);
    assert.equal(notViolating.constraint_violations.find((v) => v.constraint === 'one_cheap'), undefined,
      'a single Cost-2 item must satisfy one_cheap — Cost 2 is on the cheap side of the 1-or-2 boundary');
  }
  ok('one_cheap fires only when every selected item is Cost>=3, with Cost 2 correctly on the safe (cheap) side of the boundary');

  // ---- tie-breaking: equal yields keep input order ------------------------
  {
    const result = scoreChanges([
      { change: 'first', impact: 4, transfer: 3, cost: 2 },  // yield 6
      { change: 'second', impact: 4, transfer: 3, cost: 2 }, // yield 6, same as first
      { change: 'third', impact: 4, transfer: 3, cost: 2 },  // yield 6, same again
    ]);
    assert.deepEqual(result.top_three.map((c) => c.change), ['first', 'second', 'third'],
      'three equal-yield candidates must keep their original input order, not be reshuffled by an unstable sort');
  }
  ok('scoreChanges keeps input order among candidates that tie exactly on yield, so results are deterministic');

  // ---- candidateProblems: a fully valid candidate has no problems ---------
  {
    assert.deepEqual(candidateProblems({ change: 'x', impact: 3, transfer: 2, cost: 4 }, 0), []);
  }
  ok('candidateProblems reports no problems for a candidate with every field in range');

  // ---- candidateProblems: each scale boundary, both sides ------------------
  {
    const base = { change: 'x', impact: 3, transfer: 2, cost: 3 };
    // impact: 1-5
    assert.deepEqual(candidateProblems({ ...base, impact: 1 }, 0), [], 'impact 1 is the valid lower boundary');
    assert.deepEqual(candidateProblems({ ...base, impact: 5 }, 0), [], 'impact 5 is the valid upper boundary');
    assert.equal(candidateProblems({ ...base, impact: 0 }, 0).length, 1, 'impact 0 is just under the valid range');
    assert.equal(candidateProblems({ ...base, impact: 6 }, 0).length, 1, 'impact 6 is just over the valid range');
    // transfer: 1-3
    assert.deepEqual(candidateProblems({ ...base, transfer: 1 }, 0), [], 'transfer 1 is the valid lower boundary');
    assert.deepEqual(candidateProblems({ ...base, transfer: 3 }, 0), [], 'transfer 3 is the valid upper boundary');
    assert.equal(candidateProblems({ ...base, transfer: 0 }, 0).length, 1, 'transfer 0 is just under the valid range');
    assert.equal(candidateProblems({ ...base, transfer: 4 }, 0).length, 1, 'transfer 4 is just over the valid range');
    // cost: 1-5
    assert.deepEqual(candidateProblems({ ...base, cost: 1 }, 0), [], 'cost 1 is the valid lower boundary');
    assert.deepEqual(candidateProblems({ ...base, cost: 5 }, 0), [], 'cost 5 is the valid upper boundary');
    assert.equal(candidateProblems({ ...base, cost: 0 }, 0).length, 1, 'cost 0 is just under the valid range');
    assert.equal(candidateProblems({ ...base, cost: 6 }, 0).length, 1, 'cost 6 is just over the valid range');
    // non-integer and missing/blank change
    assert.equal(candidateProblems({ ...base, impact: 2.5 }, 0).length, 1, 'a non-integer factor must be rejected');
    assert.equal(candidateProblems({ ...base, change: '   ' }, 0).length, 1, 'a blank change name must be rejected');
    assert.deepEqual(candidateProblems(null, 2), ['candidate 3: not an object']);
  }
  ok('candidateProblems enforces every factor\'s 1-N scale boundary on both sides, and flags non-integers, blank names, and non-object candidates');

  // ---- a selected candidate is never accompanied by "nothing scores" -----
  // Regression test: the note fired whenever every yield was <= 1.5, but
  // the band table (and each candidate's own verdict) treats exactly 1.5 as
  // "fill_only" — usable — not "cut". A candidate scoring exactly 1.5 could
  // be selected onto the sheet in the very same result that told the reader
  // nothing scored well enough for the sheet to matter.
  {
    const result = scoreChanges([{ change: 'x', impact: 3, transfer: 1, cost: 2 }]); // yield = 1.5 exactly
    assert.equal(result.top_three.length, 1);
    assert.equal(result.top_three[0].verdict, 'fill_only');
    assert.equal(result.note, undefined, 'a candidate that was just selected onto the sheet must not be reported alongside "nothing scores above 1.5"');
  }
  ok('a candidate scoring exactly the 1.5 fill-only boundary is selected without a contradictory "nothing scores" note');

  // ---- the note still fires when everything genuinely is a cut -----------
  {
    const result = scoreChanges([{ change: 'x', impact: 1, transfer: 1, cost: 5 }]); // yield = 0.2
    assert.equal(result.top_three.length, 0);
    assert.ok(result.note, 'a log where everything is genuinely below the cut line should still get the note');
  }
  ok('the "nothing scores" note still fires when every candidate is genuinely below 1.5');

  console.log(`\n${passed} yield.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
