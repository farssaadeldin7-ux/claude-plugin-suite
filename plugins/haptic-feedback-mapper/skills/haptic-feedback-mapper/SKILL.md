---
name: haptic-feedback-mapper
description: >
  This skill should be used when someone wants to replace screen-checking with haptic
  feedback and sell that as deep-work protection — "map render progress to haptics", "design
  a haptic vocabulary for my app", "quantify the cost of context switching", "how many
  billable hours do interruptions cost", "let artists stay in the zone", "notify without a
  screen", "build the deep-work ROI case", "which events deserve a buzz". Also use it for
  deciding which events earn a haptic at all, designing distinguishable patterns, measuring
  cognitive load before and after, and writing the "Deep-Work Protection" pitch in billable
  hours.
metadata:
  version: "0.1.0"
---

# Haptic Feedback Mapper

Eliminates context-switching: quantify the cognitive load of constantly checking a screen,
then map the checks to haptic feedback so the screen never needs to be looked at. Sold as
**Deep-Work Protection** — proving that the tool lets artists stay in the zone, increasing
their billable hours by reducing interruptions.

Every glance at a progress bar, a render queue, an export status or a notification tray is
a context switch, and the cost is not the glance — it is the minutes of refocusing after
it. A working session ends up perforated by dozens of checks that each felt free. The
product move is to carry that information through the wrist or the device instead, and the
sales move is to price the recovered attention in billable hours.

## The one rule

**A haptic that fires for something ignorable is worse than the screen it replaced.** The
channel works because it is scarce and trusted: every buzz means something the artist
actually needs to know, and silence reliably means "keep working". The moment users feel a
buzz and think "probably nothing", they go back to checking the screen — and now they have
both interruptions. Defend the channel's signal-to-noise ratio above every feature request.

## Sequence

### 1. Baseline the cognitive load

Before mapping anything, measure the current cost of screen-checking so the improvement has
a denominator. For a typical working session, count: how many times the artist checks a
status (observed or self-logged over a few sessions), what fraction of checks changed
nothing ("still rendering"), and the refocus cost per switch. Use the research range for
recovery after an interruption — commonly cited around 10–23 minutes for full refocus, the
upper figure tracing to Mark, Gudith & Klocke, "The Cost of Interrupted Work: More Speed
and Stress" (CHI 2008), with a defensible conservative floor of 1–5 minutes for a
glance-level switch — and **state which figure you used and why**, naming the citation
when the upper figure appears in anything a buyer reads. The baseline formula:

```
weekly cost = checks/day × refocus minutes × working days
```

Run it with the conservative floor and the literature figure both. Even the floor is
usually alarming, and the floor is credible. The `refocus_figures` tool carries both
figures with their bases; `load_math` runs the arithmetic at both bounds and echoes every
assumption back so it can be shown next to the numbers. If the tools are unavailable, the
formula above is the whole computation — run it by hand.

### 2. Inventory the checks

List every reason the artist looks at the screen mid-flow: render/export progress, job
completed, job failed, client message arrived, upload finished, battery/storage warnings,
queue position. For each, record what decision the check feeds. A check that feeds no
decision — "still going" — is pure load and maps to **silence**, not to a haptic.

### 3. Decide what earns a haptic

Sort every event into exactly one class:

| Class | Criterion | Channel |
| --- | --- | --- |
| Act now | The artist must do something (render failed, client approved, blocking question) | Distinct haptic, immediately |
| Done | A wait has ended and work can resume or ship (export complete) | One simple haptic |
| Ambient | Progress the artist would peek at (50% rendered) | Silence, or an opt-in low-intensity pulse pattern |
| Noise | Feeds no decision during flow (likes, newsletters, non-blocking chat) | Nothing, deferred to a batch digest after the session |

The distribution matters: in a healthy mapping, most events land in Ambient or Noise. If
more than a handful land in Act now, the mapping is re-creating the notification tray in
vibration form.

Once the mapping is drafted, run `mapping_audit` — it checks the recorded mapping against
these rules mechanically with the entries quoted: ambient or noise events carrying a
haptic, act-now events without one, the ceiling, the distribution. It reports facts, never
which class an event belongs in; that judgement stays here, with the user.

### 4. Design the haptic vocabulary

Small and learnable beats expressive: **3–5 distinguishable patterns, no more.** Untrained
users reliably distinguish patterns that differ on intensity, count and rhythm — one firm
tap for Done, two for Act now, a distinct triple for failure — but not subtle variations.
Rules: every pattern maps to one meaning everywhere in the product; failure must never be
confusable with success (make it the most distinctive pattern); intensity respects the
context (a wrist buzz an artist feels through a drawing glove differs from a phone on a
desk); and the whole vocabulary is teachable in one sentence each. Test it blind: if a
user cannot name the meaning of a pattern without looking, cut a pattern rather than add a
tutorial. Run `vocabulary_check` on the proposed set — it flags duplicate meanings, axis
collisions, pairs that differ only in intensity, and a failure pattern confusable with
success. What it cannot check is how the patterns feel on the actual hardware; only the
blind test decides that.

### 5. Verify the load actually dropped

Re-measure after adoption, same method as the baseline: checks per session, and the share
of haptics the user acted on (the trust metric — it should stay high; a falling action
rate means the vocabulary has started crying wolf). With a paid plan, keep the record
mechanical: `log_session` stores each session's counts by phase, and `review_sessions`
computes the per-phase averages, the drop share and the trust metric, flagging a
crying-wolf action rate and a baseline that didn't drop. The before/after pair is both the
product validation and the sales asset. If checks did not drop, the usual causes, in
order: Ambient events got haptics, Noise wasn't actually silenced, or the artist doesn't
yet trust silence to mean "nothing needs you" — which is fixed by reliability, not by
more feedback.

### 6. Sell it as Deep-Work Protection

The pitch is not "vibration alerts" — every phone has those. The pitch is the recovered
hours, priced at the buyer's own rate:

1. **Their baseline** — checks per day from their workflow, not a generic figure.
2. **The math shown, assumptions labelled** — checks × refocus minutes × their hourly
   rate, using the conservative floor so the number survives scrutiny.
3. **The claim** — "stay in the zone: the work tells you when it needs you, so you never
   have to ask", proven by the before/after measurement, not asserted.
4. **The guarantee shape** — invite them to run the two-week baseline/after comparison on
   their own sessions.

For a freelance artist billing $75/hour, even 20 glance-level checks a day at the 2-minute
floor is ~3 hours a week — roughly $10k a year of attention. Present that as their number,
computed from their inputs, and let them argue with their own workflow rather than with
your marketing.

## Presentation

Deliverables, not descriptions: the check inventory table, the event-class mapping, the
haptic vocabulary spec (pattern, meaning, intensity, context), the baseline and after
measurements with the formula and assumptions visible, and the ROI one-pager in the
buyer's rate. Whenever a number appears, its assumption appears next to it — the credibility
of the whole pitch rests on the conservative math being checkable.

## Licensing

`event_classes`, `vocabulary_rules` and `refocus_figures` are open. `load_math`,
`mapping_audit`, `vocabulary_check` and the session log require a paid licence, and return
`license_required` or `upgrade_required` when the plan does not cover them. Handle it
plainly: say what is missing, call `list_plans`, and offer `start_checkout`. Never work
around a gate by inventing what the paid tool would have said — and never let a licensing
miss stall the method itself: every computation here can be run by hand from the formulas
and rules on this page.

## Limits of the method

- **Refocus-cost figures are borrowed, not measured here.** The upper figure comes from
  Mark, Gudith & Klocke (CHI 2008), which studied office task-switching, not studio work;
  that is why the method computes with a conservative floor and labels every assumption.
- **Billable-hour gains are projections until the after-measurement exists.** Sell the
  measured before/after where you have it; sell the framework and the trial where you
  don't. Never present the projection as a result.
- **Haptics carry alerts, not content.** A buzz says "the client replied"; reading the
  reply is still a screen task. The win is choosing *when* to switch, not never switching.
- **Accessibility varies.** Sensitivity to vibration differs across users and hardware;
  the vocabulary needs a visual/audio fallback, and pattern distinctions must be tested on
  the actual devices.
- **Some interruptions should interrupt.** A deadline moved up or a cancelled job is worth
  breaking flow for; the mapping protects deep work, it does not seal the room.
