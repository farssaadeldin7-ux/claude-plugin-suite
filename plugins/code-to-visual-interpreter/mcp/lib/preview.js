/**
 * The preview generator and its inverse: turn supplied CSS, Canvas 2D or GLSL
 * source into a single self-contained HTML file with one slider per extracted
 * parameter, and write chosen slider values back into the source.
 *
 * Parameter extraction is textual and deterministic, in the same spirit as
 * reading.js's scanSource: a fixed set of patterns for numeric literals
 * attached to named constants (CSS custom properties, JS const/let/var
 * declarations, GLSL const and #define declarations) plus detected GLSL float
 * uniforms. A name that matches more than one literal is ambiguous — it gets
 * no slider and apply_params refuses to rewrite it. Nothing here parses a
 * language, and nothing is ever rewritten on a guess.
 */

import { ToolError } from '../mcp-lite.js';

// One numeric literal, no exponent — the same shape every pattern below reuses.
const NUM = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';

// Each pattern captures (prefix, name, infix, literal[, unit]) so the
// literal's exact character offset can be recorded: offset = match.index +
// prefix.length + name.length + infix.length.
const PATTERNS = {
  // --speed: 12; or --speed: 1.5s; — a CSS custom property whose value opens
  // with a number. The unit is kept and re-attached on every rewrite.
  css_custom_property: new RegExp(
    `(--)([A-Za-z][\\w-]*)(\\s*:\\s*)(${NUM})([a-zA-Z%]*)(?=\\s*[;}])`, 'g'
  ),
  // const SPEED = 1.5; — only when the literal is the whole initialiser, so
  // `const x = 5 * 2` is never treated as a parameter with value 5, and never
  // inside a for-loop header, where `let i = 0` is a counter, not a constant.
  js_const: new RegExp(
    `((?<!\\bfor\\s*\\(\\s*)\\b(?:const|let|var)\\s+)([A-Za-z_$][\\w$]*)(\\s*=\\s*)(${NUM})(?=\\s*(?:;|,|\\r?\\n|$))`, 'g'
  ),
  // #define SPEED 1.5
  glsl_define: new RegExp(
    `(^[ \\t]*#define[ \\t]+)([A-Za-z_]\\w*)([ \\t]+)(${NUM})(?=[ \\t]*\\r?$)`, 'gm'
  ),
  // const float SPEED = 1.5;
  glsl_const: new RegExp(
    `(\\bconst\\s+(?:float|int)\\s+)([A-Za-z_]\\w*)(\\s*=\\s*)(${NUM})(?=\\s*;)`, 'g'
  ),
};

// uniform float u_scale; — no literal in WebGL1, so no offset to record. The
// harness drives these directly as uniforms.
const GLSL_FLOAT_UNIFORM = /\buniform\s+float\s+([A-Za-z_]\w*)\s*;/g;

// The harness sets these itself every frame; they are not user parameters.
const HARNESS_UNIFORMS = new Set(['time', 'resolution']);

const PATTERNS_BY_KIND = {
  css: ['css_custom_property'],
  canvas2d: ['js_const'],
  glsl: ['glsl_define', 'glsl_const'],
};

export const KINDS = Object.keys(PATTERNS_BY_KIND);

const lineOf = (code, offset) => code.slice(0, offset).split('\n').length;

/**
 * The slider range rule, applied identically to every parameter: a value in
 * 0..1 gets the range 0..1 (step 0.01); anything else gets value ±100%. The
 * step preserves the literal's own granularity — an integer literal steps by
 * whole numbers, a decimal literal by 1/100 of the span.
 */
export function sliderRange(value, raw) {
  if (value >= 0 && value <= 1) return { min: 0, max: 1, step: 0.01 };
  const span = Math.abs(value);
  const min = value - span;
  const max = value + span;
  let step = (max - min) / 100;
  if (!String(raw).includes('.')) step = Math.max(1, Math.round(step));
  return { min, max, step };
}

function collectMatches(code, patternNames) {
  const found = [];
  for (const patternName of patternNames) {
    const re = new RegExp(PATTERNS[patternName].source, PATTERNS[patternName].flags);
    let m;
    while ((m = re.exec(code)) !== null) {
      const [, prefix, name, infix, raw, unit] = m;
      const start = m.index + prefix.length + name.length + infix.length;
      found.push({
        name,
        value: Number(raw),
        raw,
        unit: unit || '',
        start,
        end: start + raw.length,
        line: lineOf(code, start),
        source: patternName,
      });
    }
  }
  return found;
}

/**
 * Extract the parameter table for one kind of source. Returns:
 *   parameters — one entry per unambiguous name, with the literal's offsets
 *                (GLSL uniforms carry no offsets: there is no literal),
 *   ambiguous  — names that matched more than one literal, with every line,
 *                excluded from sliders because rewriting one of several
 *                same-named literals would be a guess.
 */
export function extractParameters(kind, code) {
  if (!PATTERNS_BY_KIND[kind]) {
    throw new ToolError('unknown_kind', `No preview kind "${kind}".`, { available: KINDS });
  }
  const matches = collectMatches(code, PATTERNS_BY_KIND[kind]);

  if (kind === 'glsl') {
    const re = new RegExp(GLSL_FLOAT_UNIFORM.source, GLSL_FLOAT_UNIFORM.flags);
    let m;
    while ((m = re.exec(code)) !== null) {
      const name = m[1];
      if (HARNESS_UNIFORMS.has(name)) continue;
      // A WebGL1 uniform carries no default literal, so there is nothing to
      // anchor a range on. The documented rule: it starts at 1 with the fixed
      // range 0..2. apply_params cannot rewrite it (no literal).
      matches.push({
        name,
        value: 1,
        raw: '1.0',
        unit: '',
        start: null,
        end: null,
        line: lineOf(code, m.index),
        source: 'glsl_uniform',
      });
    }
  }

  const byName = new Map();
  for (const match of matches) {
    if (!byName.has(match.name)) byName.set(match.name, []);
    byName.get(match.name).push(match);
  }

  const parameters = [];
  const ambiguous = [];
  for (const [name, group] of byName) {
    if (group.length > 1) {
      ambiguous.push({ name, lines: group.map((g) => g.line), count: group.length });
      continue;
    }
    const p = group[0];
    parameters.push({
      ...p,
      ...(p.source === 'glsl_uniform' ? { min: 0, max: 2, step: 0.02 } : sliderRange(p.value, p.raw)),
    });
  }
  return { parameters, ambiguous };
}

/** Format a value as a source literal, preserving the old literal's shape:
 *  its unit is re-attached by the caller, and a literal that had a decimal
 *  point keeps one — so a GLSL float constant stays a float. */
export function formatLiteral(value, oldRaw) {
  let s = String(value);
  if (/e/i.test(s)) {
    s = value.toFixed(12).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  if (String(oldRaw).includes('.') && !s.includes('.')) s += '.0';
  return s;
}

/**
 * Rewrite exactly the named constants' literals in the source and report each
 * change. Kind-agnostic: every literal-bearing pattern is scanned, so the
 * same call handles CSS, JS and GLSL source. All-or-nothing — any name that
 * cannot be resolved to exactly one literal fails the whole call, and nothing
 * is rewritten.
 */
export function applyParams(code, params) {
  const text = String(code ?? '');
  if (!text.trim()) {
    throw new ToolError('empty_code', 'Pass the source to rewrite — the actual code, not a description of it.');
  }
  const entries = Object.entries(params ?? {});
  if (!entries.length) {
    throw new ToolError('no_params', 'params is empty — name at least one parameter to rewrite.');
  }
  for (const [name, value] of entries) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ToolError('invalid_value', `params.${name} must be a finite number, got ${JSON.stringify(value)}.`);
    }
  }

  const matches = collectMatches(text, Object.keys(PATTERNS));
  const byName = new Map();
  for (const match of matches) {
    if (!byName.has(match.name)) byName.set(match.name, []);
    byName.get(match.name).push(match);
  }

  // Resolve every requested name before touching anything.
  const edits = [];
  for (const [name, value] of entries) {
    const group = byName.get(name);
    if (!group) {
      const detail = { available: [...byName.keys()] };
      if (new RegExp(`\\buniform\\s+float\\s+${name}\\s*;`).test(text)) {
        throw new ToolError('no_literal',
          `"${name}" is declared as a uniform with no default literal in the source — there is nothing to rewrite. ` +
          'Set it at runtime where the uniform is uploaded instead.', detail);
      }
      throw new ToolError('unknown_name',
        `No named constant "${name}" with a numeric literal was found in the source. Nothing was rewritten.`, detail);
    }
    if (group.length > 1) {
      throw new ToolError('ambiguous_name',
        `"${name}" matches ${group.length} literals (lines ${group.map((g) => g.line).join(', ')}) — ` +
        'rewriting one of them would be a guess. Rename the duplicates apart first. Nothing was rewritten.',
        { lines: group.map((g) => g.line) });
    }
    edits.push({ ...group[0], newValue: value });
  }

  // Apply from the end of the file backwards so earlier offsets stay valid.
  edits.sort((a, b) => b.start - a.start);
  let updated = text;
  const changes = [];
  for (const edit of edits) {
    const literal = formatLiteral(edit.newValue, edit.raw);
    updated = updated.slice(0, edit.start) + literal + updated.slice(edit.end);
    changes.push({
      name: edit.name,
      from: edit.raw + edit.unit,
      to: literal + edit.unit,
      line: edit.line,
      declared_as: edit.source,
    });
  }
  changes.sort((a, b) => a.line - b.line);
  return { code: updated, changes };
}

// -------------------------------------------------------------- HTML harness

/** Embed a string in an inline <script> without ever closing it early. */
const embed = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/\u{2028}/gu, '\\u2028')
  .replace(/\u{2029}/gu, '\\u2029');

export const CANVAS2D_EXPECTED_SHAPE =
  'The code must define a function named "draw" taking (ctx, params, t): ' +
  '`function draw(ctx, params, t) { ... }` or `const draw = (ctx, params, t) => { ... }`. ' +
  'The harness calls it once per animation frame with the 2D context, the current ' +
  'slider values keyed by name, and the elapsed time in seconds. Top-level constants ' +
  'above it become sliders and are rewritten live.';

export const HARNESS_NOTE =
  'The preview is a harness: it runs the supplied code inside its own page, canvas or ' +
  'WebGL1 quad, so behaviour identical to your own environment is not guaranteed — ' +
  'check anything that matters back in the real context.';

const PAGE_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 system-ui, sans-serif; background: #16181d; color: #e6e6e6; }
  header { padding: 12px 20px; border-bottom: 1px solid #2c2f36; }
  header h1 { font-size: 15px; margin: 0; font-weight: 600; }
  header p { margin: 4px 0 0; color: #9aa0aa; font-size: 12px; max-width: 70em; }
  main { display: flex; flex-wrap: wrap; gap: 20px; padding: 20px; align-items: flex-start; }
  #stage-wrap { flex: 1 1 480px; min-width: 320px; background: #0d0e11; border: 1px solid #2c2f36;
    border-radius: 6px; padding: 16px; min-height: 320px; display: flex; align-items: center; justify-content: center; }
  canvas { max-width: 100%; height: auto; display: block; }
  aside { flex: 0 1 340px; min-width: 280px; }
  .param { margin-bottom: 14px; }
  .param label { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 2px; }
  .param label code { color: #9aa0aa; }
  .param input[type=range] { width: 100%; }
  .param .meta { font-size: 11px; color: #6d7480; }
  h2 { font-size: 13px; margin: 20px 0 6px; font-weight: 600; }
  pre { background: #0d0e11; border: 1px solid #2c2f36; border-radius: 6px; padding: 10px;
    font-size: 12px; overflow: auto; margin: 0; }
  #error { color: #ff8f8f; margin: 0 20px 20px; white-space: pre-wrap; }
  button { background: #2c2f36; color: #e6e6e6; border: 1px solid #454a54; border-radius: 4px;
    padding: 5px 12px; font: inherit; font-size: 12px; cursor: pointer; margin-top: 8px; }
  button:hover { background: #383d46; }
  .quiet { color: #6d7480; font-size: 12px; }
`;

const STAGES = {
  css: '<div id="stage"></div><style id="user-css"></style>',
  canvas2d: '<canvas id="stage" width="640" height="480"></canvas>',
  glsl: '<canvas id="stage" width="640" height="480"></canvas>',
};

// The default subject for a CSS preview when no markup snippet is supplied.
const DEFAULT_CSS_STAGE =
  '<div class="cvi-subject" style="width:120px;height:120px;background:#5a8bd6;border-radius:8px;"></div>';

// Per-kind runtime. Each defines applySource(src) — called once at load and
// again whenever a slider changes a constant — and may define onFrame/onParam.
const RUNTIMES = {
  css: `
    var stage = document.getElementById('stage');
    stage.innerHTML = STAGE_HTML;
    var styleEl = document.getElementById('user-css');
    function applySource(src) { styleEl.textContent = src; clearError(); }
    function onParam() { applySource(currentSource()); }
  `,
  canvas2d: `
    var canvas = document.getElementById('stage');
    var ctx = canvas.getContext('2d');
    var draw = null;
    var started = performance.now();
    function applySource(src) {
      try {
        var fn = new Function(src + '\\n;return (typeof draw === "function") ? draw : null;')();
        if (!fn) throw new Error('The code did not define a function named "draw".');
        draw = fn;
        clearError();
      } catch (err) {
        draw = null;
        showError('Could not build draw() from the source:\\n' + err.message);
      }
    }
    function onParam() { applySource(currentSource()); }
    function frame(now) {
      if (draw) {
        try {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          draw(ctx, state, (now - started) / 1000);
        } catch (err) {
          draw = null;
          showError('draw() threw:\\n' + err.message);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  `,
  glsl: `
    var canvas = document.getElementById('stage');
    var gl = canvas.getContext('webgl');
    var program = null;
    var locations = {};
    var started = performance.now();
    var UNIFORM_PARAMS = PARAMS.filter(function (p) { return p.source === 'glsl_uniform'; })
      .map(function (p) { return p.name; });
    if (!gl) {
      showError('WebGL is not available in this browser, so the shader cannot run.');
    } else {
      var quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    }
    var VERTEX_SRC = 'attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }';
    function compile(type, src) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(log || 'shader failed to compile');
      }
      return shader;
    }
    function applySource(src) {
      if (!gl) return;
      try {
        var vs = compile(gl.VERTEX_SHADER, VERTEX_SRC);
        var fs = compile(gl.FRAGMENT_SHADER, src);
        var next = gl.createProgram();
        gl.attachShader(next, vs);
        gl.attachShader(next, fs);
        gl.linkProgram(next);
        if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(next) || 'program failed to link');
        }
        if (program) gl.deleteProgram(program);
        program = next;
        gl.useProgram(program);
        var position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        locations = {
          resolution: gl.getUniformLocation(program, 'resolution'),
          time: gl.getUniformLocation(program, 'time'),
        };
        UNIFORM_PARAMS.forEach(function (name) {
          locations[name] = gl.getUniformLocation(program, name);
        });
        clearError();
      } catch (err) {
        showError('Shader did not compile:\\n' + err.message);
      }
    }
    function onParam(name) {
      var p = PARAMS.filter(function (q) { return q.name === name; })[0];
      if (!p || p.start === null) applySource(currentSource());
    }
    function frame(now) {
      if (gl && program) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (locations.resolution) gl.uniform2f(locations.resolution, canvas.width, canvas.height);
        if (locations.time) gl.uniform1f(locations.time, (now - started) / 1000);
        UNIFORM_PARAMS.forEach(function (name) {
          if (locations[name]) gl.uniform1f(locations[name], state[name]);
        });
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  `,
};

const SHARED_RUNTIME = `
  var state = {};
  PARAMS.forEach(function (p) { state[p.name] = p.value; });

  var errorEl = document.getElementById('error');
  function showError(message) { errorEl.hidden = false; errorEl.textContent = message; }
  function clearError() { errorEl.hidden = true; errorEl.textContent = ''; }

  // The same literal-formatting rule the server's apply_params uses, so the
  // preview and the writer never disagree about what a value looks like.
  function formatLiteral(value, oldRaw) {
    var s = String(value);
    if (/e/i.test(s)) s = value.toFixed(12).replace(/(\\.\\d*?)0+$/, '$1').replace(/\\.$/, '');
    if (String(oldRaw).indexOf('.') !== -1 && s.indexOf('.') === -1) s += '.0';
    return s;
  }

  // Splice the current slider values into the original source at the recorded
  // literal offsets, applied back-to-front so earlier offsets stay valid.
  function currentSource() {
    var src = SOURCE;
    PARAMS.filter(function (p) { return p.start !== null; })
      .sort(function (a, b) { return b.start - a.start; })
      .forEach(function (p) {
        src = src.slice(0, p.start) + formatLiteral(state[p.name], p.raw) + src.slice(p.end);
      });
    return src;
  }

  var jsonEl = document.getElementById('param-json');
  function renderJson() { jsonEl.textContent = JSON.stringify(state, null, 2); }

  var slidersEl = document.getElementById('sliders');
  PARAMS.forEach(function (p) {
    var wrap = document.createElement('div');
    wrap.className = 'param';
    var label = document.createElement('label');
    var nameEl = document.createElement('span');
    nameEl.textContent = p.name + (p.unit ? ' (' + p.unit + ')' : '');
    var valueEl = document.createElement('code');
    valueEl.textContent = String(p.value);
    label.appendChild(nameEl);
    label.appendChild(valueEl);
    var input = document.createElement('input');
    input.type = 'range';
    input.min = p.min; input.max = p.max; input.step = p.step; input.value = p.value;
    var meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = p.min + ' to ' + p.max + ' — ' + p.source.replace(/_/g, ' ') + ', line ' + p.line;
    input.addEventListener('input', function () {
      state[p.name] = Number(input.value);
      valueEl.textContent = input.value;
      renderJson();
      onParam(p.name);
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(meta);
    slidersEl.appendChild(wrap);
  });
  if (!PARAMS.length) {
    slidersEl.innerHTML = '<p class="quiet">No adjustable parameters were found in the source.</p>';
  }

  document.getElementById('copy-json').addEventListener('click', function () {
    var text = JSON.stringify(state, null, 2);
    var done = function () {};
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (err) { /* selection still works by hand */ }
  });

  renderJson();
`;

const KIND_LABELS = { css: 'CSS animation', canvas2d: 'Canvas 2D', glsl: 'GLSL fragment shader' };

/**
 * Build the whole self-contained preview page: no external assets, all user
 * content embedded as JSON and injected by script, never parsed as markup.
 */
export function buildPreviewHtml({ kind, code, html, parameters }) {
  const stageHtml = kind === 'css' ? embed(html || DEFAULT_CSS_STAGE) : 'null';
  const paramData = parameters.map(({ name, value, raw, unit, start, end, line, source, min, max, step }) => (
    { name, value, raw, unit, start, end, line, source, min, max, step }
  ));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CVI preview — ${KIND_LABELS[kind]}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<header>
  <h1>Code-to-Visual Interpreter — ${KIND_LABELS[kind]} preview</h1>
  <p>${HARNESS_NOTE}</p>
</header>
<main>
  <section id="stage-wrap">${STAGES[kind]}</section>
  <aside>
    <div id="sliders"></div>
    <h2>Current parameters</h2>
    <pre id="param-json"></pre>
    <button id="copy-json" type="button">Copy JSON</button>
    <p class="quiet">Paste this JSON into the apply_params tool to write these values back into the source.</p>
  </aside>
</main>
<pre id="error" hidden></pre>
<script>
var KIND = ${embed(kind)};
var SOURCE = ${embed(code)};
var STAGE_HTML = ${stageHtml};
var PARAMS = ${embed(paramData)};
${SHARED_RUNTIME}
${RUNTIMES[kind]}
applySource(currentSource());
</script>
</body>
</html>
`;
}
