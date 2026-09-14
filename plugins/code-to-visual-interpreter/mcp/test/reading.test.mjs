#!/usr/bin/env node
/**
 * Regression tests for lib/reading.js's scanSource: the determinism and
 * bloat-trap textual scan described in references/toolchain-notes.md.
 *
 *   node plugins/code-to-visual-interpreter/mcp/test/reading.test.mjs
 */
import assert from 'node:assert/strict';
import { scanSource } from '../lib/reading.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- empty source is rejected, not scanned as zero findings ------------
  {
    for (const bad of ['', '   \n  \t ', undefined, null]) {
      assert.throws(
        () => scanSource(bad),
        (err) => err instanceof ToolError && err.code === 'empty_source'
      );
    }
  }
  ok('scanSource rejects empty or whitespace-only source instead of silently reporting zero findings');

  // ---- unseeded Math.random() is found, with a correct 1-indexed line ----
  {
    const src = 'function setup() {\n  noiseSeed(1);\n}\nfunction draw() {\n  const x = Math.random() * width;\n}\n';
    const result = scanSource(src);
    const found = result.determinism_findings.find((f) => f.check === 'unseeded_random');
    assert.ok(found, 'Math.random() must be flagged as unseeded_random');
    assert.equal(found.line, 5, 'the reported line must be 1-indexed and match the actual source line');
    assert.equal(result.lines_scanned, 7, 'lines_scanned must count every line, including the trailing empty one produced by the final newline');
  }
  ok('scanSource finds Math.random() with the correct 1-indexed line number and an accurate lines_scanned total');

  // ---- each determinism marker fires on its own pattern -------------------
  {
    const glsl = scanSource('float h = fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);');
    assert.ok(glsl.determinism_findings.some((f) => f.check === 'glsl_sin_hash'));

    const noiseDetail = scanSource('noiseDetail(4, 0.5);');
    assert.ok(noiseDetail.determinism_findings.some((f) => f.check === 'noise_detail_global'));
  }
  ok('scanSource fires glsl_sin_hash on the fract(sin(dot(...))) constants and noise_detail_global on noiseDetail(...) independently');

  // ---- seeding markers: first occurrence only, every documented spelling ----
  {
    const src = 'randomSeed(1);\nrandomSeed(2);\nnoiseSeed(3);\nconst rng = mulberry32(seed);\nconst r2 = sfc32(a, b, c, d);\nd3.randomLcg(seed);\n';
    const result = scanSource(src);
    const byWhat = Object.fromEntries(result.seeding_present.map((s) => [s.what, s.first_seen_line]));
    assert.equal(byWhat['randomSeed() (p5 / Processing)'], 1, 'a repeated call must report only the first line it appears on');
    assert.equal(byWhat['noiseSeed() (p5 / Processing)'], 3);
    assert.equal(byWhat['mulberry32'], 4);
    assert.equal(byWhat['sfc32'], 5);
    assert.equal(byWhat['d3.randomLcg()'], 6);
    assert.equal(result.seeding_present.length, 5, 'exactly the five documented seeding spellings must be recognised, no more');
  }
  ok('scanSource recognises every documented seeding spelling and reports only the first line each appears on');

  // ---- mixed_randomness_note: only when unseeded AND seeded appear together ----
  {
    const onlySeeded = scanSource('randomSeed(1);\nconst x = noise(t);\n');
    assert.equal(onlySeeded.mixed_randomness_note, undefined, 'seeded-only source must not get the mixed-randomness warning');

    const onlyUnseeded = scanSource('const x = Math.random();\n');
    assert.equal(onlyUnseeded.mixed_randomness_note, undefined, 'unseeded-only source has nothing to be "mixed" with, so no warning');

    const mixed = scanSource('randomSeed(1);\nconst x = Math.random();\n');
    assert.match(mixed.mixed_randomness_note, /will not be reseeded/, 'source using both a seeded PRNG and Math.random must get the mixed-randomness warning');
  }
  ok('scanSource\'s mixed_randomness_note appears only when both an unseeded Math.random() and a seeding call are present, not either alone');

  // ---- bloat-trap markers fire independently ------------------------------
  {
    const src = [
      'function draw() {',
      '  const buf = createGraphics(w, h);',
      '  ctx.shadowBlur = 10;',
      '  const pixels = ctx.getImageData(0, 0, w, h);',
      '  loadPixels();',
      '  updatePixels();',
      '}',
    ].join('\n');
    const result = scanSource(src);
    const checks = result.bloat_trap_findings.map((f) => f.check);
    assert.ok(checks.includes('create_graphics'));
    assert.ok(checks.includes('shadow_blur'));
    assert.ok(checks.includes('get_image_data'));
    assert.equal(checks.filter((c) => c === 'load_pixels').length, 2, 'both loadPixels() and updatePixels() must be reported under the shared load_pixels check');
  }
  ok('scanSource finds every documented bloat-trap call: createGraphics, shadowBlur, getImageData, and both loadPixels/updatePixels');

  // ---- save/restore trap requires a receiver, matching how it is actually written ----
  // A bare `save()`/`restore()` call (no object) is not the Canvas 2D
  // save/restore this trap describes, and the pattern requires a leading
  // dot for exactly that reason — a bare call must not be flagged.
  {
    const withReceiver = scanSource('ctx.save();\nctx.restore();\n');
    assert.equal(withReceiver.bloat_trap_findings.filter((f) => f.check === 'save_restore').length, 2);

    const bareCall = scanSource('function save() {}\nsave();\n');
    assert.equal(bareCall.bloat_trap_findings.filter((f) => f.check === 'save_restore').length, 0,
      'a bare save() with no receiving object is not the Canvas 2D context trap and must not be flagged');
  }
  ok('scanSource\'s save_restore trap requires a dotted receiver (ctx.save()) and does not fire on an unrelated bare save() function');

  // ---- the_one_rule and scan_limits are always present --------------------
  {
    const result = scanSource('const x = 1;\n');
    assert.match(result.the_one_rule, /Seed the randomness/);
    assert.match(result.scan_limits, /not a parse/);
    assert.deepEqual(result.determinism_findings, []);
    assert.deepEqual(result.bloat_trap_findings, []);
  }
  ok('scanSource always reports the_one_rule and scan_limits, and reports empty (not missing) finding arrays for clean source');

  console.log(`\n${passed} reading.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
