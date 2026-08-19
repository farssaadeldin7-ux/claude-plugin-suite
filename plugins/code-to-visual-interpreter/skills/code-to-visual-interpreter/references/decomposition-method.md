# The decomposition method

Every generative image separates into three layers. Name all three explicitly before
writing a line of code. If you cannot name the structure, you do not yet understand the
image and any code you write will be a pile of special cases.

## Layer 1 — structure

The rule that decides *where* things go. Exactly one per piece.

| Structure | Signature in the image | Core parameters |
| --- | --- | --- |
| Square grid | Constant spacing, elements aligned on two axes | cell size, margin |
| Hex / triangular lattice | Six-way or three-way symmetry, offset rows | cell size, row offset |
| Polar / radial | Elements converge on a centre, spacing grows outward | rings, divisions per ring |
| Flow field | Elements follow continuous curved paths that never quite touch | seed count, step size, step count |
| Recursive subdivision | Nested rectangles or triangles at several scales | depth, split ratio, split probability |
| L-system / branching | Self-similar branching, thinning toward the tips | axiom, rules, depth, branch angle |
| Circle / shape packing | Sizes vary, gaps are consistently tight, nothing overlaps | attempts, min/max radius, padding |
| Poisson-disc sampling | Random-looking but with a visible minimum spacing | min distance, candidate attempts |
| Tiling (Truchet, Wang) | Repeated unit, contiguous lines crossing cell borders | tile set, cell size |
| Particle system with attractors | Density clusters, trails, no lattice at all | count, forces, integration step |

**Test for grid versus flow:** cover half the image. If you can predict where an element
sits in the covered half, it is a lattice. If you can only predict the *direction* it
travels, it is a field.

**Test for grid versus packing:** measure gaps. Constant gaps with varying element size
means a grid. Constant *tightness* with varying size means packing.

## Layer 2 — modulation

The rule that decides how each element *differs*. One, occasionally two. Never five.

| Modulation | Reads as | Parameters that must be stated |
| --- | --- | --- |
| Value / Perlin / simplex noise | Neighbours are similar; smooth continuous drift | dimensionality (2D/3D/4D), frequency, octaves, lacunarity (~2.0), gain (~0.5) |
| Curl noise | Swirling, divergence-free, no sources or sinks | frequency, epsilon used for the derivative |
| Sine / harmonic | Regular, predictable, periodic | frequency, phase, amplitude |
| Easing curve on `t` | Acceleration or bunching along one axis | which easing, applied to what |
| Per-element seeded random | Neighbours are unrelated; visually crunchy | seed, distribution, range |
| Gradient by position | Monotonic change across the frame | axis, mapping function |
| Time | Only present in animation | rate, whether it loops |

**Continuous or independent?** Look at any two adjacent elements. If they are similar,
the modulation is a noise field or a gradient. If they are unrelated, it is per-element
random. Getting this backwards is the most common decomposition error, and it is
immediately visible in the result.

**How many octaves?** Count the distinct visual scales — the size of the largest blob,
and the size of the smallest detail that is not just an edge. Roughly
`log2(largest / smallest)` octaves. Three or four covers most images; asking for eight
is usually asking for expensive noise nobody can see.

**Distribution matters.** Uniform random gives an even spread. Gaussian clusters around
the mean and gives an occasional outlier. `random()^2` biases hard toward zero and is
how you get "mostly small, a few large" without a special case. State which you used.

## Layer 3 — surface

How the mark is painted. One or two decisions, no more.

- **Stroke or fill**, and whether weight varies (and with what).
- **Opacity**, and whether the piece depends on accumulation. Accumulation is a
  structural choice, not a finishing touch — an image built from 2,000 strokes at
  alpha 0.03 looks nothing like the same strokes at alpha 1.0.
- **Blend mode.** `multiply` darkens and keeps hue, `screen` and `lighter` build toward
  white, `overlay` raises contrast. If overlaps read as glow, it is additive.
- **Colour mapping** — from what quantity? Position, noise value, element index and
  velocity all look different. Sampling from a fixed palette of four to six looks
  designed; sampling a continuous HSL sweep looks generated.
- **Background**, including whether elements are drawn onto it once or every frame.

## Worked decomposition 1 — noise flow field

The ubiquitous "curved lines across the canvas" piece.

- **Structure:** flow field. Seed points on a jittered grid or by Poisson-disc sampling,
  each integrated forward through an angle field. Euler steps of 2–5 px, 100–400 steps.
- **Modulation:** one 2D simplex noise field, sampled at frequency 0.002–0.005 per pixel,
  mapped to angle over 0 to 2π (or 0 to 4π for more turbulence per unit of noise).
- **Surface:** low-alpha stroke, 0.5–2 px, colour drawn once per streamline from a small
  palette. Overlap accumulation supplies all the depth.

One structure, one modulation. The failure mode is adding a second noise field for
colour and a third for width — the result is mud, because three independent modulations
destroy the coherence that made the field legible.

**Cost:** 5,000 streamlines × 200 steps = 1,000,000 line segments. That is Canvas 2D
territory with batched paths, not SVG — as SVG it would be roughly 9 MB of path data
before simplification.

## Worked decomposition 2 — Truchet tiling

- **Structure:** square grid, typically 20–60 cells across.
- **Modulation:** one seeded discrete choice per cell, selecting one of two (or four)
  tile orientations. No continuous modulation at all.
- **Surface:** a single stroke weight, arcs of radius exactly half the cell.

The thing people try to explain with modulation — the long meandering paths that cross
many cells — is a *structural* property. Arc endpoints land on cell-edge midpoints, so
adjacent tiles always connect. Nothing is modulating the path; it emerges from the tile
set. If your decomposition of a Truchet pattern contains noise, it is wrong.

**Cost:** 40 × 40 = 1,600 arcs. Trivially SVG, and it should be SVG, because two tile
shapes as `<symbol>` plus 1,600 `<use>` elements is a few kilobytes.

## Worked decomposition 3 — circle packing

- **Structure:** greedy packing. Pick a candidate point, grow its radius until it
  touches an existing circle or the frame, keep it if it exceeds a minimum radius,
  repeat for a fixed attempt budget.
- **Modulation:** the *maximum radius cap as a function of position* — from an image's
  luminance, or from a noise field. This one modulation is what makes the packing read
  as a picture rather than as foam.
- **Surface:** stroke-only circles at one weight, or fill sampled from the same source
  image.

**Cost, and the trap:** naive packing tests every candidate against every placed circle.
5,000 circles is roughly 12.5 million distance checks and will hang a browser tab. Use a
spatial hash grid with cell size equal to the maximum radius and test only the nine
neighbouring cells — this takes it to roughly linear.

## The five questions to ask of any image

1. Is there a repeating unit, and what is its size relative to the frame?
2. Do elements sit on a lattice, or flow along paths?
3. Is spacing constant, gradient, or clustered? Clustered means packing or attractors,
   never a grid.
4. Are neighbouring elements similar (noise) or unrelated (per-element random)?
5. Does the depth come from overlap order, opacity accumulation, or a blend mode?

Answer these five and the decomposition writes itself. Skip them and you will produce
code that reproduces one image rather than the family it came from.
