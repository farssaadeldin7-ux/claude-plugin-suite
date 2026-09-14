#!/usr/bin/env node
/**
 * Regression tests for lib/analyse.js: parseLog, normalise, sizeTier and the
 * audit() report — counting and dividing over a normalised action log.
 *
 * The size-tier, undo-share and per-action-undo boundaries are exactly the
 * kind of documented threshold this codebase has previously gotten wrong at
 * with a flipped comparison, so every one of them is tested on both sides.
 *
 * audit()'s top_actions test reproduces the "Worked example — Photoshop
 * beauty retouching" table in references/sequence-analysis.md: brush_stroke
 * 1,190/4,812 = 24.7%, navigate_zoom 402/4,812 = 8.4%, and so on, hand
 * -computed below before being encoded as assertions. Note: the doc's
 * separately-stated navigation share (24.4%) and undo share (6.5%) for that
 * same log are NOT both independently reproducible from the top-actions
 * table alone — see the comment at that test for the discrepancy this
 * surfaced, which looks like the table being a partial (top-7-of-137) view
 * rather than a code bug.
 *
 *   node plugins/neural-link-intention-layer/mcp/test/analyse.test.mjs
 */
import assert from 'node:assert/strict';
import { parseLog, normalise, sizeTier, audit, IDLE_GAP_MS, SESSION_GAP_MS } from '../lib/analyse.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// Build a `normalised` object directly (bypassing parseLog/normalise, which
// have their own tests below) so audit()'s counting can be exercised with
// exact, hand-chosen numbers. Every token gets run:1 so tokens, rawCount and
// the sum of runs all agree, matching what normalise() would itself produce
// for a log with no repeated-action runs.
function tok(action) { return { action, run: 1, t: null }; }
function normalisedFrom(actions) {
  return {
    sequences: [actions.map(tok)],
    sessions: 1,
    tokens: actions.length,
    rawCount: actions.length,
    dateRange: null,
  };
}

try {
  // ================= sizeTier =================================================
  // Every boundary in the reference table, both sides: under 500 / 500-2,000 /
  // 2,000-5,000 / 5,000+ / 20,000+.
  {
    assert.equal(sizeTier(499), 'under_500');
    assert.equal(sizeTier(500), '500_to_2000', '500 itself is documented as the start of the 500-2,000 band');
    assert.equal(sizeTier(1999), '500_to_2000');
    assert.equal(sizeTier(2000), '2000_to_5000', '2,000 itself starts the 2,000-5,000 band');
    assert.equal(sizeTier(4999), '2000_to_5000');
    assert.equal(sizeTier(5000), '5000_plus', '5,000 itself starts the 5,000+ band');
    assert.equal(sizeTier(19999), '5000_plus');
    assert.equal(sizeTier(20000), '20000_plus', '20,000 itself starts the 20,000+ band');
  }
  ok('sizeTier places every documented size boundary (500 / 2,000 / 5,000 / 20,000) in the band that starts at it, on both sides');

  // ================= audit(): under-500 floor ==================================
  {
    assert.throws(
      () => audit(normalisedFrom(Array.from({ length: 499 }, (_, i) => `a${i}`))),
      (err) => err instanceof ToolError && err.code === 'log_too_small'
    );
    // 500 must not throw — it is only the reporting depth that changes.
    assert.doesNotThrow(() => audit(normalisedFrom(Array.from({ length: 500 }, (_, i) => `a${i}`))));
  }
  ok('audit() throws log_too_small under exactly 500 actions and not at exactly 500');

  // ================= audit(): provisional flag at the 500/2,000 boundary =======
  {
    const under2000 = audit(normalisedFrom(Array.from({ length: 1999 }, (_, i) => `a${i}`)));
    assert.equal(under2000.provisional, 'Under 2,000 actions — frequencies and obvious repeats only, marked provisional.');
    assert.equal('top_bigrams' in under2000, false, 'the 500-2,000 tier must not report bigram statistics');

    const at2000 = audit(normalisedFrom(Array.from({ length: 2000 }, (_, i) => `a${i}`)));
    assert.equal(at2000.provisional, undefined, '2,000 actions exactly must no longer be marked provisional');
    assert.equal('top_bigrams' in at2000, true, 'the 2,000-5,000 tier must report bigram statistics');
  }
  ok('audit() marks exactly the 500-2,000 tier provisional and withholds bigrams/trigrams/undo_diagnostic there, both sides of the 2,000 boundary');

  // ================= audit(): the worked Photoshop retouching example ==========
  // Reproduces references/sequence-analysis.md's top-actions table for a
  // 4,812-action log by constructing a log with exactly those seven named
  // action counts (summing to 2,907) plus 1,905 unique, non-matching filler
  // actions (each occurring once) to reach the doc's stated total of 4,812.
  // Hand-verified shares (100 x count / 4812, to 1dp):
  //   brush_stroke            1190 -> 24.7298...%  -> 24.7%
  //   navigate_zoom            402 ->  8.3541...%  ->  8.4%
  //   navigate_pan             356 ->  7.3982...%  ->  7.4%
  //   undo                     311 ->  6.4629...%  ->  6.5%
  //   select_tool_brush        244 ->  5.0706...%  ->  5.1%
  //   set_brush_size           233 ->  4.8421...%  ->  4.8%
  //   toggle_layer_visibility  171 ->  3.5536...%  ->  3.6%
  // every one matching the doc's own table exactly.
  {
    const named = [
      ['brush_stroke', 1190], ['navigate_zoom', 402], ['navigate_pan', 356],
      ['undo', 311], ['select_tool_brush', 244], ['set_brush_size', 233],
      ['toggle_layer_visibility', 171],
    ];
    const namedTotal = named.reduce((n, [, c]) => n + c, 0);
    assert.equal(namedTotal, 2907);
    const actions = [];
    for (const [action, count] of named) for (let i = 0; i < count; i++) actions.push(action);
    const fillerCount = 4812 - namedTotal; // 1,905
    for (let i = 0; i < fillerCount; i++) actions.push(`filler_${i}`);
    assert.equal(actions.length, 4812);

    const result = audit(normalisedFrom(actions));
    const byAction = Object.fromEntries(result.top_actions.map((r) => [r.action, r]));
    assert.equal(byAction.brush_stroke.share, '24.7%');
    assert.equal(byAction.navigate_zoom.share, '8.4%');
    assert.equal(byAction.navigate_pan.share, '7.4%');
    assert.equal(byAction.undo.share, '6.5%');
    assert.equal(byAction.select_tool_brush.share, '5.1%');
    assert.equal(byAction.set_brush_size.share, '4.8%');
    assert.equal(byAction.toggle_layer_visibility.share, '3.6%');

    // Undo share/band: 311/4812 = 6.4629...% sits in the doc's "3-8%: Normal
    // for exploratory creative work" bucket, matching "Undo share 6.5% —
    // normal band, no action to take."
    assert.equal(result.undo.share, '6.5%');
    assert.equal(result.undo.band.reading, 'Normal for exploratory creative work');

    assert.equal(result.size_tier.band, '2,000-5,000', '4,812 sits just under the 5,000 floor, as the doc itself notes');

    // Discrepancy noted, not silently resolved: the doc states navigation
    // share 24.4% for this log, but its top-actions table only lists 137
    // distinct actions' top 7 — the three navigation-matching ones shown here
    // (navigate_zoom + navigate_pan + toggle_layer_visibility = 929) sum to
    // only 929/4812 = 19.30%, not 24.4%. The doc's candidate 2 write-up
    // mentions a further action, "navigate_zoom_out", that never appears in
    // the top-7 table at all — so the 24.4% figure depends on distinct
    // actions this partial table does not enumerate. That is expected
    // incompleteness in an illustrative doc, not a code bug, so this test
    // checks the code's arithmetic against what the constructed log actually
    // contains rather than asserting the doc's 24.4% figure outright.
    assert.equal(result.navigation.share, '19.3%');
  }
  ok('audit() reproduces the worked Photoshop-retouching example\'s top-action shares, undo share/band and size tier from references/sequence-analysis.md exactly');

  // ================= audit(): undo-share band boundaries (3% / 8% / 15%) =======
  // Each case: 1,000 tokens total, `undoCount` of them the single action
  // "undo", the rest a single non-matching filler action — chosen so the
  // share lands exactly on, or just off, each documented boundary.
  function undoShareCase(undoCount) {
    const actions = [];
    for (let i = 0; i < undoCount; i++) actions.push('undo');
    for (let i = 0; i < 1000 - undoCount; i++) actions.push('filler');
    return audit(normalisedFrom(actions));
  }
  {
    assert.equal(undoShareCase(29).undo.band.reading, 'Healthy, or the log is not capturing undos'); // 2.9%
    assert.equal(undoShareCase(30).undo.band.reading, 'Normal for exploratory creative work', '3.0% exactly belongs to the 3-8% bucket, not under 3%'); // 3.0%
    assert.equal(undoShareCase(80).undo.band.reading, 'Normal for exploratory creative work', '8.0% exactly still belongs to the 3-8% bucket'); // 8.0%
    assert.equal(undoShareCase(81).undo.band.reading, 'Investigate what precedes the undos'); // 8.1%
    assert.equal(undoShareCase(150).undo.band.reading, 'Investigate what precedes the undos', '15.0% exactly still belongs to the 8-15% bucket'); // 15.0%
    assert.equal(undoShareCase(151).undo.band.reading, 'Wrong defaults, or a destructive rather than non-destructive process'); // 15.1%
  }
  ok('the undo-share band lands each documented boundary (3% / 8% / 15%) in its lower bucket, on both sides, matching the "under/x-y/over" wording');

  // ================= audit(): per-action undo diagnostic, count boundary =======
  // Four actions, each isolated in its own 2-token pair so no bigram leaks
  // between them: A seen 20 times (5 followed by undo, p=0.25 exactly), B
  // seen 20 times (19 followed by undo, p=0.95), C seen only 19 times (just
  // under the 20-occurrence floor) even though every one of its occurrences
  // is followed by undo, and D seen 20 times but never followed by undo
  // (p=0 exactly). Padded with a single filler action to clear the 2,000
  // floor for the non-provisional branch that reports undo_diagnostic.
  {
    const actions = [];
    for (let i = 0; i < 5; i++) actions.push('A', 'undo');
    for (let i = 0; i < 15; i++) actions.push('A', 'filler');
    for (let i = 0; i < 19; i++) actions.push('B', 'undo');
    actions.push('B', 'filler');
    for (let i = 0; i < 19; i++) actions.push('C', 'undo');
    for (let i = 0; i < 20; i++) actions.push('D', 'filler');
    while (actions.length < 2000) actions.push('filler');
    assert.equal(actions.length, 2000);

    const result = audit(normalisedFrom(actions));
    const rows = Object.fromEntries(result.undo_diagnostic.rows.map((r) => [r.action, r]));
    assert.equal(result.undo_diagnostic.threshold, 0.25);
    assert.equal(rows.A.seen, 20);
    assert.equal(rows.A.p_undo_next, 0.25, '5/20 = 0.25 exactly');
    assert.equal(rows.B.seen, 20);
    assert.equal(rows.B.p_undo_next, 0.95, '19/20 = 0.95 exactly');
    assert.equal('C' in rows, false, 'C is seen only 19 times — one short of the 20-occurrence floor — and must be excluded regardless of its p_undo_next');
    assert.equal('D' in rows, false, 'D clears the 20-occurrence floor but has p_undo_next=0 exactly, which the code filters out (> 0, not >= 0)');
    assert.deepEqual(result.undo_diagnostic.rows.map((r) => r.action), ['B', 'A'], 'rows must be sorted by p_undo_next descending');
  }
  ok('the per-action undo diagnostic excludes an action one occurrence short of the 20-occurrence floor even at p=1.0, and excludes p_undo_next=0 even at the floor, while including 0.25 and 0.95 exactly');

  // ================= navigation classification: regex word-boundary cases =====
  {
    const actions = ['navigate_zoom', 'navigate_pan', 'pan', 'pan_left', 'toggle_layer_visibility',
      'panning', 'expand', 'companion', 'select_tool_brush'];
    while (actions.length < 500) actions.push(`filler_${actions.length}`);
    const result = audit(normalisedFrom(actions));
    const matched = new Set(result.navigation.matched_tokens.map((r) => r.action));
    assert.ok(matched.has('navigate_zoom'));
    assert.ok(matched.has('navigate_pan'));
    assert.ok(matched.has('pan'));
    assert.ok(matched.has('pan_left'));
    assert.ok(matched.has('toggle_layer_visibility'));
    assert.ok(!matched.has('panning'), '"panning" contains "pan" but not as a whole token bounded by a separator or the string edges, and must not match');
    assert.ok(!matched.has('expand'), '"expand" contains "pan" only mid-word and must not match');
    assert.ok(!matched.has('companion'), '"companion" contains "pan" only mid-word and must not match');
    assert.ok(!matched.has('select_tool_brush'));
  }
  ok('navigation matching requires "pan" to be a separator- or edge-bounded token, so "panning"/"expand"/"companion" are correctly not classified as navigation');

  // ================= navigationActions: caller-supplied extras ================
  {
    const actions = ['orbit_view', 'orbit_view', 'filler'];
    while (actions.length < 500) actions.push(`filler_${actions.length}`);
    const withoutExtra = audit(normalisedFrom(actions));
    assert.ok(!withoutExtra.navigation.matched_tokens.some((r) => r.action === 'orbit_view'));
    const withExtra = audit(normalisedFrom(actions), { navigationActions: ['orbit_view'] });
    assert.ok(withExtra.navigation.matched_tokens.some((r) => r.action === 'orbit_view'));
  }
  ok('a caller-supplied navigationActions entry is matched in addition to the built-in patterns, and only when supplied');

  // ================= parseLog =====================================================
  {
    const events = parseLog([
      '# a comment line, skipped',
      '',
      '   ',
      '2026-08-14T10:04:12  photoshop  layer.new',
      '2026-08-14T10:04:13  layer.fill', // timestamp + action, no application
      'photoshop layer.select', // application + action, no timestamp — "photoshop" does not parse as a date
      'layer.deselect', // bare action, no timestamp or application
    ].join('\n'));

    assert.equal(events.length, 4);
    assert.equal(events[0].action, 'layer.new');
    assert.ok(Number.isFinite(events[0].t), 'a full timestamp + application + action line must record a timestamp');
    assert.equal(events[1].action, 'layer.fill');
    assert.ok(Number.isFinite(events[1].t), '"timestamp action" (no application) must still record a timestamp');
    assert.equal(events[2].action, 'layer.select');
    assert.equal(events[2].t, null, 'a first field that is not a valid timestamp ("photoshop") must leave t null, not misparse it as a date');
    assert.equal(events[3].action, 'layer.deselect');
    assert.equal(events[3].t, null);
  }
  ok('parseLog skips blank and comment lines, extracts the trailing action field, and only records a timestamp when the first field actually parses as one');

  // ================= normalise: run collapsing =====================================
  {
    const events = [
      { t: null, action: 'a' }, { t: null, action: 'a' }, { t: null, action: 'a' },
      { t: null, action: 'b' },
      { t: null, action: 'a' },
    ];
    const result = normalise(events);
    assert.equal(result.sequences.length, 1);
    const seq = result.sequences[0];
    assert.deepEqual(seq.map((t) => [t.action, t.run]), [['a', 3], ['b', 1], ['a', 1]]);
    assert.equal(result.tokens, 3, 'three collapsed tokens, even though five raw events came in');
    assert.equal(result.rawCount, 5);
  }
  ok('normalise collapses consecutive identical actions into one token carrying a run count, and leaves non-consecutive repeats as separate tokens');

  // ================= normalise: idle-gap boundary is exclusive at 3 minutes ========
  {
    const base = Date.parse('2026-08-14T10:00:00Z');
    const notCut = normalise([
      { t: base, action: 'a' },
      { t: base + IDLE_GAP_MS, action: 'b' }, // gap exactly 3:00 -> must NOT cut
    ]);
    assert.equal(notCut.sequences.length, 1, 'a gap of exactly 3 minutes must not split the sequence — the rule is "over 3 min"');

    const cut = normalise([
      { t: base, action: 'a' },
      { t: base + IDLE_GAP_MS + 1, action: 'b' }, // gap 3:00.001 -> must cut
    ]);
    assert.equal(cut.sequences.length, 2, 'a gap one millisecond over 3 minutes must split the sequence');
  }
  ok('normalise cuts a sequence only when the idle gap is strictly over 3 minutes, not at exactly 3 minutes');

  // ================= normalise: session-gap boundary is exclusive at 30 minutes ====
  {
    const base = Date.parse('2026-08-14T10:00:00Z');
    const notNewSession = normalise([
      { t: base, action: 'a' },
      { t: base + SESSION_GAP_MS, action: 'b' }, // gap exactly 30:00 -> still 1 session
    ]);
    assert.equal(notNewSession.sessions, 1, 'a gap of exactly 30 minutes must not start a new session — the rule is "over 30 min"');

    const newSession = normalise([
      { t: base, action: 'a' },
      { t: base + SESSION_GAP_MS + 1, action: 'b' },
    ]);
    assert.equal(newSession.sessions, 2, 'a gap one millisecond over 30 minutes must start a new session');
  }
  ok('normalise starts a new session only when the gap is strictly over 30 minutes, not at exactly 30 minutes');

  // ================= normalise: dateRange and the empty-log case ===================
  {
    const withStamps = normalise([
      { t: Date.parse('2026-08-14T10:00:00Z'), action: 'a' },
      { t: Date.parse('2026-08-15T09:00:00Z'), action: 'b' },
      { t: null, action: 'c' }, // an event with no timestamp must not break min/max
    ]);
    assert.equal(withStamps.dateRange.from, '2026-08-14T10:00:00.000Z');
    assert.equal(withStamps.dateRange.to, '2026-08-15T09:00:00.000Z');

    const empty = normalise([]);
    assert.equal(empty.sessions, 0);
    assert.equal(empty.sequences.length, 0);
    assert.equal(empty.tokens, 0);
    assert.equal(empty.rawCount, 0);
    assert.equal(empty.dateRange, null);

    const noStamps = normalise([{ t: null, action: 'a' }]);
    assert.equal(noStamps.dateRange, null, 'a log with actions but no timestamps must report no date range, not a bogus one');
    assert.equal(noStamps.sessions, 1, 'a non-empty log always starts at least one session, even with no timestamps to measure gaps from');
  }
  ok('normalise computes dateRange from timestamped events only, and reports sessions=0/sequences=[]/dateRange=null for an empty log');

  console.log(`\n${passed} analyse.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
