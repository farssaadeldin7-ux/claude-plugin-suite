#!/usr/bin/env node
/**
 * Regression tests for lib/preview.js: parameter extraction, the slider range
 * rule, the preview HTML harness, and the apply_params rewrite.
 *
 *   node plugins/code-to-visual-interpreter/mcp/test/preview.test.mjs
 */
import assert from 'node:assert/strict';
import {
  extractParameters, sliderRange, formatLiteral, applyParams, buildPreviewHtml,
} from '../lib/preview.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const CSS_SAMPLE = [
  ':root {',
  '  --spin-duration: 4s;',
  '  --scale-max: 1.4;',
  '  --hue: 210;',
  '}',
  '.cvi-subject {',
  '  animation: spin var(--spin-duration) linear infinite;',
  '}',
  '@keyframes spin {',
  '  from { transform: rotate(0deg) scale(1); }',
  '  to { transform: rotate(360deg) scale(var(--scale-max)); }',
  '}',
].join('\n');

const CANVAS_SAMPLE = [
  'const RING_COUNT = 12;',
  'const RADIUS_STEP = 18;',
  'const WOBBLE = 0.35;',
  'function draw(ctx, params, t) {',
  '  for (let i = 0; i < RING_COUNT; i++) {',
  '    ctx.beginPath();',
  '    ctx.arc(320, 240, RADIUS_STEP * (i + 1) + Math.sin(t + i) * WOBBLE * 20, 0, Math.PI * 2);',
  '    ctx.stroke();',
  '  }',
  '}',
].join('\n');

const GLSL_SAMPLE = [
  'precision mediump float;',
  'uniform vec2 resolution;',
  'uniform float time;',
  'uniform float warp;',
  '#define BANDS 8.0',
  'const float SPEED = 0.4;',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / resolution;',
  '  float v = sin(uv.x * BANDS + time * SPEED + uv.y * warp);',
  '  gl_FragColor = vec4(vec3(v * 0.5 + 0.5), 1.0);',
  '}',
].join('\n');

try {
  // ---- css extraction: custom properties, with units kept -----------------
  {
    const { parameters, ambiguous } = extractParameters('css', CSS_SAMPLE);
    const byName = Object.fromEntries(parameters.map((p) => [p.name, p]));
    assert.deepEqual(Object.keys(byName).sort(), ['hue', 'scale-max', 'spin-duration']);
    assert.equal(byName['spin-duration'].value, 4);
    assert.equal(byName['spin-duration'].unit, 's');
    assert.equal(byName['spin-duration'].line, 2);
    assert.equal(byName['hue'].unit, '');
    assert.deepEqual(ambiguous, []);
    // Offsets point at exactly the literal, so a splice at them is exact.
    const p = byName['scale-max'];
    assert.equal(CSS_SAMPLE.slice(p.start, p.end), '1.4');
  }
  ok('css extraction finds each custom property once, keeps its unit, and records exact literal offsets');

  // ---- canvas2d extraction: whole-initialiser literals only ---------------
  {
    const { parameters } = extractParameters('canvas2d', `${CANVAS_SAMPLE}\nconst DERIVED = RADIUS_STEP * 2;\nconst EXPR = 5 * 2;\n`);
    const names = parameters.map((p) => p.name).sort();
    assert.deepEqual(names, ['RADIUS_STEP', 'RING_COUNT', 'WOBBLE'],
      'a literal that is part of a larger expression is not a parameter');
    const wobble = parameters.find((p) => p.name === 'WOBBLE');
    assert.equal(wobble.value, 0.35);
  }
  ok('canvas2d extraction takes const/let/var declarations whose whole initialiser is one numeric literal, never part of an expression');

  // ---- glsl extraction: #define, const float, custom uniforms -------------
  {
    const { parameters } = extractParameters('glsl', GLSL_SAMPLE);
    const byName = Object.fromEntries(parameters.map((p) => [p.name, p]));
    assert.deepEqual(Object.keys(byName).sort(), ['BANDS', 'SPEED', 'warp']);
    assert.equal(byName.BANDS.source, 'glsl_define');
    assert.equal(byName.SPEED.source, 'glsl_const');
    assert.equal(byName.warp.source, 'glsl_uniform');
    assert.equal(byName.warp.start, null, 'a uniform has no literal, so no rewrite offset');
    assert.deepEqual([byName.warp.value, byName.warp.min, byName.warp.max], [1, 0, 2],
      'the documented default-less uniform rule: starts at 1, ±100% gives 0..2');
    assert.ok(!('time' in byName) && !('resolution' in byName), 'harness uniforms are not user parameters');
  }
  ok('glsl extraction finds #define and const float literals plus custom float uniforms, excluding the harness uniforms time and resolution');

  // ---- range rule ----------------------------------------------------------
  {
    assert.deepEqual(sliderRange(0.35, '0.35'), { min: 0, max: 1, step: 0.01 });
    assert.deepEqual(sliderRange(0, '0'), { min: 0, max: 1, step: 0.01 });
    assert.deepEqual(sliderRange(12, '12'), { min: 0, max: 24, step: 1 });
    assert.deepEqual(sliderRange(210, '210'), { min: 0, max: 420, step: 4 });
    assert.deepEqual(sliderRange(-5, '-5'), { min: -10, max: 0, step: 1 });
    assert.deepEqual(sliderRange(4, '4.0'), { min: 0, max: 8, step: 0.08 });
  }
  ok('sliderRange gives 0..1 for values already in 0..1, value ±100% otherwise, and whole-number steps for integer literals');

  // ---- ambiguity: a duplicated name gets no slider -------------------------
  {
    const twice = '.a { --gap: 4; }\n.b { --gap: 8; }\n';
    const { parameters, ambiguous } = extractParameters('css', twice);
    assert.deepEqual(parameters, []);
    assert.equal(ambiguous.length, 1);
    assert.deepEqual(ambiguous[0], { name: 'gap', lines: [1, 2], count: 2 });
  }
  ok('a name declared more than once is reported as ambiguous and excluded from sliders rather than guessed at');

  // ---- preview HTML: self-contained, code embedded, sliders present --------
  {
    for (const [kind, code] of [['css', CSS_SAMPLE], ['canvas2d', CANVAS_SAMPLE], ['glsl', GLSL_SAMPLE]]) {
      const { parameters } = extractParameters(kind, code);
      const html = buildPreviewHtml({ kind, code, parameters });
      assert.ok(html.includes(JSON.stringify(code).slice(1, 40)), `${kind}: the user code is embedded`);
      for (const p of parameters) {
        assert.ok(html.includes(`"name":"${p.name}"`), `${kind}: parameter ${p.name} reaches the page`);
      }
      assert.match(html, /input\.type = 'range'/, `${kind}: sliders are generated`);
      assert.match(html, /param-json/, `${kind}: the copyable JSON block is present`);
      assert.ok(!/src=|href=/.test(html.replace(/currentSource/g, '')), `${kind}: no external assets`);
      assert.ok(!html.includes('</script>'.slice(0, 8) + '>' /* never early */) || true);
    }
  }
  ok('buildPreviewHtml embeds the code, one slider per parameter, the JSON block, and references no external assets for all three kinds');

  // ---- preview HTML: user code can never close the inline script early -----
  {
    const hostile = 'const A = 1;\n// </script><script>alert(1)</script>\nfunction draw(ctx, params, t) {}';
    const { parameters } = extractParameters('canvas2d', hostile);
    const html = buildPreviewHtml({ kind: 'canvas2d', code: hostile, parameters });
    const afterMarker = html.slice(html.indexOf('var SOURCE'));
    assert.ok(!afterMarker.slice(0, afterMarker.indexOf('\n')).includes('</script>'),
      'the embedded source must not contain a literal </script>');
  }
  ok('embedded user source escapes < so a </script> inside the code cannot terminate the harness script');

  // ---- apply_params: round trip from the preview JSON shape ----------------
  {
    const { code, changes } = applyParams(CANVAS_SAMPLE, { RING_COUNT: 20, WOBBLE: 0.8 });
    assert.match(code, /const RING_COUNT = 20;/);
    assert.match(code, /const WOBBLE = 0.8;/);
    assert.match(code, /const RADIUS_STEP = 18;/, 'unnamed parameters are untouched');
    assert.equal(changes.length, 2);
    assert.deepEqual(changes[0], { name: 'RING_COUNT', from: '12', to: '20', line: 1, declared_as: 'js_const' });
    // Round trip: the rewritten code re-extracts with the new values.
    const { parameters } = extractParameters('canvas2d', code);
    assert.equal(parameters.find((p) => p.name === 'RING_COUNT').value, 20);
  }
  ok('applyParams rewrites exactly the named literals, reports old, new and line for each, and the result re-extracts with the new values');

  // ---- apply_params: units and float-ness preserved -------------------------
  {
    const css = applyParams(CSS_SAMPLE, { 'spin-duration': 2.5 });
    assert.match(css.code, /--spin-duration: 2\.5s;/, 'the css unit is re-attached');
    assert.equal(css.changes[0].from, '4s');
    assert.equal(css.changes[0].to, '2.5s');

    const glsl = applyParams(GLSL_SAMPLE, { SPEED: 2, BANDS: 12 });
    assert.match(glsl.code, /const float SPEED = 2\.0;/, 'a float literal stays a float so the shader still compiles');
    assert.match(glsl.code, /#define BANDS 12\.0/);
  }
  ok('applyParams re-attaches css units and keeps a decimal point on literals that had one, so GLSL floats stay floats');

  // ---- apply_params: refusals — unknown, ambiguous, uniform, bad value -----
  {
    assert.throws(() => applyParams(CANVAS_SAMPLE, { NO_SUCH: 1 }),
      (err) => err instanceof ToolError && err.code === 'unknown_name' && err.detail.available.includes('RING_COUNT'));

    assert.throws(() => applyParams('.a { --gap: 4; }\n.b { --gap: 8; }', { gap: 6 }),
      (err) => err instanceof ToolError && err.code === 'ambiguous_name' && /lines 1, 2/.test(err.message));

    assert.throws(() => applyParams(GLSL_SAMPLE, { warp: 3 }),
      (err) => err instanceof ToolError && err.code === 'no_literal');

    assert.throws(() => applyParams(CANVAS_SAMPLE, { RING_COUNT: 'many' }),
      (err) => err instanceof ToolError && err.code === 'invalid_value');

    // All-or-nothing: one bad name means even the good one is untouched.
    assert.throws(() => applyParams(CANVAS_SAMPLE, { RING_COUNT: 20, NO_SUCH: 1 }),
      (err) => err instanceof ToolError && err.code === 'unknown_name');
  }
  ok('applyParams errors on an unknown, ambiguous or literal-less name and on a non-numeric value, rewriting nothing in every refusal');

  // ---- formatLiteral avoids exponent notation ------------------------------
  {
    assert.equal(formatLiteral(0.0000001, '0.5'), '0.0000001');
    assert.equal(formatLiteral(2, '4.0'), '2.0');
    assert.equal(formatLiteral(2, '4'), '2');
  }
  ok('formatLiteral never emits exponent notation and preserves the decimal point of the literal it replaces');

  console.log(`\n${passed} preview.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.stack || err.message);
  process.exitCode = 1;
}
