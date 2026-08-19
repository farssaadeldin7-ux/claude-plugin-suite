# Basecamp Split

Plans a group trip as three ledgers that have to reconcile: gear, weight and cost.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

An organiser who is good at this does not start with a kit list. They start with a
roster, because every line of every ledger ends up against a named person. This plugin
enforces that order and refuses to call a plan finished while a name is missing.

- **Gear ledger** — a shared vs personal classification, a duplication audit, and the
  seven-system single-point-of-failure check (shelter, water treatment, fire/stove,
  navigation, first aid, communications, repair). Every system needs a named owner and
  a stated backup in someone else's pack, or the plan is not done.
- **Weight ledger** — carried mass against a per-person band: roughly 20% of body
  weight for multi-day carry, 25–30% only for fit and conditioned carriers, 15% or less
  for the unconditioned. When someone is over, it names the constraint that binds and
  re-splits rather than quietly loading the strongest person.
- **Consumables** — kcal/person/day by exertion band, 700–900 g/person/day of dry food,
  water by climate, treatment throughput by method, fuel by conditions, and a mandatory
  one-day reserve at 60% ration.
- **Cost ledger** — even, weighted-by-nights and itemised splits chosen per expense,
  with a settle-up that reports the transfers needed and does not overclaim minimality.

## Who it is for

Expedition leaders, guides, DofE and scout leaders, climbing and paddling club trip
organisers, and anyone who has been the person who ended up carrying the fourth stove.

## Components

| Component | Purpose |
| --- | --- |
| Skill `basecamp-split` | The whole thing. Roster, classification, SPOF check, consumables, weight bands, rebalancing, settle-up |
| `references/gear-taxonomy.md` | Shared vs personal test, the seven-system table with acceptable backups, splittable items |
| `references/consumables-planning.md` | Energy, food weight, water, treatment and fuel figures, plus a worked four-person three-day example |
| `references/cost-splitting.md` | The three split models, the settle-up algorithm and its limits, worked example |

## Free and paid

This is a pure-skill plugin. There is no MCP server, nothing is metered, and no part of
it is gated behind a licence — install it and the whole procedure is available. No trip
data leaves your machine because nothing is sent anywhere.

## Setup

No install step, no dependencies, no configuration. Drop it in and ask for a gear split.

It works best if you can supply body weights, nights per person and a rough personal
kit weight per person. Without body weights it falls back to self-declared target loads
and says so, rather than assuming a 70 kg carrier.

## What this is not

- **Not a risk assessment.** It will not tell you whether a route, a season or a river
  crossing is within your group's competence, and it says so when the question drifts
  that way.
- **Not a forecast.** Weather, avalanche, tide and river-level information are separate
  and current-day. It can tell you a cold ration is heavier; it cannot tell you whether
  it will be cold.
- **Not medical advice.** The carry bands are expedition and military load convention,
  not physiology, and they are wrong for individuals in both directions.
- **Not a source of real weights.** Every mass is either yours or a typical figure, and
  manufacturer tent weights run 5–10% light once pegs, stuff sacks and mud are counted.
  Weigh the actual kit.
- **Not a certification.** It checks that a first aid kit, an emergency communication
  plan and a route plan left with someone exist and have owners. It cannot check that
  they are any good.
