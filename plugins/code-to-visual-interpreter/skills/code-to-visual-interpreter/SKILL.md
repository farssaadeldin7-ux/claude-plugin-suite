---
name: code-to-visual-interpreter
description: >
  This skill should be used when someone needs to translate between generative code and the
  image it produces, in either direction — "what does this shader actually draw", "explain
  this p5 sketch", "how would I code this pattern", "recreate this generative image", "turn
  this flow field into code", "what happens if I set the noise scale to zero", "why does my
  canvas animation drop frames", "this generated SVG is 4 MB", "reduce the file size of this
  export", "should this be SVG or canvas", "convert these particles to instanced geometry".
  Also use it for reviewing generative code before it ships, for choosing between p5.js,
  three.js, GLSL, SVG, Canvas 2D, WebGL and D3 for a described visual, and for deciding which
  parameters to expose to a designer.
metadata:
  version: "0.1.0"
---

# Code-to-Visual Interpreter

Translate in both directions between generative code and the geometry it produces, and
keep the resulting asset lean rather than bloated.

These are two different jobs and they fail differently. **Code → visual** is a reading
task, and the risk is describing what the code appears to intend rather than what it
will execute. **Visual → code** is a decomposition task, and the risk is reproducing the
image with a pile of special cases instead of finding the small generative rule
underneath it. Establish which direction you are in first — the order of operations is
not the same.

## The one rule

**Seed the randomness and record the seed. `Math.random` makes a piece unreviewable.**

Say this at the first opportunity, before any other advice. An unseeded artefact cannot
be regenerated, so it cannot be reviewed, diffed, iterated on or handed over. Every
parameter table you write about it describes a frame that no longer exists.

Reading code: if you find `Math.random()` anywhere in generation, name it as the first
finding, above anything about performance. Writing code: use a small seedable PRNG
(`mulberry32` or `sfc32` in plain JS, `randomSeed()`/`noiseSeed()` in p5,
`d3.randomLcg(seed)` in D3) and print the seed into the output as metadata.

GLSL needs care. The usual `fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453)`
hash depends on the precision of `sin` and gives different results across GPU vendors
and drivers — it is not deterministic across devices. For anything reproducible, use an
integer hash (PCG-style) on `uvec` inputs, or sample a pre-generated noise texture.

## Sequence

### 1. Code → visual: read in execution order, not reading order

Do not describe the sketch top to bottom. Resolve it in this order:

1. **Coordinate space.** Dimensions, pixel density, whether Y is down (Canvas, SVG, p5
   2D) or up (WebGL clip space, three.js), and every transform on the stack at the point
   of drawing. A `scale()` left un-popped is the commonest reason code does not draw
   what its author thinks.
2. **Iteration count.** Multiply out every nested loop and recursion. Branching factor
   `b` to depth `d` is `b^d` marks — a modest-looking `b=3, d=10` is 59,049. State the
   number: it determines both the look and the cost.
3. **The mark.** What one iteration draws: a line, an arc, a fragment.
4. **The modulation.** What varies the mark's position, size or colour, and at what
   frequency relative to the structure's spacing.
5. **Surface state.** Stroke, fill, alpha, blend mode — and *where it is set*. Canvas 2D
   state leaks across iterations unless saved and restored.

### 2. Code → visual: evaluate the edges before you describe the middle

The value of reading code is knowing where it degenerates. Work through these:

| Condition | What actually happens |
| --- | --- |
| Noise frequency → 0 | Every sample returns the same value. The modulation vanishes and the structure collapses to its bare grid. |
| Noise frequency > ~1 cycle per pixel | Coherence is lost below the sample rate; output aliases into white noise that reads as static. |
| Element radius ≥ half the grid spacing | Neighbours overlap. With alpha accumulation this is a different pattern, not a denser one. |
| Alpha below 1/255 (0.0039) | Below the 8-bit destination floor. Accumulation never registers — the layer is invisible no matter how many passes. |
| Flow-field step size > cell size | Particles skip cells, streamlines cross each other, and the field stops reading as a field. |
| Angle exactly 0 or π/2 | Rotations align with the pixel grid. Expect moiré and hard aliasing that does not appear at 0.01 rad. |
| Any divisor reaching 0 | Canvas silently draws nothing for NaN coordinates. SVG emits an invalid path and may drop the whole element. |
| p5 `noise()` treated as uniform | Perlin output is clustered around 0.5 and rarely reaches 0 or 1. Remapping it linearly to a range gives a much narrower spread than expected. |

Report the safe operating range for each parameter, not just the current value.

### 3. Visual → code: decompose into structure, modulation, surface

This is the core craft. Separate the image into exactly three layers: **structure** (the
underlying grid, field, packing or recursion — one of these), **modulation** (noise,
easing, or seeded randomness with a stated seed and distribution — one, occasionally
two), and **surface** (stroke, fill, blend mode, opacity, colour mapping).

**Most generative images are one structure plus one or two modulations.** A
decomposition that needs five modulations is almost always the wrong structure — go
back and re-read the image rather than adding a sixth.

`references/decomposition-method.md` has the full taxonomy of each layer, the questions
to ask when looking at an image, and worked decompositions of three well-known patterns.
Use it rather than improvising a decomposition.

### 4. Build the parameter table before the implementation

Every parameter gets a name, a default, a usable range and one line on what moving it
does. The range matters more than the default — it tells a designer where the piece
stops working.

### 5. Cost the asset before you write it, not after

Bloat is the failure mode this skill exists to prevent, and it is nearly always cheaper
to design around than to fix afterwards. Two figures decide the technology:

**Element count** — the switch points are sharp:

| Elements | Technology |
| --- | --- |
| Up to ~500 | DOM or SVG nodes are fine, including animated |
| 500 – 10,000 | Canvas 2D, with draws batched into a single path |
| 10,000 – 100,000 | WebGL instanced rendering, one draw call |
| Above 100,000 | GPU-side state: transform feedback (WebGL2) or compute (WebGPU) |

**Frame budget** — 60 fps is 16.7 ms. Spend at most 10 ms in your own code and leave the
rest for style, layout and compositing. For static exports the equivalent levers are
coordinate precision and point count: three decimal places is almost always enough and
often halves the file size on its own.

`references/performance-budgets.md` has the arithmetic behind every one of these
numbers, the per-technology limits, and how to decide a Ramer–Douglas–Peucker epsilon.
Quote the reasoning, not just the threshold.

### 6. Pick the technology deliberately

Do not default to whatever the user mentioned first. Three decisions dominate: **output
medium** (print or zoomable interface → vector; screen-only → raster), **whether it
animates** (a static piece can afford geometry a live one cannot), and **whether the
work is per-pixel or per-element** (per-pixel is a shader, per-element is geometry —
doing per-element work in a fragment shader is how a 4-ms piece becomes a 40-ms one).

`references/toolchain-notes.md` covers p5.js, three.js, GLSL, SVG, Canvas 2D,
WebGL/WebGPU, D3 and Processing: what each is good at, its determinism story, and the
specific bloat trap it leads people into. Name the trap when you recommend the tool.

### 7. Expose exactly two parameters

When handing generative code to a designer, expose two controls and hard-code the rest.

Choose one of each:

- **A structure parameter** — cell size, seed count, recursion depth, packing density.
  Changes the piece's density and rhythm.
- **A modulation parameter** — noise frequency, amplitude or turbulence. Moves its
  character between orderly and chaotic.

Neither slot goes to colour — a palette is a swap, not a parameter, and belongs in a
named array they edit directly. Neither goes to the seed either: the seed should always
be visible and always settable, which is metadata, not a design control.

A designer given nine sliders explores a fraction of the space and reports the piece
does not do much. Given two, they find the range.

## Output format

For a **visual → code** request, deliver these five things in this order:

1. **The decomposition** — structure, modulation, surface, named explicitly.
2. **The parameter table** — name, default, range, visual effect.
3. **The implementation** — seeded, with the seed printed.
4. **The estimated cost budget** — element count, draw calls or fragment ops, expected
   file size or frame time, and how rough the estimate is.
5. **The two parameters** worth exposing, and why each was chosen.

For a **code → visual** request: what it draws, the ranges over which that description
holds, where it breaks, then the cost. Do not restate the code as prose.

## What this skill cannot do

Be explicit about all of these when they apply.

- **It cannot see rendered output.** Unless the user supplies an image, every claim
  about what code draws comes from reading it. Ask for a render back, and expect to be
  wrong about blend modes and accumulation in particular — those are genuinely hard to
  predict from source.
- **It cannot profile on the user's hardware.** Every cost figure is an
  order-of-magnitude estimate; treat ±3x as normal, and worse between an integrated GPU
  and a discrete one, or desktop and mobile. These numbers tell you which side of a
  switch point you are on, not what your frame time will be. Measure before optimising
  further.
- **It cannot reproduce a specific piece.** Decomposition recovers a family of images
  with the same generative logic, not the original. Hand-tuned constants and the
  original seed are not recoverable from looking at the output.
- **It cannot validate visual quality.** It can tell you a decomposition is plausible
  and cheap. Whether the result is any good is judged by looking at it.
- **GLSL determinism does not survive a change of GPU** where a `sin`-based hash is
  used. Do not promise cross-device reproducibility for code you have not converted to
  an integer hash.

## References

- `references/decomposition-method.md` — the structure/modulation/surface taxonomy, the
  questions to ask of an image, and worked decompositions of three known patterns
- `references/performance-budgets.md` — the numeric budgets, the arithmetic behind them,
  per-technology limits and the switch points
- `references/toolchain-notes.md` — per-library idioms, what each is good at, its
  determinism story, and the common bloat trap in each
