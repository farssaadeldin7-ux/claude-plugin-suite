# Article template and style rules

An article is not documentation. It is a retrieval target with an answer attached, written
for two readers: the retriever that has to find it, and the customer who has to be satisfied
by the first two sentences.

## The template

```
# <Intent, in the customer's words>

Applies to: <plan / region / order state, or "all customers">   Kind: policy | procedure
Owner: <name>   Last reviewed: <YYYY-MM-DD>   Review by: <YYYY-MM-DD>

<The answer, in one or two sentences. No preamble.>

## Preconditions
- <What must be true for the answer above to hold>

## Steps            (procedure articles only)
1. <Literal UI labels in bold or quotes>

## Exact strings and codes
- "<user-facing message>" (<error_code>)

## If this does not apply
<One-line pointer to the sibling article, or "escalate to a human">
```

Keep it under 400 words — longer articles get chunked, and a chunk from the middle rarely
contains the answer.

## Style rules

| Rule | Reason |
| --- | --- |
| Title is the customer's question, not a noun phrase | "Why was my card declined?" retrieves; "Payment troubleshooting" does not |
| Answer in the first two sentences | Retrieved chunks are short; the answer must be in the first one |
| One intent per article | Multi-intent articles are retrieved for all and resolve none |
| Preconditions stated, never implied | An unqualified answer is wrong for somebody |
| Exact user-facing strings, verbatim | Customers paste them, and that paste is the query |
| Error codes and labels in text, never only in an image | Images are invisible to retrieval |
| Each number written once, in one place | "30 days" in nine articles becomes nine edits |
| No cross-reference chains | An answer two hops away will not be found |
| Date and owner on every article | Undated articles are unmaintainable and outrank current ones |

## Policy versus procedure

Split them, every time. **Procedure** is how to do a thing and is stable for years ("how to
start a return"). **Policy** is the rule that governs it and changes with the business
("returns window: 30 days from delivery, unworn, tags attached, final-sale excluded").

The policy article is short, has a single owner — usually not support — and is the only place
the number appears. Procedure articles reference it by name rather than restating it. The
test: if a policy changes tomorrow, how many articles need editing? More than one means the
split has not been done.

## Anti-patterns, with rewrites

### 1. The buried answer

**Before**

> # Returns
> At <brand> we want you to love what you ordered. We know that sometimes things do not work
> out, and our returns process is designed to be as simple as possible. Our customer care team
> is here to help you every step of the way. To begin a return, first find your order number...

The answer to "how long do I have" never appears. The first chunk carries no information.

**After**

> # How do I return an item?
> You have 30 days from delivery to return an item. Start at <brand>.com/returns with your
> order number and the email address on the order.
>
> ## Preconditions
> - Unworn, with tags attached
> - Final-sale and personalised items cannot be returned
> - Delivered within the last 30 days (see: Returns window policy)

### 2. The unqualified regional answer

**Before:** "Shipping is free on orders over £50 and arrives in 2-3 working days." A customer
in Ireland is now confidently told something false.

**After**

> # How much is delivery and how long does it take?
> Delivery cost and speed depend on your destination.
>
> | Destination | Free over | Standard |
> | --- | --- | --- |
> | UK mainland | £50 | 2-3 working days |
> | UK Highlands & Islands | £75 | 3-5 working days |
> | Ireland | €70 | 4-6 working days |
> | EU | €90 | 5-8 working days, duties apply |
>
> ## If your destination is not listed
> Escalate; do not estimate.

### 3. The near-duplicate pair

Two articles, "Payment issues" and "Card declined at checkout", both partially covering the
same intent. Scores split, neither clears threshold, the agent guesses. **Fix:** merge into one article titled with the customer's phrasing and **delete** the other
from the index — a deprecated-but-indexed article is still a competing retrieval target.

### 4. Product vocabulary instead of customer vocabulary

**Before:** `# Configuring the Notification Preference Centre for sub-accounts`. No customer
types that.

**After**

> # How do I stop getting emails for other people's accounts?
> ## Also asked as
> - "turn off notifications for my team"
> - "why am I getting emails about someone else's project"

The "also asked as" block is lifted verbatim from real tickets, so retrieval matches the
query the customer actually sends.

### 5. The missing error string

**Before:** "If your payment fails, please check your card details and try again."

**After**

> # My card was declined at checkout
> A decline usually comes from your bank, not from us. Retry the same card or use another
> payment method.
>
> ## Exact messages you may see
> - "Payment method declined (err_card_2041)" — bank declined; retry or use another card
> - "Card expired (err_card_2012)" — update the expiry date
> - "Incorrect security code (err_card_2018)" — re-enter the CVC from the back of the card
> - "3D Secure authentication failed (err_3ds_5502)" — complete the bank's verification step
>
> ## If none of these match your screen
> Escalate with the exact wording of the message.

## Maintenance

- **Review cadence:** policy quarterly, procedure every six months.
- **Change trigger:** any release that changes a UI label an article quotes. Put it on the
  release checklist, or the agent will describe a button that no longer exists.
- **Archive, do not deprecate.** Remove it from the index; an article marked "outdated" at
  the top still gets retrieved and quoted.
- **Every article change re-runs the regression set.** Edits to first sentences are exactly
  what moves retrieval.
