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

A pure-skill plugin: no MCP server, nothing metered, nothing gated behind a licence.

| Component | Purpose |
| --- | --- |
| Skill `neural-link-intention-layer` | The whole procedure: framing, instrumentation, normalisation, n-gram fitting, scoring, the three optimisation moves, the confidence floor |
| `references/instrumentation.md` | Getting a command log out of each application, with fidelity, effort and blind spots per method |
| `references/sequence-analysis.md` | The n-gram method plainly, normalisation rules, minimum log sizes, the scoring formula, a worked Photoshop retouching example |
| `references/automation-catalogue.md` | Photoshop Actions, Illustrator Actions, Figma components and plugin API, Blender keymaps, After Effects expressions and scripting, Keyboard Maestro / AutoHotkey / Hammerspoon, Stream Deck — and what each cannot do |

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
