#!/usr/bin/env node
/**
 * Regression tests for lib/toolchains.js's toolchainFor: the id-normalisation
 * lookup against references/toolchain-notes.md's per-library entries.
 *
 *   node plugins/code-to-visual-interpreter/mcp/test/toolchains.test.mjs
 *
 * TOOLCHAINS itself is a static data table ported verbatim from the
 * reference doc (no arithmetic to verify independently); toolchainFor's
 * normalise/lookup is the only real logic in this file, so that is what
 * these checks cover.
 */
import assert from 'node:assert/strict';
import { toolchainFor } from '../lib/toolchains.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- the obvious human spellings must resolve, not just the bare key ---
  {
    assert.equal(toolchainFor('p5.js').label, 'p5.js');
    assert.equal(toolchainFor('three.js').label, 'three.js');
    assert.equal(toolchainFor('Canvas-2D').label, 'Canvas 2D');
    assert.equal(toolchainFor('WebGL/WebGPU').label, 'WebGL and WebGPU directly');
  }
  ok('toolchainFor resolves the obvious punctuated spellings (p5.js, three.js, Canvas-2D, WebGL/WebGPU) to the correct entry');

  // ---- normalisation is case- and whitespace-insensitive ------------------
  {
    assert.equal(toolchainFor('  P5JS  ').label, 'p5.js');
    assert.equal(toolchainFor('Three JS').label, 'three.js');
  }
  ok('toolchainFor\'s lookup is case-insensitive and ignores surrounding whitespace and internal separators');

  // ---- the returned id is the canonical table key, not the caller's spelling ----
  {
    const result = toolchainFor('P5.JS');
    assert.equal(result.id, 'p5js', 'the returned id must be the canonical TOOLCHAINS key, not the input spelling');
  }
  ok('toolchainFor returns the canonical table key as id regardless of the input spelling');

  // ---- unknown or empty ids return null, not a guessed nearest match -----
  {
    assert.equal(toolchainFor('blender'), null);
    assert.equal(toolchainFor(''), null);
    assert.equal(toolchainFor(undefined), null);
    assert.equal(toolchainFor(null), null);
  }
  ok('toolchainFor returns null for an unrecognised, empty, or missing id instead of guessing the nearest match');

  console.log(`\n${passed} toolchains.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
