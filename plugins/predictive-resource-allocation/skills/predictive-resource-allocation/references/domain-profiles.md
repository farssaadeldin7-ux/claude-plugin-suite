# Domain profiles

What usually binds in each application, the settings that move it most, and the scaling
law that governs the estimate.

## GPU path tracing — Cycles, Redshift, Octane

**Usually binds on:** VRAM capacity first, then compute. Bandwidth rarely.

The governing law: **noise falls as 1/√N**, so halving perceived noise costs 4x the
samples. Every sample decision follows from this.

| Setting | Effect | Notes |
| --- | --- | --- |
| Sample count | Linear | The dominant compute term |
| Denoiser (OptiX, OIDN) | 2–4x effective | 128 denoised usually beats 512 raw for the same wall time |
| Adaptive sampling threshold | 1.3–2x | Near-free in most scenes; check dark areas for blotching |
| Max bounces and clamping | 1.2–3x | Transparent and volumetric bounces are the expensive ones |
| Tile size | Up to 1.5x | GPUs want large tiles or the whole frame; 16–32 px CPU-era tiles throttle them |
| Light count and portals | Up to 5x | Many-light sampling and interior portals are the biggest structural win |

**Out-of-core textures:** Redshift and Octane page from host RAM and degrade gracefully,
losing 10–30% under moderate paging. Cycles has no out-of-core geometry and its
host-memory fallback is a cliff — a spilling scene runs 5–20x slower. **BVH build** shows
as a long first frame; if frame 1 is 4 minutes and frame 2 is 20 seconds, no sample
setting will touch it.

## Houdini FLIP

**Usually binds on:** CPU for the solve, then RAM, then disk write.

Cubic scaling, with a substep multiplier on top: halving particle separation is 8x the
particles and **10–16x the time**, because the CFL condition forces more substeps too.
Separation x0.8 is roughly 2.5x.

| Setting | Effect |
| --- | --- |
| Substeps / CFL condition | Linear. The most over-set parameter in the application |
| Particle separation | Cubic. Change last, and only after the look is approved |
| Narrow-band FLIP | 2–5x where only the surface matters. Underused |
| Collision resolution | Independent of separation; raise before raising particle count |
| Surfacing / meshing | Often exceeds the solve. Time it separately first |

**Disk write is a real constraint.** A 40M-particle frame is 1.5–3 GB, so 240 frames is
up to 720 GB, and 2 GB per frame over 1 GbE (0.11 GB/s) costs 18 seconds per frame in
writing alone. Cache to local NVMe, move the result afterwards.

## Houdini Pyro

**Usually binds on:** VRAM under OpenCL, otherwise CPU and RAM.

Voxel count is cubic in `1/voxel_size`: halving voxel size is 8x the voxels and 10–14x
the time once substeps rise.

| Setting | Effect |
| --- | --- |
| Voxel size | Cubic. The biggest lever and the last one to touch |
| Sparse / narrow-band solve | 2–10x on sims with a lot of empty domain |
| Fields carried (temperature, fuel, colour, divergence) | Linear on memory, near-linear on time. Delete unused fields |
| OpenCL solve | 2–5x if the sim fits in VRAM, a hard failure if it does not |

## Nuke

**Usually binds on:** disk read, then single-threaded nodes.

A 4K multi-layer EXR is 150–400 MB per frame, so 24 fps playback needs 3.6–9.6 GB/s
sustained — beyond NVMe, far beyond any share. Comp playback is an I/O problem in nearly
every facility.

| Lever | Effect |
| --- | --- |
| Localisation to local NVMe | 3–10x on network-sourced plates. Do this first, always |
| EXR compression choice | DWAA is 3–5x smaller than uncompressed and decodes fast; ZIP decodes slower; uncompressed reads worst and decodes best |
| Proxy or half-resolution work | ~4x, and free during layout and roto |
| Pre-comp and bake stable upstream branches | Removes repeated recomputation |

**Single-threaded nodes** are the other half. Deep operations, some third-party plugins
and anything with a scanline dependency will not use the box; the signature is one core
at 100% and the rest idle. More cores buys nothing — profile, find the node, cache below.

## After Effects

**Usually binds on:** RAM, then single-core clock speed.

RAM preview holds decoded frames at `width x height x 4 bytes` for 8-bit, doubled for
16-bit — 4K 8-bit is 33 MB per frame, so 10 seconds at 24 fps is about 8 GB.

| Lever | Effect |
| --- | --- |
| RAM allocated to AE, other apps closed | Directly sets preview length |
| Multi-Frame Rendering | 1.5–3x on multi-core machines, only where effects support it |
| Disk cache on fast NVMe | Large on repeated previews |
| Pre-rendering stable layers | Often the biggest single win |

Single-core clock matters more than core count for anything not MFR-eligible. Say so
before anyone buys a many-core CPU for After Effects.

## Model training

**Usually binds on:** VRAM capacity, then the input pipeline, then compute.

| Symptom | Cause | Remedy |
| --- | --- | --- |
| GPU util sawtooths 0–100 per step | Dataloader starvation | Raise `num_workers` towards core count, `prefetch_factor` 4, pinned memory, pre-decoded shards |
| OOM at any batch size | Static state exceeds VRAM | Algorithmic only: 8-bit Adam, LoRA, ZeRO sharding, smaller model |
| OOM only at large batch | Activations | Gradient accumulation, then activation checkpointing |
| Step time linear in batch, util 100% | Compute-bound. Healthy | Mixed precision, fused attention, `torch.compile` |
| Util high, throughput low for the FLOPs | Bandwidth-bound | Larger batch, fused kernels, fewer small ops |

| Lever | Speedup | Memory | Effort |
| --- | --- | --- | --- |
| bf16 / fp16 mixed precision | 1.5–3x | Halves activations | Minutes |
| Fused attention kernel | 1.3–2x at long context | Large saving | Minutes |
| Dataloader workers and prefetch | Up to 5x when starved, 0 when not | None | Minutes |
| Gradient accumulation | ~1x | Large saving | Minutes |
| `torch.compile` | 1.1–1.6x | Slight increase | Hours, plus recompile stalls |
| Activation checkpointing | 0.7x — it costs time | 60–80% saving | Hours |
| Pre-decoded packed shards | Up to 5x when I/O-bound | None | Hours |

Two rows there are slowdowns bought deliberately to relieve capacity. That is the correct
trade against a cliff and should be presented as one.

## Farm and cloud dispatch

**Per-frame fixed overhead** — scene load, texture load, BVH build, licence checkout,
container pull — is typically **30–120 seconds**, paid on every task.

**The dispatch rule:** send per-frame only when render time per frame exceeds roughly
**10x that overhead**, keeping overhead under 10% of the total — in practice **5–10
minutes per frame minimum**. Below that, batch frames so overhead is paid once.

| Per-frame time | Verdict |
| --- | --- |
| Under 1 minute | Batch 20–50 frames per task |
| 1–5 minutes | Batch 5–10 frames per task |
| 5–30 minutes | Dispatch per frame |
| Over 30 minutes | Dispatch per frame, and consider splitting by tile or sample seed |

**Rendering and batch comp** are frame-parallel and scale near-linearly. **Simulation**
does not distribute across frames, since frame N depends on frame N-1 — distribute across
shots or wedges instead. **Training** runs at roughly 0.85x efficiency per added GPU on a
good interconnect, far worse across nodes without one.

**Spot and preemptible instances** are 60–90% cheaper and can be reclaimed on about two
minutes of notice. They suit frame-parallel rendering, where losing a frame costs one
frame, and are dangerous for long training runs without checkpointing.

Checkpoint interval follows the Young–Daly result:
`optimal_interval ≈ sqrt( 2 x checkpoint_cost x mean_time_between_interruptions )`.
With a 60-second checkpoint and a 4-hour mean time to preemption that is about 17
minutes. Every 5 minutes wastes throughput; every 2 hours risks an hour lost per reclaim.

Never move a job to the cloud before the single-machine constraint is known. A
dataloader-starved run rented at scale is the same run, starved, at higher cost.
