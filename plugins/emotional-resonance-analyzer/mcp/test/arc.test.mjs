#!/usr/bin/env node
/**
 * Regression tests for lib/arc.js.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/arc.test.mjs
 */
import assert from 'node:assert/strict';
import { monotonyStretches } from '../lib/arc.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const scene = (position, start, end, valence) => ({ position, start, end, valence, intensity: 3 });

try {
  // ---- two flat stretches on either side of a real jump are not merged ---
  // Regression test: the merge check only compared scene-index adjacency
  // (`left <= last.toIndex + 1`), which two genuinely different flat levels
  // satisfy whenever they sit right next to each other in the scene list —
  // reporting one falsely-merged stretch that claims no meaningful valence
  // movement across a span that actually jumps from 0 to 5.
  {
    const scenes = [0, 0, 0, 5, 5, 5].map((v, i) => scene(i + 1, i * 200, (i + 1) * 200, v));
    const stretches = monotonyStretches(scenes);
    assert.equal(stretches.length, 2, `expected two separate flat stretches, got: ${JSON.stringify(stretches.map((s) => s.scores))}`);
    assert.deepEqual(stretches[0].scores, [0, 0, 0]);
    assert.deepEqual(stretches[1].scores, [5, 5, 5]);
  }
  ok('two adjacent flat stretches at different valence levels are reported separately, not merged into one falsely-flat span');

  // ---- a genuinely continuous flat stretch still merges across checkpoints
  {
    const scenes = Array.from({ length: 10 }, (_, i) => scene(i + 1, i * 200, (i + 1) * 200, 2));
    const stretches = monotonyStretches(scenes);
    assert.equal(stretches.length, 1, 'ten scenes at a constant valence must still be reported as one continuous stretch');
    assert.equal(stretches[0].scores.length, 10);
  }
  ok('a genuinely continuous flat run is still merged into a single stretch');

  console.log(`\n${passed} arc.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
