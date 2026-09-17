# Predictive Resource Allocation

Works out where a render, simulation or training job will bottleneck, and says what to
change first.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

The difference between an expert and an amateur is not knowing more settings. It is
refusing to optimise anything until the binding constraint is identified. An amateur
turns down samples on a job that was never compute-bound, gains four percent, and blames
the machine.

- **Four-way triage** — compute, memory capacity, memory bandwidth or I/O — with the
  cheap discriminating tests for each and what each symptom rules out.
- **Capacity arithmetic first**, because VRAM is a cliff rather than a slope. Geometry,
  BVH, textures and framebuffer for GPU rendering; the 16-bytes-per-parameter rule for
  mixed-precision training with Adam, plus activations scaled by batch size.
- **Per-domain profiles** for Cycles, Redshift and Octane, Houdini FLIP and Pyro, Nuke,
  After Effects and model training — the settings that matter in each, and the scaling
  laws behind them.
- **Remedies ranked cheapest first**: change a setting, change the data layout, change
  the algorithm, buy hardware — with the reasoning for why hardware is last.
- **Farm and cloud rules**: the minimum per-frame time that justifies dispatch, what
  distributes and what does not, Young–Daly checkpoint intervals for spot instances.
- **Measured telemetry from the machine it runs on**: RAM, cores, load averages and
  NVIDIA GPU memory, and a headroom check that runs the same capacity arithmetic
  against what is actually free right now — with every figure labelled measured or
  estimated, never both, never neither.

## Components

| Component | Purpose |
| --- | --- |
| Skill `predictive-resource-allocation` | The intake interview, the triage sequence, how to choose and present remedies |
| MCP server | The triage reference, capacity arithmetic, bottleneck classification, dispatch arithmetic, host telemetry and headroom checks, estimate log, licensing |

### Tools

**Open** — no licence needed, enough to evaluate the method before buying

- `triage_reference` — the four constraint classes, the discriminating tests, the
  symptom index, the bandwidth ladder and the minimum intake
- `domain_profile` — per-application bottleneck profiles and the settings that matter
- `remedy_ladder` — the fixed remedy order, and why hardware is last

**Licensed** — requires a pro or team key

- `vram_estimate` — GPU rendering capacity arithmetic against the card's usable budget
- `training_memory_estimate` — static state and activation arithmetic, with the cliff
  called out when no batch size can fix it
- `classify_bottleneck` — threshold checks over measured test readings; names a class
  only when two findings agree
- `dispatch_plan` — the 10x-overhead dispatch rule, batching bands and Young–Daly
  checkpoint intervals
- `system_snapshot` — measured host telemetry: RAM, cores, load averages, NVIDIA GPU
  memory via `nvidia-smi`, top resident-memory processes on Linux
- `headroom_check` — the same estimate arithmetic checked against the machine's
  measured free memory, with the reserve rule applied to the real numbers and, when
  the plan does not fit, the measured largest consumers as the tasks to close
- `estimate_log` — local log of predictions against measured actuals, with a
  factor-of-two calibration tally

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

## Who it is for, and what it requires

3D animators, VFX artists and data scientists who own a deadline and a machine that is
not fast enough for it. Using it well requires **system architecture literacy** — a
working understanding of what CPU, GPU, RAM and I/O each do and why they fail
differently. The skill talks in occupancy against utilisation, bandwidth against
capacity, cliffs against slopes. If those distinctions are unfamiliar, the output reads
as jargon rather than as a plan.

You also have to bring **one measured baseline run** — the skill will ask for it and
will decline to predict without it, on purpose. The hardware half of the intake can now
be measured rather than reported when the MCP server runs on the machine in question:
`system_snapshot` reads RAM, cores and load from Node's built-ins and NVIDIA GPU memory
from `nvidia-smi`. When the server runs somewhere other than the render machine, the
snapshot describes the wrong computer — say which machine the plan is for.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan from the pricing page (or with `start_checkout` from inside a
conversation) and paste the key — it will be stored at
`~/.config/plugin-suite/predictive-resource-allocation.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export PREDICTIVE_RESOURCE_ALLOCATION_LICENSE_KEY=PS-PRA-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-PRA-...
```

The estimate log is written only to
`~/.config/plugin-suite/predictive-resource-allocation-estimates.json` on the machine
that created it. Telemetry snapshots are returned to the conversation and stored
nowhere. The billing service sees a licence key, a plugin id, a hashed
device identifier and a device label (your machine's hostname) — never a scene, a
model, an estimate or a snapshot.

## Honest limits

### Estimated against measured — the split, stated plainly

The plugin's outputs are now two different kinds of number, and every figure says
which it is:

- **Estimated** — the capacity arithmetic (`vram_estimate`, `training_memory_estimate`)
  and everything downstream of it. Arithmetic over inputs you reported, with a stated
  ±20% band on the formulas and **roughly a factor of two end to end**. A prediction of
  "about 6 minutes a frame" means somewhere between 3 and 12, and it means that even
  when the arithmetic is careful and the inputs are good.
- **Measured** — what `system_snapshot` and `headroom_check` read from the machine the
  server runs on: RAM, cores, load averages, NVIDIA GPU memory, top resident-memory
  processes. Real readings, but of a single point in time — a snapshot is not a
  profile, and the numbers move as other work starts and stops.

`headroom_check` compares one against the other and labels each side. The comparison
inherits the estimate's error band: a "fits" verdict is an estimated footprint inside a
measured budget, not a guarantee.

### What the GPU probe can and cannot see

GPU telemetry comes from one place: `nvidia-smi --query-gpu=name,memory.total,memory.used`.
That means, honestly:

- **NVIDIA cards with a working driver only.** AMD, Intel and Apple GPUs report
  `gpu: unavailable ("nvidia-smi not found or no NVIDIA GPU")` — a limit of the probe,
  not a statement about the hardware. No GPU figure is ever invented or approximated.
- **Card-level memory only.** The probe sees total and used per card, not which process
  holds it. The "background tasks to close" list is the machine's largest *host RAM*
  consumers (from `ps`, Linux only); it does not attribute VRAM per process.
- **No utilisation, clocks or thermals.** Occupancy-against-utilisation readings for
  `classify_bottleneck` still come from you and your profiler.

Load averages are reported as unsupported on Windows rather than shown as zeros, and
per-process memory is listed on Linux only, with the reason stated when it is omitted.

Scene and model content still dominates in ways no formula captures: two scenes with
identical polygon counts can differ tenfold through transparency depth, volumetrics or
light count. Driver and library versions move throughput 30% in either direction and
are unmodelled. Thermal throttling is invisible here entirely.

**One measured run of the actual job beats any estimate this produces — and beats a
snapshot too.** The tools say so in their own output rather than hiding it in a
footnote.

## What this is not

- **Not a profiler.** A snapshot reads what the machine holds at one instant; a
  profiler shows where a job's time goes. Nsight Systems, `py-spy`, Houdini's
  performance monitor and your renderer's own stats panel measure what this only
  estimates. Use them where you can.
- **Not a benchmark database.** It has no per-card scores for your scene or your model.
- **Not a purchasing recommendation engine.** It says which constraint a component would
  relieve and by roughly what ratio. It will not tell you an upgrade pays for itself —
  that depends on your rate and your pipeline, not on the hardware.
- **Not a substitute for a test render.** Every estimate it gives is an argument for
  running the smallest measurement that would settle the question.

## The skill you bring

**System Architecture Literacy.** Know CPU from GPU from RAM from I/O well enough to act on the findings. The triage names the binding constraint; you have to recognise it in your own pipeline.

## Plans

Served by `services/billing` in this repo; the catalog lives in its `catalog.js`.
Pro is $500/month (2 seats) and team is $2,500/month (10 seats). The licence gates the
compute tools — capacity arithmetic, bottleneck classification, dispatch arithmetic,
host telemetry and headroom checks, and the estimate log. The skill content and the
browsing tools (`triage_reference`, `domain_profile`, `remedy_ladder`) stay open, so
the method can be evaluated before buying.
