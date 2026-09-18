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
- **Export the profile and wire the bridge** — the audited mapping compiled into a
  canonical JSON profile plus a POSIX-sh `notify` hook, and mapped events appended to a
  local event log that any haptic driver, Stream Deck plugin or automation tool can watch
- **Verify the load dropped** — the same measurement re-run after adoption, plus the trust
  metric: the share of haptics the user actually acted on
- **Build the Deep-Work Protection pitch** — the buyer's own check count × refocus minutes
  × their hourly rate, with every assumption labelled so the math survives scrutiny

The one rule: a haptic that fires for something ignorable is worse than the screen it
replaced. The channel works because it is scarce and trusted.

## The delivery chain

An MCP text server cannot drive haptic hardware, and this one does not pretend to. The
chain is: **design** the mapping and vocabulary → **audit** them against the stated rules
(`mapping_audit`, `vocabulary_check`) → **export** the audited result as consumable
artefacts (`export_profile`) → **emit** mapped events to a local log (`emit_event`, or the
exported `notify` shell hook) → **the haptic driver on the user's machine consumes the log
and does the vibrating**. The plugin designs and exports the mapping and emits events; it
drives no hardware directly.

The consumer contract, stated in every exported artefact:

- **Event log** — `${XDG_CONFIG_HOME:-$HOME/.config}/plugin-suite/haptic-feedback-mapper-events.log`,
  NDJSON, one object per line, appended atomically (a single `O_APPEND` write). Each line
  carries `ts`, `profile`, `event`, `class` (`act_now` or `done` only — silent classes are
  never emitted), `pattern` (`id`, normalised `amplitude` 0–1, `pulse_ms`, `gap_ms`,
  `repeat`, the `rhythm` label), `priority`, advisory `cooldown_seconds`, and `source`
  (`emit_event` or `notify`). Consume it with `tail -F` and translate each line's tuple
  into a vibration.
- **Profile JSON** — `<name>.haptic-profile.json` in the caller's directory: the full
  compiled mapping (event ids, classes, priorities, cooldowns, amplitude/duration/repeat
  tuples derived from the vocabulary's count/intensity/rhythm axes) for drivers that load
  a profile rather than tail a log.
- **`notify` hook** — POSIX sh, no dependencies: `notify <event_id>` appends the same
  contract line, so a build system or file-sync tool can emit without the MCP server.

An export is refused — with the failures named — when the mapping fails its own
`mapping_audit` or `vocabulary_check` rules, so nothing that breaks the one rule ever
reaches a driver.

## Who it is for

**Creative studios** — drawing, rendering, audio, video work — losing focus time to
screen-checking mid-session. Steps 1–6 of the skill measure the cost, design the fix and
wire it to the machine; step 7 turns it into the case for the plan, priced at your own
billable rate.

The plugin supplies the measurement method, the mapping discipline and the ROI framing;
the before/after numbers must come from your own sessions, and the skill will say so
rather than invent them.

## Components

| Component | Purpose |
| --- | --- |
| Skill `haptic-feedback-mapper` | The sequence: baseline, inventory, event classes, vocabulary design, export and the bridge, verification, the pitch |
| MCP server | The reference tables as data, the load arithmetic, the mechanical mapping audit and vocabulary check, the profile export and event-log bridge, the local session log, licensing |

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
- `export_profile` — the audited mapping compiled into the canonical JSON profile and the
  `notify` shell hook, written to a caller-supplied directory; refused with the failures
  named when the mapping fails its own audit
- `emit_event` — one mapped event appended atomically to the local event log with its
  vocabulary tuple, validated against the exported profile; structured errors for
  unmapped and silence-mapped events
- `log_session` / `review_sessions` — the local before/after measurement log: per-phase
  checks-per-hour, the drop share, and the trust metric with the crying-wolf flag

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

The server is deterministic throughout: it serves tables, does arithmetic, matches the
recorded mapping against stated rules, and writes files and log lines. It never decides
what class an event belongs in, never measures a session, never predicts a billable-hour
gain — and never drives haptic hardware, which only the consumer of the event log can do.
That split is the design, not a gap.

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
`~/.config/plugin-suite/haptic-feedback-mapper-sessions.json`, exported profiles to
`~/.config/plugin-suite/haptic-feedback-mapper-profiles.json` (plus the artefacts in the
directory you name), and emitted events to
`~/.config/plugin-suite/haptic-feedback-mapper-events.log`; the billing service sees a
licence key, a plugin id, a hashed device identifier and a device label (your machine's
hostname) — never a session, a mapping, an event or a rate.

## What this is not

- **Not a hardware driver.** The stated limit of the whole plugin: an MCP text server
  cannot vibrate anything, and nothing here fakes it. The plugin designs and exports the
  mapping and emits events to the local log; the haptic driver on your machine — a watch
  companion app, a Stream Deck plugin, a wearable bridge, any tool that can tail a file —
  does the vibrating. Without such a consumer, the export is a specification, not a buzz.
- **Not a measured claim until you measure.** Billable-hour gains are projections until
  the after-measurement exists; the pitch sells the measured before/after where it
  exists and the trial where it doesn't.
- **Not original research.** Refocus-cost figures are borrowed: the upper figure traces
  to Mark, Gudith & Klocke, "The Cost of Interrupted Work: More Speed and Stress"
  (CHI 2008) — the widely cited ~23 minutes to fully return to an interrupted task —
  which studied office task-switching, not studio work. That is why the method computes
  with a conservative floor and labels every assumption.
- **Not a content channel.** A buzz says "the client replied"; reading the reply is still
  a screen task. The win is choosing when to switch, not never switching.
- **Not one-size-fits-all hardware.** Vibration sensitivity differs across users and
  devices; the vocabulary needs a visual/audio fallback and on-device testing.

## Plans

Served by `services/billing` in this repo; the catalog lives in its `catalog.js`:
pro $100/month (2 seats) and team $300/month (10 seats) — a Deep-Work premium priced
against the billable hours it recovers for the studios it serves. Both plans include the
same tools — the licence gates `load_math`,
`mapping_audit`, `vocabulary_check`, `export_profile`, `emit_event`, `log_session` and
`review_sessions`; the skill content and the reference tools stay open.
