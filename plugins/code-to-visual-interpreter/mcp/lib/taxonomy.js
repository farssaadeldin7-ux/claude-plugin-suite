/**
 * The decomposition taxonomy — structure, modulation, surface — ported from
 * references/decomposition-method.md, with the discrimination tests, the five
 * questions and the three worked decompositions. matchStructures applies the
 * tests the reference states mechanically; it filters candidates, it does not
 * identify a piece. Choosing between candidates by looking at the image is the
 * skill's job.
 */

import { ToolError } from '../mcp-lite.js';

// Layer 1 — the rule that decides where things go. Exactly one per piece.
// The placement/spacing tags drive matchStructures and come from each row's
// stated signature: "aligned on two axes" is a lattice, "follow continuous
// curved paths" is paths, and so on.
export const STRUCTURES = [
  {
    id: 'square-grid',
    label: 'Square grid',
    signature: 'Constant spacing, elements aligned on two axes',
    core_parameters: ['cell size', 'margin'],
    placement: 'lattice',
    spacing: 'constant',
  },
  {
    id: 'hex-lattice',
    label: 'Hex / triangular lattice',
    signature: 'Six-way or three-way symmetry, offset rows',
    core_parameters: ['cell size', 'row offset'],
    placement: 'lattice',
    spacing: 'constant',
  },
  {
    id: 'polar',
    label: 'Polar / radial',
    signature: 'Elements converge on a centre, spacing grows outward',
    core_parameters: ['rings', 'divisions per ring'],
    placement: 'lattice',
    spacing: 'gradient',
  },
  {
    id: 'flow-field',
    label: 'Flow field',
    signature: 'Elements follow continuous curved paths that never quite touch',
    core_parameters: ['seed count', 'step size', 'step count'],
    placement: 'paths',
    spacing: null,
  },
  {
    id: 'recursive-subdivision',
    label: 'Recursive subdivision',
    signature: 'Nested rectangles or triangles at several scales',
    core_parameters: ['depth', 'split ratio', 'split probability'],
    placement: 'lattice',
    spacing: null,
  },
  {
    id: 'l-system',
    label: 'L-system / branching',
    signature: 'Self-similar branching, thinning toward the tips',
    core_parameters: ['axiom', 'rules', 'depth', 'branch angle'],
    placement: 'paths',
    spacing: null,
  },
  {
    id: 'packing',
    label: 'Circle / shape packing',
    signature: 'Sizes vary, gaps are consistently tight, nothing overlaps',
    core_parameters: ['attempts', 'min/max radius', 'padding'],
    placement: 'neither',
    spacing: 'clustered',
  },
  {
    id: 'poisson-disc',
    label: 'Poisson-disc sampling',
    signature: 'Random-looking but with a visible minimum spacing',
    core_parameters: ['min distance', 'candidate attempts'],
    placement: 'neither',
    spacing: null,
  },
  {
    id: 'tiling',
    label: 'Tiling (Truchet, Wang)',
    signature: 'Repeated unit, contiguous lines crossing cell borders',
    core_parameters: ['tile set', 'cell size'],
    placement: 'lattice',
    spacing: 'constant',
  },
  {
    id: 'particle-attractors',
    label: 'Particle system with attractors',
    signature: 'Density clusters, trails, no lattice at all',
    core_parameters: ['count', 'forces', 'integration step'],
    placement: 'paths',
    spacing: 'clustered',
  },
];

// Layer 2 — the rule that decides how each element differs. One, occasionally
// two. Never five.
export const MODULATIONS = [
  {
    id: 'noise',
    label: 'Value / Perlin / simplex noise',
    reads_as: 'Neighbours are similar; smooth continuous drift',
    parameters: ['dimensionality (2D/3D/4D)', 'frequency', 'octaves', 'lacunarity (~2.0)', 'gain (~0.5)'],
  },
  {
    id: 'curl-noise',
    label: 'Curl noise',
    reads_as: 'Swirling, divergence-free, no sources or sinks',
    parameters: ['frequency', 'epsilon used for the derivative'],
  },
  {
    id: 'sine',
    label: 'Sine / harmonic',
    reads_as: 'Regular, predictable, periodic',
    parameters: ['frequency', 'phase', 'amplitude'],
  },
  {
    id: 'easing',
    label: 'Easing curve on t',
    reads_as: 'Acceleration or bunching along one axis',
    parameters: ['which easing', 'applied to what'],
  },
  {
    id: 'per-element-random',
    label: 'Per-element seeded random',
    reads_as: 'Neighbours are unrelated; visually crunchy',
    parameters: ['seed', 'distribution', 'range'],
  },
  {
    id: 'gradient-by-position',
    label: 'Gradient by position',
    reads_as: 'Monotonic change across the frame',
    parameters: ['axis', 'mapping function'],
  },
  {
    id: 'time',
    label: 'Time',
    reads_as: 'Only present in animation',
    parameters: ['rate', 'whether it loops'],
  },
];

export const MODULATION_NOTES = {
  octaves:
    'Count the distinct visual scales — the size of the largest blob, and the size of the smallest ' +
    'detail that is not just an edge. Roughly log2(largest / smallest) octaves. Three or four covers ' +
    'most images; asking for eight is usually asking for expensive noise nobody can see.',
  distribution:
    'Uniform random gives an even spread. Gaussian clusters around the mean and gives an occasional ' +
    'outlier. random()^2 biases hard toward zero and is how you get "mostly small, a few large" ' +
    'without a special case. State which you used.',
};

// Layer 3 — how the mark is painted. One or two decisions, no more.
export const SURFACE = [
  'Stroke or fill, and whether weight varies (and with what).',
  'Opacity, and whether the piece depends on accumulation. Accumulation is a structural choice, ' +
    'not a finishing touch — an image built from 2,000 strokes at alpha 0.03 looks nothing like ' +
    'the same strokes at alpha 1.0.',
  'Blend mode. multiply darkens and keeps hue, screen and lighter build toward white, overlay ' +
    'raises contrast. If overlaps read as glow, it is additive.',
  'Colour mapping — from what quantity? Position, noise value, element index and velocity all ' +
    'look different. Sampling from a fixed palette of four to six looks designed; sampling a ' +
    'continuous HSL sweep looks generated.',
  'Background, including whether elements are drawn onto it once or every frame.',
];

// The discrimination tests, stated verbatim so they can be quoted back.
export const TESTS = {
  grid_versus_flow:
    'Cover half the image. If you can predict where an element sits in the covered half, it is a ' +
    'lattice. If you can only predict the direction it travels, it is a field.',
  grid_versus_packing:
    'Measure gaps. Constant gaps with varying element size means a grid. Constant tightness with ' +
    'varying size means packing.',
  continuous_or_independent:
    'Look at any two adjacent elements. If they are similar, the modulation is a noise field or a ' +
    'gradient. If they are unrelated, it is per-element random. Getting this backwards is the most ' +
    'common decomposition error, and it is immediately visible in the result.',
};

export const FIVE_QUESTIONS = [
  'Is there a repeating unit, and what is its size relative to the frame?',
  'Do elements sit on a lattice, or flow along paths?',
  'Is spacing constant, gradient, or clustered? Clustered means packing or attractors, never a grid.',
  'Are neighbouring elements similar (noise) or unrelated (per-element random)?',
  'Does the depth come from overlap order, opacity accumulation, or a blend mode?',
];

export const WORKED_EXAMPLES = [
  {
    id: 'noise-flow-field',
    label: 'Noise flow field',
    description: 'The ubiquitous "curved lines across the canvas" piece.',
    structure:
      'Flow field. Seed points on a jittered grid or by Poisson-disc sampling, each integrated ' +
      'forward through an angle field. Euler steps of 2–5 px, 100–400 steps.',
    modulation:
      'One 2D simplex noise field, sampled at frequency 0.002–0.005 per pixel, mapped to angle ' +
      'over 0 to 2π (or 0 to 4π for more turbulence per unit of noise).',
    surface:
      'Low-alpha stroke, 0.5–2 px, colour drawn once per streamline from a small palette. Overlap ' +
      'accumulation supplies all the depth.',
    failure_mode:
      'Adding a second noise field for colour and a third for width — the result is mud, because ' +
      'three independent modulations destroy the coherence that made the field legible.',
    cost:
      '5,000 streamlines × 200 steps = 1,000,000 line segments. That is Canvas 2D territory with ' +
      'batched paths, not SVG — as SVG it would be roughly 15 MB of path data before simplification.',
  },
  {
    id: 'truchet-tiling',
    label: 'Truchet tiling',
    structure: 'Square grid, typically 20–60 cells across.',
    modulation:
      'One seeded discrete choice per cell, selecting one of two (or four) tile orientations. No ' +
      'continuous modulation at all.',
    surface: 'A single stroke weight, arcs of radius exactly half the cell.',
    failure_mode:
      'Explaining the long meandering paths with modulation. They are a structural property: arc ' +
      'endpoints land on cell-edge midpoints, so adjacent tiles always connect. If your ' +
      'decomposition of a Truchet pattern contains noise, it is wrong.',
    cost:
      '40 × 40 = 1,600 arcs. Trivially SVG, and it should be SVG, because two tile shapes as ' +
      '<symbol> plus 1,600 <use> elements is a few kilobytes.',
  },
  {
    id: 'circle-packing',
    label: 'Circle packing',
    structure:
      'Greedy packing. Pick a candidate point, grow its radius until it touches an existing circle ' +
      'or the frame, keep it if it exceeds a minimum radius, repeat for a fixed attempt budget.',
    modulation:
      'The maximum radius cap as a function of position — from an image\'s luminance, or from a ' +
      'noise field. This one modulation is what makes the packing read as a picture rather than as foam.',
    surface: 'Stroke-only circles at one weight, or fill sampled from the same source image.',
    failure_mode:
      'Naive packing tests every candidate against every placed circle: 5,000 circles is roughly ' +
      '12.5 million distance checks and will hang a browser tab. Use a spatial hash grid with cell ' +
      'size equal to the maximum diameter and test only the nine neighbouring cells — roughly linear.',
    cost: 'See failure mode — the cost is in the packing loop, not the drawing.',
  },
];

const PLACEMENTS = ['lattice', 'paths', 'neither'];
const SPACINGS = ['constant', 'gradient', 'clustered'];
const NEIGHBOURS = ['similar', 'unrelated'];

/**
 * Filter the structure table by answers to the five questions. Mechanical
 * filtering on the stated signatures only: the result is the set of structures
 * consistent with the answers, never a single identification.
 */
export function matchStructures({ placement, spacing, neighbours, largest_scale, smallest_scale } = {}) {
  if (placement && !PLACEMENTS.includes(placement)) {
    throw new ToolError('invalid_answer', `"${placement}" is not a placement answer.`, { valid: PLACEMENTS });
  }
  if (spacing && !SPACINGS.includes(spacing)) {
    throw new ToolError('invalid_answer', `"${spacing}" is not a spacing answer.`, { valid: SPACINGS });
  }
  if (neighbours && !NEIGHBOURS.includes(neighbours)) {
    throw new ToolError('invalid_answer', `"${neighbours}" is not a neighbours answer.`, { valid: NEIGHBOURS });
  }
  if (!placement && !spacing && !neighbours && largest_scale == null && smallest_scale == null) {
    throw new ToolError('no_answers', 'Answer at least one of the five questions.', {
      questions: FIVE_QUESTIONS,
    });
  }

  const rulesApplied = [];
  let candidates = STRUCTURES;

  if (placement) {
    candidates = candidates.filter((s) => s.placement === placement);
    rulesApplied.push(`Placement "${placement}": ${TESTS.grid_versus_flow}`);
  }
  if (spacing === 'clustered') {
    // The reference is emphatic here, so the filter is exact, not permissive.
    candidates = candidates.filter((s) => s.spacing === 'clustered');
    rulesApplied.push('Spacing "clustered": clustered means packing or attractors, never a grid.');
  } else if (spacing) {
    candidates = candidates.filter((s) => s.spacing === spacing || s.spacing === null);
    rulesApplied.push(`Spacing "${spacing}": structures whose stated signature contradicts it are excluded.`);
  }

  const result = {
    candidates: candidates.map(({ id, label, signature, core_parameters }) => ({
      id, label, signature, core_parameters,
    })),
    rules_applied: rulesApplied,
  };

  if (!candidates.length) {
    result.note =
      'No structure in the table is consistent with all the answers — one of them is wrong. ' +
      'Re-run the discrimination tests on the image.';
    result.tests = TESTS;
  } else if (candidates.length > 1) {
    result.next_tests = TESTS;
  }

  if (neighbours) {
    result.modulation = {
      rule: TESTS.continuous_or_independent,
      candidates: neighbours === 'similar'
        ? MODULATIONS.filter((m) => ['noise', 'gradient-by-position'].includes(m.id))
        : MODULATIONS.filter((m) => m.id === 'per-element-random'),
    };
  }

  if (largest_scale != null || smallest_scale != null) {
    if (!(largest_scale > 0) || !(smallest_scale > 0) || largest_scale <= smallest_scale) {
      throw new ToolError('invalid_scales',
        'largest_scale and smallest_scale must both be positive, in the same units, with largest > smallest.');
    }
    const octaves = Math.log2(largest_scale / smallest_scale);
    result.octave_estimate = {
      octaves_exact: Number(octaves.toFixed(1)),
      octaves_suggested: Math.max(1, Math.round(octaves)),
      how: 'log2(largest_scale / smallest_scale)',
      note: MODULATION_NOTES.octaves,
    };
  }

  result.caveat =
    'Candidates consistent with the answers, not an identification. Most generative images are one ' +
    'structure plus one or two modulations — a decomposition that needs five modulations is almost ' +
    'always the wrong structure. Whether a candidate actually fits is judged by re-reading the image.';
  return result;
}
