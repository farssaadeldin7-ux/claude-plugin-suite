---
name: support-agent-architect
description: >
  This skill should be used when someone is building, fixing or auditing an AI support agent
  and needs the knowledge base and escalation rules behind it — "our support bot keeps making
  things up", "the AI gave a customer the wrong refund policy", "how do I stop our support
  agent hallucinating", "help me structure our help centre for an AI agent", "which tickets
  can we safely automate", "write escalation rules for our support bot", "our deflection rate
  looks great but customers are angry", "audit our knowledge base before we launch the agent",
  "how do we test a support agent before it goes live". Also use it for triaging a ticket
  backlog into intents, rewriting help articles so retrieval can find them, and defining the
  metrics a support agent should be judged on.
metadata:
  version: "0.1.0"
---

# Support Agent Architect

Design the knowledge base and escalation rules that sit underneath an AI support agent,
so it answers accurately instead of confidently guessing.

Hold this premise throughout: **hallucination in support is nearly always a
knowledge-architecture defect, not a model defect.** An agent invents a returns window
because no article states it retrievably. It gives the EU answer to a US customer because
one article covers both regions with no qualifier. It contradicts itself because two
near-duplicate articles split retrieval. Swapping the model fixes none of that.

An amateur starts by writing a system prompt. A practitioner starts by classifying the
tickets, because that classification decides what may be automated at all.

## The one rule

**No intent gets auto-answered until it has been classified as static, and no article gets
written until its intent exists in the taxonomy.**

Every intent is one of three kinds:

| Kind | Test | Agent behaviour |
| --- | --- | --- |
| **Static** | The correct answer is identical for every customer who asks it today | May be auto-answered from an article |
| **Account-specific** | The answer depends on a lookup into order, subscription or account state | Answer only with a verified live lookup; never from memory or inference |
| **Judgement** | The answer depends on discretion, tone, risk or an exception | Hand to a human |

If you cannot say which of the three an intent is, it is not static; default to escalation.
This single classification is the method — which articles get written, what the grounding
contract permits and where escalation triggers sit are all derived from it.

## Sequence

### 1. Build the ticket taxonomy before anything else

Pull at least 90 days of tickets, or 2,000 tickets, whichever is larger. Under 500 the
volume figures are noise; say so rather than ranking on them.

Cluster into intents — a customer goal, phrased as the customer would phrase it ("where is
my order", not "shipping"). Keep clustering until the top 20 intents cover 70% or more of
volume. If they do not, the clusters are too fine; merge. For each intent record **volume**
(count and % of total), **resolution path** (what the human currently does, step by step),
and **kind** (static / account / judgement).

The full method, the three-way test with its edge cases, and worked taxonomies for an
e-commerce store and a B2B SaaS product are in `references/intent-taxonomy.md`.

### 2. Decide the automation surface

Sort static intents by volume, descending: that ordered list is the article backlog.

- An intent below **0.5% of volume** does not get an article yet unless it is safety-,
  legal- or accessibility-adjacent.
- An intent whose answer changed more than twice last quarter is **policy**, not procedure —
  it still gets an article, but see the split in step 3.
- Account-specific intents are automated only where a live lookup exists. No lookup, no
  automation: the agent collects the order number and hands over.

State the expected containment ceiling out loud: the share of volume held by static intents
plus automatable account-specific intents. Nothing above it is achievable. For most
e-commerce stores it lands between 35% and 55%; anyone promising 80% is counting escalations
as deflections.

### 3. Write articles the retriever can actually find

One intent per article, no exceptions — an article covering three intents is retrieved for
all three and answers none of them well. The non-negotiables:

- **Answer in the first two sentences.** Everything after is qualification.
- **State preconditions explicitly** — plan, region, order age, account status. An
  unqualified answer is a wrong answer waiting for the wrong customer.
- **Put the exact user-facing strings and error codes in the text.** If the screen says
  `Payment method declined (err_card_2041)`, that literal string belongs in the article,
  because it is what the customer will paste.
- **Separate policy from procedure.** Procedure is stable ("how to start a return"); policy
  changes ("the returns window is 30 days"). Put policy in its own short article with its own
  owner and reference it, so a policy change does not require edits to nine articles, eight
  of which get missed.
- **Date every article and name an owner.** An article with no owner is stale within two
  quarters.

The structure, the style rules and before/after rewrites of real anti-patterns are in
`references/article-template.md`.

### 4. Audit for the four retrieval failure modes

Run this against the drafted set before launch. Each one produces confident wrong answers
rather than visible failures, which is why they survive so long.

| Failure mode | Symptom | Fix |
| --- | --- | --- |
| **Near-duplicate split** | Two articles cover the same intent; retrieval scores split between them and neither clears threshold | Merge, then delete. Do not leave a redirect stub in the index |
| **Stale outranking** | An old, well-written article outranks the current, thinner one | Date-boost retrieval, and archive out of the index rather than "marking deprecated" |
| **Missing qualifier** | Region-, plan- or currency-specific answer written as universal | Add the qualifier to the title and the first sentence, or split per region |
| **Vocabulary mismatch** | Article answers a question no customer phrases that way | Retitle in customer words; add real ticket phrasings verbatim |

For the fourth, test with actual ticket text, not paraphrases you wrote: sample 20 real
tickets per intent and check whether the intended article is retrieved top-1.

### 5. Define escalation before you define answers

Escalation triggers are hard rules, evaluated before any retrieval attempt. The mandatory set — billing disputes, refunds above your threshold, data deletion, legal or
regulatory, accessibility, safety, chargebacks, an angry cancellation, three failed
resolution turns, and any explicit request for a human — plus the handover format, is in
`references/escalation-and-eval.md`.

Two rules about the handover itself:

- It hands over **with a summary**: what the customer asked, what was attempted, what is
  already known (order number, plan, error code), and why it escalated.
- It **never re-litigates**. Once a trigger fires it does not try one more answer, does not
  ask the customer to reconsider, and does not apologise at length. It hands over.

### 6. Write the grounding contract

The agent answers **only** from retrieved articles, and cites the article it used. When
nothing is retrieved above the confidence threshold, it says it does not know and escalates.

Make "I don't know" a first-class, rewarded outcome, and say so explicitly in the system
prompt and in how you evaluate. An agent that escalates a question it could have answered
costs one human touch. An agent that answers a question it should have escalated costs a
wrong refund, a lost customer, or a regulatory problem. The costs are not symmetric and the
design should not pretend they are.

Retrieval scores are not comparable across systems, so do not copy a threshold from anywhere.
Set it empirically from the regression set in step 7 — the lowest threshold at which
false-containment stays under your ceiling.

### 7. Build the regression set and measure the right three things

Assemble **50 to 100 real tickets** with known-good answers, spread across intents in rough
proportion to volume, including at least 10 that must escalate. Freeze it, and re-run it on
every article, prompt or model change.

| Metric | Definition | Reading |
| --- | --- | --- |
| **Containment** | Share of tickets resolved with no human touch | Capacity, not quality |
| **Accuracy on contained** | Of contained tickets, share answered correctly | Should sit above 95% before wider rollout |
| **False-containment** | Share answered wrongly instead of escalating | The dangerous one. Target under 2%, investigate every instance |

**Deflection rate on its own is a vanity metric** — name it as such when someone quotes it,
because a bot that replies to everything and resolves nothing deflects 100%. Report
containment only paired with accuracy and false-containment. Definitions, the scoring rubric
and the rollout gates are in `references/escalation-and-eval.md`.

### 8. Roll out in stages

Suggest, do not send, for the first two weeks: the agent drafts, a human approves, and you
track the approved-as-written rate. Auto-answer the top three static intents first, widening
only when live false-containment stays under 2% for a full week per intent.

## Presentation

Deliver the taxonomy as a table the team can maintain — intent, volume, kind, resolution
path, owner. It is the artefact with the longest life; the articles are downstream of it.

Be blunt about what cannot be automated. A stakeholder who wanted 80% containment is better
served by an honest 40% than by a number that includes wrong answers. And when you find an
intent that is currently being auto-answered and should not be, lead with that, before the
rest of the audit.

## What this skill does not do

- It does not measure your existing agent. It designs and audits knowledge and rules; the
  numbers must come from your own regression run against your own tickets.
- It cannot tell you your containment ceiling without your ticket data. Any figure quoted
  before the taxonomy exists is a guess, and the range across comparable businesses is wide
  enough to be nearly useless as a forecast.
- It does not write your refund, returns or privacy policy. It tells you where policy must be
  stated explicitly and separately; deciding it is your job, and often legal's.
- It does not remove the need for human support. A good design produces a smaller,
  better-targeted human queue, not an empty one.
- It does not tune retrievers, embeddings or rerankers. Those matter, but they are second
  order to the four failure modes in step 4.

## References

- `references/intent-taxonomy.md` — the clustering method, the static/account/judgement test,
  and worked e-commerce and SaaS taxonomies
- `references/article-template.md` — article structure, style rules, and anti-patterns with
  before/after rewrites
- `references/escalation-and-eval.md` — the trigger list, the handover format, the
  regression-set method and the metric definitions
