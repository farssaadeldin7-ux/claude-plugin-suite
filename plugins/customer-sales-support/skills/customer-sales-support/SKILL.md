---
name: customer-sales-support
description: >
  This skill should be used when someone wants an AI agent handling their customer support
  tickets — "set up a support agent for my store", "train an AI on our FAQs", "automate our
  support inbox", "audit our help centre", "why does our support bot make things up", "which
  tickets should still go to a human", "our docs aren't ready for an AI agent", "reduce our
  ticket volume". Also use it for auditing an existing help centre, restructuring articles so
  an agent can answer from them without hallucinating, finding coverage gaps, and writing the
  escalation rules that decide which questions must reach a person.
metadata:
  version: "0.1.0"
---

# Customer Sales Support

Build an AI-powered customer support agent on the company's own content. Instead of a human
answering every basic question, the agent is trained on the company's manuals and FAQs and
handles tickets automatically. This skill audits the help centre first, restructures it into
something answerable without hallucinating, reports where coverage is missing, and defines
which questions must reach a person.

The order matters. Most support-agent failures are not model failures — they are knowledge
failures. An agent pointed at a help centre written for humans skimming will guess, and a
confident wrong answer about a refund costs more than the ticket it deflected. So the work
starts with the content, not the bot.

## The one rule

**"I don't know — let me get you a person" is a first-class answer.** The agent must never
bridge a gap in the docs with a plausible guess. Every answer is grounded in a specific
article; a question with no covering article escalates, full stop. An agent that deflects
80% of tickets accurately beats one that "handles" 95% and invents policy for the last 15.

## Sequence

### 1. Audit the help centre

Before anything is automated, read the existing manuals, FAQs and macros the way the agent
will: one question at a time, looking for the one article that answers it. For a sample of
real tickets (50–200, pulled from the actual queue), record for each: which article should
answer it, whether that article exists, and whether its text actually contains the answer
stated plainly. The output is three lists — answered, answerable-but-buried, and uncovered.
Do not skip the sample; auditing the help centre against itself instead of against real
tickets is how gaps stay invisible.

### 2. Restructure so the agent can't hallucinate

An article the agent can answer from safely has a specific shape:

- **One question per article.** An article answering five questions retrieves for all of
  them and answers none cleanly.
- **The answer in the first two sentences**, stated as fact, not narrative. Everything
  after is qualification.
- **Policy stated with its numbers.** "Returns within 30 days, unworn, with receipt" — not
  "we're happy to help with returns". Vague policy text is what the agent fills in with
  invented specifics.
- **Conditions as explicit branches.** If the answer differs by plan, region or product,
  each branch is written out. The agent must never interpolate between cases.
- **No stale duplicates.** Two articles disagreeing about the same policy means the agent
  answers from whichever retrieves first. Merge or delete.

Rewrite the answerable-but-buried list into this shape. That work is the bulk of the
project and the reason the agent will be trustworthy.

### 3. Report the coverage gaps

The uncovered list from the audit becomes a written report for the business owner: the
questions customers actually ask that no document answers, ranked by frequency in the
ticket sample. For each gap, either the business writes the missing article (most cases) or
explicitly assigns the question to humans (where the answer is judgement, not policy). The
gap report is a deliverable in its own right — it is usually the first time anyone has seen
what their help centre doesn't say.

### 4. Define what must reach a person

Write the escalation rules before the agent goes live, as literal conditions, not vibes:

| Always escalate | Why |
| --- | --- |
| Refund or compensation above a stated threshold | Costs real money; needs judgement |
| Legal, safety or medical language | Liability is not automatable |
| An angry customer or a repeated contact on the same issue | The relationship is the product now |
| Anything the docs do not cover | The one rule, enforced |
| The customer asks for a human | Refusing this reads as hiding |

Every escalation hands over the full context — the question, what the agent already said,
the article it used — so the customer never repeats themselves. An escalation that restarts
the conversation converts a deflection failure into a churn risk.

### 5. Ground the agent and test before launch

Configure the agent to answer **only** from the restructured articles, citing which article
each answer came from. Then run the ticket sample from step 1 through it as a regression
set before any customer sees it. Score three outcomes per ticket: answered correctly from
the right article, escalated correctly, or wrong. Wrong answers are launch blockers —
each one traces to either a doc defect (fix the article) or a missing escalation rule (add
it). Keep the regression set and re-run it after every doc change; a help centre edit that
silently breaks ten answers is otherwise invisible until customers find it.

### 6. Launch narrow, then widen

Go live on the highest-volume, lowest-risk intents first — order status, shipping times,
password resets — with everything else still routed to humans. Watch two numbers weekly:
the share of tickets resolved without a human, and the share of escalations that were
correct. Widen the agent's scope one intent at a time, only after its regression rows for
that intent are clean. Report progress in the owner's terms: tickets that no longer need a
person, and hours that got given back.

## Presentation

Deliver artifacts, not advice: the audit lists, the rewritten articles, the gap report, the
escalation rule table, and the regression scores. When reviewing an existing help centre,
quote the failing text — "this article says 'we're happy to help with returns' and the
agent will invent the terms" is actionable; "your docs need work" is not.

## Limits of the method

- **The agent is only as good as the documents.** No configuration compensates for a help
  centre that doesn't state the policy. The restructuring step is the product.
- **Containment rates cannot be promised in advance.** The regression set gives a floor on
  accuracy; the deflection share is discovered at launch, not predicted.
- **Policy decisions belong to the business.** This skill finds where policy is unstated or
  contradictory; it never invents the policy to fill the hole.
- **Angry customers are not a routing problem.** Escalating them is necessary and not
  sufficient; nothing here fixes what made them angry.
- **The docs drift.** Products, prices and policies change; without the regression re-run
  on every edit, accuracy decays silently.
