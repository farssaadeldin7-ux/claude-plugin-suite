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
| MCP server | Verb ladder, band tables, hidden-rubric checklist, effort arithmetic, scorecard, audit history, licensing |

### Tools

**Open** — no licence needed, enough to decompose a rubric before buying

- `verb_ladder` — the seven-rung ladder, demotion signals, promotion moves, and exact
  verb lookup
- `band_descriptors` — band naming across UK, US and ECTS, what separates the bands,
  the 2:1 to 1st pivot, descriptor-phrase translation
- `hidden_rubric` — the unwritten conventions checklist, with tests and failure
  signatures

**Licensed** — requires a pro or team key

- `effort_map` — target words and marks per 100 words per criterion, investment ratios
  against the threshold table
- `audit_scorecard` — marks at stake from the audit's verdicts, and the ranked fix list
- `log_audit` / `record_result` / `review_audits` — local audit history and its error bar

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan from the pricing page (or with `start_checkout` from inside a
conversation) and paste the key — it will be stored at
`~/.config/plugin-suite/professor-mind-reader.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export PROFESSOR_MIND_READER_LICENSE_KEY=PS-PMR-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-PMR-...
```

## Free and paid

Everything the skill does is free — decomposition, effort mapping, the audit, the hidden
rubric sweep and band positioning — and the server's knowledge-base tools are open. The
licence gates the server's compute and history tools: the effort arithmetic, the
scorecard, and the local audit log.

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

Pricing is defined in the suite catalog: pro $40/month (2 seats) and team $70/month
(10 seats). Both plans include the same tools; the licence gates `effort_map`,
`audit_scorecard` and the audit history. Skill content and the knowledge-base tools
stay open.
