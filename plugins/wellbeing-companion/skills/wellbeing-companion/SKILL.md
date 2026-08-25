---
name: wellbeing-companion
description: >
  This skill should be used when designing, reviewing or operating a boundaried wellbeing
  support conversation for an employer or telehealth programme — "we want to add a
  wellbeing chatbot", "design the escalation rules for our support bot", "review our
  mental health assistant's safety boundaries", "what should our wellbeing agent refuse
  to do", "write the handover protocol for our EAP chat", "our wellness bot said
  something it shouldn't have", "how do we triage to a human counsellor", "audit our
  wellbeing assistant". Also use it to write the scope statement, the escalation
  trigger list, the human handover format and the operator's evaluation plan for such
  a service.
metadata:
  version: "0.1.0"
---

# Wellbeing Companion

Design and operate a wellbeing support conversation that knows exactly what it is not.

This skill is for the people building the service — a telehealth platform, an HR wellness
team, an EAP provider. It produces the scope statement, escalation protocol, handover
format and evaluation plan. It is not itself a therapist, and the thing it helps you build
must not be one either.

**Say the honest thing first, in the product and in this skill's output.** A conversational
service can offer structured reflection, psychoeducation, and a reliable route to a human.
It cannot assess risk, diagnose, treat, or manage a crisis. Any design that blurs this is
not a bolder product; it is an unsafe one, and in most jurisdictions a clinical claim also
drags the product into medical-device regulation.

## The one rule

**Escalation is never a judgement call the model makes about severity.**

The moment a trigger appears, the conversation routes to a human. The model does not weigh
how serious it sounds, does not ask assessment questions to decide, and does not attempt
to talk someone down first. Severity estimation by a conversational model is the single
failure mode that turns this product from useful into dangerous, because it is confident
and it is wrong in exactly the cases that matter.

A design where the model decides when to escalate is not finished. A design where a trigger
mechanically forces escalation is.

## Sequence

### 1. Write the scope statement before anything else

Three lists, explicit, published to users and to staff. Nothing ships without them.

| List | Contents |
| --- | --- |
| **In scope** | Reflective listening, naming and normalising common experiences, psychoeducation from approved material, structured check-ins, signposting to named internal and external services, practical navigation of the benefits or booking system |
| **Out of scope** | Diagnosis, treatment, symptom scoring, medication questions, risk assessment, crisis response, couples or family mediation, anything about a named third party's mental health |
| **Hard stop** | Every trigger in step 2 |

If a stakeholder wants something moved from out-of-scope to in-scope, that is a clinical
governance decision with a named clinical owner, not a product decision. Record who signed it.

See `references/scope-and-boundaries.md` for the full wording, including the phrasing that
declines out-of-scope requests without sounding like a rejection of the person.

### 2. Define triggers mechanically

Triggers are patterns, not severity judgements. `references/escalation-protocol.md` holds the
full list with example phrasings and the reason each is on it. The categories:

- Any reference to suicide, self-harm, or not wanting to be alive — including passive,
  hypothetical, third-person, joking or past-tense framings
- Harm to another person
- Abuse, violence, coercion or exploitation, current or historical
- Disclosure involving a minor
- Signs of psychosis, mania, dissociation, or loss of contact with reality
- Substance withdrawal, overdose, or acute intoxication
- Any medical emergency
- Disordered eating, restriction, purging or compulsive exercise
- The user directly asking for a human, twice declining to continue, or using distress
  language in three or more consecutive turns

Design the detector to over-trigger. A false escalation costs a counsellor five minutes.
A missed one does not have a cost you are willing to pay. Set the review target on
**false-negative rate**, and treat a low false-positive rate as a warning sign rather than
an achievement.

### 3. Specify the handover

A trigger fires. What happens next must be defined to the second, because this is where
services fail in practice — the bot escalates into a queue that is closed.

1. **In-conversation response**: brief, warm, no assessment questions, no advice. State
   plainly that a person will take over, and give the direct route to immediate help in
   the user's region.
2. **Route**: named team, named hours, and a named fallback for out-of-hours. If your
   coverage is business hours only, the out-of-hours path must be an external service that
   is genuinely staffed, and the product must say so before the user starts, not after.
3. **Handover packet**: conversation transcript, the trigger that fired, the timestamp, and
   what the user was told. The human does not restart the conversation from zero.
4. **What the model stops doing**: it stops. It does not continue supporting alongside the
   human, does not follow up, and does not reopen the thread.

Crisis resources must be regional, verified, and dated at deployment. Do not hardcode a
list from memory; `references/escalation-protocol.md` explains why and gives the
configuration format and the re-verification cadence.

### 4. Be honest about confidentiality

Most wellbeing services are not confidential in the way users assume, and users disclose on
that assumption. Before the first message, state in plain language: who can read the
transcript, how long it is kept, what an employer sees (aggregate only, if that is true —
and if it is not true, say what they see), and what triggers a disclosure outside the
service.

Never let the product imply protections it does not have. Do not use the words "safe space",
"private" or "confidential" unless every one of them is literally true.

### 5. Build the evaluation before launch

Three measures, and only the third is about safety.

| Measure | Definition | Target |
| --- | --- | --- |
| Coverage | Share of sessions handled entirely in scope | Informational only |
| Helpfulness | User-rated, sampled, on in-scope sessions only | Set locally |
| **Missed escalation** | Sessions containing a trigger where no escalation fired | **Zero, reviewed weekly** |

Build a red-team set of at least 200 transcripts covering every trigger category, including
the indirect phrasings — the hypothetical, the joke, the third-person, the message that only
becomes a trigger three turns in. Run it on every model or prompt change. A change that
improves helpfulness and moves missed-escalation off zero does not ship.

`references/evaluation-and-governance.md` covers the red-team construction, the incident
review process, and the governance roles that must exist before launch.

### 6. Name the owners

A service like this needs a named clinical governance lead, a named data protection owner,
and a named on-call route. If any of these three does not exist, report that as a blocking
finding. It is the most common gap and the one that turns a bad day into an unmanaged one.

## Limits of this skill

- It designs a support service. It is not clinical supervision and does not replace a
  qualified clinical governance lead reviewing the same material.
- It cannot tell you whether your escalation coverage is adequate for your population.
  That depends on who your users are and what your staffing actually is.
- It gives no legal or regulatory determination. Whether your product is a medical device
  under EU MDR, UK MDR or FDA SaMD guidance depends on the claims you make and needs a
  regulatory opinion.
- It will not help design a service that positions itself as therapy, that discourages
  users from seeking human help, that uses engagement or retention as a success metric,
  or that removes an escalation trigger to improve containment. Report those as refusals,
  and say why.

## If a person in distress reaches this skill directly

That is not what it is for, but it happens. Do not run the design protocol at them. Respond
as a person would: acknowledge what they have said, without probing or assessing, and offer
to help them find support where they are. Then do that. Everything above is for the builder,
not the person in difficulty.
