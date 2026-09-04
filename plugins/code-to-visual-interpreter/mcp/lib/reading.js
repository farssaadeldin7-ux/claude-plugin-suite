/**
 * The code → visual reading aids: the degenerate-parameter table from the
 * skill, and a textual scan of source for the determinism and bloat-trap
 * markers the references name. The scan is line-by-line pattern matching, not
 * a parse — every finding quotes its evidence and line number, and the result
 * states what a textual scan cannot see.
 * Source: skills/code-to-visual-interpreter/SKILL.md (degenerate-parameter table)
 * and references/toolchain-notes.md (determinism and bloat-trap markers).
 */

import { ToolError } from '../mcp-lite.js';

// Where parameters degenerate, and what actually happens — ported from the
// skill's edge-condition table.
export const EDGE_CONDITIONS = [
  {
    condition: 'Noise frequency → 0',
    what_happens: 'Every sample returns the same value. The modulation vanishes and the structure collapses to its bare grid.',
  },
  {
    condition: 'Noise frequency > ~1 cycle per pixel',
    what_happens: 'Coherence is lost below the sample rate; output aliases into white noise that reads as static.',
  },
  {
    condition: 'Element radius ≥ half the grid spacing',
    what_happens: 'Neighbours overlap. With alpha accumulation this is a different pattern, not a denser one.',
  },
  {
    condition: 'Alpha below 1/255 (0.0039)',
    what_happens: 'Below the 8-bit destination floor. Accumulation never registers — the layer is invisible no matter how many passes.',
  },
  {
    condition: 'Flow-field step size > cell size',
    what_happens: 'Particles skip cells, streamlines cross each other, and the field stops reading as a field.',
  },
  {
    condition: 'Angle exactly 0 or π/2',
    what_happens: 'Rotations align with the pixel grid. Expect moiré and hard aliasing that does not appear at 0.01 rad.',
  },
  {
    condition: 'Any divisor reaching 0',
    what_happens: 'Canvas silently draws nothing for NaN coordinates. SVG emits an invalid path and may drop the whole element.',
  },
  {
    condition: 'p5 noise() treated as uniform',
    what_happens: 'Perlin output is clustered around 0.5 and rarely reaches 0 or 1. Remapping it linearly to a range gives a much narrower spread than expected.',
  },
];

export const EDGE_RULE =
  'Report the safe operating range for each parameter, not just the current value.';

// The determinism markers come first: the one rule is that an unseeded piece
// is unreviewable, named above anything about performance.
const DETERMINISM_PATTERNS = [
  {
    check: 'unseeded_random',
    pattern: /Math\.random\s*\(/,
    why: 'Math.random cannot be reseeded, so the piece cannot be regenerated — it is unreviewable. ' +
      'Name this above anything about performance. Use a seedable PRNG (mulberry32 or sfc32 in ' +
      'plain JS, randomSeed()/noiseSeed() in p5, d3.randomLcg(seed) in D3) and record the seed.',
  },
  {
    check: 'glsl_sin_hash',
    pattern: /12\.9898|43758\.5453/,
    why: 'The fract(sin(dot(...))) hash depends on the precision of sin and gives different results ' +
      'across GPU vendors and drivers — stable on one machine, not across machines. Use an integer ' +
      'hash (PCG-style) on uvec inputs, or sample a pre-generated noise texture.',
  },
  {
    check: 'noise_detail_global',
    pattern: /\bnoiseDetail\s*\(/,
    why: 'noiseDetail sets octave count and gain globally — setting it for one field changes every ' +
      'other noise call in the sketch.',
  },
];

const SEED_PATTERNS = [
  { pattern: /\brandomSeed\s*\(/, what: 'randomSeed() (p5 / Processing)' },
  { pattern: /\bnoiseSeed\s*\(/, what: 'noiseSeed() (p5 / Processing)' },
  { pattern: /d3\.randomLcg\s*\(/, what: 'd3.randomLcg()' },
  { pattern: /\bmulberry32\b/, what: 'mulberry32' },
  { pattern: /\bsfc32\b/, what: 'sfc32' },
];

// Known bloat-trap calls from the toolchain and budget references. The scan
// reports that a call is present; whether it sits in the hot loop is exactly
// what a textual scan cannot see, so each finding says what to check.
const TRAP_PATTERNS = [
  {
    check: 'create_graphics',
    pattern: /\bcreateGraphics\s*\(/,
    why: 'Each createGraphics call allocates a full framebuffer — roughly 8 MB at 1080p. Inside ' +
      'draw() the sketch dies within seconds; create buffers once in setup(). Check which function ' +
      'this call sits in — the scan cannot tell.',
  },
  {
    check: 'shadow_blur',
    pattern: /\bshadowBlur\b/,
    why: 'shadowBlur costs 5–20x the base draw. Pre-render a blurred sprite and drawImage it.',
  },
  {
    check: 'get_image_data',
    pattern: /\bgetImageData\s*\(/,
    why: 'getImageData forces a GPU→CPU sync and stalls the pipeline for 1–10 ms. Read once, or ' +
      'keep a parallel CPU-side buffer. Check whether this runs mid-frame.',
  },
  {
    check: 'load_pixels',
    pattern: /\b(?:loadPixels|updatePixels)\s*\(/,
    why: 'loadPixels/updatePixels each copy the full framebuffer in both directions — expensive ' +
      'when only a handful of pixels were read.',
  },
  {
    check: 'save_restore',
    pattern: /\.(?:save|restore)\s*\(\s*\)/,
    why: 'save()/restore() cost ~1 µs each; 10,000 pairs is 20 ms of nothing. Check whether the ' +
      'pair sits inside the per-element loop.',
  },
];

const scanLines = (lines, { check, pattern, why }, findings) => {
  lines.forEach((line, index) => {
    const match = pattern.exec(line);
    if (match) {
      findings.push({ check, evidence: line.trim().slice(0, 160), line: index + 1, matched: match[0], why });
    }
  });
};

/**
 * Scan source text for the markers above. Facts with evidence only — no
 * severity, no score. Interpreting a finding, and reading everything the
 * patterns cannot match, is the skill's job.
 */
export function scanSource(source) {
  const text = String(source ?? '');
  if (!text.trim()) {
    throw new ToolError('empty_source', 'Paste the source to scan — the actual code, not a description of it.');
  }
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const determinism = [];
  for (const spec of DETERMINISM_PATTERNS) scanLines(lines, spec, determinism);

  const seeding = [];
  for (const { pattern, what } of SEED_PATTERNS) {
    const index = lines.findIndex((l) => pattern.test(l));
    if (index !== -1) seeding.push({ what, first_seen_line: index + 1 });
  }

  const traps = [];
  for (const spec of TRAP_PATTERNS) scanLines(lines, spec, traps);

  const unseeded = determinism.some((f) => f.check === 'unseeded_random');
  return {
    the_one_rule: 'Seed the randomness and record the seed. Math.random makes a piece unreviewable.',
    determinism_findings: determinism,
    seeding_present: seeding,
    ...(unseeded && seeding.length
      ? {
          mixed_randomness_note: 'Seeded calls and Math.random appear in the same source. ' +
            'Math.random will not be reseeded, so the piece is irreproducible while looking as though it is not.',
        }
      : {}),
    bloat_trap_findings: traps,
    lines_scanned: lines.length,
    scan_limits: 'A line-by-line textual scan, not a parse. It cannot see aliased or dynamically ' +
      'constructed calls, cannot tell which function or loop a call sits in, and says nothing ' +
      'about code it does not match. It has not run or rendered anything.',
  };
}
