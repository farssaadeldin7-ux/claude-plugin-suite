# Customer Sales Support

An AI-powered customer support agent, built on the company's own content. Instead of a
human answering every basic question, the agent is trained on the company's manuals and
FAQs and handles tickets automatically — post-sales support tickets and the pre-sales
questions prospects ask before buying (what a product does, which plan fits, availability,
how to order), under one grounding rule. The plugin audits the help centre first,
restructures it into something answerable without hallucinating, reports where coverage is
missing, and defines which questions must reach a person.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

Hallucination in support is nearly always a knowledge defect, not a model defect. An agent
invents a returns window because no article states it retrievably, or gives the EU answer
to a US customer because one article covers both regions with no qualifier. So the work
runs content-first:

- **Audit the help centre against real tickets** — for a sample from the actual queue,
  which article should answer each, whether it exists, and whether it states the answer
  plainly. Output: answered, answerable-but-buried, uncovered.
- **Restructure so the agent can't guess** — one question per article, the answer in the
  first two sentences, policy stated with its numbers, conditions as explicit branches,
  duplicates merged.
- **Report the coverage gaps** — the questions customers ask that no document answers,
  ranked by frequency, for the business to either document or assign to humans.
- **Define what must reach a person** — hard escalation rules as literal conditions
  (refunds over a threshold, legal/safety language, anger, repeat contacts, anything
  uncovered, "I want a human" — and on the pre-sales side: negotiation, discounts, and
  recommendations the docs don't determine), with a handover that never makes the
  customer repeat themselves.
- **Test before launch** — the ticket sample as a frozen regression set; wrong answers are
  launch blockers; re-run on every doc change.
- **Launch narrow, widen by intent** — highest-volume, lowest-risk intents first.

The one rule throughout: "I don't know — let me get you a person" is a first-class answer,
and a question with no covering article escalates, full stop.

## Who it is for

E-commerce managers and SaaS founders who want basic tickets handled automatically without
their brand confidently making things up.

You bring your own ticket history and your policies. The plugin finds where policy is
unstated or contradictory; deciding the policy is yours, and often legal's.

## Components

| Component | Purpose |
| --- | --- |
| Skill `customer-sales-support` | The sequence: audit, restructure, gap report, escalation rules, regression test, staged launch |
| MCP server | The reference tables as data, the mechanical audit, lint, screen and scorer, run history, licensing |

### Tools

**Open** — no licence needed, enough to evaluate the method before buying

- `taxonomy_reference` — intent kinds, the three-way test with edge cases, clustering
  thresholds, worked e-commerce and SaaS taxonomies
- `article_rules` — the article template, style rules, the policy/procedure split,
  anti-patterns with rewrites, the four retrieval failure modes
- `escalation_reference` — the hard-trigger table, handover format, grounding contract,
  regression-set composition, metric definitions, rollout gates

**Licensed** — requires a pro or team key

- `taxonomy_audit` — a recorded intent taxonomy checked against every stated threshold,
  plus the containment-ceiling arithmetic and the ordered article backlog
- `article_lint` — mechanical checks on one drafted article, evidence quoted
- `escalation_screen` — a message screened against the triggers' literal detection phrases
- `regression_score` — the metric formulas over a scored run, composition checks, gates
- `regression_history` — recorded runs with arithmetic deltas, local to this machine

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
`~/.config/plugin-suite/customer-sales-support.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export CUSTOMER_SALES_SUPPORT_LICENSE_KEY=PS-CSS-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-CSS-...
```

## Privacy

The skill content is readable without a licence, and no ticket data leaves your machine:
the audit, lint, screen and scorer run locally, and the regression-run history is written
only to `~/.config/plugin-suite/customer-sales-support-runs.json` on the machine that
created it. The billing service sees a licence key, a plugin id, a hashed device
identifier — never a ticket, an article or a metric.

## What this is not

- **Not the runtime agent itself.** It builds and tests the knowledge, rules and gates an
  agent runs on; you still need the agent, the retriever and the helpdesk integration.
- **Not a containment forecast.** Deflection share is discovered at launch against your
  own regression set, not predicted. Any number quoted before that is a guess.
- **Not a policy writer.** It reports where policy must be stated explicitly; deciding it
  is the business's job.
- **Not retrieval tuning.** Embeddings, chunking and rerankers matter, but they are second
  order to the content defects the audit finds.

## Plans

Pricing is defined in the suite catalog, served by `services/billing` in this repo:
pro $1,000/month (2 seats) and team $5,000/month (10 seats). The licence gates the compute
tools — `taxonomy_audit`, `article_lint`, `escalation_screen`, `regression_score` and
`regression_history`; the three reference tools and the skill content stay open (the
Starter tier: the whole method, free, by hand).

**Month one of pro is the paid pilot.** Never sold cold: agree the success metric before
checkout — regression-set accuracy on the buyer's own tickets, scored by their own team —
run the month, then the subscription continues on the measured result or cancels at
period end. No separate pilot SKU; the pitch is the fraction-of-value rule, priced
against the support hours the pilot just measured.
