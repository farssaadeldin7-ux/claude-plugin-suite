# Support Agent Architect

Designs the knowledge base and escalation rules behind an AI support agent, so it answers
accurately instead of confidently guessing.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

Hallucination in support is nearly always a knowledge-architecture defect, not a model
defect. An agent invents a returns window because no article states it retrievably, or gives
the EU answer to a US customer because one article covers both regions with no qualifier.
Changing the model fixes neither.

The plugin enforces the order a practitioner works in:

- **Ticket taxonomy first.** Cluster historical tickets into intents, and record volume,
  resolution path and kind for each — *static* (documentable), *account-specific* (needs a
  lookup) or *judgement* (needs a human). Only static intents may be auto-answered.
- **Article architecture.** One intent per article, answer in the first two sentences,
  preconditions explicit, exact error strings in the text, policy split from procedure, every
  article dated and owned.
- **The four retrieval failure modes**, audited before launch: near-duplicate splits, stale
  articles outranking current ones, missing region or plan qualifiers, and articles that
  answer a question no customer phrases that way.
- **Hard escalation triggers** and a handover format that never re-litigates.
- **A grounding contract** in which "I don't know" is a first-class, rewarded outcome.
- **An evaluation method** built on a frozen regression set of 50-100 real tickets, measuring
  containment, accuracy on contained tickets, and false-containment.

## Who it is for

E-commerce managers and SaaS founders about to deploy, or already running, an AI support
agent.

**The skill you must bring is knowledge base architecture.** The plugin supplies the method,
the thresholds and the templates; it cannot supply judgement about what your policies are,
which intents your business treats as discretionary, or what a wrong answer costs you.
Someone who has never maintained a help centre will produce a tidy taxonomy nobody updates.

You also need your own ticket history. Under 500 tickets the volume figures are noise —
the taxonomy still gets built, but nothing is ranked on volumes, and
the plugin says so rather than inventing volumes.

## Components

| Component | Purpose |
| --- | --- |
| Skill `support-agent-architect` | The sequence, the thresholds, the rollout gates |
| `references/intent-taxonomy.md` | Clustering method, the static/account/judgement test, worked e-commerce and SaaS taxonomies |
| `references/article-template.md` | Article structure, style rules, anti-patterns with before/after rewrites |
| `references/escalation-and-eval.md` | Trigger list, handover format, regression-set method, metric definitions |
| MCP server | The reference tables as data, the mechanical audit, lint, screen and scorer, run history, licensing |

### Tools

**Open** — no licence needed, enough to evaluate the method before buying

- `taxonomy_reference` — the three kinds, the three-way test with edge cases, clustering
  thresholds, both worked taxonomies, the recording format
- `article_rules` — the template, style rules, the policy/procedure split, anti-patterns
  with rewrites, the four retrieval failure modes
- `escalation_reference` — the hard-trigger table, handover format, grounding contract,
  regression-set composition, metric definitions, rollout gates

**Licensed** — requires a pro or team key

- `taxonomy_audit` — a recorded taxonomy checked against every stated threshold, plus the
  containment-ceiling arithmetic and the ordered article backlog
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
`~/.config/plugin-suite/support-agent-architect.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export SUPPORT_AGENT_ARCHITECT_LICENSE_KEY=PS-SAA-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-SAA-...
```

## Privacy

The skill and its reference files are readable without a licence, and no ticket data
leaves your machine: the audit, lint, screen and scorer run locally, and the regression-run
history is written only to `~/.config/plugin-suite/support-agent-architect-runs.json` on
the machine that created it. The billing service sees a licence key, a plugin id, a hashed
device identifier — never a ticket, an article or a metric.

## What this is not

- **Not a support agent.** It designs the knowledge and rules that one runs on. You still
  need the agent, the retriever and the helpdesk integration.
- **Not a measurement tool.** Containment, accuracy and false-containment come from running
  your own regression set against your own system. Any number quoted before that is a guess.
- **Not a containment forecast.** The ceiling depends on your intent mix. The worked
  e-commerce example lands at 40-60% depending on launch maturity; the range across
  businesses is too wide to be a prediction.
- **Not a policy writer.** It tells you where policy must be stated explicitly and owned
  separately. Deciding the policy is yours, and often legal's.
- **Not retrieval tuning.** Embeddings, chunking and rerankers matter, but they are second
  order to the four failure modes above.

## The skill you bring

**Knowledge Base Architecture.** Structure FAQs and manuals into a clean, logical hierarchy; that structure — not the model — is what keeps a support agent answering instead of hallucinating.

## Plans

Pricing is defined in the suite catalog, served by `services/billing` in this repo:
pro $500/month (2 seats) and team $2,000/month (10 seats). The licence gates the compute
tools — `taxonomy_audit`, `article_lint`, `escalation_screen`, `regression_score` and
`regression_history`; the three reference tools and the skill content stay open.
