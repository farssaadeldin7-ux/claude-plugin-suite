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

There is no MCP server. This is a pure-skill plugin: install it and it works.

## Free and paid

Everything the skill does is free. Suite-wide paid features, where a plugin has them,
cover stored history and exports; this one has no gated capability.

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

Pricing is defined in the suite catalog for when this plugin's tool server ships:
pro $40/month (2 seats) and team $70/month (10 seats), with a 14-day single-seat
trial. Until the server exists, the skill content is open and nothing is gated.
