# Haptic Feedback Mapper

Eliminates context-switching: quantifies the cognitive load of constantly checking a
screen, maps status checks to a small haptic vocabulary, and sells the result as
**Deep-Work Protection** — proving that the tool lets artists stay in the zone, increasing
their billable hours by reducing interruptions.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

Every glance at a render bar, an export status or a notification tray is a context switch,
and the cost is the refocus minutes after it, not the glance. The plugin works the problem
in order:

- **Baseline the cognitive load** — checks per session, the share that changed nothing,
  and a refocus cost computed with a stated, conservative assumption
- **Inventory the checks** — every reason the artist looks at the screen mid-flow, and
  which decision each check feeds
- **Classify events** — act-now, done, ambient, noise; only the first two earn a haptic,
  and noise is deferred to a post-session digest
- **Design the haptic vocabulary** — 3–5 distinguishable patterns, one meaning each,
  failure never confusable with success, teachable in a sentence
- **Verify the load dropped** — the same measurement re-run after adoption, plus the trust
  metric: the share of haptics the user actually acted on
- **Build the Deep-Work Protection pitch** — the buyer's own check count × refocus minutes
  × their hourly rate, with every assumption labelled so the math survives scrutiny

The one rule: a haptic that fires for something ignorable is worse than the screen it
replaced. The channel works because it is scarce and trusted.

## Who it is for

Makers of creative tools — drawing, rendering, audio, video — selling to artists and
freelancers who bill by the hour, and product teams positioning focus itself as the
feature.

You bring the product and the users. The plugin supplies the measurement method, the
mapping discipline and the ROI framing; the before/after numbers must come from real
sessions, and the skill will say so rather than invent them.

## Components

| Component | Purpose |
| --- | --- |
| Skill `haptic-feedback-mapper` | The sequence: baseline, inventory, event classes, vocabulary design, verification, the pitch |
| MCP server | The reference tables as data, the load arithmetic, the mechanical mapping audit and vocabulary check, the local session log, licensing |

### Tools

**Open** — no licence needed, enough to evaluate the method before buying

- `event_classes` — the four classes (act_now, done, ambient, noise) with criteria,
  channels and examples, plus the one rule and the act-now ceiling
- `vocabulary_rules` — the 3–5 pattern limit, the three distinguishable axes, the
  failure-distinctiveness rule, the fallback requirement, the blind test
- `refocus_figures` — the conservative glance-level floor and the literature range, each
  with its basis and limits stated

**Licensed** — requires a pro or team key

- `load_math` — checks/day × refocus minutes × working days at both bounds, priced at the
  buyer's own rate, with every assumption echoed back for showing next to the numbers
- `mapping_audit` — a recorded event→class mapping checked against the stated rules with
  the entries quoted: ambient/noise events carrying a haptic, act-now events without one,
  the ceiling, the distribution
- `vocabulary_check` — a proposed pattern set checked mechanically: duplicate meanings,
  axis collisions, intensity-only pairs, the failure-distinctiveness rule
- `log_session` / `review_sessions` — the local before/after measurement log: per-phase
  checks-per-hour, the drop share, and the trust metric with the crying-wolf flag

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

The server is deterministic throughout: it serves tables, does arithmetic and matches the
recorded mapping against stated rules. It never decides what class an event belongs in,
never measures a session, and never predicts a billable-hour gain — that split is the
design, not a gap.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan from the pricing page (or with `start_checkout` from inside a
conversation) and paste the key — it will be stored at
`~/.config/plugin-suite/haptic-feedback-mapper.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export HAPTIC_FEEDBACK_MAPPER_LICENSE_KEY=PS-HFM-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-HFM-...
```

## Free and paid

The skill content and the three reference tools are free — the whole method can be read
and inspected before buying. A licence gates the compute and the history: the load
arithmetic, the mapping audit, the vocabulary check and the session log.

The server runs locally over stdio, so no session data leaves the machine. The
measurement log is written only to
`~/.config/plugin-suite/haptic-feedback-mapper-sessions.json`; the billing service sees a
licence key, a plugin id and a hashed device identifier — never a session, a mapping or a
rate.

## What this is not

- **Not a measured claim until you measure.** Billable-hour gains are projections until
  the after-measurement exists; the pitch sells the measured before/after where it
  exists and the trial where it doesn't.
- **Not original research.** Refocus-cost figures are borrowed from the
  interruption-recovery literature, which studied office task-switching, not studio work
  — which is why the method computes with a conservative floor and labels every
  assumption.
- **Not a content channel.** A buzz says "the client replied"; reading the reply is still
  a screen task. The win is choosing when to switch, not never switching.
- **Not one-size-fits-all hardware.** Vibration sensitivity differs across users and
  devices; the vocabulary needs a visual/audio fallback and on-device testing.

## Plans

Served by `services/billing` in this repo; the catalog lives in its `catalog.js`:
pro $500/month (2 seats) and team $2,000/month (10 seats). Both plans include the same
tools — the licence gates `load_math`, `mapping_audit`, `vocabulary_check`, `log_session`
and `review_sessions`; the skill content and the reference tools stay open.
