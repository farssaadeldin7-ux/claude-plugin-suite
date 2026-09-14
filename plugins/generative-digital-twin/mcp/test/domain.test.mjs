#!/usr/bin/env node
/**
 * Regression tests for generative-digital-twin's domain logic: the
 * corpus-curation mechanical check, the medium taxonomy lookup, the profile
 * fact-counter and local store, and the scoring/drift arithmetic.
 *
 * corpusCheck's worked example is the 20-piece curation printed verbatim in
 * references/corpus-curation.md (also carried in lib/curation.js as
 * WORKED_EXAMPLE) — turning it into an assertion is the point: every count
 * below (near-misses, media spread, date range, median year) was tallied by
 * hand from that same list before being encoded here, so this checks the
 * code against an independently-counted reference, not the code's own math.
 * scoreDraft's hard-fail example uses the exact numbers
 * (mean 3.4, one breach) that references/drift-and-governance.md states in
 * its "do not average it away" sentence.
 *
 *   node plugins/generative-digital-twin/mcp/test/domain.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const { sizeBand, corpusCheck, WORKED_EXAMPLE, MEDIA } = await import('../lib/curation.js');
const { mediumFor, DIMENSIONS } = await import('../lib/dimensions.js');
const {
  meanBand, scoreIsValid, scoreDraft, driftAudit, HARD_FAIL_RULE, FLAT_TWOS_NOTE, REAUDIT,
} = await import('../lib/scoring.js');

// profiles.js creates its store (and resolves the config directory) at
// import time, so XDG_CONFIG_HOME must be set — and profiles.js dynamically
// imported — before that happens, exactly as the professor-mind-reader
// pilot does for its audits.js store. A static import here would be hoisted
// ahead of this assignment regardless of source order.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'generative-digital-twin-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;
const {
  profileFacts, saveProfile, getProfile, listProfiles, NEVER_TARGET, ANCHOR_TARGET,
} = await import('../lib/profiles.js');

const finding = (result, check) => result.findings.find((f) => f.check === check);

try {
  // ============================== curation.js ==============================

  // ---- sizeBand: the four documented bands, both sides of every boundary ----
  {
    assert.equal(sizeBand(9).range, 'under 10');
    assert.equal(sizeBand(10).range, '10-14', '10 is the first count in the 10-14 band, not still "under 10"');
    assert.equal(sizeBand(14).range, '10-14');
    assert.equal(sizeBand(15).range, '15-40', '15 is the first count in the useful 15-40 range, not still 10-14');
    assert.equal(sizeBand(40).range, '15-40');
    assert.equal(sizeBand(41).range, 'over 40', '41 is the first count over the useful range');
  }
  ok('sizeBand places every documented boundary count (9/10, 14/15, 40/41) in its correct band');

  // ---- corpusCheck: the worked 20-piece curation from corpus-curation.md ----
  // Hand-tallied from the doc's own table before writing this assertion:
  // media_spread by counting each medium column (film 7, stills 5, editorial 3,
  // longform 3, identity 1, script 1 = 20); date_range by sorting all 20 years
  // (four 2022s, eight 2023s, eight 2024s) and reading the median index
  // floor((20-1)/2)=9, which falls in the 2023 block. near_misses = 3
  // (verge, chorus, foundry-copy), matching the doc's own "three near-misses"
  // framing. currentYear is pinned to 2024 (the corpus's own latest year) so
  // the staleness check is deterministic rather than depending on today's date.
  {
    const result = corpusCheck(WORKED_EXAMPLE.corpus, { currentYear: 2024 });
    assert.equal(result.pieces, 20);
    assert.equal(result.size_band, '15-40');
    assert.equal(result.near_misses, 3);
    assert.deepEqual(result.date_range, { earliest: 2022, latest: 2024, median: 2023 });
    assert.deepEqual(result.media_spread, {
      film: 7, stills: 5, editorial: 3, longform: 3, identity: 1, script: 1,
    });
    assert.deepEqual(result.findings, [], 'the worked example is presented as clean — fully labelled, schema-valid, no near-miss missing its note, the one heavy-constraint piece (ferrous) carries a contributes list — and must produce no findings');
  }
  ok('corpusCheck reproduces the worked 20-piece curation from references/corpus-curation.md exactly: piece count, size band, near-miss count, date range/median, and media spread, all hand-tallied from the doc\'s own table');

  // ---- corpusCheck: missing/duplicate/out-of-schema fields are flagged -----
  {
    const missingBrief = corpusCheck([{ id: 'x', medium: 'film', year: 2024, landed: 'landed' }], { currentYear: 2024 });
    assert.ok(finding(missingBrief, 'missing_field'), 'a piece missing "brief" must be flagged');

    const dup = corpusCheck([
      { id: 'a', brief: 'b', medium: 'film', year: 2024, landed: 'landed' },
      { id: 'a', brief: 'b', medium: 'film', year: 2024, landed: 'landed' },
    ], { currentYear: 2024 });
    assert.equal(finding(dup, 'duplicate_id')?.evidence, '"a" appears more than once');

    const badMedium = corpusCheck([{ id: 'x', brief: 'b', medium: 'sculpture', year: 2024, landed: 'landed' }], { currentYear: 2024 });
    assert.ok(finding(badMedium, 'medium_outside_schema'));

    const badLanded = corpusCheck([{ id: 'x', brief: 'b', medium: 'film', year: 2024, landed: 'great' }], { currentYear: 2024 });
    assert.ok(finding(badLanded, 'landed_outside_schema'));

    const badConstraints = corpusCheck([{ id: 'x', brief: 'b', medium: 'film', year: 2024, landed: 'landed', constraints: 'medium' }], { currentYear: 2024 });
    assert.ok(finding(badConstraints, 'constraints_outside_schema'));

    const missingNote = corpusCheck([{ id: 'x', brief: 'b', medium: 'film', year: 2024, landed: 'near-miss' }], { currentYear: 2024 });
    assert.ok(finding(missingNote, 'near_miss_without_note'));
  }
  ok('corpusCheck flags a missing required field, a duplicate id, an out-of-schema medium/landed/constraints value, and a near-miss with no note');

  // ---- corpusCheck: year must be exactly four digits, both boundaries -----
  {
    const base = (year) => corpusCheck([{ id: 'x', brief: 'b', medium: 'film', year, landed: 'landed' }], { currentYear: 2024 });
    assert.ok(finding(base(999), 'year_not_four_digits'), '999 is only three digits');
    assert.equal(finding(base(1000), 'year_not_four_digits'), undefined, '1000 is the first valid four-digit year');
    assert.equal(finding(base(9999), 'year_not_four_digits'), undefined, '9999 is the last valid four-digit year');
    assert.ok(finding(base(10000), 'year_not_four_digits'), '10000 is five digits');
    assert.ok(finding(base(2024.5), 'year_not_four_digits'), 'a non-integer year must be flagged even though it is in range');
  }
  ok('corpusCheck accepts exactly the four-digit integer year range (1000-9999) and rejects both sides of it plus non-integers');

  // ---- corpusCheck: staleness boundary is "older than five years" ---------
  // References/corpus-curation.md: "Prefer the last three to five years."
  // The code's rule is `year < currentYear - 5`, so with currentYear 2024 the
  // boundary sits between 2019 (exactly five years back, not stale) and 2018.
  {
    const notStale = corpusCheck([{ id: 'x', brief: 'b', medium: 'film', year: 2019, landed: 'landed' }], { currentYear: 2024 });
    assert.equal(finding(notStale, 'pieces_older_than_five_years'), undefined, '2019 is exactly five years before 2024 and must not be flagged stale');

    const stale = corpusCheck([{ id: 'x', brief: 'b', medium: 'film', year: 2018, landed: 'landed' }], { currentYear: 2024 });
    assert.ok(finding(stale, 'pieces_older_than_five_years'), '2018 is six years before 2024 and must be flagged stale');
  }
  ok('corpusCheck\'s staleness check treats exactly five years back as current and six years back as stale');

  // ---- corpusCheck: "two or three near-misses" boundary -------------------
  {
    const nearMissPiece = (id) => ({ id, brief: 'b', medium: 'film', year: 2024, landed: 'near-miss', note: 'n' });
    const zero = corpusCheck([{ id: 'p1', brief: 'b', medium: 'film', year: 2024, landed: 'landed' }], { currentYear: 2024 });
    assert.equal(finding(zero, 'too_few_near_misses')?.evidence, '0 labelled near-miss');

    const one = corpusCheck([nearMissPiece('n1')], { currentYear: 2024 });
    assert.equal(finding(one, 'too_few_near_misses')?.evidence, '1 labelled near-miss');

    const two = corpusCheck([nearMissPiece('n1'), nearMissPiece('n2')], { currentYear: 2024 });
    assert.equal(finding(two, 'too_few_near_misses'), undefined, 'two near-misses meets the documented minimum');
  }
  ok('corpusCheck flags too few near-misses at 0 and 1, and stops flagging at the documented minimum of two');

  // ---- corpusCheck: size band over 40 carries the trim-by-date remedy -----
  {
    const makePieces = (n) => Array.from({ length: n }, (_, i) => ({
      id: `p${i}`, brief: 'b', medium: 'film', year: 2024, landed: 'landed',
    }));
    const at40 = corpusCheck(makePieces(40), { currentYear: 2024 });
    assert.equal(at40.size_band, '15-40');
    assert.equal(at40.oversize_remedy, undefined, '40 pieces is still inside the useful range and needs no remedy');

    const at41 = corpusCheck(makePieces(41), { currentYear: 2024 });
    assert.equal(at41.size_band, 'over 40');
    assert.equal(at41.oversize_remedy, 'Take the most recent 30 and set the rest aside as an archive to check the profile against later.');
  }
  ok('corpusCheck only attaches the oversize trim-by-date remedy once the corpus passes 40 pieces, not at 40 itself');

  // ---- corpusCheck: heavy-constraint pieces need a contributes list -------
  // The worked example's "ferrous" piece is the documented-good case: heavy
  // constraints with a contributes array survives unflagged. A piece with no
  // contributes at all is flagged. NOTE (flagged in the final report, not
  // asserted as "correct" here): LABEL_SCHEMA documents `contributes` as
  // "'all', or a list of dimensions" — but the code's check
  // (`Array.isArray(piece?.contributes) && piece.contributes.length`) rejects
  // the string "all" as if it were missing, even though the schema names it
  // as a valid value. This test pins the code's actual current behaviour.
  {
    const good = corpusCheck([{
      id: 'ferrous', brief: 'b', medium: 'film', year: 2024, landed: 'landed', constraints: 'heavy', contributes: ['cadence'],
    }], { currentYear: 2024 });
    assert.equal(finding(good, 'heavy_constraints_without_contributes'), undefined);

    const missing = corpusCheck([{
      id: 'x', brief: 'b', medium: 'film', year: 2024, landed: 'landed', constraints: 'heavy',
    }], { currentYear: 2024 });
    assert.ok(finding(missing, 'heavy_constraints_without_contributes'));

    const allString = corpusCheck([{
      id: 'x', brief: 'b', medium: 'film', year: 2024, landed: 'landed', constraints: 'heavy', contributes: 'all',
    }], { currentYear: 2024 });
    assert.ok(finding(allString, 'heavy_constraints_without_contributes'), 'documents that contributes:"all" (a value LABEL_SCHEMA calls valid) is currently treated as missing because it is not an array — see report');
  }
  ok('corpusCheck accepts a heavy-constraint piece with a non-empty contributes array and flags one with no contributes list (and documents that a contributes:"all" string is also currently flagged, despite LABEL_SCHEMA naming "all" as a valid value)');

  // ============================== dimensions.js ==============================

  // ---- mediumFor: case/whitespace-insensitive lookup, no prototype leak ---
  // Regression coverage for exactly the prototype-pollution trap the code
  // comment calls out: an inherited property name like "constructor" is
  // truthy on a plain object, so a naive `DIMENSIONS[key] ?? null` lookup
  // would return Object.prototype.constructor instead of null.
  {
    assert.equal(mediumFor('visual'), DIMENSIONS.visual);
    assert.equal(mediumFor('VISUAL'), DIMENSIONS.visual, 'lookup must be case-insensitive');
    assert.equal(mediumFor(' written '), DIMENSIONS.written, 'lookup must trim whitespace');
    assert.equal(mediumFor('motion'), DIMENSIONS.motion);
    assert.equal(mediumFor('sculpture'), null, 'an unrecognised medium must return null, not guess');
    assert.equal(mediumFor('constructor'), null, 'an inherited property name must not leak Object.prototype.constructor');
    assert.equal(mediumFor(undefined), null);
    assert.equal(mediumFor(''), null);
  }
  ok('mediumFor looks up every medium case- and whitespace-insensitively, and returns null (never an inherited prototype property) for anything unrecognised');

  // ============================== scoring.js ==============================

  // ---- meanBand: the four documented mean bands, both sides of every boundary ----
  {
    assert.equal(meanBand(3.5).band, '3.5+');
    assert.equal(meanBand(3.49).band, '2.8 to under 3.5', '3.49 is just under the 3.5+ band');
    assert.equal(meanBand(2.8).band, '2.8 to under 3.5', '2.8 exactly belongs to the 2.8-to-under-3.5 band per the doc\'s own "to under" wording');
    assert.equal(meanBand(2.79).band, '2.0 to under 2.8');
    assert.equal(meanBand(2.0).band, '2.0 to under 2.8', '2.0 exactly belongs to the 2.0-to-under-2.8 band');
    assert.equal(meanBand(1.99).band, 'under 2.0');
  }
  ok('meanBand places every documented boundary mean (3.5, 2.8, 2.0) in its lower-inclusive band, matching the doc\'s "X to under Y" wording');

  // ---- scoreIsValid: integers 0-4 only -------------------------------------
  {
    assert.equal(scoreIsValid(0), true);
    assert.equal(scoreIsValid(4), true);
    assert.equal(scoreIsValid(-1), false);
    assert.equal(scoreIsValid(5), false);
    assert.equal(scoreIsValid(2.5), false, 'the scale is integer 0-4, not continuous');
    assert.equal(scoreIsValid('2'), false, 'a numeric string is not a valid score');
    assert.equal(scoreIsValid(NaN), false);
  }
  ok('scoreIsValid accepts only integers 0-4 and rejects out-of-range, fractional, string, and NaN scores');

  // ---- scoreDraft: a normal weighted mean and the two weakest dimensions ----
  {
    const result = scoreDraft([
      { dimension: 'palette', score: 4, weight: 2 },
      { dimension: 'grain', score: 3, weight: 1 },
      { dimension: 'type', score: 3, weight: 1 },
    ]);
    // (4*2 + 3*1 + 3*1) / (2+1+1) = 14/4 = 3.5
    assert.equal(result.weighted_mean, 3.5);
    assert.equal(result.hard_fail, false);
    assert.equal(result.band, '3.5+');
    assert.deepEqual(result.weakest_dimensions, [{ dimension: 'grain', score: 3 }, { dimension: 'type', score: 3 }]);
    assert.equal(result.flat_twos, undefined);
  }
  ok('scoreDraft computes the weighted mean correctly (14/4 = 3.5) and reports the two lowest-scoring dimensions, ties kept in input order');

  // ---- scoreDraft: the doc's own hard-fail sentence, as a worked example ----
  // references/drift-and-governance.md: "Do not average it away — a mean of
  // 3.4 with one breach is a reject." Ten equally-weighted dimensions scoring
  // one 0-breach, eight 4s and one 2 sum to 34, mean 3.4 — hand-picked to
  // land on the doc's own number before writing this assertion.
  {
    const scores = [
      { dimension: 'palette', score: 0, weight: 1, breached_never_entry: 'Never let an accent colour exceed roughly 12% of frame area' },
      ...Array.from({ length: 8 }, (_, i) => ({ dimension: `d${i}`, score: 4, weight: 1 })),
      { dimension: 'grain', score: 2, weight: 1 },
    ];
    const result = scoreDraft(scores);
    assert.equal(result.weighted_mean, 3.4, 'sanity check on the hand-picked numbers: (0 + 8*4 + 2) / 10 = 3.4');
    assert.equal(result.verdict, 'reject');
    assert.equal(result.hard_fail, true);
    assert.deepEqual(result.breaches, [{ dimension: 'palette', never_entry: 'Never let an accent colour exceed roughly 12% of frame area' }]);
    assert.equal(result.rule, HARD_FAIL_RULE);
    assert.equal(result.band, undefined, 'a hard-fail result must not carry a band reading at all — the mean must not be allowed to soften the verdict');
  }
  ok('scoreDraft reproduces references/drift-and-governance.md\'s own "a mean of 3.4 with one breach is a reject" example: a single 0 forces verdict "reject" with no band, regardless of an otherwise-decent mean');

  // ---- scoreDraft: flat 2s vs a mixed low score are diagnostically flagged ----
  {
    const flat = scoreDraft([{ dimension: 'a', score: 2 }, { dimension: 'b', score: 2 }]);
    assert.equal(flat.flat_twos, true);
    assert.equal(flat.flat_twos_note, FLAT_TWOS_NOTE);
    assert.equal(flat.band, '2.0 to under 2.8');

    const mixed = scoreDraft([{ dimension: 'a', score: 4 }, { dimension: 'b', score: 1 }]);
    assert.equal(mixed.flat_twos, undefined, 'a mix of 4 and 1 (also mean 2.5) must not be reported as flat 2s');
  }
  ok('scoreDraft flags an all-2s scorecard as flat_twos and does not mistake a mixed scorecard with the same mean for one');

  // ============================== scoring.js: driftAudit ==============================

  // ---- driftAudit: mean-fall and low-score-share thresholds, both sides ---
  // Four dimensions, each isolating one side of one of the two documented
  // flag rules from the rest, with the other rule's inputs held constant
  // (fall=0 or lowShare=0) so each assertion tests exactly one boundary:
  //   d1: fall exactly 1.0 (flagged)      d2: fall 0.99, just under (not flagged)
  //   d3: 40% low exactly (flagged)       d4: 37.5% low, just under (not flagged)
  {
    const result = driftAudit([
      { dimension: 'd1_fall_at_threshold', baseline_mean: 4, sample_scores: Array(8).fill(3) },
      { dimension: 'd2_fall_just_under', baseline_mean: 4, sample_scores: Array(8).fill(3.01) },
      { dimension: 'd3_low_share_at_threshold', baseline_mean: 3.2, sample_scores: [2, 2, 2, 2, 4, 4, 4, 4, 4, 4] },
      { dimension: 'd4_low_share_just_under', baseline_mean: 3.25, sample_scores: [2, 2, 2, 4, 4, 4, 4, 4] },
    ]);
    const byName = Object.fromEntries(result.dimensions.map((d) => [d.dimension, d]));

    assert.equal(byName.d1_fall_at_threshold.flagged, true, 'a mean fall of exactly 1.0 meets the documented "1.0 or more" threshold');
    assert.match(byName.d1_fall_at_threshold.flag_reasons[0], /mean fell 1\.00/);

    assert.equal(byName.d2_fall_just_under.flagged, false, 'a mean fall of 0.99 is just under the threshold and must not flag');

    assert.equal(byName.d3_low_share_at_threshold.share_scoring_2_or_below, 0.4);
    assert.equal(byName.d3_low_share_at_threshold.flagged, true, '40% scoring 2-or-below meets the documented "40% or more" threshold');

    assert.equal(byName.d4_low_share_just_under.share_scoring_2_or_below, 0.38, '3/8 rounds to 0.38, just under 0.4');
    assert.equal(byName.d4_low_share_just_under.flagged, false);

    assert.equal(result.sample_size_warning, undefined, 'all four dimensions carry at least the minimum 8-sample size, so no warning should fire');
  }
  ok('driftAudit\'s two flag rules (mean fell >=1.0 from baseline; >=40% of samples score 2 or below) are each true exactly on their documented boundary and false just short of it');

  // ---- driftAudit: never-breach reading depends on repeat occurrences -----
  {
    const result = driftAudit([{ dimension: 'x', baseline_mean: 4, sample_scores: Array(8).fill(4) }], [
      { entry: 'Never cut on a musical beat.', occurrences: 1 },
      { entry: 'Never let an accent colour exceed roughly 12% of frame area.', occurrences: 2 },
    ]);
    assert.equal(result.never_breaches[0].reading, 'Any never-list breach in the sample is flagged regardless of the mean.');
    assert.equal(result.never_breaches[1].reading, 'More than one breach of the same entry means the entry is not reaching the preamble.');
    assert.equal(result.never_breaches[0].flagged, true);
  }
  ok('driftAudit reads a single breach and a repeated breach of the same never-list entry differently, per the doc\'s step 5');

  // ---- driftAudit: sample-size warning fires below the documented minimum ----
  {
    const short = driftAudit([{ dimension: 'x', baseline_mean: 3, sample_scores: Array(7).fill(3) }]);
    assert.match(short.sample_size_warning, /smallest per-dimension sample is 7/);
    assert.equal(REAUDIT.minimum_sample, 8);

    const full = driftAudit([{ dimension: 'x', baseline_mean: 3, sample_scores: Array(8).fill(3) }]);
    assert.equal(full.sample_size_warning, undefined, 'exactly the documented minimum of 8 must not warn');
  }
  ok('driftAudit warns when the smallest per-dimension sample falls below the documented minimum of 8, and not when it exactly meets it');

  // ============================== profiles.js ==============================

  // ---- profileFacts: the never-list target has a lower floor and a range ----
  // NEVER_TARGET: floor 8, target range 12-20. Below 8 is a distinct, more
  // severe fact than "outside target" (8-11 and 21+).
  {
    const withCount = (n) => profileFacts({ never_list: Array(n).fill('x'), anchors: ['a', 'b', 'c'], scope: 's', boundary: ['b'], provenance: 'p' });
    assert.equal(withCount(7).facts.find((f) => f.fact.startsWith('never_list'))?.fact, 'never_list_below_eight');
    assert.equal(withCount(8).facts.find((f) => f.fact.startsWith('never_list'))?.fact, 'never_list_outside_target', '8 clears the floor but is still below the 12-20 target range');
    assert.equal(withCount(11).facts.find((f) => f.fact.startsWith('never_list'))?.fact, 'never_list_outside_target');
    assert.equal(withCount(12).facts.find((f) => f.fact.startsWith('never_list')), undefined, '12 is the low end of the target range');
    assert.equal(withCount(20).facts.find((f) => f.fact.startsWith('never_list')), undefined, '20 is the high end of the target range');
    assert.equal(withCount(21).facts.find((f) => f.fact.startsWith('never_list'))?.fact, 'never_list_outside_target');
    assert.equal(NEVER_TARGET.floor, 8);
    assert.equal(NEVER_TARGET.min, 12);
    assert.equal(NEVER_TARGET.max, 20);
  }
  ok('profileFacts distinguishes a never-list below the floor of 8 from one merely outside the 12-20 target range, correctly at every boundary count');

  // ---- profileFacts: anchor count target (3-5) -----------------------------
  {
    const withAnchors = (n) => profileFacts({ never_list: Array(15).fill('x'), anchors: Array(n).fill('a'), scope: 's', boundary: ['b'], provenance: 'p' });
    assert.ok(withAnchors(2).facts.some((f) => f.fact === 'anchors_outside_target'));
    assert.equal(withAnchors(3).facts.some((f) => f.fact === 'anchors_outside_target'), false);
    assert.equal(withAnchors(5).facts.some((f) => f.fact === 'anchors_outside_target'), false);
    assert.ok(withAnchors(6).facts.some((f) => f.fact === 'anchors_outside_target'));
    assert.equal(ANCHOR_TARGET.min, 3);
    assert.equal(ANCHOR_TARGET.max, 5);
  }
  ok('profileFacts flags an anchor count outside 3-5 and not at either boundary');

  // ---- profileFacts: missing sections and un-checkable entries ------------
  {
    const missingSection = profileFacts({ never_list: Array(15).fill('x'), anchors: ['a', 'b', 'c'], scope: '', boundary: ['b'], provenance: 'p' });
    assert.ok(missingSection.facts.some((f) => f.fact === 'section_missing' && f.section === 'scope'), 'an empty-string scope must count as missing, not merely falsy-checked');

    const withDims = profileFacts({
      never_list: Array(15).fill('x'), anchors: ['a', 'b', 'c'], scope: 's', boundary: ['b'], provenance: 'p',
      dimensions: [
        { name: 'sentence_length', entry: 'Median 14 words; 8% over 30' },
        { name: 'refusals', entry: 'Never centred' },
        { name: 'register', entry: 'Varied and expressive throughout' },
      ],
    });
    const noFigureFact = withDims.facts.find((f) => f.fact === 'entries_with_no_number_or_prohibition');
    assert.deepEqual(noFigureFact.dimensions, ['register'], 'only the entry with neither a digit nor a never/no/not prohibition should be flagged');
  }
  ok('profileFacts treats an empty-string section as missing (not just undefined) and flags only the dimension entry with no number and no prohibition');

  // ---- profileFacts: preamble word budget (300-600), both boundaries ------
  {
    const words = (n) => Array(n).fill('word').join(' ');
    const profileWith = (wordCount, neverList) => profileFacts({
      never_list: neverList ?? [], anchors: ['a', 'b', 'c'], scope: 's', boundary: ['b'], provenance: 'p', preamble: words(wordCount),
    });
    assert.equal(profileWith(299).preamble_check.within_budget, false);
    assert.equal(profileWith(300).preamble_check.within_budget, true, '300 words is the documented minimum');
    assert.equal(profileWith(600).preamble_check.within_budget, true, '600 words is the documented maximum');
    assert.equal(profileWith(601).preamble_check.within_budget, false);
  }
  ok('profileFacts\' preamble word-count check is true at exactly 300 and 600 words and false just outside either side');

  // ---- profileFacts: never-list entries must appear verbatim in the preamble ----
  {
    const entry = 'Never let an accent colour exceed roughly 12% of frame area.';
    const withEntry = profileFacts({
      never_list: [entry], anchors: ['a', 'b', 'c'], scope: 's', boundary: ['b'], provenance: 'p',
      preamble: `${entry} ${Array(300).fill('word').join(' ')}`,
    });
    assert.deepEqual(withEntry.preamble_check.never_entries_missing_verbatim, []);
    assert.equal(withEntry.preamble_check.rule, undefined, 'no missing entries means no rule field at all');

    const withoutEntry = profileFacts({
      never_list: [entry], anchors: ['a', 'b', 'c'], scope: 's', boundary: ['b'], provenance: 'p',
      preamble: Array(300).fill('word').join(' '),
    });
    assert.deepEqual(withoutEntry.preamble_check.never_entries_missing_verbatim, [entry]);
    assert.match(withoutEntry.preamble_check.rule, /verbatim/);
  }
  ok('profileFacts catches a never-list entry that is absent from the preamble\'s exact text, and reports no rule when every entry is present verbatim');

  // ---- saveProfile / getProfile / listProfiles: versioning and changelog ----
  {
    const created = saveProfile({ name: 'Test Director', version: '1.0', scope: 'film, editorial' }, undefined);
    assert.match(created.profile_id, /^prof_[0-9a-f]{12}$/);
    assert.equal(created.version, '1.0');
    assert.equal(created.changelog.length, 1);
    assert.equal(created.changelog[0].note, 'Profile created.');

    const updated = saveProfile({ profile_id: created.profile_id, version: '1.1' }, 'Reweighted after re-audit.');
    assert.equal(updated.profile_id, created.profile_id, 'updating by profile_id must not mint a new id');
    assert.equal(updated.created_at, created.created_at, 'created_at must survive an update');
    assert.equal(updated.name, 'Test Director', 'name must be preserved when the update omits it, like the other carried-forward fields');
    assert.equal(updated.version, '1.1');
    assert.equal(updated.changelog.length, 2);
    assert.equal(updated.changelog[1].note, 'Reweighted after re-audit.');

    assert.deepEqual(getProfile(created.profile_id), updated);
    assert.equal(getProfile('prof_doesnotexist'), null);

    const list = listProfiles();
    assert.equal(list.length, 1);
    assert.equal(list[0].profile_id, created.profile_id);
    assert.equal(list[0].version, '1.1');
  }
  ok('saveProfile mints a profile_id on creation and preserves it, created_at, and omitted fields like name across an update, appending each change to the changelog; getProfile and listProfiles read that state back correctly');

  // ---- saveProfile: version must survive an update that omits it ----------
  // Every other carried-forward field on the profile (name, scope, never_list,
  // dimensions, ...) falls back to the existing value with `?? existing?.field`
  // when the caller omits it on an update. `version` was the one field that did
  // not — `version: input.version` with no fallback — so any update call that
  // omitted it (the MCP tool layer always sends one and so never hit this, but
  // the domain function itself did not defend against it) silently overwrote a
  // real version with undefined, directly contradicting this module's own
  // documented rule: "a profile without a version cannot be audited for
  // drift." Fixed here to match every sibling field's fallback pattern.
  {
    const created = saveProfile({ name: 'Omit-Version Director', version: '2.0' }, undefined);
    const updated = saveProfile({ profile_id: created.profile_id, name: 'Omit-Version Director, Updated' }, 'Name change only.');
    assert.equal(updated.version, '2.0', 'omitting version on an update must preserve the existing version, not drop it to undefined');
  }
  ok('saveProfile preserves the existing version when an update omits it, matching every other carried-forward field (regression: version previously had no fallback and silently became undefined)');

  console.log(`\n${passed} generative-digital-twin domain-logic checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
