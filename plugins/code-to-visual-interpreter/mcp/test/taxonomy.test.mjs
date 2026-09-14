#!/usr/bin/env node
/**
 * Regression tests for lib/taxonomy.js's matchStructures: the structure
 * filtering against references/decomposition-method.md's discrimination
 * tests and the octave-count estimate.
 *
 *   node plugins/code-to-visual-interpreter/mcp/test/taxonomy.test.mjs
 */
import assert from 'node:assert/strict';
import { matchStructures } from '../lib/taxonomy.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const ids = (result) => result.candidates.map((c) => c.id).sort();

try {
  // ---- no answers at all is rejected --------------------------------------
  {
    assert.throws(
      () => matchStructures({}),
      (err) => err instanceof ToolError && err.code === 'no_answers'
    );
  }
  ok('matchStructures requires at least one of the five questions to be answered');

  // ---- invalid answer values are rejected, not silently ignored ----------
  {
    assert.throws(() => matchStructures({ placement: 'orbit' }), (err) => err instanceof ToolError && err.code === 'invalid_answer');
    assert.throws(() => matchStructures({ spacing: 'random' }), (err) => err instanceof ToolError && err.code === 'invalid_answer');
    assert.throws(() => matchStructures({ neighbours: 'friends' }), (err) => err instanceof ToolError && err.code === 'invalid_answer');
  }
  ok('matchStructures rejects an out-of-vocabulary placement, spacing or neighbours answer');

  // ---- placement partitions the table exactly as the reference table implies ----
  {
    assert.deepEqual(ids(matchStructures({ placement: 'lattice' })),
      ['hex-lattice', 'polar', 'recursive-subdivision', 'square-grid', 'tiling'].sort());
    assert.deepEqual(ids(matchStructures({ placement: 'paths' })),
      ['flow-field', 'l-system', 'particle-attractors'].sort());
    assert.deepEqual(ids(matchStructures({ placement: 'neither' })),
      ['packing', 'poisson-disc'].sort());
  }
  ok('matchStructures\'s placement filter partitions all ten structures into exactly the lattice/paths/neither groups the reference table implies');

  // ---- spacing "clustered" is an EXACT filter: "never a grid" ------------
  // The reference is emphatic: "Clustered means packing or attractors, never
  // a grid" — so a grid structure with unset (null) spacing must NOT slip
  // through a clustered filter, unlike every other spacing value which is
  // permissive toward null.
  {
    assert.deepEqual(ids(matchStructures({ spacing: 'clustered' })), ['packing', 'particle-attractors'].sort());
  }
  ok('matchStructures\'s spacing="clustered" filter keeps only packing and particle-attractors, matching the reference\'s emphatic "never a grid" rule');

  // ---- other spacing values are permissive toward an unset (null) spacing ----
  {
    // lattice structures whose spacing is either "constant" or left unset:
    // square-grid, hex-lattice, tiling (constant) plus recursive-subdivision
    // (null); polar (gradient) must be excluded.
    assert.deepEqual(
      ids(matchStructures({ placement: 'lattice', spacing: 'constant' })),
      ['hex-lattice', 'recursive-subdivision', 'square-grid', 'tiling'].sort(),
      'spacing="constant" must admit structures with unset spacing but still exclude polar (gradient)'
    );
  }
  ok('matchStructures\'s non-clustered spacing filters admit structures with unset spacing rather than only an exact match');

  // ---- a contradictory combination yields zero candidates and a note -----
  // Lattice structures never have "clustered" spacing in the table (the
  // reference's own rule), so this combination must be empty.
  {
    const result = matchStructures({ placement: 'lattice', spacing: 'clustered' });
    assert.equal(result.candidates.length, 0);
    assert.match(result.note, /one of them is wrong/);
    assert.ok(result.tests, 'a contradictory answer set must hand back the discrimination tests to re-run');
  }
  ok('matchStructures reports zero candidates with a re-test note for a self-contradictory placement/spacing combination, instead of guessing');

  // ---- a single surviving candidate gets neither a note nor next_tests ---
  {
    const result = matchStructures({ placement: 'neither', spacing: 'clustered' });
    assert.deepEqual(ids(result), ['packing']);
    assert.equal(result.note, undefined);
    assert.equal(result.next_tests, undefined, 'a single unambiguous candidate must not prompt further discrimination tests');
  }
  ok('matchStructures omits next_tests when exactly one candidate survives, and includes it when more than one does');

  {
    const result = matchStructures({ placement: 'lattice' });
    assert.ok(result.candidates.length > 1);
    assert.ok(result.next_tests, 'more than one surviving candidate must prompt the discrimination tests');
  }
  ok('matchStructures includes next_tests whenever more than one candidate survives the filter');

  // ---- neighbours drives the modulation candidates, per the reference rule ----
  {
    const similar = matchStructures({ neighbours: 'similar' });
    assert.deepEqual(similar.modulation.candidates.map((m) => m.id).sort(), ['gradient-by-position', 'noise'].sort());

    const unrelated = matchStructures({ neighbours: 'unrelated' });
    assert.deepEqual(unrelated.modulation.candidates.map((m) => m.id), ['per-element-random']);
  }
  ok('matchStructures maps "similar" neighbours to noise/gradient modulation candidates and "unrelated" to per-element-random only');

  // ---- octave estimate: log2(largest/smallest), hand-verified ------------
  // A clean case: largest=100, smallest=12.5 -> ratio 8 -> log2(8) = 3 exactly.
  {
    const result = matchStructures({ neighbours: 'similar', largest_scale: 100, smallest_scale: 12.5 });
    assert.equal(result.octave_estimate.octaves_exact, 3);
    assert.equal(result.octave_estimate.octaves_suggested, 3);
  }
  ok('matchStructures\'s octave estimate reproduces log2(largest_scale/smallest_scale) exactly for a clean ratio of 8 (100 / 12.5 -> 3 octaves)');

  // A non-round case: largest=300, smallest=40 -> ratio 7.5 -> log2(7.5) ~= 2.9069,
  // hand-verified independently before writing the assertion.
  {
    const result = matchStructures({ neighbours: 'similar', largest_scale: 300, smallest_scale: 40 });
    assert.equal(result.octave_estimate.octaves_exact, 2.9);
    assert.equal(result.octave_estimate.octaves_suggested, 3, 'octaves_suggested must round 2.9 to the nearest whole octave, 3');
  }
  ok('matchStructures\'s octave estimate rounds a non-integer log2 ratio (300/40 -> 2.9) to the nearest whole octave for octaves_suggested');

  // ---- invalid scales: both sides of the largest > smallest boundary -----
  {
    assert.throws(() => matchStructures({ neighbours: 'similar', largest_scale: 0, smallest_scale: 5 }),
      (err) => err instanceof ToolError && err.code === 'invalid_scales');
    assert.throws(() => matchStructures({ neighbours: 'similar', largest_scale: 5, smallest_scale: 0 }),
      (err) => err instanceof ToolError && err.code === 'invalid_scales');
    assert.throws(() => matchStructures({ neighbours: 'similar', largest_scale: 50, smallest_scale: 50 }),
      (err) => err instanceof ToolError && err.code === 'invalid_scales',
      'largest_scale exactly equal to smallest_scale must be rejected, not accepted as a zero-octave estimate'
    );
    assert.throws(() => matchStructures({ neighbours: 'similar', largest_scale: 49, smallest_scale: 50 }),
      (err) => err instanceof ToolError && err.code === 'invalid_scales');
    // just past the boundary must succeed.
    const result = matchStructures({ neighbours: 'similar', largest_scale: 50.01, smallest_scale: 50 });
    assert.ok(Number.isFinite(result.octave_estimate.octaves_exact));
  }
  ok('matchStructures rejects non-positive scales and largest_scale <= smallest_scale (including the exact-equality boundary), and accepts just past it');

  console.log(`\n${passed} taxonomy.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
