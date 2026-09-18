#!/usr/bin/env node
/**
 * Regression tests for lib/graph.js — the modelled engagement series and its
 * SVG rendering, run on the worked 12-scene boatyard example from
 * references/arc-scoring.md.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/graph.test.mjs
 */
import assert from 'node:assert/strict';
import { engagementGraph, renderEngagementSvg, SERIES_CAPTION, FORMULA } from '../lib/graph.js';
import { checkTells, normaliseQuestions } from '../lib/tells.js';
import { normaliseScenes } from '../lib/scenes.js';
import { formFor } from '../lib/forms.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// The worked 12-scene boatyard example, exactly as the reference tables it.
const boatyardScenes = [
  { timecode: '00:00', valence: -1, intensity: 2, description: 'Dawn, empty yard, radio news of the sale', person_with_want: true, information_only: false },
  { timecode: '00:35', valence: 0, intensity: 2, description: 'Dan opens up, 31 years', person_with_want: true, information_only: false },
  { timecode: '01:25', valence: 0, intensity: 2, description: 'History of the yard', person_with_want: false, information_only: true },
  { timecode: '03:05', valence: 0, intensity: 2, description: 'Economics of small boatbuilding', person_with_want: false, information_only: true },
  { timecode: '04:25', valence: 0, intensity: 2, description: 'Council planning process', person_with_want: false, information_only: true },
  { timecode: '05:35', valence: 1, intensity: 3, description: 'Dan finds the old ledger book', person_with_want: true, information_only: false },
  { timecode: '06:20', valence: -2, intensity: 4, description: 'Dan on his father, unbroken single frame', person_with_want: true, information_only: false, longest_talking_head_seconds: 110 },
  { timecode: '08:10', valence: -2, intensity: 4, description: 'The buyer\'s letter arrives', person_with_want: true, information_only: false },
  { timecode: '08:50', valence: -1, intensity: 4, description: 'Meeting in the shed, argument', person_with_want: true, information_only: false },
  { timecode: '09:45', valence: 3, intensity: 5, description: 'The vote goes their way', person_with_want: true, information_only: false },
  { timecode: '10:20', valence: 2, intensity: 3, description: 'Celebration in the yard', person_with_want: true, information_only: false },
  { timecode: '11:10', valence: 2, intensity: 2, description: 'Dawn again, boat launches, credits', person_with_want: true, information_only: false },
];
const boatyardQuestions = [
  { id: 'Q1', question: 'Will the yard reopen?', opens: '00:15', closes: '09:45', how: 'on_screen', weight: 'central' },
  { id: 'Q2', question: 'Why did Dan stay?', opens: '00:40', closes: '07:00', how: 'implied', weight: 'major' },
  { id: 'Q3', question: 'What is in the ledger book?', opens: '05:50', how: 'never', weight: 'minor' },
];

const build = () => {
  const form = formFor('short_doc');
  const { scenes, runtime } = normaliseScenes(boatyardScenes, { totalRuntime: '11:40' });
  const questions = normaliseQuestions(boatyardQuestions, runtime);
  return { form, scenes, runtime, questions };
};

try {
  // ---- flagged tell ranges are exactly what check_tells finds -------------
  {
    const { form, scenes, runtime, questions } = build();
    const { stretches } = checkTells({ scenes, questions, runtime, form });
    const graph = engagementGraph({ scenes, questions, runtime, form, ledgerSupplied: true });
    assert.deepEqual(
      graph.tellStretches.map((s) => [s.cause, s._from, s._to]),
      stretches.map((s) => [s.cause, s.from, s.to]),
      'the graph\'s flagged tell ranges must be check_tells\'s stretches, unchanged'
    );
    // The reference's reading of the example: no_question_open, stakes and
    // monotony over the scenes 3–5 block, texture starvation on scene 7,
    // no premature resolution.
    const causes = new Set(graph.tellStretches.map((s) => s.cause));
    assert.deepEqual(
      [...causes].sort(),
      ['no_question_open', 'stakes_not_personalised', 'texture_starvation', 'tonal_monotony']
    );
    assert.ok(!causes.has('premature_resolution'), 'Q1 closes at 0.84 of run-time — inside the short-doc window');
  }
  ok('boatyard example: flagged ranges equal what check_tells finds, and premature resolution stays untripped');

  // ---- the series is the documented arithmetic, per scene -----------------
  {
    const { form, scenes, runtime, questions } = build();
    const graph = engagementGraph({ scenes, questions, runtime, form, ledgerSupplied: true });
    assert.equal(graph.series.length, 12, 'one point per scene');
    for (let i = 0; i < graph.series.length; i++) {
      const p = graph.series[i];
      const movement = i ? Math.abs(scenes[i].valence - scenes[i - 1].valence) : 0;
      assert.equal(p.components.valence_movement, movement, `scene ${i + 1} valence movement`);
      assert.equal(p.components.intensity, scenes[i].intensity, `scene ${i + 1} intensity`);
      assert.equal(
        p.engagement,
        p.components.intensity + p.components.valence_movement - p.components.tell_penalty,
        `scene ${i + 1}: engagement must equal its own stated components`
      );
    }
    // Hand-traced values: scenes 3–5 sit under three overlapping tells
    // (no question open, stakes, monotony) at intensity 2 with no movement.
    assert.equal(graph.series[2].engagement, -1);
    assert.equal(graph.series[2].components.tell_penalty, 3);
    // Scene 10, the vote: intensity 5, valence jump of 4, no tell.
    assert.equal(graph.series[9].engagement, 9);
    assert.equal(graph.series[9].components.tell_penalty, 0);
  }
  ok('the modelled series is intensity + valence movement − tell penalties, and matches the hand-traced boatyard values');

  // ---- reproducible run to run --------------------------------------------
  {
    const one = (() => {
      const { form, scenes, runtime, questions } = build();
      const graph = engagementGraph({ scenes, questions, runtime, form, ledgerSupplied: true });
      return JSON.stringify(graph) + renderEngagementSvg({
        series: graph.series, runtime, tellStretches: graph.tellStretches,
        flatSeries: graph.flatSeries, formLabel: form.label,
      });
    });
    assert.equal(one(), one(), 'series and SVG must be byte-identical across runs on the same input');
  }
  ok('series and SVG are reproducible run to run');

  // ---- the SVG carries the honesty caption and the flagged shading --------
  {
    const { form, scenes, runtime, questions } = build();
    const graph = engagementGraph({ scenes, questions, runtime, form, ledgerSupplied: true });
    const svg = renderEngagementSvg({
      series: graph.series, runtime, tellStretches: graph.tellStretches,
      flatSeries: graph.flatSeries, formLabel: form.label,
    });
    assert.ok(svg.includes(SERIES_CAPTION), 'the modelled-not-measured caption must be baked into the image');
    assert.ok(svg.includes('<polyline'), 'a line chart, not just labels');
    assert.ok(svg.includes('fill-opacity="0.08"'), 'flagged ranges shaded');
    assert.ok(svg.includes('texture starvation'), 'the tell is named on the chart key');
    assert.ok(svg.includes('11:40') || svg.includes('10:00'), 'x-axis timecodes rendered');
    // Self-contained: the only URL is the SVG namespace itself — no hrefs,
    // no url() references, no images, no scripts.
    assert.ok(!/href|url\(|<image|<script/.test(svg), 'self-contained: no external assets, no scripts');
  }
  ok('the SVG is self-contained, shades the flagged ranges, names the tells and bakes in the caption');

  // ---- no ledger: coverage tells drop out instead of flagging the whole film
  {
    const { form, scenes, runtime } = build();
    const graph = engagementGraph({ scenes, questions: [], runtime, form, ledgerSupplied: false });
    const wholeFilm = graph.tellStretches.find((s) => s.cause === 'no_question_open' && s._from === 0 && s._to === runtime);
    assert.equal(wholeFilm, undefined, 'an absent ledger must not read as one whole-film no-question stretch');
    // The scene-based information-only run still trips.
    assert.ok(graph.tellStretches.some((s) => s.cause === 'no_question_open'), 'the information-only scene run still flags');
  }
  ok('without a Q&A ledger the coverage check drops out rather than flagging the whole film');

  // ---- the formula's honesty text -----------------------------------------
  {
    assert.ok(FORMULA.components.length === 3);
    assert.ok(FORMULA.note.includes('not a measurement of any audience'));
  }
  ok('the formula states its three components and disclaims measurement');
} catch (err) {
  console.error(`\nFAILED after ${passed} passing: ${err.message}`);
  process.exit(1);
}

console.log(`\n${passed} tests passed`);
