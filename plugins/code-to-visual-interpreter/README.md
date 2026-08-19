# Code-to-Visual Interpreter

Translates in both directions between generative code and the geometry it produces,
keeping the resulting asset lean rather than bloated.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

Reading generative code and writing it are different jobs with different failure modes,
and this plugin enforces the right order of operations for each.

- **Code → visual.** Resolves the sketch in execution order — coordinate space, loop
  count, mark, modulation, surface state — then evaluates the edges: noise frequency at
  zero, alpha below the 8-bit floor of 1/255, radius exceeding half the grid spacing, a
  divisor reaching zero. You get each parameter's safe operating range.
- **Visual → code.** Decomposes an image into **structure** (grid, field, packing,
  recursion), **modulation** (noise, easing, seeded randomness) and **surface** (stroke,
  fill, blend, opacity). Most generative images are one structure plus one or two
  modulations; needing five means the wrong structure. Includes worked decompositions of
  a flow field, a Truchet tiling and a circle packing.
- **Bloat prevention.** Budgets with the arithmetic behind them: SVG coordinate precision
  (three decimals typically halves the file), RDP epsilon by use case, Canvas 2D per-call
  overhead, zero-allocation loops, shader branch divergence, instanced versus per-object
  draws, and the switch points — 500 animated DOM nodes, 10,000 canvas, 100,000 instanced.
- **Determinism, first.** Anything reviewed or reproduced needs a seeded PRNG with the
  seed recorded. `Math.random` makes a piece unreviewable, and the plugin says so before
  anything about performance.

## Who it is for

Creative technologists and web developers. The skill you must bring is **computational
design** — an understanding of how visual geometry relates to the code that generates
it. It will not teach you what a flow field is; it will tell you yours costs 1,000,000
line segments and belongs on a canvas. Covers p5.js, three.js, GLSL, SVG, Canvas 2D,
WebGL/WebGPU, D3 and Processing.

## Components

| Component | Purpose |
| --- | --- |
| Skill `code-to-visual-interpreter` | Both directions, the decomposition sequence, the output format |
| `references/decomposition-method.md` | The taxonomy, the five questions to ask of an image, three worked decompositions |
| `references/performance-budgets.md` | Numeric budgets, the arithmetic, per-technology limits, switch points |
| `references/toolchain-notes.md` | Per-library idioms, determinism story, the bloat trap in each |

## Free and paid

This is a pure-skill plugin. There is no MCP server, nothing is metered, and no part of
it is gated behind a licence — install it and the whole procedure is available. No code
leaves your machine because nothing is sent anywhere, and there is no install step,
dependency or configuration. It works best if you paste the actual source rather than
describing it, and — for a visual → code request — supply a reference image or a precise
description of spacing, overlap and how neighbouring elements relate.

## What this is not

- **Not a renderer.** It cannot see output unless you supply an image. Every claim about
  what code draws comes from reading it, and blend modes and alpha accumulation are hard
  to predict from source — render it back and correct the description.
- **Not a profiler.** Every cost figure is an order-of-magnitude estimate from stated
  arithmetic; ±3x is normal, more between an integrated and a discrete GPU. It tells you
  which side of a switch point you are on, not your frame time.
- **Not a copier.** Decomposition recovers a family of images sharing a generative logic,
  not a specific artist's piece. The original seed is not recoverable from the output.
- **Not an art critic.** It can say a decomposition is plausible and cheap. Whether the
  result is any good is judged by looking at it.
- **Not a guarantee of cross-device reproducibility.** A `sin`-based GLSL hash differs
  across GPU vendors, and long-running GPU simulations drift. It says when a piece is
  reproducible only on the machine that made it.
