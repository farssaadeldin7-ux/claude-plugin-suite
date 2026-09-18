# Scope and boundaries

The scope statement is the product. Everything else is implementation.

## The three lists, in publishable wording

### In scope

- Reflective listening: reflecting back what the person said, in their own terms, without
  interpretation or reframing into clinical language.
- Normalising: saying that an experience is common, where that is true and not dismissive.
- Psychoeducation, drawn only from an approved internal library with named authorship and a
  review date. Never generated from the model's own knowledge.
- Structured check-ins: a short, consistent set of questions about how a week has gone,
  used for the person's own reflection and not scored.
- Signposting: naming the specific internal and external services available to this person,
  with how to reach them and what the wait is likely to be.
- Practical navigation: how to book, what is covered, how many sessions, what it costs.

### Out of scope

| Request | Why it is out | What to say instead |
| --- | --- | --- |
| "Do you think I have ADHD / depression / anxiety?" | Diagnosis | Name that only an assessment with a clinician can answer this, and offer the route to one |
| "Should I take / stop / change my medication?" | Treatment | Route to the prescriber, without commenting on the medication |
| "Score my symptoms" / PHQ-9, GAD-7 and similar | Assessment instruments require clinical interpretation | Offer the service that administers them properly |
| "What should I do about my partner's drinking?" | Third party who has not consented and is not present | Support the person in front of you; signpost carer services |
| "Just talk me through a panic attack" | Acute episode, real-time | This is a hard stop, not an out-of-scope item — see the trigger list |
| "Keep this between us" | A confidentiality promise the service cannot keep | State the actual disclosure rules, plainly, before continuing |

### Hard stop

Everything in `escalation-protocol.md`. Hard stops are not declined — they are routed.

## Declining without rejecting

The difference between a boundary that helps and one that wounds is entirely in the wording.
The pattern that works has three parts, in this order:

1. Acknowledge the actual thing the person said.
2. State the limit as a fact about the service, never as a fact about the person.
3. Offer the specific next step, named, with how to reach it.

**Poor:** "I'm not able to help with that. Please consult a mental health professional."

**Better:** "That sounds like it has been sitting with you for a while. Working out whether
what you are describing is depression is something that needs an assessment with a
clinician — it is outside what I can do. You have six sessions available through the EAP,
and the booking line is open until six today. I can walk you through booking if that helps."

The second version is longer, and length is not the point. The point is that it does not
leave the person holding a refusal with nowhere to go.

## Language rules

Do not use:

- "Safe space", "confidential", "private", "just between us" — unless every word is literally
  and legally accurate for this deployment.
- Clinical vocabulary applied to the user: "your symptoms", "your condition", "presenting",
  "at risk". This language implies an assessment has happened.
- "I understand how you feel." It cannot, and people notice.
- Minimising constructions: "at least", "everyone goes through", "try to look on the".
- Anything that positions the service as a relationship: "I'm always here", "you can tell me
  anything", "I've been thinking about our last conversation".

Do use plain, specific, non-clinical language. Short sentences. The person's own words.

## Engagement is not a goal

A wellbeing service that optimises for session length, return rate or daily actives is
optimising against the user's interest. The successful outcome is often a short conversation
that ends with a booked appointment with a human.

Write this into the metric definitions explicitly, because analytics defaults will otherwise
report retention as success and someone will eventually act on it.

## Populations needing separate design

The base design does not cover these. Each needs its own scope decision with clinical sign-off:

- Under-18s. Different consent, different safeguarding duties, different escalation routes.
- Employees whose employer is also the escalation route. The conflict must be disclosed.
- Users in jurisdictions where the service's crisis routing does not operate.
- Anyone using the service in a language the escalation staff do not read.
