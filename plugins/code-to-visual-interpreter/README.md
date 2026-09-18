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
- **The preview loop.** `render_preview` turns supplied CSS animations, Canvas 2D drawing
  code or a GLSL fragment shader into one self-contained interactive HTML file: the code
  running live, one slider per extracted parameter, and a copyable JSON block of the
  current values. `apply_params` takes that JSON and writes the chosen values back into
  the source, reporting each change. Adjust the visual, copy the JSON, apply it — that is
  the bi-directional loop.

## Who it is for

Creative technologists. The skill you must bring is **computational
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
| MCP server | The tables as lookups, the budget arithmetic, structure matching, source scanning, the preview loop, licensing |

### Tools

**Open** — no licence needed, enough to evaluate the method before buying

- `decomposition_taxonomy` — the structure/modulation/surface tables, the discrimination
  tests, the five questions and the three worked decompositions
- `toolchain_notes` — per-library strengths, determinism story and the bloat trap in each
- `edge_conditions` — where generative parameters degenerate, and what actually happens

**Licensed** — requires a pro or team key

- `structure_match` — the structures consistent with answers to the five questions, the
  implied modulation class and the octave estimate
- `cost_budget` — which side of the switch points an element count sits, with the arithmetic
- `svg_export_budget` — path-data size from point count and precision, and the RDP epsilon
  for the use case
- `source_scan` — textual scan of pasted source for unseeded randomness, the GLSL sin hash
  and known bloat-trap calls, each finding with its line quoted
- `render_preview` — one self-contained HTML file from supplied CSS, Canvas 2D or GLSL
  source: the code running in a stage, a slider per extracted parameter with live updates,
  and the current values as a copyable JSON block
- `apply_params` — the write-back half of the loop: rewrites exactly the named constants'
  numeric literals in the source and lists each change (old, new, line), refusing any name
  it cannot resolve unambiguously

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

### The preview loop

`render_preview` takes `{ kind: "css" | "canvas2d" | "glsl", code }` (plus an optional
`html` stage snippet for CSS and an `out_path`, default `./cvi-preview.html`) and writes
one HTML file with no external assets:

- **css** — the stylesheet applied to a stage element with its animations running;
- **canvas2d** — the code run in a `<canvas>` harness that calls
  `draw(ctx, params, t)` every frame. The code must define that function; anything else
  is refused with the expected shape spelled out, never guessed at;
- **glsl** — the fragment shader compiled in a minimal inline WebGL1 harness (fullscreen
  triangle), with `resolution` (vec2) and `time` (float) supplied if declared, plus every
  detected custom `float` uniform driven from its slider.

Parameter extraction is a textual scan for numeric literals attached to named constants:
CSS custom properties (`--speed: 4s`, unit kept), JS `const`/`let`/`var` declarations
whose whole initialiser is one literal (never a loop counter or part of an expression),
GLSL `const float`/`const int` and `#define` declarations, and custom GLSL `float`
uniforms. Each parameter becomes a slider: range 0–1 when the value already sits in 0..1,
value ±100% otherwise, and 0–2 for a uniform with no default literal. A name declared
more than once is ambiguous — it gets no slider, and is reported as such.

The page shows the current slider values as a copyable JSON block. `apply_params` takes
`{ code, params }` — values copied from that JSON block feed straight into it — and
deterministically rewrites exactly those named constants' literals, returning the updated
code and a per-parameter change list (old, new, line). Any name it cannot find
unambiguously fails the whole call and nothing is rewritten. That copy-adjust-apply cycle
is the bi-directional loop.

The preview is a harness, not your environment: it runs the code inside its own page,
canvas or WebGL1 quad, so behaviour identical to your own setup is not guaranteed.

## Free and paid

The skill content is open — install it and the whole procedure is available. The server's
reference tools stay open too: the taxonomy, the toolchain notes and the edge-condition
table need no key. The compute tools — structure matching, budget arithmetic, export
sizing, source scanning, preview generation and parameter write-back — require a paid
licence. Everything runs locally: the billing
service sees a licence key, a plugin id, a hashed device identifier and a device label
(your machine's hostname), and nothing else — never your code. It works best if you paste the actual source rather than describing it,
and — for a visual → code request — supply a reference image or a precise description of
spacing, overlap and how neighbouring elements relate.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan from the pricing page (or with `start_checkout` from inside a
conversation) and paste the key — it will be stored at
`~/.config/plugin-suite/code-to-visual-interpreter.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export CODE_TO_VISUAL_INTERPRETER_LICENSE_KEY=PS-CVI-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-CVI-...
```

## What this is not

- **Not a renderer.** The server never runs your code; `render_preview` writes a file for
  your own browser to render, and the plugin itself cannot see the result. Every claim it
  makes about what code draws comes from reading it, and blend modes and alpha
  accumulation are hard to predict from source — open the preview and correct the
  description against what you see.
- **The preview is a harness.** Your code runs inside the harness's page, canvas or
  WebGL1 quad, not your build. Sizing, pixel density, colour management and any code the
  snippet depends on can differ — check anything that matters back in the real context.
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

## The skill you bring

**Computational Design.** Understand the relationship between visual geometry and the code that generates it; that understanding is what prevents bloated, unoptimised assets.

## Plans

Served by `services/billing` in this repo; the catalog lives in its `catalog.js`.
Pro $150/month (2 seats) and team $400/month (10 seats). Both carry the same `tools`
capability: the licence gates the compute tools — `structure_match`, `cost_budget`,
`svg_export_budget`, `source_scan`, `render_preview` and `apply_params` — while the
skill content and the reference tools stay open.
