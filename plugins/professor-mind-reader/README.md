# Professor Mind-Reader

Reverse-engineers a marking rubric into the handful of criteria that actually move the
mark, then audits a draft against them in the order a marker reads.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

A marking rubric is not read evenly. Weights differ, the verb in each criterion sets a
cognitive level most drafts land one rung below, and a set of unwritten conventions sits
alongside the printed criteria. This skill makes all three explicit.

- **Rubric decomposition** — every criterion split into weight, the observable evidence a
  marker can point at, and the verb that fixes the level: describe, explain, apply,
  analyse, compare, evaluate, synthesise
- **Weight-to-effort mapping** — marks per 100 words per criterion, and where the draft
  is over-invested. A 10% structure criterion does not deserve a third of the word count
- **Draft audit** — for each criterion, the strongest sentence in the draft that
  satisfies it, quoted verbatim. No quotable sentence means the criterion is unmet, and
  that is the whole test
- **The hidden rubric** — a standing checklist of what graders reward that the printed
  rubric omits, labelled throughout as inferred convention rather than guarantee
- **Band positioning** — what separates 2:1 from a first, mapped across UK, US and ECTS
  naming, given as a range and never as a number

## Who it is for

University students and professionals writing to any stated set of assessment criteria:
coursework, dissertation chapters, professional qualifications, graded reports, funding
applications with published scoring criteria.

## Ethics

This works on the student's own draft against stated criteria. It does not write the
submission, does not draft passages for hand-in, and does not invent sources or
citations. Asked to ghostwrite for assessment, the skill refuses and offers the audit.

## Components

| Component | Purpose |
| --- | --- |
| Skill `professor-mind-reader` | The decomposition and audit procedure, and how to report it |
| `references/rubric-decomposition.md` | Verb ladder, weight-to-effort table, worked decomposition |
| `references/band-descriptors.md` | Band boundaries across UK, US and ECTS, and the 2:1 to 1st pivot |
| `references/hidden-criteria.md` | The unwritten conventions checklist, with why each is rewarded |

There is no MCP server. This is a pure-skill plugin: install it and it works.

## Free and paid

Everything the skill does is free — decomposition, effort mapping, the audit, the hidden
rubric sweep and band positioning. Suite-wide paid features, where a plugin has them,
cover stored history and exports. This plugin has no gated capability.

## What this is not

**It does not read your marker.** The name is a joke about the outcome, not a claim about
the method. Everything here is inference from criteria you supply plus the ordinary
conventions of academic marking. Two markers on the same script disagree, and moderation
moves marks.

It does not predict a grade. Band positioning is a reading of published descriptors and
can be a full band out where local conventions differ. If you want a number, this tool
will not give you one, and any tool that does is guessing.

It does not verify sources, check factual accuracy, or know whether a cited work says
what the draft claims it says. It does not replace the module handbook or your marker's
own guidance — where they disagree with this, they are right.

## The skill you bring

**Prompt Engineering.** The lowest-barrier skill to monetise in the suite. The audit is only as strong as the artefacts and phrasing supplied — the rubric verbatim, the brief, the draft, and asks pitched at the rubric's own verbs. Packaging that discipline (an academic-success pack, a wrapper over this skill) is the fastest speed-to-market here.

## Plans

Pricing is defined in the suite catalog for when this plugin's tool server ships:
pro $40/month (2 seats) and team $70/month (10 seats). Until the server exists, the skill content is open and nothing is gated.
