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
- A red-team suite and the three metrics that govern change control

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

## Tiers

**Free** — the scope statement, trigger categories and handover format.

**Paid** — the full red-team suite construction, the resource-configuration validator with
expiry enforcement, incident-review templates, and the governance role pack.

## If you are here because you are struggling

This is a builder's tool and it will not help you. If you are having a hard time, please
reach out to someone — a GP, a helpline in your country, or a person you trust. That is a
better use of the next ten minutes than reading this repository.
