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
| MCP server | The reference tables as queryable data, the four ledger computations, licensing |

### Tools

**Open** — no licence needed, enough to inspect the method before buying

- `gear_taxonomy` — the shared vs personal test, the three tags, the typical
  classification, splittable items and the duplication audit
- `spof_systems` — the seven-system table with acceptable backups and the rules
- `planning_figures` — kcal, food weight, reserve, water, treatment, fuel, carry bands
  and split models, all as stated ranges

**Licensed** — requires a pro or team key

- `size_consumables` — food, reserve, water and fuel arithmetic for a party; ranges
  stay ranges unless a point inside them is chosen
- `weight_ledger` — per-person load against band, the binding constraint named, the
  aggregate-versus-split finding
- `settle_costs` — the ledger in whole pennies, the zero-sum check, the greedy
  settle-up with its honest limits
- `reconcile_plan` — the four finishing checks plus the two always-required items

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
`~/.config/plugin-suite/basecamp-split.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export BASECAMP_SPLIT_LICENSE_KEY=PS-BCS-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-BCS-...
```

The tools work best if you can supply body weights, nights per person and a rough
personal kit weight per person. Without body weights the weight ledger falls back to
self-declared target loads and says so, rather than assuming a 70 kg carrier.

Trip data — rosters, loads, expenses — is passed through the tools and stored nowhere.
The billing service sees a licence key, a plugin id and a hashed device identifier; it
never sees a trip.

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

## The skill you bring

**Logistics & Resource Optimisation.** The transferable skill this plugin encodes: multi-variable distribution under hard constraints. The same discipline prices into supply chain, disaster relief and event logistics — build for expedition companies first, then pivot the allocation method to larger industries. As a leader you still bring judgement about route and group competence, which the plugin deliberately does not provide.

## Plans

Pricing is defined in the suite catalog: pro $5/month (2 seats) and team $15/month — the $20-per-trip alternative is storefront framing; at $5 flat, one trip a month already beats it. Team pricing is
(10 seats). A licence gates the four ledger computations — `size_consumables`,
`weight_ledger`, `settle_costs` and `reconcile_plan`. The skill content and the three
reference-table tools stay open, so the method can be evaluated before buying.
