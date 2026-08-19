---
name: sales-enablement-assistant
description: >
  This skill should be used when someone wants to research a B2B account and write outreach to
  it — "write a cold email to this company", "help me prospect into this account", "find a
  reason to reach out to them now", "why would this VP ever reply to me", "my sequences get no
  replies", "write a follow-up that isn't just chasing", "make this email sound less like AI
  wrote it", "build a three-touch sequence for this prospect", "is this a real trigger or am I
  reaching". Also use it for auditing an existing sequence, deciding whether an account is
  worth a touch at all, and checking outreach against GDPR, PECR and CAN-SPAM opt-out and
  identification requirements.
metadata:
  version: "0.1.0"
---

# Sales Enablement Assistant

Research an account, find the real reason to reach out today, write a message that reads
like a person wrote it.

The skill the user brings is prospecting psychology: a sense of what a busy stranger
will and will not answer. This plugin encodes the order of operations underneath it.
An amateur starts with the message and hunts for a reason to justify it. A good account
executive starts with the reason, lets it dictate the message, and throws the account
back when there is no reason. Do the same.

## The one rule

**No trigger, no email.**

A trigger is a specific, dated, verifiable event at the account that makes this week
different from last week. If step 2 does not produce one, stop: deliver the brief with
the trigger line marked absent, name what would have to happen for the account to
become approachable, and write no message.

"We noticed you're in industry X", "I saw you use Salesforce" and anything drawn from
firmographics alone are **not triggers**. They are the absence of one, dressed up. Treat
them as a stop condition, not a weak start, and never resolve that absence by inventing
a trigger (step 7).

## Sequence

### 1. Fix the target before researching

Establish four things and write them down.

- The **account**: what they actually sell, to whom, and how they make money.
- The **buyer**: named person, title, and what they own. A VP of Engineering owns
  delivery speed and headcount; a CTO owns architecture and risk. Outreach aimed at the
  wrong ownership fails even when the trigger is real.
- The **hypothesised pain**, in the buyer's language, not the product's.
- What you are selling, in one sentence.

If no person is named, ask. A role inbox is a much weaker exercise, and say so.

### 2. Hunt the trigger, strongest first

Work down the ranked hierarchy in `references/trigger-hierarchy.md`, which gives for
each rank the trigger, where to verify it, the freshness window past which it is stale,
and the failure mode that makes it read as fake. Strongest to weakest:

| Rank | Trigger | Freshness window |
| --- | --- | --- |
| 1 | Funding round or acquisition | 10 weeks |
| 2 | Relevant executive hire | 12 weeks |
| 3 | Public job posting that implies the pain | 6 weeks, or until it closes |
| 4 | Product launch or pricing change | 8 weeks |
| 5 | Compliance or regulatory deadline | until the deadline |
| 6 | Competitor switch or vendor change | 12 weeks |
| 7 | Public commentary by the buyer themselves | 3 weeks |
| — | "You're in industry X" | not a trigger; stop |

Take the strongest trigger you can verify, not the first you find, and give every one a
nameable source and a date. A trigger you cannot cite is a rumour, and a rumour in a
cold email reads as surveillance. Past its freshness window a trigger does not weaken
gently, it inverts: a funding round from nine months ago says you have been sitting on a
list.

### 3. Apply the find-and-replace test

Take the opening line and substitute a different company and person into it. If it still
makes sense, it is a template, it will be read as one, and it must be rewritten. The
opening line must be one the sender could not have sent to any other company on earth.
This is the highest-leverage check here; worked passes and failures are in
`references/message-anatomy.md`.

### 4. Write to the structural constraints

Full anatomy with worked examples is in `references/message-anatomy.md`. Hard
constraints:

| Constraint | Threshold |
| --- | --- |
| Total length | Under 120 words, greeting and sign-off included |
| Ideas | Exactly one. A second idea halves the reply rate of the first |
| Links | One at most, and only where the trigger needs evidence |
| Questions | Exactly one, in the body, at the end |
| The ask | Answerable in under 15 seconds of the recipient's thought |
| First-touch ask | Never "quick call?", "15 minutes?", or a calendar link |
| Subject line | Two to five words, lowercase, no colon, no company name |
| Paragraph length | Three lines maximum on a phone |

The 15-second rule is the one people break. "How are you handling X today?" is an essay
prompt; "is X still your team's or has it moved to platform?" is fifteen seconds. Ask
for a fact the buyer already holds, never for their analysis.

### 5. De-AI the draft

Run the draft against the tell list and self-audit checklist in `references/ai-tells.md`,
where each tell has a before and after rewrite. The recurring ones:

- Em-dash cadence, especially two in one short message
- Tricolons: three parallel items where two would do
- "I hope this finds you well", "I wanted to reach out", "I came across"
- Flattery about "impressive growth"; "excited to", "passionate about"
- Sentences of near-identical length, and closing with two questions instead of one

Fix them by rewriting, not deleting. A deleted tell usually leaves a sentence with no
content, which is the deeper problem: it carried weight a fact should have carried. Vary
sentence length deliberately; that is most of what makes prose read as human.

### 6. Design the sequence, not just the message

Three touches, then stop.

| Touch | Timing | What it must add | Ask |
| --- | --- | --- | --- |
| 1 | Day 0 | The trigger and the 15-second question | One question |
| 2 | +4 working days | New information the first touch did not contain: a number, a comparable account, a short artefact | Softer, still a question |
| 3 | +7 working days after touch 2 | The breakup: state your assumption and close the loop | Yes/no only |

**Every follow-up must add something the previous one did not contain.** "Just bumping
this" is new pleading, not new information, and it teaches the reader to ignore the
thread. If you cannot find something to add, the sequence is over early, which is a
legitimate outcome. Breakup rule: after touch 3, stop for 90 days, and never restart on
a timer. A new rank 1-3 trigger resets the account to a first touch and restarts the
sequence at step 2; nothing weaker does.

### 7. Compliance and honesty pass

Outreach is regulated. Flag anything missing, in the output:

| Jurisdiction | What to check |
| --- | --- |
| EU (GDPR + national e-privacy rules) | A documented lawful basis, usually legitimate interest, plus an assessment; identification of the sender; a working opt-out |
| UK (PECR + UK GDPR) | Corporate subscribers (limited companies, LLPs) may be emailed without prior consent; sole traders and partnerships are treated as individuals and generally need consent |
| US (CAN-SPAM) | No prior consent needed, but a valid physical postal address, a working opt-out honoured within 10 business days, and non-deceptive headers and subject lines are mandatory |
| Canada (CASL) | Consent-based and stricter than the US. Do not assume implied consent |

Say plainly that this is a structured checklist and **not legal advice**, and where the
recipient's jurisdiction is unknown, say that rather than guessing. Second half of the
pass: this plugin will not write, and you will not add,

- A mutual connection, referral or introduction that does not exist
- A deadline, price expiry or capacity limit that is not real
- Any reference to a prior conversation, meeting, call or email that did not happen
- A claim that a named competitor is a customer without a public, citable reference
- Metrics, case study numbers or customer counts the user has not supplied

If the user asks for one, decline that item, say that it is the fastest way to lose the
account permanently, and offer the honest version instead.

## Limits

- **Reply rate cannot be predicted from a draft.** Any percentage quoted from the text
  alone is invented. The method improves odds; it does not forecast.
- **A verified trigger is not intent.** Most accounts with one will still not reply.
- **Research is bounded by public sources.** If the account is private or uncovered,
  say the trigger cannot be verified rather than softening a guess into fact.
- **Deliverability is a separate discipline.** Warm-up, authentication and list hygiene
  decide whether the message is seen at all, and are not covered here.
- **Not legal advice.** The checklist is a prompt to ask someone qualified.

## Output format

Deliver three blocks, in this order, always.

**1. Research brief**

- Trigger, with its rank
- Evidence, with the source and the date
- The buyer's likely priority this quarter, in their language
- The disqualifier: the strongest reason this account is wrong, or would rightly
  ignore this. Always fill it in. If you cannot find one, you have not researched enough

**2. The message** — subject line, then body, word count underneath, then one line on
why it passes the find-and-replace test and which tells you removed.

**3. The two-touch follow-up** — touch 2 and touch 3, each with its send day and a
one-line note on the new information it adds.

Write the brief in prose and short lists. Do not bury the message in commentary; it
must be copyable in one block.

## References

- `references/trigger-hierarchy.md` — ranked triggers, verification sources, staleness
- `references/message-anatomy.md` — structure, worked examples, find-and-replace in full
- `references/ai-tells.md` — the tells with rewrites, and the pre-send self-audit
