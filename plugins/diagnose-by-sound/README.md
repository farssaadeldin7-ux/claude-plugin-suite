# Diagnose by Sound

Turns a described vehicle noise into a ranked, testable differential diagnosis.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

A mechanic who is good at acoustic diagnosis does not guess at causes — they
characterise the noise precisely, then find the one question that splits the field
fastest. This plugin enforces that order.

- A controlled vocabulary for describing noise, so descriptions are comparable
- 42 acoustic signatures across 12 vehicle systems, each with confirmation tests,
  the parts usually involved and book labour hours
- Weighted matching that reports **calibrated** confidence — a one-word description
  reads as 28%, not 100%
- Computed discriminating questions: the ones that would actually change the answer
- A deliberately conservative safety verdict, driven by the worst plausible candidate
- Local case history, stored on your machine and never sent to a server

## Components

| Component | Purpose |
| --- | --- |
| Skill `diagnose-by-sound` | The interview protocol, how to read the results, how to present them |
| MCP server | Vocabulary, signature matching, repair planning, case history, licensing |

### Tools

**Free tier**

- `sound_vocabulary` — the controlled terms, and which ones matter most
- `list_signatures` / `describe_signature` — browse and inspect the knowledge base
- `diagnose` — the main call: ranked candidates, next questions, safety verdict

**Paid**

- `repair_plan` — ordered confirmation sequence, parts, book labour hours
- `save_case` / `review_cases` / `record_outcome` — local case history

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then either start a free trial from inside a conversation ("start a trial for
diagnose by sound"), or paste an existing key and it will be stored at
`~/.config/plugin-suite/diagnose-by-sound.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export DIAGNOSE_BY_SOUND_LICENSE_KEY=PS-DBS-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-DBS-...
```

## Plans

| Plan | Price | Includes |
| --- | --- | --- |
| Trial | free | `diagnose`, 5 per month |
| Pro | $29/month | + repair plans, case history, export, 300 per month |
| Shop | $99/month | + multi-technician, labour guide, 10 seats, 3000 per month |

## Privacy

Case history — vehicles, observations, outcomes — is written only to
`~/.config/plugin-suite/diagnose-by-sound-cases.json` on the machine that created it.
The billing service sees a licence key, a plugin id, a hashed device identifier and
usage counts. It never sees a diagnosis.

## Limits

This does not read fault codes, does not replace inspection, does not price parts, and
does not cover EV-specific drivetrain noise in depth. Every candidate it produces is a
hypothesis with a test attached — the test is the point.
