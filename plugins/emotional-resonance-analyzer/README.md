# Emotional Resonance Analyzer

Maps the emotional arc of a cut against the attention its form expects, so an editor can
see where the film loses people and why.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## This measures structure, not feeling

There is no audience here and no biometric signal. Nothing in this plugin senses emotion
and it cannot tell you how anyone felt. It produces a modelled arc, derived from craft
variables known to correlate with sustained attention — scene length, information density,
stakes clarity, question-and-answer spacing, tonal variance, cut rhythm — evaluated
against the conventions of the form you name.

Where you have real retention data from a platform it overrides the model completely, and
the skill asks for it first. With a real curve in hand the job changes from estimating
where attention drops to explaining a drop already measured.

## What it does

- **Question-and-answer ledger** — every question the film opens, where it closes and how.
  Unclosed questions at the end are unsatisfying, questions closed too early kill the
  pull. The single most useful artefact the skill produces
- **Five diagnosable drop-off causes**, each with a mechanical structural tell: no
  question open, stakes not personalised, tonal monotony, premature resolution, texture
  starvation — with the standard fix and worked examples for each
- **Valence and intensity plotting** — every scene scored −3 to +3 and 0 to 5, read as a
  derivative. Flat stretches are the problem, not low stretches
- **Form conventions** for short doc, feature doc, branded film, YouTube long-form and
  broadcast, and **three ranked highest-leverage cuts** on a defined edit effort scale

## Who it is for

Professional video editors and documentary film-makers. It assumes you bring narrative
pacing theory — you understand the *why* behind drop-off and want a structured second
reading of your cut, not a lesson. It will not teach you to edit.

Feed it a paper edit or timecoded transcript, the intended form, length and venue, and any
real retention curve you have. Without timecodes every duration-based tell is lost.

## Components

| Component | Purpose |
| --- | --- |
| Skill `emotional-resonance-analyzer` | The analysis sequence and how to report it |
| `references/dropoff-causes.md` | Five causes, tells, standard fixes, worked examples |
| `references/form-conventions.md` | Per-form attention shape, beats and departure points |
| `references/arc-scoring.md` | Scoring anchors, ledger format, worked 12-scene example |
| MCP server | Reference tables, threshold checks, pacing arithmetic, analysis log, licensing |

### Tools

**Open** — no licence needed, enough to judge the method before buying

- `form_conventions` — the per-form attention conventions and thresholds
- `scoring_anchors` — valence and intensity anchors, ledger format, effort scale
- `dropoff_causes` — the five causes, their tells, thresholds and standard fixes

**Licensed** — requires a pro or team key

- `check_tells` — the five drop-off tells run mechanically against a scored scene table
  and Q&A ledger, with overlaps, priority and exposed run-time
- `plot_arc` — the valence and intensity series read as a derivative: flat stretches,
  the largest gap between valence changes, peaks and whether they land
- `reconcile_curve` — classify real retention drops as explained, unexplained or
  model-only against the tripped tells
- `log_analysis` / `review_analyses` — local analysis history, version against version

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

None of the tools scores the film. They return counts, timecode ranges and table
lookups from the references; scoring the scenes and reading the flags is the skill's
job, and a real retention curve outranks all of it.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan from the pricing page (or with `start_checkout` from inside a
conversation) and paste the key — it will be stored at
`~/.config/plugin-suite/emotional-resonance-analyzer.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export EMOTIONAL_RESONANCE_ANALYZER_LICENSE_KEY=PS-ERA-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-ERA-...
```

## Free and paid

The skill and its references are open, as is browsing the reference tables through the
server. The licence gates the compute: the mechanical tell checks, the arc arithmetic,
curve reconciliation and the local analysis history. Analysis history is written only to
`~/.config/plugin-suite/emotional-resonance-analyzer-analyses.json` on the machine that
created it — the billing service sees a licence key, a plugin id, a hashed device
identifier and nothing about any film.

## What this is not

**It is not emotion measurement.** The name describes the subject matter, not the method.
No audience is watching and a modelled arc is not a felt arc.

**It will not give you a predicted retention percentage.** Any such number would be
invented, and the skill refuses the request rather than producing one.

It cannot judge performance, music, colour, sound design or whether a shot is beautiful,
and those routinely decide whether a scene works. It does not know your audience.

Everything it flags is a hypothesis about the cut, testable by watching the cut. Where it
disagrees with a real retention curve, the curve is right.

## The skill you bring

**Narrative Pacing Theory.** Understand why audiences leave. The tells locate where the cut is at risk; choosing the right creative adjustment is pacing judgement the table cannot make.

## Plans

Pricing is defined in the suite catalog: pro $500/month (2 seats, ≈ $250 per editor seat) and team $1,500/month (10 seats, ≈ $150 per seat) — per-seat is the honest unit here, and the "$500 per project" framing is the pitch: one project a month at pro. Team is
(10 seats). Both plans include the same tools — the licence gates `check_tells`,
`plot_arc`, `reconcile_curve` and the analysis history; the reference-table tools and
the skill content stay open.
