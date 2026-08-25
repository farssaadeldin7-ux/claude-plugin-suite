# Escalation protocol

Triggers are mechanical. The model matches a pattern and routes. It does not weigh severity.

## Trigger categories

| # | Category | Includes, without exception |
| --- | --- | --- |
| 1 | Suicide and self-harm | Direct statements, passive ideation ("I wouldn't mind if I didn't wake up"), hypotheticals, jokes, past attempts raised in the present, third-person framings ("asking for a friend"), method questions, references to a plan, timeline or means |
| 2 | Harm to others | Threats, intent, fantasies described as intent, questions about how to harm |
| 3 | Abuse and violence | Domestic abuse, sexual violence, coercive control, financial abuse, trafficking, elder abuse — current or historical |
| 4 | Minors | Any disclosure involving a child's safety, and any indication the user is under 18 |
| 5 | Loss of contact with reality | Reported hallucinations, delusional content, severe dissociation, mania |
| 6 | Substances | Withdrawal symptoms, overdose, acute intoxication during the conversation |
| 7 | Medical emergency | Chest pain, breathing difficulty, injury, collapse, pregnancy complications |
| 8 | Eating and body | Restriction, purging, compulsive exercise, rapid weight change |
| 9 | Conversational | Explicit request for a human; two declines to continue; distress language in three or more consecutive user turns; the same concern repeated three times without resolution |

## Why the indirect phrasings are in category 1

They are the majority of real disclosures. People test the ground before they say the thing
directly. A detector tuned to explicit statements will miss most of what it exists to catch,
and will miss it precisely in the cases where the person was being careful.

Build the red-team set around indirect phrasings first, explicit ones second.

## The response when a trigger fires

Four constraints, all of them load-bearing:

1. **No assessment questions.** Do not ask about plan, means, intent, timeline or history.
   Asking these implies the answers change what happens next. They do not.
2. **No advice, no coping technique, no grounding exercise.** These belong to a trained
   person, and offering one signals that the conversation is continuing.
3. **Short.** Two or three sentences.
4. **Concrete and immediate.** Name what happens now and give the direct route.

A workable shape:

> Thank you for telling me that. I am not the right support for this and I want you to have
> someone who is — I am passing this to [named team] now, and they will pick it up
> [timeframe]. If you need someone immediately, [regional service] is available
> [hours] on [number].

Then stop. Do not answer further messages in that session beyond repeating the route.

For a medical emergency (the overdose item in Category 6, and all of Category 7 — chest
pain, breathing difficulty, collapse), the route is different and comes first:

> This needs medical help now — call [emergency services number] straight away. I am
> also passing this to [named team] so someone follows up with you.

The emergency services number comes from configuration like every other resource, and is
never the crisis line.

## Regional resources

**Do not hardcode crisis numbers from memory, and do not let the model generate them.**
Numbers change, coverage differs by country and region, and a wrong number given to someone
in crisis is the worst possible failure of this product.

Configure them, per deployment, in this shape:

```json
{
  "region": "GB",
  "verified_on": "2026-08-01",
  "verified_by": "clinical-governance@example.com",
  "review_due": "2026-11-01",
  "services": [
    { "name": "...", "contact": "...", "hours": "...", "notes": "text-based option" }
  ]
}
```

Rules for the configuration:

- Verified against the provider's own published page, not a directory or an aggregator.
- Re-verified quarterly, and the review date enforced in CI — a stale block fails the build.
- At least one non-voice option per region, because many people will not make a call.
- A default for users whose region is unknown, plus the instruction to ask which country
  they are in before giving a number.
- Emergency services number stated separately from the crisis line, and never conflated.

## Out-of-hours

If the human team is not staffed 24/7, the out-of-hours path must be an external service
that genuinely is. State the staffed hours in the onboarding, before the user's first
message, not at the point of escalation.

A service that escalates into an unstaffed queue at two in the morning has not escalated.

## Handover packet

| Field | Contents |
| --- | --- |
| `transcript` | Full session, verbatim |
| `trigger` | Category number and the matching text |
| `fired_at` | Timestamp, with timezone |
| `told_user` | Exact wording the user received |
| `region` | Resolved region and the resource block given |
| `prior_sessions` | Count and dates only, unless policy permits more |

The receiving human must not have to ask the person to repeat what they have already said.
That repetition is the most commonly reported harm in escalation from automated services.

## What never happens

- The model does not continue supporting alongside the human.
- The model does not follow up later, automatically or otherwise.
- The model does not reopen the thread if the user returns within the same session.
- No survey, no rating request, no "how did I do" after an escalation.
