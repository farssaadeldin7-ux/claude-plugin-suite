---
name: neural-link-intention-layer
description: >
  This skill should be used when a designer or artist wants to cut repetitive command work out
  of a creative workflow — "I keep doing the same twenty clicks in Photoshop", "what should I
  turn into an action", "audit my design workflow", "analyse my command history and find the
  patterns", "is this worth making a macro for", "my Figma workflow is full of busywork", "help
  me set up a Stream Deck for retouching", "I want it to know what tool I'm reaching for next",
  "why does exporting take so long every single time", "how do I measure where my time actually
  goes in Blender". Also use it for choosing between an in-app action, an OS-level macro and a
  hardware button, for scoring whether a piece of automation repays its setup cost, and for
  instrumenting an application so that a command history exists at all.
metadata:
  version: "0.1.0"
---

# Neural-Link Intention Layer

**There is no neural link here and nothing reads intention.** The name is a product name.
What this does is count sequences in a command history the designer supplies, fit an
n-gram model over them — Markov-order statistics over action names — and use that to run
a workflow audit: which repeated sequences cost the most, and which are worth eliminating,
batching or automating. The "prediction" is `P(next action | the last one or two actions)`,
computed from their own recorded behaviour and nothing else. Say so in the first exchange,
in these words: a designer who believes it reads intention will distrust all of it the
first time it is wrong, and a good model of a workflow is still wrong more often than right.

Someone good at workflow optimisation does not start from a list of shortcuts they wish
they knew, but from a measurement of what they actually did — because the expensive
habits are invisible ones nobody remembers: zoom-pan-zoom, the tool toggle, the undo.

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
   percentage of the total. Usually the largest single cost, and rarely macro-fixable.

### 4. Fit the predictor and report its accuracy honestly

Split the log **chronologically**, last 20% held out. Random splitting leaks, because
neighbouring actions come from the same sequence, and returns a figure 15 to 25 points
too high. Report four numbers every time: the **baseline top-1** (always predict the
most frequent action), the **model top-1** with self-transitions excluded, the **model
top-3**, and the **log's date range and size**.

Realistic figures for a creative workflow, self-transitions excluded: baseline 8–15%,
bigram 25–35%, trigram with backoff 30–45%. If the model does not beat the baseline by at
least **10 percentage points absolute**, this log has no learnable sequence structure —
say so and continue with the audit, which is still worth doing. Treat any top-1 above 70%
as a bug until disproved; it nearly always means leaked test data or uncollapsed runs.

### 5. Score candidates for automation

```
value = F x (K + C) / (S + R)          payback_weeks = S x 1.3 / (F x (K + C))
```

**F** occurrences per week; **K** seconds saved (keystroke 0.3 s, mouse trip to a menu
1.5 s, modal dialogue 4 s); **C** context-switch cost (0 if the hand stays put, 1.5
mouse-to-menu, 4 dialogue, 15 leaving the app); **S** setup seconds plus 30% annualised
maintenance; **R** wrong-fire risk, `(1 − p) x severity`, severity 2 s if easily undone,
30 s if silently wrong, unbounded if destructive.

**Build it when payback is under 8 weeks and the sequence is stable across the whole log.**
At a typical 3 seconds saved per occurrence that gives:

| Mechanism | Setup | Break-even F per week |
| --- | --- | --- |
| Blender keymap entry | ~3 min | ~10 |
| Stream Deck button | ~4 min | ~13 |
| Photoshop or Illustrator Action | ~5 min | ~16 |
| Figma component set | ~15 min | ~49 |
| Keyboard Maestro or AutoHotkey macro | ~20 min | ~65 |
| Scripted plugin | ~1.5 h | ~270 |

Hence the working floor: **below roughly 15 occurrences per week a custom macro does not
repay its setup and maintenance.** Rescale when the saving is not 3 seconds — a Figma
component set saving 40 seconds each time breaks even at four uses a week.

### 6. Eliminate, then batch, then automate — in that order

1. **Eliminate** — why does this step exist at all? No ongoing maintenance cost.
2. **Batch** — can it be done once across many items instead of once each? Low cost.
3. **Automate** — can a machine perform the sequence? Ongoing cost, forever.

**Automating something that should have been eliminated is the most common mistake in
this discipline.** Before writing any macro, ask "why does this step exist?" three times.
If the answer bottoms out at a default, a template, a document preset, a preference or a
badly built source file, it is an elimination job and a macro would only freeze the
mistake in place. A macro setting every new document to 300 dpi CMYK is a missing preset.

### 7. Choose the mechanism

`references/automation-catalogue.md` covers Photoshop Actions and Script Events Manager,
Illustrator Actions, Figma components, variants and the plugin API, Blender keymaps and
pie menus, After Effects expressions, presets and scripting, the OS-level tools
(Keyboard Maestro, AutoHotkey, Hammerspoon) and Stream Deck — with what each genuinely
cannot do. Two rules worth repeating: prefer the in-app mechanism, which understands
document state and survives version updates; and **an OS-level macro that clicks screen
coordinates is a maintenance liability**, since it breaks on panel moves, display
scaling changes and updates. Prefer one that only sends keystrokes the app already binds.

### 8. Set a confidence floor, surface, then re-measure

A wrong suggestion in a creative flow costs more than no suggestion at all. That
asymmetry is the whole design constraint: a correct suggestion saves about a second, a
wrong one costs the read, the rejection and the break in attention. Let `k` be how many
times worse a wrong suggestion is than a right one is good. Surface only when
`p > k / (1 + k)` — that is 0.67 at k=2, 0.75 at k=3, 0.80 at k=4, 0.86 at k=6, 0.89
at k=8.

**Default to k = 4 and a floor of 0.80.** Most trigram models over a design log clear
0.80 in a handful of contexts and nowhere else, which is the correct outcome. Three
reliable suggestions beat forty speculative ones.

Never auto-execute a predicted action — surface it as an accelerator needing a
deliberate keystroke. For anything destructive or hard to undo, such as flatten, merge,
delete, close or overwrite on export, do not surface it at any confidence.

Two weeks later, log again and check each new macro is firing at the predicted rate.
Remove the ones that are not — dead automation is worse than none, because it still
occupies a hotkey and a slot in the designer's memory.

## Limits

- The model knows action names and timestamps. It cannot see the screen, the document
  or the file, and must never be given them.
- It does not model intent. Identical sequences can serve different goals, accuracy falls
  sharply on a change of project type, and recall is zero on anything unseen.
- Workflows are non-stationary. Refit anything built on a log older than about eight
  weeks or predating a major version change, and report the date range every time.
- It cannot tell you whether a suggested action is any good, only that it is what this
  designer usually does next. Automating a bad habit makes the habit faster.

## Privacy

Command history is sensitive: it reveals client work, hours worked and technique.

- Ask only for **action names, counts and timestamps**. Never ask for screen contents,
  document or file contents, file names, layer names or project titles.
- The raw log stays on the designer's machine. Work from aggregated counts pasted into the
  conversation rather than a whole log file, and delete the raw log afterwards.
- A keystroke logger must capture modified chords and named keys only, never raw
  characters, and must have a global stop hotkey.

## References

- `references/instrumentation.md` — getting a command log out of each application
- `references/sequence-analysis.md` — n-gram method, normalisation, scoring, worked example
- `references/automation-catalogue.md` — per-tool mechanisms and their real limits
