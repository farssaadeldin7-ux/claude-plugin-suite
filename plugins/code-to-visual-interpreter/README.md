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
| MCP server | The tables as lookups, the budget arithmetic, structure matching, source scanning, licensing |

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

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

## Free and paid

The skill content is open — install it and the whole procedure is available. The server's
reference tools stay open too: the taxonomy, the toolchain notes and the edge-condition
table need no key. The compute tools — structure matching, budget arithmetic, export
sizing, source scanning — require a paid licence. Everything runs locally: the billing
service sees a licence key, a plugin id, a hashed device identifier and nothing else —
never your code. It works best if you paste the actual source rather than describing it,
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

## The skill you bring

**Computational Design.** Understand the relationship between visual geometry and the code that generates it; that understanding is what prevents bloated, unoptimised assets.

## Plans

Served by `services/billing` in this repo; the catalog lives in its `catalog.js`.
Pro $40/month (2 seats) and team $70/month (10 seats). Both carry the same `tools`
capability: the licence gates the compute tools — `structure_match`, `cost_budget`,
`svg_export_budget` and `source_scan` — while the skill content and the reference
tools stay open.
