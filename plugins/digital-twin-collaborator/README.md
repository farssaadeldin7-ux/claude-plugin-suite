# Digital Twin Collaborator

Builds an explicit, written style profile from a director's own body of work, so a generative
apprentice produces first drafts in their voice rather than a generic one. Part of a 14-plugin
suite sharing one Stripe-backed licensing service. Profiles and every check stay on your
machine; the only network calls are licence checks to the billing service.

## What it does

Most attempts fail the same way: a director pastes three favourite pieces into a prompt and
asks for "my style", and back comes the genre average with a tint. What works is the slow part —
curating a corpus, extracting named dimensions from it, writing down the refusals. This plugin
enforces that order.

- **Rights gate first** — ownership, work-for-hire and third-party portfolios settled before
  anything is read
- **Corpus curation** — 15 to 40 pieces, inclusion and exclusion rules, a labelling schema, and
  a worked 20-piece example including what was thrown out, and why
- **Dimension extraction** — composition and negative space, palette discipline, value
  structure, type system, grain, subject distance and cadence for visual work; sentence length
  distribution, register, metaphor density, opening move, closing move and refusals for written
  work. Each with a method for measuring it rather than guessing
- **A "never" list** — 12 to 20 refusals, treated as the operative part of the profile
- **A prompt preamble** derived from the profile, compressed to 300-600 words with the
  constraints first
- **A scoring pass** — every draft graded 0-4 per dimension, with any never-list breach a hard
  fail regardless of the mean
- **Drift detection** — a quarterly or every-20-outputs re-audit with explicit thresholds for
  flagging a dimension that has regressed toward house-average output

## Components

| Component | Purpose |
| --- | --- |
| Skill `digital-twin-collaborator` | The sequence — rights gate, curation, extraction, the never list, the preamble, the scoring pass, drift — and every judgement in it |
| MCP server | The deterministic half: taxonomy and rule data, the mechanical corpus check, scoring and re-audit arithmetic, the local profile store, licensing |

### Tools

**Open** — no licence needed, enough to evaluate the method before buying

- `style_dimensions` — the dimension taxonomy for visual, written and motion work, with extraction methods
- `curation_rules` — corpus size bands, inclusion and exclusion rules, the labelling schema, the worked 20-piece example
- `governance_reference` — the 0-4 scoring scale, mean bands, re-audit thresholds, diagnosis table, checklists

**Licensed** — requires a pro or team key

- `corpus_check` — mechanical checks on a labelled corpus list: size band, schema violations, missing notes, date spread
- `score_draft` — the scoring-pass arithmetic: weighted mean, reading band, weakest dimensions, the hard-fail rule
- `drift_audit` — sample means against baseline, flagged by the stated regression thresholds, breach counting
- `save_profile` / `get_profile` — the local style-profile store, versioned, with countable facts about each profile

None of the tools reads work, extracts a style or scores a draft — extraction and scoring are
the reviewer's judgement, made in the skill; the server counts, stores and compares.

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
`~/.config/plugin-suite/digital-twin-collaborator.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export DIGITAL_TWIN_COLLABORATOR_LICENSE_KEY=PS-DTC-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-DTC-...
```

## Who it is for

Freelance creative directors, studio heads and small teams who produce enough volume that first
drafts are a real cost, and who have a body of their own work to build on.

## What you need to bring

**Style governance.** The plugin cannot curate the corpus for you. Deciding which twenty pieces
represent your standard, which were really the client's decisions, and which near-misses to
include is judgement work, and it is where the quality of the output is determined. A weak
corpus produces a confident, wrong profile. You also need to keep feeding corrections back:
nothing here learns, the profile improves when someone edits it, and if that stops happening
quality plateaus within weeks.

## Free and paid

The skill content and the three open tools — taxonomy, curation rules, the scoring and
governance reference — need no licence, and are enough to evaluate the method and build a
profile by hand. The licence gates the tools that save time once the method is trusted: the
mechanical corpus check, the scoring and drift arithmetic, and the versioned local profile
store. Profiles are written only to `~/.config/plugin-suite/digital-twin-collaborator-profiles.json`
on the machine that created them; the billing service sees a licence key, a plugin id, a hashed
device identifier — never a profile or a corpus.

## What this is not

**It is not a twin.** Nothing here models a person, learns from them, or reproduces their
judgement. The name describes an aspiration; the artefact is a document of checkable style rules
plus a scoring rubric. The honest metaphor is an apprentice — first drafts at a junior's quality,
to be directed and corrected. Treated that way it saves hours; expected to be a twin it
disappoints immediately.

**Extraction is lossy.** The best work in most portfolios is good for reasons that resist being
written down. What survives extraction is the checkable part. That part is real and it is not
all of it.

**It cannot tell you whether your style is any good**, only whether a draft matches it. A
profile built from work that is not working will faithfully reproduce it.

**It refuses other people's portfolios**, including a mix of your own and people you admire.
Style in general is not copyrightable; specific works are, and a corpus is made of specific
works.

**It is not legal advice.** Contested rights questions — a disputed work-for-hire clause, an
agency claiming ownership — go to a lawyer.

## The skill you bring

**Style Governance.** Curate high-quality training data from your own past work; the apprentice mimics exactly what the corpus and the never lists teach it, and nothing else.

## Plans

Pricing is defined in the suite catalog (`services/billing/catalog.js`):
pro $40/month (2 seats) and team $70/month (10 seats). Both plans include the same tools —
`corpus_check`, `score_draft`, `drift_audit` and the profile store; team buys seats, not
capabilities. The skill content and the open tools stay free.
