/**
 * The budget tables and the arithmetic behind them, ported from
 * references/performance-budgets.md. Every figure here is an order-of-magnitude
 * guide derived from the arithmetic shown, not a measurement of anyone's
 * machine — ±3x is normal variance, and every result says so.
 */

import { ToolError } from '../mcp-lite.js';

export const VARIANCE_NOTE =
  'Order-of-magnitude estimate from stated arithmetic, not a measurement. Treat ±3x as normal ' +
  'variance — more between an integrated and a discrete GPU. This says which side of a switch ' +
  'point you are on, not what your frame time or file size will be.';

export const FRAME_BUDGET = {
  frame_ms: 16.7,
  own_code_ms: 10,
  why: '60 fps is 16.7 ms per frame, and the browser needs several of those for style, layout, ' +
    'paint and compositing. Budget 10 ms for your own code.',
};

export const BYTE_BUDGET = {
  comfortable: '100 KB gzipped',
  someone_complains: '300 KB gzipped',
  a_bug: '1 MB gzipped',
  svg_gzip_ratio: 'SVG gzips at roughly 4–6x — quote raw and gzipped.',
};

// Bytes per path point at each coordinate precision.
export const SVG_PRECISION = [
  { precision: 'full', bytes_per_point: 37, note: 'Full float (toString() default), ~18 bytes per coordinate.' },
  { precision: '6', bytes_per_point: 21 },
  { precision: '3', bytes_per_point: 15, note: 'A thousandth of a user unit, invisible at any zoom a browser supports.' },
  { precision: 'integer', bytes_per_point: 7, note: 'Viable only when one unit is already sub-pixel at the largest display size; a 100-unit viewBox on a 4K display gives visible stair-stepping on diagonals.' },
];

export const PRECISION_RULE =
  'Rounding to three decimals typically halves the file and never changes the image — do it on ' +
  'every export, unconditionally.';

export const RDP_EPSILON = [
  { use_case: 'zoomable_or_print', epsilon_device_px: '0.2', typical_point_reduction: '50–70%' },
  { use_case: 'standard_web', epsilon_device_px: '0.5', typical_point_reduction: '70–90%' },
  { use_case: 'background_texture', epsilon_device_px: '1.0–2.0', typical_point_reduction: '85–95%' },
];

export const RDP_NOTES = [
  'Epsilon is in coordinate units — convert if the viewBox is not 1:1 with display pixels.',
  'RDP is O(n log n) typically, O(n²) on adversarial input, so simplify per-path.',
  'Before running it, drop duplicate points and collapse collinear runs; loops produce both.',
];

export const SVG_ELEMENT_BANDS = [
  { up_to: 1000, verdict: 'Fine, including per-element CSS.' },
  { up_to: 5000, verdict: 'Static is fine but style recalculation is noticeable on any class change.' },
  { up_to: 20000, verdict: 'Static only — parse and layout run into hundreds of ms.' },
  { up_to: null, verdict: 'Use canvas or pre-rasterise.' },
];

export const SVG_ANIMATION_LIMIT = {
  elements: 500,
  arithmetic: 'A transform change per element costs 20–50 µs including style recalculation and ' +
    'paint invalidation, so 500 × 40 µs = 20 ms, already over budget. Animating one group ' +
    'transform is composited and costs nothing; animating d or points re-rasterises the whole ' +
    'path every frame.',
};

export const SVG_SIZE_WINS =
  'In order of payoff: <use> with <symbol> for repeated geometry, classes instead of inline ' +
  'style per node, one <path> with many subpaths instead of many <path> elements, and a group ' +
  'transform instead of a per-node transform.';

export const CANVAS_COSTS = {
  per_call_us: [1, 5],
  principle: 'Fill rate is rarely the constraint — per-call overhead is. Ten thousand individual ' +
    'path draws is 10,000 × ~2 µs = 20 ms, over budget. One beginPath, 10,000 moveTo/arc pairs ' +
    'and one fill is 2–4 ms, fine. Batching only works when elements share fill and stroke, so ' +
    'group by colour: six colours means six batches, not 10,000.',
  operations: [
    { operation: 'save() / restore()', cost: '~1 µs each; 10,000 pairs is 20 ms of nothing' },
    { operation: 'fillStyle assignment', cost: 'Breaks batching — sort draws by colour' },
    { operation: 'shadowBlur', cost: '5–20x the base draw; pre-render to a sprite instead' },
    { operation: 'getImageData', cost: '1–10 ms; forces a GPU→CPU sync and stalls the pipeline' },
    { operation: 'drawImage from a canvas', cost: '~5–20 µs; cheaper than re-drawing complex geometry' },
  ],
};

export const ALLOCATION_RULE = {
  arithmetic: 'One object per element per frame at 10,000 elements and 60 fps is 600,000 objects ' +
    'per second. Minor GC runs constantly, and every few seconds a major collection produces a ' +
    '5–20 ms pause that reads as a stutter.',
  target: 'Zero allocation inside the animation loop: pre-allocated Float32Arrays rather than ' +
    'arrays of objects, reused scratch vectors, no map/filter/closures in the hot loop, no ' +
    'per-frame string building. A rising sawtooth in the memory timeline is the diagnostic.',
};

export const WEBGL_COSTS = {
  draw_call_ms: [0.05, 0.15],
  arithmetic: 'A draw call costs roughly 0.05–0.15 ms of CPU time in validation and state setup, ' +
    'independent of how much geometry it draws. 1,000 separate meshes is 1,000 × 0.1 ms = 100 ms ' +
    'per frame, hopeless. One instanced draw of 100,000 instances is ~0.1 ms.',
  targets: 'Under 100 draw calls per frame; the switch to InstancedMesh pays off at around 100 ' +
    'objects sharing a geometry. Each unique material is a shader compile of 10–100 ms stalling ' +
    'on first render — share materials and pre-warm by rendering one frame off-screen.',
};

export const FRAGMENT_BUDGET = {
  arithmetic: 'Full-screen at 1920×1080 and 60 fps is 2.07 M × 60 = 124 million fragment ' +
    'invocations per second. Four octaves of 3D simplex noise is roughly 300–500 ALU ops, so ' +
    'about 40–60 GFLOP/s. Integrated GPUs deliver on the order of 300–800 GFLOP/s in practice.',
  safe_budget: 'Three to four octaves full-screen on integrated graphics; eight octaves needs a ' +
    'discrete GPU or half-resolution rendering.',
  first_lever: 'Always resolution, not octaves. Halving both dimensions quarters the fragment ' +
    'cost and for a soft noise field the upscale is usually invisible. Reducing octaves changes ' +
    'the image; reducing resolution mostly does not.',
};

export const SWITCH_POINTS = [
  { elements: 'Up to 500 (animated)', technology: 'DOM / SVG nodes', why: 'Style recalculation reaches 10 ms' },
  { elements: 'Up to 20,000 (static)', technology: 'SVG', why: 'Parse and layout grow past 5,000; above 20,000, canvas or pre-rasterise' },
  { elements: '500 – 10,000', technology: 'Canvas 2D, batched by colour', why: 'Per-call overhead reaches 10 ms' },
  { elements: '10,000 – 100,000', technology: 'WebGL instanced', why: 'Draw call count, and CPU-side per-object work' },
  { elements: 'Above 100,000', technology: 'Transform feedback or WebGPU compute', why: 'CPU cannot update the buffer in 10 ms' },
];

export const SWITCH_RULE =
  'Cross a switch point and the fix is a change of technology, not micro-optimisation. Below ' +
  'one, micro-optimisation is wasted effort.';

// Per-technology ceilings for the "which side am I on" check. Each figure is
// traceable to the budgets or toolchain references.
const TECHNOLOGY_CEILINGS = {
  svg: {
    label: 'SVG / DOM',
    animated: 500,
    static: 20000,
    why: 'Animated: style recalculation reaches 10 ms at ~500 elements. Static: parse and layout run into hundreds of ms past 5,000; above 20,000, canvas or pre-rasterise.',
  },
  canvas2d: {
    label: 'Canvas 2D',
    animated: 10000,
    static: 10000,
    why: 'Per-call overhead reaches 10 ms at ~10,000 elements even batched by colour.',
  },
  webgl: {
    label: 'WebGL / three.js instanced',
    animated: 100000,
    static: 100000,
    why: 'Above 100,000 the CPU cannot update the buffer in 10 ms — move the simulation to transform feedback or WebGPU compute.',
  },
  p5: {
    label: 'p5.js',
    animated: 5000,
    static: 5000,
    why: 'p5.js is weak above roughly 5,000 elements per frame.',
  },
  d3_dom: {
    label: 'D3 with DOM nodes',
    animated: 500,
    static: 5000,
    why: 'One DOM node per datum is fine to 500, painful by 5,000. Above that, use D3 for the layout and draw with canvas.',
  },
};

export const TECHNOLOGIES = Object.keys(TECHNOLOGY_CEILINGS);

const msRange = (elements, [lowUs, highUs]) => ({
  low_ms: Number(((elements * lowUs) / 1000).toFixed(2)),
  high_ms: Number(((elements * highUs) / 1000).toFixed(2)),
});

/**
 * Place an element count against the switch-point table and show the
 * arithmetic for each candidate technology. Deterministic table lookup and
 * multiplication — nothing here has seen the code or the machine.
 */
export function costBudget({ elements, animated = false, technology = null }) {
  if (!Number.isFinite(elements) || elements <= 0) {
    throw new ToolError('invalid_elements', 'elements must be a positive number.');
  }
  const n = Math.round(elements);

  let band;
  if (animated) {
    if (n <= 500) band = { technology: 'DOM or SVG nodes', detail: 'Fine, including animated.' };
    else if (n <= 10000) band = { technology: 'Canvas 2D', detail: 'Draws batched into a single path, grouped by colour.' };
    else if (n <= 100000) band = { technology: 'WebGL instanced rendering', detail: 'One draw call.' };
    else band = { technology: 'GPU-side state', detail: 'Transform feedback (WebGL2) or compute (WebGPU).' };
  } else {
    const svgBand = SVG_ELEMENT_BANDS.find((b) => b.up_to === null || n <= b.up_to);
    band = n <= 20000
      ? { technology: 'SVG or Canvas 2D', detail: `As SVG: ${svgBand.verdict}` }
      : { technology: 'Canvas 2D or pre-rasterise', detail: svgBand.verdict };
  }

  const arithmetic = {
    svg_animated: {
      per_element: '20–50 µs per animated transform change, including style recalculation',
      estimate: msRange(n, [20, 50]),
    },
    canvas2d_unbatched: {
      per_element: '1–5 µs per beginPath/draw/fill triple',
      estimate: msRange(n, [1, 5]),
    },
    canvas2d_batched: {
      per_element: 'from the 2–4 ms per 10,000 sub-paths figure; one beginPath, one fill per colour group',
      estimate: msRange(n, [0.2, 0.4]),
    },
    webgl_one_draw_per_object: {
      per_element: '0.05–0.15 ms of CPU per draw call, independent of geometry',
      estimate: msRange(n, [50, 150]),
    },
    webgl_instanced: { estimate_ms: '~0.1 per instanced draw, whatever the instance count' },
  };

  const result = {
    elements: n,
    animated,
    recommended: band,
    switch_points: SWITCH_POINTS,
    rule: SWITCH_RULE,
  };

  if (animated) {
    result.frame_budget = FRAME_BUDGET;
    result.arithmetic = arithmetic;
    result.allocation = {
      objects_per_second_if_allocating_per_element: n * 60,
      ...ALLOCATION_RULE,
    };
  } else {
    result.arithmetic = {
      note: 'Static output — the frame arithmetic does not apply; the levers are coordinate ' +
        'precision and point count. Use svg_export_budget for file size.',
    };
  }

  if (technology) {
    const tech = TECHNOLOGY_CEILINGS[technology];
    if (!tech) {
      throw new ToolError('unknown_technology', `No technology "${technology}".`, { available: TECHNOLOGIES });
    }
    const ceiling = animated ? tech.animated : tech.static;
    result.stated_technology = {
      technology: tech.label,
      ceiling,
      within_ceiling: n <= ceiling,
      why: tech.why,
    };
  }

  result.note = VARIANCE_NOTE;
  return result;
}

const PRECISION_ALIASES = { full: 'full', 6: '6', 3: '3', 0: 'integer', integer: 'integer' };

/**
 * Estimate SVG path-data size from point count and coordinate precision, and
 * look up the RDP epsilon for a stated use case. Multiplication against the
 * ported byte table; markup overhead is extra and the result says so.
 */
export function svgExportBudget({ points, precision = '3', use_case = null, elements = null }) {
  if (!Number.isFinite(points) || points <= 0) {
    throw new ToolError('invalid_points', 'points must be a positive number — the total path points across the export.');
  }
  const key = PRECISION_ALIASES[String(precision).toLowerCase()];
  if (!key) {
    throw new ToolError('unknown_precision', `No precision "${precision}".`, {
      available: ['full', '6', '3', 'integer'],
    });
  }
  const n = Math.round(points);
  // KB here is 1,000 bytes, matching the reference's own arithmetic
  // (5,000 points × ~15 bytes at three decimals = 75 KB).
  const sizeAt = (row, count) => {
    const raw = count * row.bytes_per_point;
    return {
      bytes_per_point: `~${row.bytes_per_point}`,
      raw_kb: Number((raw / 1000).toFixed(1)),
      gzipped_kb_range: [Number((raw / 6 / 1000).toFixed(1)), Number((raw / 4 / 1000).toFixed(1))],
    };
  };
  const chosen = SVG_PRECISION.find((r) => r.precision === key);

  const result = {
    points: n,
    precision: key,
    path_data: sizeAt(chosen, n),
    at_each_precision: Object.fromEntries(SVG_PRECISION.map((r) => [r.precision, sizeAt(r, n)])),
    precision_rule: PRECISION_RULE,
    byte_budget: BYTE_BUDGET,
  };

  if (use_case) {
    const row = RDP_EPSILON.find((r) => r.use_case === use_case);
    if (!row) {
      throw new ToolError('unknown_use_case', `No use case "${use_case}".`, {
        available: RDP_EPSILON.map((r) => r.use_case),
      });
    }
    const [lowPct, highPct] = row.typical_point_reduction.replace('%', '').split('–').map(Number);
    const pointsAfter = [Math.round(n * (1 - highPct / 100)), Math.round(n * (1 - lowPct / 100))];
    result.simplification = {
      use_case,
      rdp_epsilon: `${row.epsilon_device_px} device px`,
      typical_point_reduction: row.typical_point_reduction,
      points_after_range: pointsAfter,
      path_data_after_range_kb: [
        sizeAt(chosen, pointsAfter[0]).raw_kb,
        sizeAt(chosen, pointsAfter[1]).raw_kb,
      ],
      notes: RDP_NOTES,
    };
  } else {
    result.simplification = { note: 'Pass use_case for the RDP epsilon and typical reduction.', table: RDP_EPSILON };
  }

  if (elements != null) {
    if (!Number.isFinite(elements) || elements <= 0) {
      throw new ToolError('invalid_elements', 'elements must be a positive number.');
    }
    const e = Math.round(elements);
    const bandRow = SVG_ELEMENT_BANDS.find((b) => b.up_to === null || e <= b.up_to);
    result.element_count = {
      elements: e,
      static_verdict: bandRow.verdict,
      animated_limit: SVG_ANIMATION_LIMIT,
      size_wins: SVG_SIZE_WINS,
    };
  }

  result.note =
    'Path-data arithmetic only — element markup, attributes and styles are extra, so the real ' +
    'file is larger. ' + VARIANCE_NOTE;
  return result;
}
