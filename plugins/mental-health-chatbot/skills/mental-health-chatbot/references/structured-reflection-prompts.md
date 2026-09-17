# Structured-reflection prompts

A bank of CBT-informed, non-clinical prompts for the reflect phase of a check-in. They are
structured questions a person can take or leave — not therapy, not a technique being
administered, and never a response to distress. The escalation protocol
(`../../wellbeing-companion/references/escalation-protocol.md`) governs everything here:
any conflict between a prompt and the protocol resolves in the protocol's favour, without
exception.

## The standing gate

No prompt is offered until the current message has passed the escalation screen — the
`screen_message` phrase floor plus the model's own read — with no trigger present from any
of the protocol's nine categories. A tripped trigger gets the escalation response and
nothing else. Offering a reflection prompt after a trigger is exactly the violation the
protocol's response constraint 2 names: "No advice, no coping technique, no grounding
exercise." A prompt is a structured question, and after a trigger even a question is a
signal that the conversation is continuing. It is not.

Answers to prompts are messages like any other: each one is screened, and an answer that
trips a trigger ends reflection immediately and routes per the protocol.

## The wording rule, for every family

These are structured questions, not therapy:

- The family names in this file — thought-noticing, evidence for and against, reframing,
  behavioural activation — are for the operator. The user never hears them, and never
  hears clinical vocabulary of any kind ("cognitive distortion", "thought record",
  "automatic thoughts", "activation").
- A prompt attaches only to something the person already volunteered in the open
  questions. It never digs for new material — probing a disclosure is out of scope for
  the whole check-in, and prompts do not create an exception.
- One prompt at a time, offered, never assigned. "Would it help to look at..." not "Now
  let's examine...".
- A declined prompt is dropped for the session, not rephrased and not re-offered. Two
  declines to continue is Category 9 (Conversational) and escalates.
- Answers are never scored, tracked over time, compared across sessions, or followed up
  later ("last time you said you would..."). The protocol's list of what never happens
  includes follow-up, and it applies here.

## Family: thought-noticing

**Prompts.**

- "What went through your mind when that happened?"
- "When you think back to that moment, what was the first thought that came up?"
- "You mentioned [their words] — what was going through your head at the time?"

**When it fits.** The person has named a specific, bounded situation in the open
questions — a meeting, a conversation, a deadline — and seems to want to say more about
it. The prompt gives their telling a shape; it does not interpret what comes back.

**When it must not be used — escalation instead.**

- The situation or the telling matches Category 1 (Suicide and self-harm) in any of the
  framings the protocol lists — "direct statements, passive ideation, hypotheticals,
  jokes, past attempts raised in the present, third-person framings". Asking what went
  through someone's mind after such a disclosure is an assessment question about intent
  by another name, and response constraint 1 forbids assessment questions outright.
- Distress language in three or more consecutive user turns, or the same concern repeated
  three times without resolution — both Category 9 (Conversational). Sustained distress
  is beyond the check-in's scope; the route is a human, not a better question.
- An acute episode in real time — a panic attack, or anything resembling one. The scope
  statement's own table marks this "a hard stop, not an out-of-scope item".

## Family: evidence for and against

**Prompts.**

- "You said [their words] — what from this week makes it read that way to you?"
- "Is there anything from the week, even something small, that points the other way?"

**When it fits.** An everyday self-assessment about work, skill or a situation — "I was
useless in that presentation", "the project is doomed" — from a person who is reflective
rather than distressed. The prompt asks them to lay their own evidence out; it never
argues, corrects or supplies counter-evidence of its own.

**When it must not be used — escalation instead.**

- Category 1 (Suicide and self-harm): a statement about self-worth that shades toward the
  protocol's "passive ideation" — "what's the point", "nobody would notice if I wasn't
  around" — is a Category 1 trigger, not a belief to examine. Weighing evidence for and
  against a statement like that treats a disclosure as a proposition, and it routes
  instead.
- Category 5 (Loss of contact with reality) — "reported hallucinations, delusional
  content, severe dissociation, mania": evidence-weighing is a debate about whether a
  belief is true, and delusional content is never debated. It routes.
- Category 3 (Abuse and violence): a disclosure of abuse, coercion or violence — the
  protocol says "current or historical", both — is never put to an evidence test. Asking
  for evidence tells the person their account is in question. It routes.

## Family: reframing

**Prompts.**

- "Is there another way to read that situation?"
- "If a colleague described the same week to you, what would you make of it?"

**When it fits.** An everyday interpretation of a low-stakes event — an unanswered
message, a flat meeting, a plan that fell through — and only after the person's own
reading has been reflected back first. Reframing is invited, never supplied: the prompt
asks whether another reading exists, and it is the person who finds one or does not.

**When it must not be used — escalation instead.**

- Category 3 (Abuse and violence): a disclosure of domestic abuse, sexual violence,
  coercive control, financial abuse, trafficking or elder abuse — current or historical —
  is never reframed. "Another way to read it" applied to abuse is minimisation. It
  routes.
- Category 2 (Harm to others): a statement of threat or intent is not a perspective to
  soften. It routes.
- Category 1 (Suicide and self-harm), in every framing the protocol lists, including
  jokes and hypotheticals: reframing after such a statement is a coping move, and
  response constraint 2 forbids it.
- Category 9 (Conversational) sustained distress: a person in their third consecutive
  turn of distress language does not need another reading of the situation. They need the
  route.

## Family: behavioural activation

**Prompts.**

- "Is there one small thing from an ordinary week that you'd want back next week?"
- "You mentioned [their words] used to be part of the week — is that something you'd
  want to pick up again, or not really?"

**When it fits.** A low-energy or stuck framing inside an otherwise in-scope check-in,
where the person has named something ordinary they have let go of. The thing is always
the person's own choice — the prompt never proposes an activity, sets a goal, or checks
next session whether it happened.

**When it must not be used — escalation instead.**

- Category 8 (Eating and body) — "restriction, purging, compulsive exercise, rapid
  weight change": never offer an eating- or exercise-shaped "small thing" in any
  check-in, and any disclosure in this category routes rather than prompts.
- Category 6 (Substances) — "withdrawal symptoms, overdose, acute intoxication during
  the conversation": no activity suggestion. It routes, and the overdose item takes the
  medical-emergency response shape.
- Category 7 (Medical emergency): the protocol's emergency route comes first and
  displaces everything else.
- Category 1 (Suicide and self-harm): "one small thing" offered against a Category 1
  trigger is a coping technique, which response constraint 2 forbids. It routes.

## The cap

At most **two prompts per check-in**. The protocol and the other references state no cap;
two is a design choice made here, and the reasoning is on the record: the product's value
is the rhythm of a short, consistent check-in, and a third prompt turns a check-in into a
session — and session-shaped depth belongs to a human, not this service. A deployment
wanting more prompts per session is asking for a different product, and that is a scope
decision for the clinical governance lead, not a configuration change.

The cap counts offers, not answers: a declined prompt still spent one of the two.
