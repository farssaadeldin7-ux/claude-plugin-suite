/**
 * Per-library notes ported from references/toolchain-notes.md: what each is
 * good at, how to make it deterministic, and the bloat trap it reliably leads
 * people into. Name the trap when recommending the tool.
 */

export const TOOLCHAINS = {
  p5js: {
    label: 'p5.js',
    good_at: 'Sketching an idea in twenty lines, teaching, static print output, anything where the ' +
      'loop is per-element rather than per-pixel. The shortest path from idea to mark.',
    weak_at: 'More than roughly 5,000 elements per frame, and anything needing a scene graph.',
    determinism: 'Genuinely good. randomSeed(n) and noiseSeed(n) cover random() and noise(). ' +
      'noiseDetail(octaves, falloff) sets octave count and gain globally — it is global state, so ' +
      'setting it for one field changes every other noise call in the sketch. Never mix in ' +
      'Math.random(): it will not be reseeded, and the piece becomes irreproducible while looking ' +
      'as though it is not.',
    bloat_trap: 'createGraphics() inside draw(). Each call allocates a full framebuffer — roughly ' +
      '8 MB at 1080p — and the sketch dies within seconds; create buffers once in setup(). ' +
      'Runner-up: loadPixels()/updatePixels() when only a handful of pixels were read, since each ' +
      'is a full framebuffer copy in both directions.',
    also_worth_knowing: 'p5\'s noise() clusters near 0.5 and rarely reaches the extremes, so a ' +
      'linear remap gives a much narrower spread than expected — measure the actual range before ' +
      'mapping. pixelDensity(1) on a retina display quarters the fragment work at a cost in ' +
      'sharpness, the cheapest fix when a sketch is near budget.',
  },
  threejs: {
    label: 'three.js',
    good_at: '3D scenes, cameras, lighting, loaded models, post-processing. The scene graph and ' +
      'material system are the value; without them it is a large WebGL wrapper.',
    determinism: 'No built-in PRNG. Bring mulberry32 and pass it explicitly. Do not use ' +
      'Math.random() in a geometry generator.',
    bloat_trap: 'One Mesh per object. Each is a draw call, and 1,000 of them is 100 ms of CPU per ' +
      'frame regardless of how simple the geometry is. Above roughly 100 objects sharing a ' +
      'geometry, use InstancedMesh and write per-instance data into the instance matrix or an ' +
      'InstancedBufferAttribute.',
    second_trap: 'Unique materials. Each distinct material is a shader compile of 10–100 ms taken ' +
      'on first render, showing as a stall the first time an object enters view. Share instances ' +
      'and vary colour through vertex or instance attributes.',
    third_trap: 'Rebuilding BufferGeometry every frame. Allocate once, mutate the attribute array ' +
      'in place, set attribute.needsUpdate = true.',
  },
  glsl: {
    label: 'GLSL fragment shaders',
    good_at: 'Per-pixel fields — noise, ray marching, reaction-diffusion, warping, gradients. ' +
      'Anything where every pixel does the same work with different coordinates. Effectively free ' +
      'once it fits the budget, because it does not touch the CPU.',
    weak_at: 'Per-element work. Testing every pixel against 500 circles is 500x the work of ' +
      'drawing them as geometry. A shader with a loop over objects is the wrong tool.',
    determinism: 'The weak point. The usual fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) ' +
      'hash relies on the precision of sin at large arguments, which varies by vendor and driver. ' +
      'It is stable on one machine and not across machines. For genuine reproducibility, use an ' +
      'integer hash on uvec inputs (PCG or similar) or sample a pre-generated noise texture.',
    bloat_trap: 'Octave inflation. Each additional fBm octave is another full noise evaluation ' +
      'across every pixel, and octaves beyond the fourth are usually below the visible detail ' +
      'threshold at typical display sizes. Before adding one, check whether the piece would ' +
      'survive at half resolution — halving both dimensions quarters the cost and for soft fields ' +
      'is invisible. Runner-up: noise(p) called separately for a colour, a displacement and a mask ' +
      'costs three evaluations. Compute it once into a variable.',
  },
  svg: {
    label: 'SVG',
    good_at: 'Vector output, print, zoomable interfaces, anything a designer must reopen in ' +
      'Illustrator or Figma, and anything that must be text-searchable or CSS-styled.',
    determinism: 'The file is the output, so it is inherently reproducible. Record the seed in a ' +
      'comment or a data-seed attribute on the root element — that is the only place it will survive.',
    bloat_trap: 'Full float precision on every coordinate. This alone routinely doubles file size ' +
      'and is fixed by rounding to three decimals on export.',
    second_trap: 'One element per mark when marks repeat. Two thousand identical circles should be ' +
      'one <symbol> and 2,000 <use> elements, or one <path> with 2,000 subpaths; inline style on ' +
      'every node duplicates the same string thousands of times where one class would do.',
    third_trap: 'Animating d or points re-rasterises the whole path every frame. Animating a ' +
      'transform on a group is composited and nearly free.',
  },
  canvas2d: {
    label: 'Canvas 2D',
    good_at: 'Getting a lot of marks onto a bitmap quickly, accumulation and alpha build-up, ' +
      'immediate-mode sketching. The realistic sweet spot is 500 to 10,000 elements.',
    determinism: 'None provided. Supply the PRNG.',
    bloat_trap: 'A beginPath / draw / fill triple per element. That is ~2 µs each and 10,000 of ' +
      'them is 20 ms. One beginPath, all the sub-paths, one fill is 2–4 ms. This only works when ' +
      'elements share fill and stroke, so sort draws by colour and issue one batch per colour.',
    second_trap: 'save()/restore() in the hot loop at ~1 µs a pair, and shadowBlur at 5–20x the ' +
      'base draw cost — pre-render a blurred sprite and drawImage it.',
    third_trap: 'getImageData() mid-frame forces a GPU-to-CPU sync and stalls the pipeline for ' +
      '1–10 ms. Read once, or keep a parallel CPU-side buffer.',
  },
  webgl_webgpu: {
    label: 'WebGL and WebGPU directly',
    good_at: '10,000 to millions of elements. Instancing turns element count into a buffer size ' +
      'rather than a loop. WebGL2 transform feedback and WebGPU compute shaders keep the ' +
      'simulation on the GPU entirely, so the CPU only issues one dispatch per frame.',
    determinism: 'Integer hashes only, as with GLSL. Floating-point accumulation across frames in ' +
      'a GPU simulation will also drift differently on different hardware — a long-running GPU ' +
      'particle simulation is not bit-reproducible even with a seeded start. Say so rather than ' +
      'promising it.',
    bloat_trap: 'Draw call count and per-object uniform uploads. One interleaved buffer and one ' +
      'instanced draw beats every micro-optimisation inside the shader.',
  },
  d3: {
    label: 'D3',
    good_at: 'Data binding, scales, axes, and the layout algorithms — force, hierarchy, geo ' +
      'projections, contours. Use it for the layout even when you render the result to canvas.',
    determinism: 'd3.randomLcg(seed) seeds the d3-random generators. Force simulations are ' +
      'deterministic given seeded initial positions and a fixed tick count, but not if you let ' +
      'them run on a timer, because the number of ticks then depends on frame timing. For a ' +
      'reproducible layout, run a fixed number of ticks synchronously.',
    bloat_trap: 'One DOM node per datum. Fine to 500, painful by 5,000. Above that, use D3 for ' +
      'the layout and draw with canvas. Runner-up: d3.select() inside a loop — each call ' +
      're-queries the DOM.',
  },
  processing: {
    label: 'Processing (Java)',
    good_at: 'Print resolution, long unattended runs, plotter output.',
    determinism: 'randomSeed() and noiseSeed(), same as p5.',
    bloat_trap: 'Vector output modes. size(w, h, PDF) and the SVG export record every single draw ' +
      'call as a vector object. A 10,000-stroke sketch at low alpha becomes a 200 MB PDF that ' +
      'Illustrator cannot open, because nothing is merged or culled. For print, render raster at ' +
      '3–4x the target dimensions instead, unless the output genuinely needs to be editable ' +
      'vectors — in which case reduce the stroke count first, not afterwards.',
  },
};

// Accept the obvious spellings — "p5.js", "three.js", "canvas-2d" — by
// normalising both sides to bare alphanumerics.
const normalise = (id) => String(id ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const BY_NORMALISED_ID = new Map(Object.keys(TOOLCHAINS).map((key) => [normalise(key), key]));

export function toolchainFor(id) {
  const key = BY_NORMALISED_ID.get(normalise(id));
  return key ? { id: key, ...TOOLCHAINS[key] } : null;
}
