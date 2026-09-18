---
name: basecamp-split
description: >
  This skill should be used when someone is dividing gear, food, weight or money across a group
  trip — "who's bringing what for the camping trip", "help me split the gear for a four-day
  hike", "how much food do we need for six people", "how much should everyone be carrying",
  "make a shared kit list for the group", "we're planning a group expedition, what are we
  forgetting", "split the costs for the trip", "work out who owes who now we're back", "one of
  our group can't carry much, how do we rebalance". Also use it for a pre-trip duplication
  audit, for checking that no critical system depends on a single person or a single pack, and
  for settling a shared expense ledger down to a short list of transfers.
metadata:
  version: "0.1.0"
---

# Basecamp Split

Plan a group trip as three ledgers that must reconcile: **gear**, **weight** and **cost**.

An organiser who is good at this does not start with a kit list. They start with a
roster, because every line of every ledger has to end up against a named person. The
amateur version of this job produces a shared spreadsheet where the gear column says
"group" — and then four people bring a stove and nobody brings the repair kit.

## The one rule

**Every line carries exactly one name.** An item owned by "the group" is an item
nobody packs. An expense owed by "everyone" is an expense nobody settles. A kilogram
assigned to "spare capacity" is a kilogram someone is quietly carrying.

If you cannot name the person, the plan is not finished. Say so rather than presenting
a tidy-looking list with holes in it.

## Sequence

### 1. Build the roster before anything else

You cannot run the weight ledger without it. For each person collect:

| Field | Why it matters |
| --- | --- |
| Body weight | The carry band is a percentage of it. Without it, all weight output is guesswork |
| Conditioning | Decides which band applies — see step 5 |
| Nights on trip | Drives food, fuel and the weighted cost split |
| Arrival / departure | Someone joining on day two changes three ledgers at once |
| Dietary needs | Non-substitutable mass, and it cannot be pooled |
| Injuries, age, known limits | Overrides the band downwards, never upwards |
| Gear already owned | Prevents buying what the group already has twice |

If body weights are not available, ask once. If they are refused or awkward — which is
common and legitimate — switch to absolute target loads chosen by the carrier
themselves and **say plainly that the load guidance is now self-declared, not
calculated**. Do not silently substitute an assumed 70 kg.

### 2. Classify every item shared or personal

Work through `references/gear-taxonomy.md`. It gives the classification test, the
three-way tag (`SHARED`, `REDUNDANT-SHARED`, `PERSONAL`) and the list of items that
split across carriers — tent body from poles from fly, stove from pot from fuel.

Then run the duplication audit: for every `SHARED` line with more than one instance,
either justify it as deliberate redundancy or delete it. Four stoves is three stoves
of dead weight unless someone decided it.

### 3. Run the single-point-of-failure check

Seven systems. Every one needs a **named owner** and a **stated backup**, and the
backup must not live in the owner's pack:

shelter, water treatment, fire/stove, navigation, first aid, communications, repair.

The full table — what counts as an acceptable backup for each, and what does not — is
in `references/gear-taxonomy.md`. This is the step that catches the classic failure.

**A plan with a blank in this table is not finished.** Report the blank as a blocker,
not as a footnote at the end of a long list.

### 4. Size the consumables

Food, water and fuel from `references/consumables-planning.md`. The headline figures:

| Quantity | Planning figure |
| --- | --- |
| Energy, sedentary basecamp | 2,500 kcal/person/day |
| Energy, moderate hiking | 3,000–3,500 kcal/person/day |
| Energy, cold weather or heavy load | 4,000–5,000 kcal/person/day |
| Food dry weight | 700–900 g/person/day |
| Water, temperate | 3–4 L/person/day including cooking |
| Rationing reserve | One extra day at ~60% ration, always |

The reserve day is not optional and it is not the same as a full extra day. Carry
roughly 400–500 g and 1,800–2,000 kcal per person of food that needs no cooking.

### 5. Run the weight ledger against the bands

Total each person's load — personal kit plus their share of group mass plus
consumables at the heaviest point of the trip, which is normally the first morning.

| Carrier | Multi-day carry limit |
| --- | --- |
| Fit, conditioned, load-experienced | 25–30% of body weight |
| Typical healthy adult | ~20% of body weight |
| Unconditioned, young, older, or recovering | 15% or less |

These are guidance, not physiology. They come from military and expedition load
convention and they are wrong for individuals in both directions. Treat an exceeded
band as a design fault in the plan, never as something the carrier should absorb.

Consumables burn down at roughly 1–1.5 kg/person/day, so a load that is 8% over on day
one may be inside the band by day two. Say that when it is true — it changes the
decision.

### 6. Rebalance, and declare the constraint that binds

Move group mass towards the strongest carriers first, in this order: fuel and water
(dense, divisible), then food, then bulky shared items, then split systems.

Then check every band again. If someone is still over:

1. Name the binding constraint out loud. "D's band is 8.7 kg and their personal kit
   plus water is 9.5 kg" is the finding — not "loads are a bit tight".
2. Cut scope before you overload anyone: fewer nights, a resupply, a cached drop, a
   lighter shelter, a shorter menu.
3. Re-split and re-check.

**Never close the gap by quietly adding the surplus to the strongest carrier past
their own band.** If the group's total mass exceeds the sum of the bands, the trip as
specified does not fit and that is the answer.

### 7. Settle the cost ledger

Three models, in `references/cost-splitting.md`: even split, weighted by nights or
person-days, and itemised. Pick per expense, not per trip — fuel for the drive is
usually even, the site fee is usually by nights, a permit is usually per head.

Compute each person's balance as paid minus owed, confirm the balances sum to zero,
then produce the transfer list. The reference gives the greedy settle-up algorithm and
its honest limits.

### 8. Reconcile the three ledgers

The plan is done when all four of these pass:

- Every `SHARED` instance has exactly one carrier's name, and every
  `REDUNDANT-SHARED` item has at least two instances, each with one named carrier, in
  different packs.
- Every one of the seven systems has an owner and a backup in a different pack.
- No person exceeds their stated band at the heaviest point of the trip.
- Cost balances sum to zero and every expense has a payer and a split model.

State which of the four failed. Do not present a plan that fails one of them as if it
were finished.

### 9. Always insist on these two, regardless of what was asked

- **Emergency communications**: who carries what, what it can and cannot do, whether
  there is coverage, and who is the named contact.
- **A route plan left with someone not on the trip**: route, intended camps, party
  list, vehicle details, expected return time, and the time at which that person
  should raise the alarm.

If the user says these are not needed, record them as declined rather than dropping
them from the output.

## Presentation

Output the three ledgers as tables — a per-person pack list, a load table showing
carried mass against band, and a settlement table. Put the failures and blanks at the
top, before the tidy parts.

Give totals in kg to one decimal place. Do not imply precision you do not have: a
stated tent weight is a manufacturer figure, and real packed weight runs 5–10% over
once stuff sacks, pegs and mud are counted.

## What this skill does not do

- **It is not a risk assessment.** It does not judge whether a route, a season or a
  crossing is within the group's competence, and it must say so when the question
  drifts that way.
- **It does not replace a forecast.** Weather, avalanche, tide and river-level
  forecasts are separate, current-day inputs. It can tell you a cold-weather ration is
  heavier; it cannot tell you whether it will be cold.
- **It does not give medical advice.** Carry limits are convention, not clinical
  guidance, and dietary and medication needs belong to the individual.
- **It does not know real weights.** Every mass it uses is either supplied by the user
  or a typical figure. Weigh the actual kit before the actual trip.
- **It does not certify a first aid kit or an emergency plan as adequate.** It checks
  that one exists and has an owner.

## References

- `references/gear-taxonomy.md` — shared vs personal classification, the seven-system
  single-point-of-failure table with acceptable backups, splittable items
- `references/consumables-planning.md` — kcal, food weight, water, treatment
  throughput and fuel by conditions, with a worked four-person three-day example
- `references/cost-splitting.md` — the three split models, the settle-up algorithm and
  its limits, worked example
