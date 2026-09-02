# Neural-Link Intention Layer

**There is no neural link and nothing here reads minds.** The name is a product name.
What this plugin does is n-gram prediction over a command history you supply — Markov-
order statistics over action sequences — plus a structured workflow audit. The
"prediction" is `P(next action | the last one or two actions)`, learned from your own
logged behaviour and nothing else. It is said plainly here and in the skill because a
designer who believes it reads intention will distrust all of it the first time it is
wrong, and it is wrong more often than right even when working correctly.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

Reduces the hotkey tax in a creative workflow by finding the command sequences you
repeat, costing them, and deciding which are worth eliminating, batching or automating.

- **Instrumentation first.** Three ways to get a command history — an application action
  log, the app's own macro recorder or a scoped keystroke logger, or a structured
  self-report — each with its fidelity and blind spots stated. Nothing numeric from recall.
- **Sequences, not actions.** Pressing V four hundred times is not a problem; `V → drag
  → Ctrl+T → Enter → V` forty times is a macro waiting to be written.
- **A payback calculation.** `F x (K + C) / (S + R)`, converted into weeks to break even
  with per-mechanism break-even frequencies. Below roughly 15 occurrences per week a
  custom macro does not repay its setup and maintenance.
- **Eliminate, batch, then automate, in that order.** Automating what should have been
  eliminated is the most common mistake in this discipline.
- **A stated confidence floor.** A wrong suggestion in a creative flow costs several
  times what a right one saves, so nothing is surfaced below 0.80 predicted probability
  and nothing is auto-executed. Accuracy is always reported as baseline, top-1 with
  self-transitions excluded, top-3 and the log's date range. Realistic top-1 is 30–45%.

## Who it is for

Professional digital artists and UI/UX designers who can reason about their own
repetitive command patterns. Photoshop, Illustrator, Figma, Blender and After Effects are
covered specifically; the method transfers to anything you can get an action log out of.

## Components

| Component | Purpose |
| --- | --- |
| Skill `neural-link-intention-layer` | The judgement: framing, instrumentation choices, reading the audit, the three optimisation moves, what to build and what to remove |
| `references/instrumentation.md` | Getting a command log out of each application, with fidelity, effort and blind spots per method |
| `references/sequence-analysis.md` | The n-gram method plainly, normalisation rules, minimum log sizes, the scoring formula, a worked Photoshop retouching example |
| `references/automation-catalogue.md` | Photoshop Actions, Illustrator Actions, Figma components and plugin API, Blender keymaps, After Effects expressions and scripting, Keyboard Maestro / AutoHotkey / Hammerspoon, Stream Deck — and what each cannot do |
| MCP server | The deterministic mechanics: log normalisation, the sequence audit, the n-gram predictor and its held-out evaluation, the payback arithmetic, the local build log, licensing |

### Tools

**Open** — no licence needed, enough to evaluate the method before buying

- `instrumentation_guide` — how to get a command history out of each application, and the log format the analysis expects
- `automation_catalogue` — what each mechanism can and cannot do, setup costs, break-even frequencies
- `method_reference` — every threshold the licensed tools compute with: normalisation rules, minimum log sizes, expected accuracy ranges, reading bands, the scoring constants, the confidence-floor table

**Licensed** — requires a pro or team key

- `analyse_log` — the sequence audit: top actions, bigrams and trigrams, recurring sequences, the undo diagnostic, the navigation share
- `fit_predictor` — the n-gram model with its honest held-out accuracy, and the contexts that clear the confidence floor
- `score_candidate` — the payback arithmetic against the 8-week build threshold
- `record_build` / `review_builds` — the local build log and the two-week re-measure

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

## Privacy

Command history is sensitive — it reveals client work, hours worked and technique. The
skill asks only for **action names, counts and timestamps**. It never asks for screen
contents, document or file contents, file names, layer names or project titles. Logs
stay on your machine; work from aggregated counts and delete the raw log afterwards. Any
keystroke logger it helps you set up captures modified chords and named keys only, never
raw characters, and always with a stop hotkey.

## What this is not

- **Not a neural interface or intention detection.** It is conditional probability
  over action names you recorded yourself.
- **Not a measurement of anything it has not been given.** No log, no numbers — a
  workflow described from memory yields hypotheses and an instrumentation plan, not counts.
- **Not a judge of your technique.** It knows what you usually do next, not whether it is
  any good. Automating a bad habit makes the habit faster.
- **Not durable.** Workflows shift; refit any model built on a log older than ~8 weeks.
- **Not a large time saving.** An honest projection for a heavy keyboard-driven user is
  20 to 90 minutes a week, and nothing at all for decision-making, client revisions or
  asset sourcing. It says so rather than padding the estimate.

## The skill you bring

**Advanced Workflow Optimisation.** Know your own repetitive command patterns — the predictive settings are configured from them, and the instrumentation only surfaces what you can recognise.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan from the pricing page (or with `start_checkout` from inside a
conversation) and paste the key — it will be stored at
`~/.config/plugin-suite/neural-link-intention-layer.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export NEURAL_LINK_INTENTION_LAYER_LICENSE_KEY=PS-NLI-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-NLI-...
```

## Plans

Pricing is defined in the suite catalog: pro $100/month (2 seats) and team $300/month
(10 seats). The licence gates the analysis tools — `analyse_log`, `fit_predictor`,
`score_candidate` and the local build log. The skill content and the reference tools
(`instrumentation_guide`, `automation_catalogue`, `method_reference`) stay open.
