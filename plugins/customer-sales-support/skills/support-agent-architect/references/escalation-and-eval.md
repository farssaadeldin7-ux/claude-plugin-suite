# Escalation rules and evaluation

Escalation is not the agent's failure state. It is one of its two correct outputs.

## Hard escalation triggers

These are evaluated **before** retrieval, on the incoming message and on conversation state.
If any fires, the agent hands over. It does not attempt an answer first.

| Trigger | Detection | Why it is hard |
| --- | --- | --- |
| Billing dispute | Customer contests a charge, says "I was charged twice", "I never authorised this" | Money plus a factual disagreement |
| Refund above threshold | Requested or implied amount over your limit | Set the limit deliberately; see below |
| Chargeback mentioned | "chargeback", "dispute with my bank", "section 75", card-network language | Regulated process with deadlines |
| Cancellation with anger | Cancellation intent plus negative sentiment or escalating language | Retention and tone; never automate |
| Data deletion | "delete my account", "delete my data", "GDPR", "right to erasure" | Irreversible and regulated |
| Legal or regulatory | Solicitor, lawsuit, regulator, ombudsman, ADR, trading standards | Anything said here is on the record |
| Accessibility | Screen reader, disability, accommodation request, WCAG | Duty of care and legal exposure |
| Safety | Injury, allergic reaction, faulty or dangerous product, self-harm language | Human, immediately, with the right escalation path |
| Three failed turns | Three agent responses without resolution in one conversation | The agent is not converging; further attempts erode trust |
| Explicit request | "human", "agent", "person", "representative", "manager" | Honour it on the first ask, without negotiation |

Two more worth adding for most businesses: **VIP or enterprise accounts** above a revenue
threshold, and **anything mentioning a public complaint** ("posting this review", "taking
this to Twitter").

### Setting the refund threshold

This is a business decision, not a knowledge one. Set it where the cost of a wrong automated
refund is smaller than the cost of a human touch. For most consumer stores that lands
somewhere between £15 and £30; above it, a human decides. Write the number down in one place
and reference it, exactly as with any other policy value.

### The "explicit request" trigger has no retention step

The agent does not ask "can I try one more thing?" A customer who asks for a human and is
asked to justify it is a customer who leaves. Hand over on the first request.

## Handover format

The agent stops answering and produces a structured handover. Nothing else.

```
Escalation: <trigger name>
Intent (best guess): <intent from taxonomy, or "unclassified">
Customer asked: <one sentence, their words>
Known facts: <order id / plan / region / error code / dates — only what was verified>
Attempted: <what the agent said, and which articles it cited, or "nothing attempted">
Sentiment: <neutral | frustrated | angry>
Suggested owner: <queue or team>
```

To the customer it says one short thing: that a person is taking over, and what they already
have. No apology paragraph, no restating the policy, no final attempt at the answer.

**Never re-litigate.** Once a trigger fires the conversation belongs to a human. An agent that
adds "but just so you know, our policy says..." after escalating has made the handover worse
than no answer at all, because the human now has to undo a position the customer has already
read.

## Grounding contract

Put this in the system prompt, in these terms:

1. Answer only from the retrieved articles. If a fact is not in them, you do not have it.
2. Cite the article you used, by title, in every substantive answer.
3. If nothing is retrieved above the confidence threshold, say you do not know and escalate.
4. Never infer a policy value, a price, a date or an entitlement. Never combine two articles
   to produce a value that neither states.
5. Never restate a customer's guess back to them as confirmation.

Rule 4 is the one that gets skipped and the one that causes the worst incidents. An agent that
reads "returns within 30 days" in one article and "exchanges follow the returns process" in
another will happily invent a 30-day exchange window that does not exist.

## Making "I don't know" a rewarded outcome

State it in the prompt, and mean it in the evaluation. A correct escalation scores as a
**pass** in the regression set, not as a miss. If your scoring counts escalations against the
agent, you have built an incentive to guess, and it will guess.

Track the reverse error too: **over-escalation**, tickets escalated that a static article
covered. It is a real cost, but it is a recoverable one. Tune it down only after
false-containment is under control, never before.

## The regression set

**Composition.** 50-100 real tickets, first message verbatim, with a known-good answer
written by a senior agent. Spread across intents in rough proportion to volume, plus:

- at least **10 that must escalate**, one per hard trigger where you have real examples
- at least **5 near-misses**: tickets whose wording resembles a static intent but requires a
  lookup or a judgement
- at least **5 with no correct answer in the knowledge base**, where "I don't know" is the
  only pass

Freeze it. Version it. Re-run on every article, prompt, retriever or model change.

**Scoring.** Each case gets one of four outcomes:

| Outcome | Meaning |
| --- | --- |
| `correct_contained` | Answered, and the answer matches the known-good answer |
| `correct_escalated` | Escalated, and escalation was right |
| `over_escalated` | Escalated, but a good answer was available |
| `false_contained` | Answered, and the answer was wrong, incomplete or unqualified |

Score by a human on the first two runs. Automated scoring drifts on exactly the cases that
matter — partially correct answers with a missing qualifier — so spot-check 20% by hand
forever.

## Metric definitions

| Metric | Formula | Target |
| --- | --- | --- |
| Containment | `(correct_contained + false_contained) / total` | Capacity measure only |
| Accuracy on contained | `correct_contained / (correct_contained + false_contained)` | Above 95% |
| False-containment | `false_contained / total` | Under 2%, ideally under 1% |
| Over-escalation | `over_escalated / total` | Under 15%, tune last |

**Deflection rate — the share of conversations that did not reach a human — is a vanity
metric.** It counts an abandoned customer as a success. Never report it alone. If a
stakeholder asks for it, give it alongside accuracy and false-containment, and say plainly
what it does and does not measure.

## Rollout gates

| Gate | Requires |
| --- | --- |
| Suggest-only, human sends | Regression accuracy above 90% |
| Auto-answer top 3 static intents | Regression accuracy above 95%, false-containment under 2% |
| Widen to all static intents | Seven consecutive days live under 2% false-containment per intent |
| Enable account-specific answers | Live lookup verified, plus 20 regression cases with real account state |

Roll back on a single false-containment incident involving money, data deletion or safety.
One is enough — those categories are why the escalation list is hard rather than advisory.

## What the numbers cannot tell you

- A regression set of 50-100 cases gives a false-containment estimate with a wide interval.
  At 2% observed on 100 cases, the true rate could plausibly be near 6%. Treat it as a floor
  on your uncertainty, not a measurement.
- The set ages. Tickets about a feature released last month are not in it. Refresh 20% of the
  cases each quarter from recent traffic.
- Customer satisfaction is not in any of these metrics. An agent can be accurate and still
  annoying. Measure CSAT on contained conversations separately, and compare it to CSAT on
  human-handled ones for the same intents rather than overall.
