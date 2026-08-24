# Wellbeing Companion

Design and operate a boundaried wellbeing support conversation that knows what it is not.

Part of a 14-plugin suite sharing one licensing service.

## What it does

This plugin is for the people building the service, not for the person in difficulty. It
produces the artefacts a wellbeing conversation needs before it is allowed near a user:

- A published scope statement — in scope, out of scope, hard stop — with the wording for
  declining an out-of-scope request without leaving someone holding a refusal
- A mechanical escalation trigger list covering the indirect phrasings that make up most
  real disclosures, not just the explicit ones
- A handover specification: what the user is told, where it routes, what the receiving
  human gets, and what the model stops doing
- A regional crisis-resource configuration format, with verification and expiry built in
- A red-team suite, the metric that gates change control, and the two it deliberately does not

## Who it is for

Telehealth platforms, HR wellness teams, and EAP providers. The skill the operator must
bring is **clinical triage literacy** — knowing that recognising when to hand over is the
whole job, and that severity estimation is not something to delegate to a model.

## The design principle

Escalation is never a judgement call. A trigger appears, the conversation routes to a human.
The model does not weigh how serious it sounds, does not ask assessment questions, and does
not try to help first. A design where the model decides when to escalate is not finished.

## What this is not

- **Not a therapist, and not a therapy product.** It does not assess, diagnose, treat or
  monitor, and it will not help you build something that claims to.
- **Not crisis intervention.** Its entire behaviour in a crisis is to route to a human and
  give a verified regional resource.
- **Not clinical supervision.** It does not replace a qualified clinical governance lead
  reviewing the same material, and it reports a missing one as a blocking finding.
- **Not legal or regulatory advice.** Whether your product falls under EU MDR, UK MDR or
  FDA SaMD guidance depends on the claims you make and needs a regulatory opinion.
- **Not a source of crisis phone numbers.** It refuses to generate them and requires a
  verified, dated, regional configuration instead, because a wrong number given to someone
  in crisis is the worst thing this product can do.

## What it refuses

Designs that position the service as therapy, that discourage users from seeking human
help, that use engagement or retention as a success metric, or that remove an escalation
trigger to improve containment.

## Components

| Component | Purpose |
| --- | --- |
| Skill `wellbeing-companion` | The design protocol, scope method, escalation rules, evaluation plan |
| `references/scope-and-boundaries.md` | The three lists, declining language, populations needing separate design |
| `references/escalation-protocol.md` | Trigger categories, response constraints, resource configuration, handover packet |
| `references/evaluation-and-governance.md` | Red-team construction, metrics, change control, roles, regulatory posture |
| MCP server | Escalation lookups, resource-block validation, scope wording, evaluation gate, run record, licensing |

### Tools

**Open** — no licence needed, ever. Safety and escalation lookups are deliberately not
behind the paywall: a safety protocol that costs money to consult is a design failure.

- `escalation_triggers` — the nine trigger categories, verbatim, with the conversational
  thresholds
- `escalation_response` — response constraints, response shapes, out-of-hours rule,
  handover packet, what never happens
- `resource_config_check` — mechanical validation of a regional crisis-resource block:
  required fields, dates, quarterly cadence, staleness (a stale block fails)

**Licensed** — requires a pro or team key

- `scope_statement` — the three lists in publishable wording, declining pattern, language
  rules, populations needing separate design
- `redteam_spec` — the red-team slices and counts, metric definitions, incident rules,
  governance roles
- `evaluation_gate` — the binary change-control gate computed from a run's counts
- `record_redteam_run` / `review_runs` — the local change-control record

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

None of the tools assess a person, score a transcript, judge severity, or generate crisis
phone numbers. They serve the protocol text and count what you measured.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan (or use `start_checkout` from inside a conversation) and paste the key —
it will be stored at `~/.config/plugin-suite/wellbeing-companion.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export WELLBEING_COMPANION_LICENSE_KEY=PS-WBC-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-WBC-...
```

## Privacy

The change-control record written by `record_redteam_run` is stored only at
`~/.config/plugin-suite/wellbeing-companion-runs.json` on the machine that created it.
The billing service sees a licence key, a plugin id and a hashed device identifier. It
never sees a run, a resource block or anything a user typed.

## If you are here because you are struggling

This is a builder's tool and it will not help you. If you are having a hard time, please
reach out to someone — a GP, a helpline in your country, or a person you trust. That is a
better use of the next ten minutes than reading this repository.

## The skill you bring

**Clinical Triage Protocols.** Be fluent in when a conversation must reach a human. The tool is support, never crisis intervention, and the escalation protocol assumes an operator who can hold that line.

## Plans

Pricing is defined in the suite catalog: pro $40/month (2 seats) and team $70/month
(10 seats). The licence gates the builder's workflow tools — scope wording, red-team
specification, the evaluation gate and the run record. The skill content, and every
safety and escalation lookup on the server, stay open regardless of licence.
