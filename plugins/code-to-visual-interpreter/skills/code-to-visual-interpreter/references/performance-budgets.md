# Performance budgets and the arithmetic behind them

Every figure here is an order-of-magnitude guide derived from the arithmetic shown, not
a measurement of the user's machine. Quote the reasoning with the number. Treat ±3x as
normal variance.

## The two numbers everything reduces to

**Frame budget.** 60 fps is 16.7 ms per frame, and the browser needs several of those
for style, layout, paint and compositing. Budget **10 ms for your own code**.

**Byte budget.** For a web hero asset, 100 KB gzipped is comfortable, 300 KB is where
someone complains, 1 MB is a bug. SVG gzips at roughly 4–6x — quote raw and gzipped.

## SVG: precision, points and element counts

A coordinate at full double precision (`123.45678901234567`) is about 18 bytes; at three
decimals it is 7. A path point is two coordinates plus a separator.

| Precision | Bytes per point | 5,000-point path |
| --- | --- | --- |
| Full float (`toString()` default) | ~37 | 185 KB |
| 6 decimals | ~21 | 105 KB |
| **3 decimals** | ~15 | **75 KB** |
| Integer | ~7 | 35 KB |
Three decimals is a thousandth of a user unit, invisible at any zoom a browser supports.
**Rounding to three decimals typically halves the file and never changes the image** —
do it on every export, unconditionally. Integers are viable only when one unit is
already sub-pixel at the largest display size; a 100-unit viewBox on a 4K display gives
visible stair-stepping on diagonals.

### Ramer–Douglas–Peucker

Generative code oversamples: a curve integrated at 2-px steps for 400 steps has 400
points where the eye needs perhaps 40. RDP drops points whose perpendicular distance
from the simplified line is below epsilon.

| Use | Epsilon | Typical point reduction on an oversampled curve |
| --- | --- | --- |
| Zoomable / print | 0.2 device px | 50–70% |
| Standard web, fixed size | 0.5 device px | 70–90% |
| Background texture, never inspected | 1.0–2.0 device px | 85–95% |
Epsilon is in coordinate units — convert if the viewBox is not 1:1 with display pixels.
RDP is O(n log n) typically, O(n²) on adversarial input, so simplify per-path. Before
running it, drop duplicate points and collapse collinear runs; loops produce both.

### Element counts

Under 1,000 is fine including per-element CSS. From 1,000 to 5,000, static is fine but
style recalculation is noticeable on any class change. From 5,000 to 20,000, static only
— parse and layout run into hundreds of ms. Above 20,000, use canvas or pre-rasterise.

**Animation is far stricter: roughly 500 elements.** A transform change per element
costs 20–50 µs including style recalculation and paint invalidation, so 500 × 40 µs =
20 ms, already over budget. Animating one group transform is composited and costs
nothing; animating `d` or `points` re-rasterises the whole path every frame.

Other size wins, in order of payoff: `<use>` with `<symbol>` for repeated geometry,
classes instead of inline `style` per node, one `<path>` with many subpaths instead of
many `<path>` elements, and a group transform instead of a per-node transform.

## Canvas 2D: the cost is calls, not pixels

Fill rate is rarely the constraint. At 1920×1080 a full-screen fill is 2.07 M pixels and
Canvas 2D handles roughly 5–10 full-screen overdraws per frame at 60 fps on integrated
graphics; 10,000 particles of 4×4 px total 160,000 px, under a tenth of one overdraw.
The fill is free. **Per-call overhead is the constraint** — a `beginPath` / `arc` /
`fill` triple costs roughly 1–5 µs, more if a state property is assigned between calls.

Ten thousand individual path draws is 10,000 × ~2 µs = **20 ms, over budget**. One
`beginPath`, 10,000 `moveTo`/`arc` pairs and one `fill` is **2–4 ms, fine**.

That is the whole trick, and the reason the Canvas 2D ceiling is quoted as ~10,000
elements rather than a pixel count. Batching only works when elements share fill and
stroke, so group by colour: six colours means six batches, not 10,000.

| Operation | Cost and note |
| --- | --- |
| `save()` / `restore()` | ~1 µs each; 10,000 pairs is 20 ms of nothing |
| `fillStyle` assignment | Breaks batching — sort draws by colour |
| `shadowBlur` | 5–20x the base draw; pre-render to a sprite instead |
| `getImageData` | 1–10 ms; forces a GPU→CPU sync and stalls the pipeline |
| `drawImage` from a canvas | ~5–20 µs; cheaper than re-drawing complex geometry |
## Per-frame allocation

One object per element per frame at 10,000 elements and 60 fps is 600,000 objects per
second. Minor GC runs constantly, and every few seconds a major collection produces a
5–20 ms pause that reads as a stutter.

**Target zero allocation inside the animation loop.** Keep state in pre-allocated
`Float32Array`s rather than arrays of objects; reuse scratch vectors instead of returning
new ones (in three.js, a module-level `const _v = new THREE.Vector3()`); no `map`,
`filter` or closures in the hot loop; and no per-frame string building, since a
template-literal colour allocates one string per element per frame. A rising sawtooth in
the memory timeline is the diagnostic.

## WebGL and three.js: draw calls

A WebGL draw call costs roughly **0.05–0.15 ms of CPU time** in validation and state
setup, independent of how much geometry it draws.

1,000 separate meshes is 1,000 × 0.1 ms = **100 ms per frame, hopeless**. One instanced
draw of 100,000 instances is **~0.1 ms**. **Target under 100 draw calls per frame**; the
switch to `InstancedMesh` pays off at around **100 objects** sharing a geometry, well
below the point at which the geometry itself matters.

Each unique material is a shader compile of 10–100 ms stalling on first render, so share
materials and pre-warm by rendering one frame off-screen. A 2048² shadow map is ~4 M
texels per light per frame. Rebuilding `BufferGeometry` per frame is a full GPU upload —
mutate the attribute and set `needsUpdate`. Transparent objects sort every frame and
cannot batch with opaque ones.

## Fragment shaders

Full-screen at 1920×1080 and 60 fps is 2.07 M × 60 = **124 million fragment invocations
per second**. Four octaves of 3D simplex noise is roughly 300–500 ALU ops, so about
40–60 GFLOP/s. Integrated GPUs deliver on the order of 300–800 GFLOP/s in practice, so
**three to four octaves full-screen is the safe budget on integrated graphics**; eight
octaves needs a discrete GPU or half-resolution rendering.

**The first lever is always resolution, not octaves.** Halving both dimensions quarters
the fragment cost and for a soft noise field the upscale is usually invisible. Reducing
octaves changes the image; reducing resolution mostly does not.

Transcendental functions (`sin`, `cos`, `pow`, `exp`, `log`) typically run at a quarter
the rate of a multiply-add, so a `pow` inside an eight-octave loop is a real cost. Hoist
anything constant across the loop.

**Branch divergence.** GPUs execute in groups of 32 (NVIDIA) or 64 (AMD) lanes in
lockstep. When lanes in a group take different branches the hardware executes both sides
and masks the results, so a divergent two-way branch costs the sum rather than the
maximum, and a four-way branch can cost 4x.

A branch on a **uniform** is effectively free — every lane agrees. A branch on a
**screen-space region** is usually cheap, since neighbouring pixels share a lane group.
A branch on a **per-pixel noise value** is the expensive case; replace it with `mix()`,
`step()` or `smoothstep()`. Separately, `mediump` on mobile has about 10 bits of
mantissa and breaks visibly at large coordinate values — offset the coordinate space
toward the origin before the noise call rather than raising precision globally.

## The switch points, in one table

| Element count | Technology | Why it changes here |
| --- | --- | --- |
| Up to 500 (animated) | DOM / SVG nodes | Style recalculation reaches 10 ms |
| Up to 20,000 (static) | SVG | Parse and layout grow past 5,000; above 20,000, canvas or pre-rasterise |
| 500 – 10,000 | Canvas 2D, batched by colour | Per-call overhead reaches 10 ms |
| 10,000 – 100,000 | WebGL instanced | Draw call count, and CPU-side per-object work |
| Above 100,000 | Transform feedback or WebGPU compute | CPU cannot update the buffer in 10 ms |
Cross a switch point and the fix is a change of technology, not micro-optimisation.
Below one, micro-optimisation is wasted effort — say so rather than tune.
