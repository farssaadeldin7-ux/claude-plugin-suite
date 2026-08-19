---
name: diagnose-by-sound
description: >
  This skill should be used when someone describes a noise a vehicle is making and wants to know
  what is causing it — "my car is making a grinding noise", "there's a clicking when I turn",
  "what's this whining sound", "squealing when I brake", "clunk over bumps", "help me diagnose
  this rattle", "hum that gets louder with speed". Also use it for triaging a customer's
  complaint before the car is on the lift, for deciding whether a vehicle is safe to drive, and
  for building a confirmation-and-repair plan from a suspected cause.
metadata:
  version: "0.1.0"
---

# Diagnose by Sound

Turn a described noise into a ranked, testable differential diagnosis.

The value here is discipline, not guesswork. A mechanic who is good at this does not
jump to a cause — they characterise the noise precisely, then work out which single
question splits the field fastest. Follow that same order.

## The one rule

**Never call `diagnose` with terms invented on the spot.** The matcher only recognises
its own vocabulary; anything else is silently dropped and quietly weakens the result.
Call `sound_vocabulary` first, map what the person said onto those terms, and use them.

"It sounds like a coin in a tumble dryer" is a great description and is not a vocabulary
term. Translate it — that is the job.

## Sequence

### 1. Characterise before diagnosing

Run the intake interview. The full question set is in
`references/intake-protocol.md`, but three questions carry more diagnostic weight
than everything else combined:

1. **Does it track road speed, engine RPM, or load?**
   Coast in neutral at speed: if the noise continues unchanged, it is road-speed
   linked (wheels, tyres, driveline). Rev in neutral while stationary: if it appears,
   it is RPM-linked (engine, accessories). If it only shows up under throttle or
   uphill, it is load-linked.
2. **What exactly reproduces it?** Braking, turning, bumps, cold start, full lock.
3. **What does it actually sound like?** Map to a `character` term.

Ask these before anything else. If the person cannot answer question 1, give them the
neutral-coast and neutral-rev tests to run and wait for the answer — it is worth the
round trip.

### 2. Diagnose

Call `diagnose` with every dimension you have. Then read the result honestly:

- **`evidence.evidence_weight_percent`** — how much of the available evidence you
  actually supplied. Below 60, the confidence numbers are structurally capped and the
  right move is to collect more, not to speculate harder.
- **`separation.top_two_gap`** — under 15 means the leaders are not separated. Do not
  present a winner.
- **`next_questions`** — these are computed to split the current contenders. Ask them.
  One well-chosen question is worth more than three more guesses.

Re-run `diagnose` with the new answers. Two or three passes is normal and is the tool
working correctly, not a failure.

### 3. Lead with safety when it matters

If `safety.level` is `critical` or `high`, say that **first**, before the diagnosis,
in plain words. A critical verdict means the vehicle should be recovered rather than
driven — say so directly and do not bury it under a ranked list.

The safety verdict is deliberately conservative: a low-confidence brake failure still
governs the advice, because being wrong about brakes costs more than an unnecessary
tow. Do not talk the user out of it because the confidence number looks low.

### 4. Present hypotheses, not verdicts

Give the top two or three candidates with, for each:

- what it is, in plain language
- the one observation that most supports it
- **the specific test that confirms or kills it**

That last item is the deliverable. "Probably a wheel bearing" is worth little.
"Probably the front-left wheel bearing — confirm it by driving gentle S-turns at
60-80 km/h and listening for it to load up on right-hand curves" is worth something.

Use `describe_signature` to pull the full confirmation procedure for any candidate.

### 5. Plan the repair (paid plans)

Once a candidate is confirmed, `repair_plan` produces the ordered confirmation
sequence, the parts usually involved and book labour hours. Pass `also_consider` with
the runner-up ids so the plan carries an explicit fallback.

Pass `labour_rate` only if the user has given you their rate. **Never estimate parts
prices** — the tool deliberately does not, and neither should you. Quote parts from a
real supplier or say they need quoting.

### 6. Close the loop (paid plans)

Save the case with `save_case`, and when the real cause is known, `record_outcome`.
`review_cases` then makes the history searchable. For a shop, the second time a model
shows up with the same noise, what it turned out to be last time is stronger evidence
than any general signature list.

## Presentation

Write like a mechanic explaining it at the counter: direct, specific, no hedging
theatre. Prose and short lists. Do not dump the raw JSON.

State confidence honestly. If the tool says the field is not separated, say the field
is not separated — do not manufacture a lead candidate to sound decisive.

Include the physical safety notes from `references/safety-and-limits.md` whenever you
send someone to test something themselves. Jack stands, hot exhausts and spinning
belts have hurt more people than wrong diagnoses have.

## What this skill does not do

- It does not read fault codes. If the vehicle has a check engine light, scan data
  should lead and the noise diagnosis should support it.
- It does not replace inspection. Every candidate it produces is a hypothesis with a
  test attached, and the test is the point.
- It does not cover electric-vehicle-specific drivetrain noise in any depth yet. Say
  so rather than stretching a combustion signature to fit.
- It does not price parts.

## Licensing

Tools return `license_required` or `upgrade_required` when the plan does not cover
something. Handle it plainly: say what is missing, call `list_plans`, and offer
`start_checkout`. Never work around a gate by inventing the answer the paid tool would
have given.

## References

- `references/intake-protocol.md` — the full interview, in order, with the tests to
  send people away to run
- `references/safety-and-limits.md` — physical safety when testing, and the limits of
  what a noise can tell you
