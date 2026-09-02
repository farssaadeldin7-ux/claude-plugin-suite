# Sequence analysis

The mechanism behind the product name. Nothing here is exotic: it is counting pairs
and triples of action names and dividing.

## The n-gram method, plainly

A log is a list of action names in order: `a1, a2, a3 ... aN`. A **bigram** is an
adjacent pair, `(a1, a2)`; a **trigram** is a run of three. Count every bigram, and the
probability that `b` follows `a` is `P(b | a) = count(a, b) / count(a)`. That is the
whole model. **Markov order** is how much history the prediction may see: order 1 uses
only the current action, order 2 the last two, order 3 the last three.

Higher order predicts better where there is data and collapses where there is not. With
a vocabulary of 120 distinct actions there are 14,400 possible order-2 contexts and
1.7 million order-3 contexts. You will never fill them.

**Backoff** handles this. Use the highest order whose context has been seen at least
**20 times**; otherwise drop to the next order down and multiply the resulting
probability by a discount of 0.4 per level dropped. Add-1 smoothing on top stops any
unseen continuation reading as exactly zero.

## Normalisation, before any counting

Get this wrong and every number afterwards is wrong.

| Rule | Do | Do not |
| --- | --- | --- |
| Parameter noise | Collapse `set_brush_size:41` and `set_brush_size:43` to `set_brush_size` | Collapse `blend_mode:soft_light` and `blend_mode:overlay` — the parameter is the action |
| Repeats | Replace N consecutive identical actions with one token carrying `run=N` | Leave runs in; they inflate accuracy to meaninglessness |
| Idle gaps | End a sequence at a gap over 3 min, end a session at 30 min | Let a bigram span a break |
| Duplicate emissions | Drop the second line when the app logs one command as two states | Assume the log is clean |
| Undo and redo | Keep as first-class tokens | Strip them as noise — they are the best signal in the log |

## Minimum log sizes

| Actions after normalisation | What may be reported |
| --- | --- |
| under 500 | Nothing numeric. Keep recording |
| 500–2,000 | Action frequencies and obvious repeated sequences, marked provisional |
| 2,000–5,000 | Bigram statistics, top sequences, candidate scoring |
| 5,000+ | Trigrams with backoff, held-out accuracy |
| 20,000+ | Separate models per project type |

Also require three sessions across two different pieces of work. A single session
models one job.

## Evaluating the predictor

1. **Split chronologically.** Last 20% held out. Random splitting leaks adjacency and
   inflates top-1 by 15–25 points.
2. **Exclude self-transitions from the headline number.** Predicting "you will paint
   again" is free and worth nothing. Quote the excluded figure; footnote the other.
3. **Always report the baseline** — always predicting the single most frequent action.
4. **Require a 10 point absolute lift** over baseline. Below that, report that the log
   contains no learnable sequence structure and proceed with the audit alone.

## Reading navigation and undo

**Undo share** as a percentage of all actions:

| Share | Reading |
| --- | --- |
| under 3% | Healthy, or the log is not capturing undos |
| 3–8% | Normal for exploratory creative work |
| 8–15% | Investigate what precedes the undos |
| over 15% | Wrong defaults, or a destructive rather than non-destructive process |

**Per-action undo diagnostic:** for each action with at least 20 occurrences, compute
`P(undo | action)`. Above 0.25 means the action's defaults are wrong; fix defaults,
not macros.

**Navigation share** is **zoom, pan, tool switching and layer-visibility toggles as a
percentage of all actions**. In retouching and illustration it is commonly **20–35%**.
This is usually the biggest single cost in a creative log and almost never a macro
candidate; fixes are hardware and habits.

## Scoring automation candidates

Use one formula throughout so ranking is not argued by gut feel.

- `value = F x (K + C) / (S + R)`
- `payback_weeks = S x 1.3 / (F x (K + C))`

Where:

| Term | Meaning | Typical values |
| --- | --- | --- |
| F | Occurrences per week, from the log | never from recall |
| K | Seconds saved per occurrence | keystroke 0.3 s, menu trip 1.5 s, modal dialogue 4 s |
| C | Context-switch cost, seconds | 0 hand stays put, 1.5 mouse-to-menu, 4 dialogue, 15 leaving the app |
| S | Setup seconds; `x1.3` adds 30% annualised maintenance | 180 keymap, 300 action, 900 component set, 1200 OS macro, 5400 plugin |
| R | `(1 − p) x severity` | severity 2 s undoable, 30 s silently wrong, unbounded destructive |

Build when payback is under 8 weeks and the sequence is stable across the whole log.

The 15 s figure for leaving the application is a deliberately conservative in-app
resumption cost. Do not reach for the widely quoted "23 minutes to refocus" number: it
comes from research on a different kind of interruption and does not describe switching
panel inside a design tool.

## Worked example — Photoshop beauty retouching

Log: 6 sessions, 11 h 40 m across 9 days, **4,812 actions**, 137 distinct action types
after normalisation. History Log at Detailed, plus an AutoHotkey chord logger scoped to
Photoshop to recover navigation.

Top actions:

| Action | Count | Share |
| --- | --- | --- |
| brush_stroke | 1,190 | 24.7% |
| navigate_zoom | 402 | 8.4% |
| navigate_pan | 356 | 7.4% |
| undo | 311 | 6.5% |
| select_tool_brush | 244 | 5.1% |
| set_brush_size | 233 | 4.8% |
| toggle_layer_visibility | 171 | 3.6% |

Navigation share 24.4%. Undo share 6.5% — normal band, no action to take.

Model: baseline top-1 24.7% including self-transitions, but only **9.1% once
self-transitions are excluded**. Trigram with backoff reaches **31.4%** excluded, top-3
58%. That clears the 10 point lift, so the model is usable — and 31% is the honest
number to quote, not 24.7% or anything above it. One caveat the size table above
imposes: 4,812 actions sits just under the 5,000 floor for trigram fitting, so the
trigram figures are provisional — re-fit once the log crosses it.

Three candidates, showing all three optimisation moves:

**1. The dodge-and-burn layer ritual — automate.**
`new_layer → fill_50_grey → blend_mode:soft_light → select_tool_brush → set_flow:2`,
41 occurrences, roughly 32 per week at the observed rate. 14 keystrokes plus two
dialogue round trips, about 11 s. A Photoshop Action costs ~300 s to record.
Payback = 300 x 1.3 / (32 x 11) = **1.1 weeks**. Build it.

**2. The zoom-pan-heal loop — eliminate, do not automate.**
`navigate_zoom → navigate_pan → heal → navigate_zoom_out`, 187 occurrences. Highest count
in the log and worth nothing as a macro, because the pan target differs every time. The
move is hardware: a rocker ring or ExpressKeys bound to zoom, Navigator for gross moves.

**3. The client export loop — batch, do not automate.**
Export As, set format, set scale, choose folder, save; 12 times per delivery, 2
deliveries a week, about 40 s each. Fragile as a macro because the folder changes. As a
batch it is one Image Processor run or a saved export preset, and 24 weekly occurrences
collapse to 2.

**A non-candidate.** Runs of three or more consecutive `set_brush_size` occur 64 times.
Looks large until normalised: those runs are one token with a run length. The underlying
action is still parameter hunting, and the fix is a tablet rocker ring or better brush
presets, not a macro around repeated key taps.

## Confidence floors for suggestions

The predictor should not surface weak suggestions. Let **k** be how many times worse a
wrong suggestion is than a right one is good. Show only when:

`p > k / (1 + k)`

| Wrong-fire is… | k | Minimum p |
| --- | --- | --- |
| equal cost to right-fire gain | 1 | 0.50 |
| 2x worse | 2 | 0.67 |
| 4x worse | 4 | 0.80 |
| 9x worse | 9 | 0.90 |

UI commands should default to a threshold around 0.8 and only drop with explicit user
consent.
