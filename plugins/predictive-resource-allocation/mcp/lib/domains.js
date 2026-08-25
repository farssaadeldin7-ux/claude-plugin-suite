/**
 * Per-application bottleneck profiles, ported from
 * references/domain-profiles.md: what usually binds in each application, the
 * settings that move it most, and the scaling law that governs the estimate.
 * Data only — no judgement, no numbers invented beyond the reference.
 */

export const DOMAINS = {
  path_tracing: {
    label: 'GPU path tracing — Cycles, Redshift, Octane',
    usually_binds_on: 'VRAM capacity first, then compute. Bandwidth rarely.',
    governing_law: 'Noise falls as 1/sqrt(N), so halving perceived noise costs 4x the samples. Every sample decision follows from this — it is why denoising at a lower sample count almost always wins on wall time.',
    settings: [
      { setting: 'Sample count', effect: 'Linear', notes: 'The dominant compute term' },
      { setting: 'Denoiser (OptiX, OIDN)', effect: '2–4x effective', notes: '128 denoised usually beats 512 raw for the same wall time' },
      { setting: 'Adaptive sampling threshold', effect: '1.3–2x', notes: 'Near-free in most scenes; check dark areas for blotching' },
      { setting: 'Max bounces and clamping', effect: '1.2–3x', notes: 'Transparent and volumetric bounces are the expensive ones' },
      { setting: 'Tile size', effect: 'Up to 1.5x', notes: 'GPUs want large tiles or the whole frame; 16–32 px CPU-era tiles throttle them' },
      { setting: 'Light count and portals', effect: 'Up to 5x', notes: 'Many-light sampling and interior portals are the biggest structural win' },
    ],
    notes: [
      'Out-of-core textures: Redshift and Octane page from host RAM and degrade gracefully, losing 10–30% under moderate paging. Cycles has no out-of-core geometry and its host-memory fallback is a cliff — a spilling scene runs 5–20x slower.',
      'BVH build shows as a long first frame; if frame 1 is 4 minutes and frame 2 is 20 seconds, no sample setting will touch it.',
    ],
  },
  houdini_flip: {
    label: 'Houdini FLIP',
    usually_binds_on: 'CPU for the solve, then RAM, then disk write.',
    governing_law: 'Cubic scaling, with a substep multiplier on top: halving particle separation is 8x the particles and 10–16x the time, because the CFL condition forces more substeps too. Separation x0.8 is roughly 2.5x.',
    settings: [
      { setting: 'Substeps / CFL condition', effect: 'Linear. The most over-set parameter in the application' },
      { setting: 'Particle separation', effect: 'Cubic. Change last, and only after the look is approved' },
      { setting: 'Narrow-band FLIP', effect: '2–5x where only the surface matters. Underused' },
      { setting: 'Collision resolution', effect: 'Independent of separation; raise before raising particle count' },
      { setting: 'Surfacing / meshing', effect: 'Often exceeds the solve. Time it separately first' },
    ],
    notes: [
      'Disk write is a real constraint. A 40M-particle frame is 1.5–3 GB, so 240 frames is up to 720 GB, and 2 GB per frame over 1 GbE (0.11 GB/s) costs 18 seconds per frame in writing alone. Cache to local NVMe, move the result afterwards.',
    ],
  },
  houdini_pyro: {
    label: 'Houdini Pyro',
    usually_binds_on: 'VRAM under OpenCL, otherwise CPU and RAM.',
    governing_law: 'Voxel count is cubic in 1/voxel_size: halving voxel size is 8x the voxels and 10–14x the time once substeps rise. A "slightly higher res" sim is not slightly more expensive.',
    settings: [
      { setting: 'Voxel size', effect: 'Cubic. The biggest lever and the last one to touch' },
      { setting: 'Sparse / narrow-band solve', effect: '2–10x on sims with a lot of empty domain' },
      { setting: 'Fields carried (temperature, fuel, colour, divergence)', effect: 'Linear on memory, near-linear on time. Delete unused fields' },
      { setting: 'OpenCL solve', effect: '2–5x if the sim fits in VRAM, a hard failure if it does not' },
    ],
    notes: [],
  },
  nuke: {
    label: 'Nuke',
    usually_binds_on: 'Disk read, then single-threaded nodes.',
    governing_law: 'A 4K multi-layer EXR is 150–400 MB per frame, so 24 fps playback needs 3.6–9.6 GB/s sustained — the upper half beyond even NVMe, all of it far beyond any share. Comp playback is an I/O problem in nearly every facility.',
    settings: [
      { setting: 'Localisation to local NVMe', effect: '3–10x on network-sourced plates. Do this first, always' },
      { setting: 'EXR compression choice', effect: 'DWAA is 3–5x smaller than uncompressed and decodes fast; ZIP decodes slower; uncompressed reads worst and decodes best' },
      { setting: 'Proxy or half-resolution work', effect: '~4x, and free during layout and roto' },
      { setting: 'Pre-comp and bake stable upstream branches', effect: 'Removes repeated recomputation' },
    ],
    notes: [
      'Single-threaded nodes are the other half. Deep operations, some third-party plugins and anything with a scanline dependency will not use the box; the signature is one core at 100% and the rest idle. More cores buys nothing — profile, find the node, cache below.',
    ],
  },
  after_effects: {
    label: 'After Effects',
    usually_binds_on: 'RAM, then single-core clock speed.',
    governing_law: 'RAM preview holds decoded frames at width x height x 4 bytes for 8-bit, doubled for 16-bit — 4K 8-bit is 33 MB per frame, so 10 seconds at 24 fps is about 8 GB.',
    settings: [
      { setting: 'RAM allocated to AE, other apps closed', effect: 'Directly sets preview length' },
      { setting: 'Multi-Frame Rendering', effect: '1.5–3x on multi-core machines, only where effects support it' },
      { setting: 'Disk cache on fast NVMe', effect: 'Large on repeated previews' },
      { setting: 'Pre-rendering stable layers', effect: 'Often the biggest single win' },
    ],
    notes: [
      'Single-core clock matters more than core count for anything not MFR-eligible. Say so before anyone buys a many-core CPU for After Effects.',
    ],
  },
  training: {
    label: 'Model training',
    usually_binds_on: 'VRAM capacity, then the input pipeline, then compute.',
    governing_law: null,
    symptoms: [
      { symptom: 'GPU util sawtooths 0–100 per step', cause: 'Dataloader starvation', remedy: 'Raise num_workers towards core count, prefetch_factor 4, pinned memory, pre-decoded shards' },
      { symptom: 'OOM at any batch size', cause: 'Static state exceeds VRAM', remedy: 'Algorithmic only: 8-bit Adam, LoRA, ZeRO sharding, smaller model' },
      { symptom: 'OOM only at large batch', cause: 'Activations', remedy: 'Gradient accumulation, then activation checkpointing' },
      { symptom: 'Step time linear in batch, util 100%', cause: 'Compute-bound. Healthy', remedy: 'Mixed precision, fused attention, torch.compile' },
      { symptom: 'Util high, throughput low for the FLOPs', cause: 'Bandwidth-bound', remedy: 'Larger batch, fused kernels, fewer small ops' },
    ],
    settings: [
      { setting: 'bf16 / fp16 mixed precision', effect: '1.5–3x', memory: 'Halves activations', effort: 'Minutes' },
      { setting: 'Fused attention kernel', effect: '1.3–2x at long context', memory: 'Large saving', effort: 'Minutes' },
      { setting: 'Dataloader workers and prefetch', effect: 'Up to 5x when starved, 0 when not', memory: 'None', effort: 'Minutes' },
      { setting: 'Gradient accumulation', effect: '~1x', memory: 'Large saving', effort: 'Minutes' },
      { setting: 'torch.compile', effect: '1.1–1.6x', memory: 'Slight increase', effort: 'Hours, plus recompile stalls' },
      { setting: 'Activation checkpointing', effect: '0.7x — it costs time', memory: '60–80% saving', effort: 'Hours' },
      { setting: 'Pre-decoded packed shards', effect: 'Up to 5x when I/O-bound', memory: 'None', effort: 'Hours' },
    ],
    notes: [
      'Two rows there are slowdowns bought deliberately to relieve capacity. That is the correct trade against a cliff and should be presented as one.',
    ],
  },
};

/**
 * The fixed remedy order from the skill: work down it and stop when the
 * constraint is relieved. Hardware is last on purpose.
 */
export const REMEDY_LADDER = {
  order_is_fixed: 'Work down the ranks and stop when the constraint is relieved.',
  ranks: [
    { rank: 1, remedy: 'Change a setting — samples, denoiser, substeps, tile size, batch size, precision, worker count', typical_cost: 'Minutes', typical_gain: '1.2x – 5x' },
    { rank: 2, remedy: 'Change the data layout — texture format and resolution, cache location, proxy geometry, sharded records, compression choice', typical_cost: 'Hours', typical_gain: '1.5x – 10x on I/O-bound work' },
    { rank: 3, remedy: 'Change the algorithm — instancing, adaptive sampling, sparse or narrow-band solvers, gradient accumulation, activation checkpointing, a smaller model', typical_cost: 'Days', typical_gain: '2x – 100x, and it is the only thing that beats a cliff' },
    { rank: 4, remedy: 'Buy hardware', typical_cost: 'Weeks and money', typical_gain: 'Bounded by the spec ratio, often under 2x' },
  ],
  why_hardware_is_last: [
    'It is the only remedy that cannot be undone if you were wrong about the constraint.',
    'The gain is bounded by the spec ratio. A card with 1.6x the bandwidth gives at most 1.6x, and only if bandwidth was the binding constraint.',
    'New hardware relieves one constraint and exposes the next. A faster GPU on a dataloader-starved training run changes nothing at all.',
    'Settings and layout changes routinely beat the spec ratio, because they remove work rather than doing the same work faster.',
  ],
  the_one_honest_exception:
    'The capacity cliff. If a scene needs 30 GB and the card has 24 GB, no setting recovers the order of magnitude — ' +
    'the choices are a real algorithmic change (proxies, out-of-core, sharding) or more VRAM. Say that directly when it ' +
    'applies rather than offering a list of settings that cannot close the gap.',
};

export function domainFor(name) {
  return DOMAINS[String(name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? null;
}
