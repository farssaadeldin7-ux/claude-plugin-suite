# Predictive Resource Allocation

Works out where a render, simulation or training job will bottleneck, and says what to
change first.

Part of a 14-plugin suite. This one is a pure skill — no MCP server, no network calls,
no telemetry.

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

## Who it is for, and what it requires

3D animators, VFX artists and data scientists who own a deadline and a machine that is
not fast enough for it. Using it well requires **system architecture literacy** — a
working understanding of what CPU, GPU, RAM and I/O each do and why they fail
differently. The skill talks in occupancy against utilisation, bandwidth against
capacity, cliffs against slopes. If those distinctions are unfamiliar, the output reads
as jargon rather than as a plan.

You also have to bring two things it cannot obtain for itself: **your actual hardware**
and **one measured baseline run**. The skill will ask for both and will decline to
predict without them, on purpose.

## Free and paid

Everything here is free. No MCP server, no licence gate, no usage counter, no account.

## Honest limits

**These are estimates, not measurements, and the error band is roughly a factor of
two.** A prediction of "about 6 minutes a frame" means somewhere between 3 and 12, and
it means that even when the arithmetic is careful and the inputs are good.

The skill has no profiler, no telemetry and no access to your machine — every input is
what you reported. Scene and model content dominates in ways no formula captures: two
scenes with identical polygon counts can differ tenfold through transparency depth,
volumetrics or light count. Driver and library versions move throughput 30% in either
direction and are unmodelled. Thermal throttling is invisible here entirely.

**One measured run beats any estimate this produces.** The skill says so in its own
output rather than hiding it in a footnote.

## What this is not

- **Not a profiler.** Nsight Systems, `py-spy`, Houdini's performance monitor and your
  renderer's own stats panel measure what this only estimates. Use them where you can.
- **Not a benchmark database.** It has no per-card scores for your scene or your model.
- **Not a purchasing recommendation engine.** It says which constraint a component would
  relieve and by roughly what ratio. It will not tell you an upgrade pays for itself —
  that depends on your rate and your pipeline, not on the hardware.
- **Not a substitute for a test render.** Every estimate it gives is an argument for
  running the smallest measurement that would settle the question.
