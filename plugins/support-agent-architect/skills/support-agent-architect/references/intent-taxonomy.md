# Intent taxonomy

The taxonomy is the foundation. Build it before writing a single article or prompt.

## What an intent is

An intent is **one customer goal, phrased the way the customer phrases it**. "Where is my
order" is an intent. "Shipping" is a category, and categories are useless here because they
do not have a single correct answer.

Two tickets belong to the same intent if the same answer resolves both. If resolving them
requires different answers, they are different intents no matter how similar the wording.

## Clustering method

1. **Export** at least 90 days or 2,000 tickets, whichever is larger. Include the first
   customer message verbatim — not the subject line, which is often empty or "Help".
2. **Strip** signatures, order numbers and quoted history. Keep error codes.
3. **Cluster** by first message. Embedding-based clustering is fine as a first pass, but a
   human must read a sample of 20 per cluster and rename it in customer language.
4. **Merge** until the top 20 intents cover 70% or more of volume. Too many small clusters is
   the normal failure; over-merging shows up as an intent whose sampled tickets need two
   different answers.
5. **Record** volume, resolution path and kind for each.
6. **Keep the long tail visible.** Everything below the top 20 goes into a single "tail" row
   with its combined percentage. It is usually 20-30% of volume and it is nearly all
   escalation.

Under 500 tickets, report the taxonomy but not the percentages. Say the volumes are
indicative only.

## The three-way test

Ask, in this order:

1. **Would the correct answer be identical for every customer asking this today?**
   Yes → **static**.
2. **Does answering require reading this customer's order, subscription or account state?**
   Yes → **account-specific**.
3. Otherwise → **judgement**.

### Edge cases that decide most arguments

| Situation | Kind | Why |
| --- | --- | --- |
| "What is your returns window?" | static | One policy, one answer |
| "Can I return this order?" | account-specific | Depends on order date and item type |
| "Can I return this outside the window?" | judgement | It is an exception request |
| "How do I reset my password?" | static | Procedure is the same for everyone |
| "Why is my password reset email not arriving?" | account-specific | Needs delivery logs |
| "Do you support SSO?" | static | Unless the answer is plan-dependent — then split per plan |
| "Does my plan include SSO?" | account-specific | Lookup |
| "Where is my order?" | account-specific | Only automatable if you can query the carrier live |
| "My order is late, I want compensation" | judgement | Discretionary |
| Anything with the word "refund" attached to a dispute | judgement | Escalate |

**A static intent that is plan-, region- or currency-dependent is not one static intent.**
It is N static intents, one per variant, or one article with an explicit qualifier table.
Treating it as one is the single most common source of confidently wrong answers.

An intent may also be static in its **first turn** and judgement thereafter. "What is your
returns window" answered from an article is fine; the follow-up "that's ridiculous, I want
an exception" is a judgement turn. Classify the turn, not just the ticket.

## Worked taxonomy — direct-to-consumer e-commerce

Illustrative volumes from a mid-sized store, roughly 4,000 tickets per quarter. Use the
shape, not the numbers.

| Intent | Vol % | Kind | Resolution path |
| --- | --- | --- | --- |
| Where is my order | 18% | account | Look up order → carrier status → paraphrase ETA |
| How do I return an item | 11% | static | Point at returns portal, state window and condition rules |
| Is this item back in stock | 7% | account | Check stock feed for SKU, offer restock alert |
| Change or cancel my order | 7% | account | Check fulfilment state; cancellable only pre-pick |
| Discount code not working | 6% | static | Explain the four standard rejection reasons |
| Where is my refund | 6% | account | Check refund state, quote the 5-10 working day bank window |
| Wrong or damaged item received | 5% | judgement | Requires photo assessment and a goodwill decision |
| Sizing and fit questions | 5% | static | Size guide per product category |
| Delivery to my country / duties | 4% | static | Per-region table; must be region-qualified |
| Payment declined at checkout | 4% | static | The declined-card article with literal error strings |
| Order never arrived / marked delivered | 3% | judgement | Loss claim, fraud exposure |
| Return not refunded yet | 3% | account | Check receipt scan at warehouse |
| Tail (60+ intents) | 21% | mixed | Mostly escalation |

Static share: roughly 29%. Automatable account-specific with a live order lookup: roughly
34%. **Containment ceiling around 55-60%, realistically 40-45% at launch.**

## Worked taxonomy — B2B SaaS

Roughly 1,200 tickets per quarter, 300 accounts.

| Intent | Vol % | Kind | Resolution path |
| --- | --- | --- | --- |
| How do I do X in the product | 16% | static | Procedure article per feature |
| Login / SSO failure | 10% | account | Check IdP config and recent auth logs |
| Billing: what am I being charged for | 9% | account | Read the invoice and seat count |
| Invite users / manage permissions | 8% | static | Role matrix article |
| API error or rate limit | 7% | static | Error-code article, literal codes in text |
| Does the product do Y | 7% | static | Capability answer, plan-qualified |
| Data import failing | 6% | account | Inspect the import job |
| Request a feature | 5% | judgement | Route to product, do not promise |
| Upgrade, downgrade, seat change | 5% | judgement | Commercial |
| Cancel subscription | 4% | judgement | Always human, always |
| Security or DPA questionnaire | 4% | judgement | Legal and security review |
| Outage / "is it just me" | 3% | account | Status page plus tenant health |
| Tail | 16% | mixed | Escalation |

Static share: roughly 38%, but note **plan-dependency**. "Does the product do Y" and the role
matrix both need per-plan variants or they will produce wrong answers for the cheapest tier,
which is where most of the volume is.

## Recording format

Keep one table, owned by a named person, reviewed quarterly:

`intent | customer phrasing examples (3) | volume % | kind | resolution path | article id | owner | last reviewed`

The customer-phrasing column is not decoration. It is the input to the retrieval test in
step 4 of the skill and the source of the article titles.

## When the taxonomy is wrong

Symptoms, in order of how often they appear:

- **An intent's sampled tickets need two different answers** — over-merged, split it.
- **An article exists with no intent behind it** — someone wrote from the product side, not
  the ticket side. It will not be retrieved. Delete or map it.
- **A high-volume intent has no resolution path recorded** — nobody actually knows how it is
  resolved today, which means it is being resolved inconsistently by humans. Fix that before
  automating it.
- **Volume shares do not sum to 100%** — tickets with multiple intents were double-counted.
  Count the primary intent only, and note multi-intent rate separately; above 15% it changes
  the agent design, because the agent must handle the second intent or escalate.
