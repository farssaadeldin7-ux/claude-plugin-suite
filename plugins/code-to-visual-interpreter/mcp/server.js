#!/usr/bin/env node
/**
 * Code-to-Visual Interpreter — MCP server.
 *
 * The deterministic half of the method: the structure/modulation/surface
 * taxonomy with its discrimination tests, the degenerate-parameter table, the
 * per-toolchain notes, the budget arithmetic behind every switch point, a
 * textual scan of source for unseeded randomness and known bloat-trap calls,
 * and the preview loop: render_preview writes a self-contained HTML harness
 * for supplied CSS/Canvas 2D/GLSL code with a slider per extracted parameter,
 * and apply_params writes chosen values back into the source. The judgement
 * half — reading an image, choosing between candidate structures, writing the
 * implementation, deciding whether the result is any good — lives in the
 * skill, and nothing here renders code on the server, profiles hardware or
 * parses a language: extraction and rewriting are textual pattern matches on
 * declared constants, refused where ambiguous.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  STRUCTURES, MODULATIONS, MODULATION_NOTES, SURFACE, TESTS, FIVE_QUESTIONS,
  WORKED_EXAMPLES, matchStructures,
} from './lib/taxonomy.js';
import { EDGE_CONDITIONS, EDGE_RULE, scanSource } from './lib/reading.js';
import { TOOLCHAINS, toolchainFor } from './lib/toolchains.js';
import { costBudget, svgExportBudget, TECHNOLOGIES } from './lib/budgets.js';
import {
  KINDS, extractParameters, buildPreviewHtml, applyParams,
  CANVAS2D_EXPECTED_SHAPE, HARNESS_NOTE,
} from './lib/preview.js';
import fs from 'node:fs';
import path from 'node:path';

const PLUGIN_ID = 'code-to-visual-interpreter';
const PLUGIN_NAME = 'Code-to-Visual Interpreter';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the taxonomy, toolchain notes and edge-condition table stay
// open so the method can be evaluated before buying; the compute tools —
// structure matching, budget arithmetic, export sizing, source scanning —
// are licensed under the single 'tools' feature.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for translating between generative code and the geometry it produces. ' +
    'Call decomposition_taxonomy for the structure/modulation/surface tables and their tests, ' +
    'toolchain_notes for per-library strengths and traps, edge_conditions for where parameters ' +
    'degenerate. The licensed tools apply the tables: structure_match filters candidates from ' +
    'answers to the five questions, cost_budget and svg_export_budget do the switch-point and ' +
    'file-size arithmetic, source_scan finds determinism and bloat-trap markers in pasted source, ' +
    'render_preview writes a self-contained interactive HTML preview of supplied CSS, Canvas 2D ' +
    'or GLSL code with a slider per extracted parameter, and apply_params writes chosen values ' +
    'back into the source. Nothing here renders code on the server, profiles hardware or judges ' +
    'an image — that is the skill\'s job.',
});

// ---------------------------------------------------------------- reference

server.tool('decomposition_taxonomy', {
  description:
    'The decomposition tables: the ten structures with their visual signatures and core parameters, ' +
    'the seven modulations, the surface decisions, the discrimination tests, the five questions to ' +
    'ask of any image, and three worked decompositions. Lookup only — it does not look at an image. ' +
    'Omit layer to get everything.',
  inputSchema: {
    type: 'object',
    properties: {
      layer: {
        type: 'string',
        description: 'Optional single section: structure, modulation, surface, tests, questions or examples.',
      },
    },
  },
  handler: async ({ layer }) => {
    const sections = {
      structure: {
        note: 'The rule that decides where things go. Exactly one per piece.',
        structures: STRUCTURES.map(({ id, label, signature, core_parameters }) => ({ id, label, signature, core_parameters })),
      },
      modulation: {
        note: 'The rule that decides how each element differs. One, occasionally two. Never five.',
        modulations: MODULATIONS,
        ...MODULATION_NOTES,
      },
      surface: { note: 'How the mark is painted. One or two decisions, no more.', decisions: SURFACE },
      tests: TESTS,
      questions: {
        note: 'Answer these five and the decomposition writes itself. Skip them and you will produce ' +
          'code that reproduces one image rather than the family it came from.',
        questions: FIVE_QUESTIONS,
      },
      examples: WORKED_EXAMPLES,
    };
    if (layer) {
      if (!sections[layer]) {
        throw new ToolError('unknown_layer', `No layer "${layer}".`, { available: Object.keys(sections) });
      }
      return { [layer]: sections[layer] };
    }
    return sections;
  },
});

server.tool('toolchain_notes', {
  description:
    'Per-library notes for p5.js, three.js, GLSL, SVG, Canvas 2D, WebGL/WebGPU, D3 and Processing: ' +
    'what each is good at, its determinism story, and the bloat trap it reliably leads people into. ' +
    'Omit toolchain to list all of them.',
  inputSchema: {
    type: 'object',
    properties: {
      toolchain: { type: 'string', description: 'p5js, threejs, glsl, svg, canvas2d, webgl_webgpu, d3 or processing.' },
    },
  },
  handler: async ({ toolchain }) => {
    if (toolchain) {
      const entry = toolchainFor(toolchain);
      if (!entry) {
        throw new ToolError('unknown_toolchain', `No toolchain "${toolchain}".`, {
          available: Object.keys(TOOLCHAINS),
        });
      }
      return entry;
    }
    return {
      note: 'Name the trap when you recommend the tool.',
      toolchains: Object.fromEntries(
        Object.entries(TOOLCHAINS).map(([id, t]) => [id, { label: t.label, good_at: t.good_at }])
      ),
    };
  },
});

server.tool('edge_conditions', {
  description:
    'The degenerate-parameter table for reading generative code: what actually happens when noise ' +
    'frequency hits zero, alpha drops below the 8-bit floor, a radius exceeds half the grid ' +
    'spacing, a divisor reaches zero, and five more. Lookup only — it has not read any code.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({ conditions: EDGE_CONDITIONS, rule: EDGE_RULE }),
});

// ------------------------------------------------------- decomposition (paid)

server.tool('structure_match', {
  description:
    'Filter the structure table by answers to the five questions — placement, spacing, whether ' +
    'neighbours are similar, the largest and smallest visual scales. Returns every structure ' +
    'consistent with the answers, the modulation class the neighbours answer implies, and the ' +
    'octave estimate. Mechanical filtering on stated signatures: it narrows candidates, it does ' +
    'not identify a piece, and it has not seen the image. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      placement: { type: 'string', description: 'Do elements sit on a lattice, flow along paths, or neither: "lattice", "paths" or "neither".' },
      spacing: { type: 'string', description: '"constant", "gradient" or "clustered".' },
      neighbours: { type: 'string', description: 'Adjacent elements: "similar" or "unrelated".' },
      largest_scale: { type: 'number', description: 'Size of the largest visual blob, any consistent unit.' },
      smallest_scale: { type: 'number', description: 'Size of the smallest detail that is not just an edge, same unit.' },
    },
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return matchStructures(args);
  },
});

// ------------------------------------------------------------ budgets (paid)

server.tool('cost_budget', {
  description:
    'Place an element count against the switch-point table: the technology band it falls in, the ' +
    'per-technology arithmetic (SVG style recalculation, Canvas 2D call overhead batched and ' +
    'unbatched, WebGL draw calls, per-frame allocation), and — if a technology is stated — which ' +
    'side of its ceiling the count sits. Table lookup and multiplication only: it is not a ' +
    'profiler and every figure carries ±3x. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      elements: { type: 'number', description: 'Elements drawn per frame (animated) or in the output (static). Multiply nested loops out first.' },
      animated: { type: 'boolean', description: 'True if the piece animates. Static exports stretch further. Default false.' },
      technology: { type: 'string', description: `Optional current technology to check against its ceiling: ${TECHNOLOGIES.join(', ')}.` },
    },
    required: ['elements'],
  },
  handler: async ({ elements, animated, technology }) => {
    await client.requireFeature('tools');
    return costBudget({ elements, animated: Boolean(animated), technology: technology || null });
  },
});

server.tool('svg_export_budget', {
  description:
    'Estimate SVG path-data size from point count and coordinate precision, at every precision ' +
    'level, raw and gzipped — plus the Ramer-Douglas-Peucker epsilon and typical point reduction ' +
    'for a stated use case. Arithmetic from the byte table only: markup overhead is extra and the ' +
    'real file is larger. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      points: { type: 'number', description: 'Total path points across the export.' },
      precision: { type: 'string', description: 'Coordinate precision: "full", "6", "3" (default) or "integer".' },
      use_case: { type: 'string', description: 'Optional, for the RDP epsilon: zoomable_or_print, standard_web or background_texture.' },
      elements: { type: 'number', description: 'Optional element count, for the parse/layout band and the size wins.' },
    },
    required: ['points'],
  },
  handler: async ({ points, precision, use_case, elements }) => {
    await client.requireFeature('tools');
    return svgExportBudget({
      points,
      precision: precision ?? '3',
      use_case: use_case || null,
      elements: elements ?? null,
    });
  },
});

// ----------------------------------------------------------- reading (paid)

server.tool('source_scan', {
  description:
    'Line-by-line textual scan of pasted source for the determinism markers (Math.random, the GLSL ' +
    'sin hash, global noiseDetail, which seeding calls are present) and the known bloat-trap calls ' +
    '(createGraphics, shadowBlur, getImageData, loadPixels, save/restore). Every finding quotes ' +
    'its line. Not a parse: it cannot see aliased calls or tell which loop a call sits in, and it ' +
    'has not run or rendered anything. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'The source to scan — the actual code, including line breaks.' },
    },
    required: ['source'],
  },
  handler: async ({ source }) => {
    await client.requireFeature('tools');
    return scanSource(source);
  },
});

// ------------------------------------------------------------ preview (paid)

server.tool('render_preview', {
  description:
    'Turn supplied CSS, Canvas 2D or GLSL source into one self-contained interactive HTML file: ' +
    'the code running in a stage, one slider per extracted parameter (numeric literals attached ' +
    'to named constants — CSS custom properties, JS const/let/var, GLSL const and #define — plus ' +
    'detected GLSL float uniforms), live updates, and a copyable JSON block of the current values ' +
    'that feeds straight into apply_params. A canvas2d source must define draw(ctx, params, t); ' +
    'anything else is refused with the expected shape, never guessed at. The preview is a harness, ' +
    'not the user\'s environment. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: KINDS, description: 'What the code is: "css", "canvas2d" or "glsl".' },
      code: {
        type: 'string',
        minLength: 1,
        description: 'The source itself. css: the stylesheet, animations included. canvas2d: JS defining ' +
          'draw(ctx, params, t). glsl: a WebGL1 fragment shader; the harness supplies uniforms ' +
          '"resolution" (vec2) and "time" (float) if declared.',
      },
      html: { type: 'string', description: 'css only: optional markup snippet for the stage. Defaults to a single square subject element.' },
      out_path: { type: 'string', description: 'Where to write the HTML file. Defaults to ./cvi-preview.html.' },
    },
    required: ['kind', 'code'],
  },
  handler: async ({ kind, code, html, out_path }) => {
    await client.requireFeature('tools');
    if (!code.trim()) {
      throw new ToolError('empty_code', 'Pass the source itself — the actual code, not a description of it.');
    }
    if (html !== undefined && kind !== 'css') {
      throw new ToolError('html_only_for_css', 'The html stage snippet only applies to kind "css" — the other kinds render into a canvas.');
    }
    if (kind === 'canvas2d' && !/(?:\bfunction\s+draw\s*\(|(?:\bconst|\blet|\bvar)\s+draw\s*=)/.test(code)) {
      throw new ToolError('draw_entry_missing',
        'The canvas2d harness found no draw entry point in the code, so it will not guess at how to run it.',
        { expected_shape: CANVAS2D_EXPECTED_SHAPE });
    }
    const { parameters, ambiguous } = extractParameters(kind, code);
    const outPath = path.resolve(out_path || './cvi-preview.html');
    if (!/\.html?$/.test(outPath)) {
      throw new ToolError('bad_out_path', `out_path must end in .html, got "${out_path}".`);
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buildPreviewHtml({ kind, code, html, parameters }));
    return {
      file: outPath,
      kind,
      parameters: parameters.map(({ name, value, unit, min, max, step, line, source }) => ({
        name, value, ...(unit ? { unit } : {}), range: [min, max], step, line,
        declared_as: source.replace(/_/g, ' '),
      })),
      ...(ambiguous.length
        ? {
            ambiguous_names_without_sliders: ambiguous,
            ambiguity_note: 'A name declared more than once cannot be rewritten without guessing which ' +
              'declaration is meant, so it gets no slider. Rename the duplicates apart to expose them.',
          }
        : {}),
      round_trip: 'The page shows the current slider values as a copyable JSON block; pass that JSON ' +
        'to apply_params to write the chosen values back into the source.',
      harness_note: HARNESS_NOTE,
    };
  },
});

server.tool('apply_params', {
  description:
    'Deterministically rewrite named constants\' numeric literals in supplied source — the ' +
    'write-back half of render_preview\'s loop: values copied from the preview\'s JSON block feed ' +
    'straight in here. Handles CSS custom properties, JS const/let/var and GLSL const/#define ' +
    'declarations; units and float-ness are preserved. Any name that does not resolve to exactly ' +
    'one literal fails the whole call and nothing is rewritten — it never rewrites a guess. ' +
    'Returns the updated code and each change as old, new and line. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', minLength: 1, description: 'The source to rewrite — the same code the preview was generated from.' },
      params: {
        type: 'object',
        description: 'Parameter name to new numeric value, e.g. {"SPEED": 2.5} — the shape of the preview\'s JSON block.',
      },
    },
    required: ['code', 'params'],
  },
  handler: async ({ code, params }) => {
    await client.requireFeature('tools');
    const result = applyParams(code, params);
    return {
      ...result,
      note: 'Only the named literals changed; every other character of the source is untouched.',
    };
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
