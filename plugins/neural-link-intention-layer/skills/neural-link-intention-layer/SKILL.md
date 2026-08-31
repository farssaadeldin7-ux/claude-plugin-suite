---
name: neural-link-intention-layer
description: >
  This skill should be used when a designer or digital artist wants to know which parts of
  their workflow are worth automating — "which of my repetitive tasks should I macro",
  "audit my command history", "how much time would this shortcut actually save", "I keep
  doing the same five steps", "is this automation worth building", "reduce my click
  fatigue", "analyse my editor log". Also use it to design an instrumentation plan when no
  command log exists yet, to score a proposed macro's payback, and to compute the
  production-capacity case from a measured audit.
metadata:
  version: "0.1.0"
---

# Neural Link Intention Layer

A deterministic sequence audit over a designer's own command history.

No biosensors, no intention inference, no behaviour claims from memory. It counts actions,
sequences and undo/navigation structure from logs, then estimates whether a shortcut or
macro is likely to pay back.

## Why this exists

Designers repeatedly ask a fuzzy question: *"Which parts of my workflow should I automate?"*
Most advice online is generic and usually wrong for a specific person. This skill replaces
that with a method:

- instrument the workflow,
- normalise the log,
- measure repeated sequences,
- score candidates by payback,
- reject fragile automation.

It is intentionally conservative. If the evidence is weak, it says so.

## What it can and cannot claim

- **Can** identify repeated command sequences, estimate weekly recurrence, and rank
  automation candidates by expected payback.
- **Cannot** infer internal goals or improve creative judgment.
- **Can** point out where effort is being burned in navigation and undo patterns.
- **Cannot** produce valid numbers without a real command log.

The expensive habits are usually invisible ones nobody remembers: zoom-pan-zoom, the tool
toggle, the undo.

## The one rule

**No log, no numbers.** Every frequency, saving and payback figure must trace back to a
recorded command history. A workflow described from memory is a source of hypotheses and
a plan for instrumentation, not a source of counts: self-report recovers roughly half the
actions actually performed and omits the cheap repeated ones first, which is exactly the
population you are hunting. If someone asks for an audit and has no log, the deliverable
is an instrumentation plan, not a ranked list of macros.

## Sequence

### 1. Frame it honestly before collecting anything

State the three things above: no mind reading, it learns only from their own history, it
will often be wrong. Then state the ceiling. For a heavy keyboard-driven user a
well-executed audit recovers **20 to 90 minutes per week** — not hours, and nothing at all
for decision-making, client revision or asset sourcing. If that is their bottleneck, stop.

### 2. Instrument

You cannot optimise a workflow you have not measured. Work through
`references/instrumentation.md`, which tabulates every method by fidelity, effort and
blind spots. Three sources, in descending order of quality:

- **Tier A, an application action or script log** — Photoshop History Log, Blender's
  Info editor, Figma plugin events. 60–95% of actions, with exact timestamps.
- **Tier B, the app's own macro recorder or an OS-level hotkey logger scoped to the
  app** — 50–70% of recordable commands, or good coverage of chords and none of menus.
- **Tier C, a structured self-report walk-through of the last finished piece** — 40–60%,
  no timing, biased against exactly the cheap repeated actions you are hunting. It
  produces hypotheses only. Never quote a frequency from it.

Collect at least **three working sessions across two different pieces of work** — one
session models one job, not a workflow. Under 500 actions report nothing numeric and keep
recording; the thresholds above that are in `references/sequence-analysis.md`.

### 3. Normalise, then analyse sequences rather than actions

Apply the normalisation rules in `references/sequence-analysis.md` first — it also holds
the bands for reading the outputs below, and a worked example over a realistic Photoshop
retouching log. The two rules that change the answer most: collapse consecutive repeats
into one token carrying a run length, and cut sequences at idle gaps over 3 minutes so no
bigram spans a coffee break. Keep undo and redo as first-class tokens — they carry more
signal than anything else in the log.

The unit of analysis is then the **sequence**. A designer pressing V four hundred times
is not a problem; that is the move tool doing its job. `V → drag → Ctrl+T → Enter → V`
occurring forty times is a macro waiting to be written. Produce, in this order:

1. Top 20 bigrams and trigrams by count, self-transitions excluded.
2. Top 10 sequences of length 4 or more recurring at least 10 times.
3. The **undo diagnostic** — `P(undo | action)` for every action seen 20 or more
   times. Above 0.25 is a wrong default, not an automation candidate.
4. The **navigation share** — zoom, pan, tool-toggle and layer-visibility as a
   percentage of the total. In retouching and illustration this is often 20–35%.

### 4. Score candidates, then choose the mechanism

Scoring formula and constants are fixed in `references/sequence-analysis.md`.

- `value = F x (K + C) / (S + R)`
- `payback_weeks = S x 1.3 / (F x (K + C))`

Where:

- **F** = frequency per week from the log,
- **K** = seconds saved per occurrence,
- **C** = context-switch cost,
- **S** = setup cost in seconds,
- **R** = wrong-fire risk.

Only build when payback is under 8 weeks **and** the sequence is stable across at least
three sessions.

Then choose the cheapest mechanism that works:

1. in-app keymap/shortcut,
2. in-app action/macro,
3. hardware button/chord,
4. OS-level macro,
5. script/plugin.

Mechanism details and examples live in `references/automation-catalogue.md`.

### 5. Validate and refit

- Re-measure the same workflow after deployment.
- Keep the automation only if net saving is visible in the next 2–3 weeks of logs.
- Refit the sequence model when major tooling or process changes happen.

## The commercial application: the Production Capacity Multiplier

What this sells is the reduction of click-fatigue. The audit prices the invisible tax —
mouse travel, menu navigation, zoom-pan-zoom, the tool toggle, the undo — in minutes per
week, counted from the person's own log. Framed for a buyer, that becomes a **Production
Capacity Multiplier**: minutes recovered per file, times files per day, is extra
throughput without extra fatigue — the shape of the claim is a retoucher handling on the
order of 20% more files per day without burnout.

The one rule holds in the pitch exactly as it holds in the audit: **no log, no numbers.**
The capacity claim is computed from *their* measured audit, after instrumentation, never
promised in advance — and it lives inside the stated ceiling (20–90 minutes per week for
a heavy user, nothing for decision-making or client revision). Sell the measurement and
the payback arithmetic; let their own log produce the multiplier.

## Deliverable format

The output should be short, auditable and falsifiable:

1. **Instrumentation quality note** (what was measured, what was not).
2. **Top repeated sequences** with counts and weekly rates.
3. **Undo and navigation diagnostics** with interpretation bands.
4. **Ranked candidate table** with `F, K, C, S, R, payback_weeks`.
5. **Recommendation**: eliminate, batch or automate.
6. **Risk note** for any candidate with destructive failure mode.

If data quality is poor, the recommendation is to improve logging first.

## Ethical and practical constraints

- Do not log document names, client names or content values unless explicitly required.
- Prefer action names and timestamps only.
- Be explicit when confidence is low.
- Never present this as mind reading or cognition extraction.

## Components

- `references/instrumentation.md` — what logs are available per tool and how noisy they are.
- `references/sequence-analysis.md` — normalisation rules, n-gram evaluation protocol,
  thresholds and worked example.
- `references/automation-catalogue.md` — mechanism selection and realistic setup costs.
