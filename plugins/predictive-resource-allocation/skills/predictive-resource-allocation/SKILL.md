---
name: predictive-resource-allocation
description: >
  This skill should be used when someone wants to know where a render, simulation or training
  job will bottleneck and what to change first — "why is my render so slow", "will this scene
  fit in 24GB", "my sim is taking 40 minutes a frame", "should I buy a 5090 or more RAM",
  "how do I speed up this training run", "am I CPU or GPU bound", "my GPU is at 30% utilisation",
  "out of memory at batch size 8", "is it worth sending this to the farm", "how long will this
  take to render". Also use it to size hardware before a purchase, to plan a shot or a training
  run against a deadline, and to decide between spot and on-demand cloud instances.
metadata:
  version: "0.1.0"
---

# Predictive Resource Allocation

Work out where a render, simulation or training job will bottleneck, and say what to
change first.

The difference between an expert and an amateur here is not knowing more settings. It
is refusing to optimise anything until the binding constraint is identified. An
amateur turns down samples on a job that was never compute-bound, gains four percent,
and concludes the machine is too slow. A professional spends ten minutes finding out
which of four resources is actually saturated, changes one thing, and gets a factor of
three.

This skill produces **estimates over stated assumptions**, not measurements. Say so.

## The one rule

**Ask for the actual hardware and one measured baseline run before predicting anything.**

Without the GPU model and its VRAM, the system RAM, the storage type and one real
timing, every number this skill produces is a guess dressed as arithmetic. The
estimates carry an error band of roughly a factor of two even when the inputs are
good — with invented inputs the band is unbounded.

The minimum intake, and refuse to predict without it:

| Need | Why it is load-bearing |
| --- | --- |
| GPU model and VRAM | Capacity is a cliff (see below), and bandwidth varies 5x across current cards |
| System RAM | Decides whether spilling is survivable or fatal |
| CPU core count | Decides BVH build, sim solve and dataloader headroom |
| Storage: NVMe, SATA SSD, spinning disk, or network | 10x to 100x spread on I/O-bound work |
| One timed run, however small | Anchors everything; one measured frame beats any estimate here |

If they cannot give a baseline, ask for the cheapest one to produce — one frame, one
epoch, one hundred training steps — and wait for it. Say plainly, in the output rather
than only in your reasoning: **one measured run beats any estimate this skill produces.**

## Sequence

### 1. Triage the constraint into one of four classes

Every job is limited by compute, memory capacity, memory bandwidth, or I/O. These need
different remedies and the wrong remedy usually does nothing.

`references/bottleneck-triage.md` holds the full symptom table, the discriminating
tests, and what each symptom rules out. The three tests that carry the most weight:

1. **Halve the batch size, tile size or resolution.** Time roughly halves →
   compute-bound. Time barely moves → fixed overhead or I/O dominates. Time falls by
   much more than half → you were spilling, and the constraint is memory capacity.
2. **Watch VRAM occupancy against GPU utilisation.** High occupancy with low
   utilisation is the signature of capacity pressure or starvation, never of a slow
   GPU. High utilisation with low occupancy means the card is genuinely working.
3. **Compare a cold-cache run with a warm-cache run.** A large gap means I/O; run the
   job twice and time the second. If the second run is not faster, the data is not
   fitting in page cache and the constraint is read bandwidth.

Do not move to remedies on fewer than two pieces of evidence, and state that evidence
in the output.

### 2. Check the capacity cliff before anything else

**VRAM capacity is a cliff, not a slope.** A job that fits runs at full speed; a job
that exceeds VRAM by five percent does not run five percent slower. It either fails
outright or falls back to host memory across PCIe, and throughput collapses by roughly
an order of magnitude — PCIe 4.0 x16 gives about 32 GB/s against 700–1500 GB/s of
on-card bandwidth.

Check capacity first, with arithmetic rather than optimism.
`references/memory-arithmetic.md` gives the formulas and worked examples:

- **GPU rendering:** geometry + textures + framebuffer + BVH overhead (budget the BVH
  at 1.3–2x the raw triangle payload, and never assume the driver reserve is zero).
- **Training:** parameters + gradients + optimiser state + activations. The rule to
  carry in your head is **16 bytes per parameter** for fp16 weights with fp32 Adam
  states — 2 for the fp16 weight, 2 for the fp16 gradient, 4 for the fp32 master
  weight, 4 for the Adam first moment, 4 for the second. A 7B model is therefore about
  112 GB of static state before a single activation, which is why it does not train on
  one 80 GB card without sharding.
- **Activations** scale with batch size and are the only term you can trade cheaply.

Leave 10–15% headroom for fragmentation, driver reserve and allocator slack. A plan
that fits in 23.8 GB of 24 GB does not fit.

### 3. Rank remedies cheapest first, and be explicit that hardware is last

The order is fixed. Work down it and stop when the constraint is relieved.

| Rank | Class of remedy | Typical cost | Typical gain |
| --- | --- | --- | --- |
| 1 | **Change a setting** — samples, denoiser, substeps, tile size, batch size, precision, worker count | Minutes | 1.2x – 5x |
| 2 | **Change the data layout** — texture format and resolution, cache location, proxy geometry, sharded records, compression choice | Hours | 1.5x – 10x on I/O-bound work |
| 3 | **Change the algorithm** — instancing, adaptive sampling, sparse or narrow-band solvers, gradient accumulation, activation checkpointing, a smaller model | Days | 2x – 100x, and it is the only thing that beats a cliff |
| 4 | **Buy hardware** | Weeks and money | Bounded by the spec ratio, often under 2x |

Buying hardware is what people reach for first and should be considered last, for four
reasons worth saying out loud:

- It is the only remedy that cannot be undone if you were wrong about the constraint.
- The gain is bounded by the spec ratio. A card with 1.6x the bandwidth gives at most
  1.6x, and only if bandwidth was the binding constraint.
- New hardware relieves one constraint and exposes the next. A faster GPU on a
  dataloader-starved training run changes nothing at all.
- Settings and layout changes routinely beat the spec ratio, because they remove work
  rather than doing the same work faster.

The one honest exception is the capacity cliff. If a scene needs 30 GB and the card
has 24 GB, no setting recovers the order of magnitude — the choices are a real
algorithmic change (proxies, out-of-core, sharding) or more VRAM. Say that directly
when it applies rather than offering a list of settings that cannot close the gap.

### 4. Apply the per-domain profile

`references/domain-profiles.md` holds bottleneck profiles for Cycles, Redshift and
Octane GPU rendering, Houdini FLIP and Pyro, Nuke comp, After Effects, and model
training — the settings that matter most in each, the scaling laws, and the farm and
cloud dispatch rules.

Two scaling laws are worth knowing without looking them up, because they dominate
every estimate in their domain:

- **Path-traced noise falls as 1/√N.** Halving perceived noise costs 4x the samples.
  This is why denoising at a lower sample count almost always wins on wall time.
- **Voxel and particle counts scale cubically.** Halving voxel size or particle
  separation multiplies the count by 8, and the CFL condition usually forces more
  substeps as well, so the real factor is 10–16x. A "slightly higher res" sim is not
  slightly more expensive.

### 5. Decide on farm or cloud only after the single-machine constraint is known

Distributing a job multiplies whatever is inefficient about it — you pay for the waste
on every node. The dispatch rule, reasoned out in `references/domain-profiles.md`:
measure the **per-frame fixed overhead** (scene load, texture load, BVH build, licence
checkout — usually 30–120 seconds). Dispatch per frame to a farm only when frame time
exceeds roughly **10x that overhead**, so overhead stays under 10% of the total. Below
that, batch several frames into one task so the overhead is paid once.

Frame-parallel work — rendering, batch comp — distributes almost linearly. Sim work
mostly does not, because frame N depends on frame N-1.

### 6. Deliver the three-part output

Every answer has the same three parts, in this order:

1. **The binding constraint, with the evidence.** Name the class, cite the two or more
   observations that point to it, and say what it rules out.
2. **The estimate, with its assumptions listed.** Every assumption you made about
   hardware, scene or model, written out so the user can correct a wrong one. State
   the error band: roughly a factor of two.
3. **A ranked list of remedies**, each with expected speedup and effort, cheapest
   first, and a note of which one you would do today.

Then the honesty line: this is an estimate from stated assumptions, and one measured
run beats it.

## Limits of the method

Be direct about all of these when they apply.

- **These are estimates, and the error band is roughly a factor of two.** Say so every
  time you give a number. A prediction of "about 6 minutes a frame" means somewhere
  between 3 and 12, and it means that even when the arithmetic is careful.
- **Nothing here is measured.** The skill has no profiler, no telemetry and no access
  to the machine. Every input is what the user reported.
- **Scene and model content dominates.** Two scenes with identical polygon counts can
  differ tenfold on render time through transparency depth, volumetrics, light count
  or shader complexity. Ask about those before predicting.
- **Driver, build and library versions are unmodelled.** A renderer version bump or a
  new attention kernel moves throughput by 30% in either direction.
- **Thermal throttling is invisible here.** A laptop that sustains 60% of its
  short-burst throughput beats every prediction downwards, and only a long run shows it.
- **When the user cannot supply hardware or a baseline, say the tool cannot answer
  and give them the smallest measurement that would let it.** That is a better answer
  than a confident number with nothing under it.
- **Never present a purchase recommendation as an ROI calculation.** You can say which
  constraint a component would relieve and by roughly what ratio. You cannot say it
  will pay for itself.

## References

- `references/bottleneck-triage.md` — the four constraint classes, the discriminating
  tests, and what each symptom rules out
- `references/memory-arithmetic.md` — VRAM and RAM estimation for rendering and
  training, with worked examples
- `references/domain-profiles.md` — per-application bottleneck profiles, the settings
  that matter most in each, and the farm and cloud dispatch rules
