# Mental-Health Chatbot

Structured non-clinical check-ins with escalation always on. Routes to real resources,
never diagnoses, never handles crisis, and produces supervisor summaries and an audit log.
Support, not crisis intervention — that boundary is enforced in the skill.

Part of a 14-plugin suite sharing one licensing service.

## What it does

The skill runs and configures a wellbeing check-in service for a telehealth platform or
HR wellness programme:

- **A fixed check-in structure** — open, reflect, one signpost, close — that never scores
  symptoms, never administers instruments, never names a diagnosis
- **Escalation always on**: every message screened against a mechanical trigger list
  covering the indirect phrasings that make up most real disclosures; a trigger routes to
  a human with a warm handover and a verified regional resource, and then the bot stops
- **Real resources only** — everything given to a user comes from the deployment's
  verified, dated, regional resource block; the plugin refuses to generate crisis numbers
  from memory
- **Supervisor summaries** at aggregate and theme level, honest about their resolution
  and bounded by the confidentiality notice users were actually shown
- **An audit log** per session — configuration version, screening, triggers fired,
  resources shown, how it ended — feeding the one weekly safety number: sessions
  containing a trigger where no escalation fired, target zero
- **A red-team gate on every change**: a change that improves helpfulness and moves
  missed-escalation off zero does not ship

## Who it is for

Telehealth platforms and HR wellness programmes. The skill the operator must bring is
**clinical triage literacy** — knowing that recognising when to hand over is the whole
job, and that severity estimation is never delegated to a model.

## The design principle

Escalation is always on, and it is never a severity judgement. A trigger appears, the
conversation routes to a human. The model does not weigh how serious it sounds, does not
ask assessment questions, and does not try to help first. No session type, user setting or
operator configuration turns this off.

## What this is not

- **Not a clinical product, whatever the name says.** "Mental-health chatbot" is the
  colloquial category buyers search for, not a claim: the service is a non-clinical
  check-in with a route to humans. Because a product's name and copy count as claims for
  medical-device purposes, the skill requires the *deployment's* user-facing name and
  description to make no clinical claims, and flags copy that does as a blocking finding.
- **Not a therapist, and not a therapy product.** It does not assess, diagnose, treat or
  monitor, and it will not help build something that claims to.
- **Not crisis intervention.** Its entire behaviour in a crisis is to route to a human and
  give a verified regional resource.
- **Not clinical supervision.** It does not replace a qualified clinical governance lead
  reviewing the same material, and it reports a missing one as a blocking finding.
- **Not legal or regulatory advice.** Whether the product falls under EU MDR, UK MDR or
  FDA SaMD guidance depends on the claims made and needs a regulatory opinion.
- **Not a source of crisis phone numbers.** It requires a verified, dated, regional
  configuration instead, because a wrong number given to someone in crisis is the worst
  thing this product can do.

## What it refuses

Deployments that position the service as therapy, that discourage users from seeking human
help, that use engagement or retention as a success metric, that remove or weaken an
escalation trigger, or that ask for individual-level reporting the confidentiality notice
does not disclose.

## Components

| Component | Purpose |
| --- | --- |
| Skill `mental-health-chatbot` | The check-in structure, the escalation boundary, summaries, the audit log, the change gate |
| MCP server | Escalation lookups, resource-block validation, scope wording, evaluation gate, run record, summary template, session audit log, licensing |

### Tools

**Open** — no licence needed, ever. Safety and escalation lookups are deliberately not
behind the paywall: a safety protocol that costs money to consult is a design failure.

- `escalation_triggers` — the trigger categories, verbatim, with the conversational
  thresholds
- `escalation_response` — response constraints, response shapes, out-of-hours rule,
  handover packet, what never happens
- `resource_config_check` — mechanical validation of a regional crisis-resource block:
  required fields, dates, quarterly cadence, staleness (a stale block fails)
- `scope_statement` — the three lists in publishable wording, declining pattern, language
  rules, populations needing separate design. Open because setup is not paywalled: a
  deployment cannot be configured safely without it

**Licensed** — requires a pro or team key

- `redteam_spec` — the red-team slices and counts, metric definitions, incident rules,
  governance roles
- `evaluation_gate` — the binary change-control gate computed from a run's counts
- `record_redteam_run` / `review_runs` — the local change-control record
- `summary_template` — the supervisor-summary sections and resolution rules (aggregate
  unless the confidentiality notice says otherwise, denominators on every claim, minimum
  session count behind a theme)
- `record_session` / `review_audit` — the local session audit log, categorical fields
  only, computing the weekly number that must stay at zero: sessions containing a
  trigger where no escalation fired

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

None of the tools assess a person, score a transcript, judge severity, or generate crisis
phone numbers. They serve the protocol text and count what you measured. The audit log
holds only categorical fields — dates, counts, category numbers, enumerated outcomes;
there is no free-text field, so nothing a user typed can enter it. The supervisor summary
itself is written by the skill against `summary_template`, from the deployment's own
records.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan (or use `start_checkout` from inside a conversation) and paste the key —
it will be stored at `~/.config/plugin-suite/mental-health-chatbot.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export MENTAL_HEALTH_CHATBOT_LICENSE_KEY=PS-MHC-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-MHC-...
```

## Privacy

The change-control record written by `record_redteam_run` is stored only at
`~/.config/plugin-suite/mental-health-chatbot-runs.json`, and the session audit log
written by `record_session` only at
`~/.config/plugin-suite/mental-health-chatbot-audit.json`, both on the machine that
created them. The audit log is categorical by construction — no free-text field exists.
The billing service sees a licence key, a plugin id and a hashed device identifier. It
never sees a run, a session record, a resource block or anything a user typed.

## If you are here because you are struggling

This is an operator's tool and it will not help you. If you are having a hard time, please
reach out to someone — a GP, a helpline in your country, or a person you trust. That is a
better use of the next ten minutes than reading this repository.

## The skill you bring

**Clinical Triage Protocols.** Be fluent in when a conversation must reach a human. The
tool is support, never crisis intervention, and the escalation protocol assumes an
operator who can hold that line.

## Plans

Pricing is defined in the suite catalog: pro $40/month (2 seats) and team $70/month
(10 seats). The licence gates the operator's measurement workflow — red-team
specification, the evaluation gate, the run record, the summary template and the session
audit log. The skill content, every safety and escalation lookup, and the scope wording
needed to configure a deployment stay open regardless of licence: neither safety nor
setup is paywalled.
