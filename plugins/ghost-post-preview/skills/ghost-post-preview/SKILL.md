---
name: ghost-post-preview
description: >
  This skill should be used when someone has drafted a social post and wants to know how it will
  land before they publish it — "will this post do well", "roast my LinkedIn post", "is this hook
  strong enough", "why do my posts get no engagement", "check this before I publish", "review my
  tweet", "does this caption work", "predict how this will perform", "which of these two hooks is
  better", "my last post flopped, what went wrong". Also use it for auditing an existing post that
  underperformed, for rewriting a weak first line, and for adapting one post across platforms
  whose ranking mechanics differ.
metadata:
  version: "0.1.0"
---

# Ghost Post Preview

Read a draft post the way its audience and its ranking system will read it, then name
the single most likely reason it underperforms.

The value here is not encouragement. What a strong editor does is read the first line
cold, in the format it will actually appear in, as someone who does not care about the
author — and then say the one thing that is wrong with it. This skill enforces that
order: fold before hook, hook before body, mechanics before opinion, one named failure
before any rewrite.

## The one rule

**Never output an engagement number.** No estimated likes, no projected impressions, no
percentage lift. Nothing in a block of text supports a numeric prediction, and a number
that looks precise will be believed.

Report an ordinal band instead, and only against a baseline the user supplies. If they
have not given you their recent performance, ask: roughly what do your last twenty posts
on this platform do — lowest, typical, best? Without a baseline, still run the fold test,
hook audit and persona panel, but say plainly that the band is unavailable. A band
without a baseline is a made-up number wearing a word.

## What this method actually is

Say this once, near the top of your output, in your own words. Do not bury it. The
personas are **stated assumptions**, not an audience. There is no panel. This is a
structured re-read of the draft from five or six defined points of view, chosen because
they are the ones that historically kill posts — useful because it is systematic, not
because it is empirical. When a reaction depends on facts you do not have, say so
rather than inventing one.

## Sequence

### 1. Collect the inputs before reading the draft

Ask for whatever is missing. Do not infer the platform.

| Input | Why it decides the read |
| --- | --- |
| Platform and surface | Feed, Reels, Shorts and search rank on different signals |
| Format | Text, single image, carousel, video, link post, poll |
| Exact draft text | Including line breaks — they determine the fold |
| Baseline | Last twenty posts: low, typical, high |
| Goal | Reach, replies, saves, clicks, DMs. One only |
| Audience | Who they believe follows them, in one sentence |

If the goal is "engagement", push back once: reach and replies pull a draft in opposite
directions on most platforms, and a post optimised for both is optimised for neither.

### 2. Run the fold test first

Work out how much of the post a reader ever sees. Call the `fold_test` tool with the
platform and the exact draft — it returns the visible fragment computed from the
truncation table, what got cut, and the first hidden line. If the tool is unavailable,
reconstruct the fragment by hand from `references/platform-mechanics.md`. Quote the
visible fragment back verbatim and judge only that fragment. If it carries no reason to
keep reading, the rest of the post is irrelevant to its performance and every other
observation is secondary. The common finding, worth stating bluntly: the interesting
sentence is below the fold.

### 3. Audit the hook

The first line does roughly 80% of the work. Hook types, failure modes and worked
before/after rewrites are in `references/hook-patterns.md`. Classify into exactly one of:
tension, number, contrarian, identity-callout, story cold-open, question. If it fits
none, that is the finding — an unclassifiable opening is usually preamble. Score each
dimension 0-2, total out of 10:

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Specificity | Abstract benefit | Concrete but generic | Named, unusual, checkable |
| Subject position | Subject buried past word 12 | Mid-sentence | Subject in first five words |
| Stakes | Nothing at risk | Mild interest | Cost, conflict or consequence |
| Curiosity honesty | Withholds to bait | Partly earned | Gap the post genuinely closes |
| Reader fit | Anyone | A broad group | A reader who recognises themselves |

Thresholds:

- **8-10** — the hook is not the problem. Look at the body and the ask.
- **5-7** — the hook is the constraint; rewriting it is the highest-value change.
- **0-4** — rewrite the opening before any other edit. Do not polish the rest; it will
  not matter.

Check explicitly for the four hook killers in the reference — vague benefit, buried
subject, throat-clearing preamble, false curiosity. Name any present, quote the offending
words, and do not soften it.

### 4. Apply platform mechanics

Read `references/platform-mechanics.md` (or call `platform_mechanics`) for the platform
in hand and check the draft against what that ranking system rewards. Do not carry a
LinkedIn instinct onto TikTok.

Run `draft_lint` for the mechanical failures with evidence quoted — links where the
platform punishes them, hashtags on X, throat-clearing openers, yes/no question openers,
engagement bait, wall-of-text shape, and the counts. It reports facts, never judgements;
weighing them against this draft is your job. It requires a licence — if it returns
`license_required`, run the same checks by hand from the references. Nothing in the
sequence depends on the tool.

| Platform | Governing signal | The mistake it punishes |
| --- | --- | --- |
| LinkedIn | Dwell time, then comments | An outbound link in the body; move it to the first comment |
| X | Reply velocity in the first 30 minutes | A line that is more fun to quote-tweet than to agree with |
| Instagram | Saves and sends over likes | A caption behind a first frame that does not stop the scroll |
| TikTok | Watch-through %, decided in the first 1.5s | A fifteen-second point stretched to sixty |
| Reddit | Subreddit norms and vote velocity | Self-promotion from an account with no history there |
| YouTube | CTR multiplied by average view duration | A title that wins the click and loses retention |

### 5. Convene the persona panel

Read the post once as each persona in `references/persona-panel.md`: skeptical scroller,
in-market buyer, peer or competitor, algorithm-as-reader, hostile quote-tweeter. Add a
domain-specific sixth when the audience warrants it, and say you have invented it. For
each, report three things and no more: where they stop reading, quoted from the draft;
what they conclude about the author; what would have kept them. A line or two each. The
panel is a diagnostic pass, not the deliverable.

### 6. Name the single most likely failure

One sentence, one cause, ranked above everything else you noticed. Not a list. Resolve
competing candidates in this order: fold failure beats hook weakness, hook weakness
beats body problems, body problems beat formatting, formatting beats timing. If two
genuinely tie, say the post has two independent problems and that fixing one will not
move it.

### 7. Give the verdict and two rewrites

| Verdict | Criteria |
| --- | --- |
| **Ship** | Hook scores 8+, fold carries the idea, no persona bounces at line one |
| **Rewrite** | The idea survives but the opening or the structure does not |
| **Kill** | No claim, no tension, no reason to exist beyond having posted |

"Kill" is a legitimate verdict and you should use it. Most weak posts are weak because
there was nothing to say, and rewriting the hook of an empty post only produces a better
opening to a post nobody needed.

Then give **exactly two rewrites of the hook**, from different hook types, each a drop-in
replacement for the first line. Not a menu. Say which you would publish and why. Both
must use only facts in the original draft — inventing a statistic to strengthen a hook
is a serious failure, not a creative flourish.

### 8. State the band

Only with a baseline in hand. Use these five bands and no others.

| Band | Meaning against their own last twenty posts |
| --- | --- |
| Well below baseline | Expect bottom-quartile performance |
| Below baseline | Expect below their typical post |
| At baseline | Indistinguishable from their normal output |
| Above baseline | Expect upper-quartile |
| Well above baseline | Expect a rare outlier |

Give one or two sentences of reasoning tied to specific observations, plus a confidence
of low, medium or high. Default to low: variance between posts on one account is
enormous, and timing and follower composition routinely swamp copy quality. Never place a
post above baseline on copy strength alone when the account's history is what drives its
reach — say that instead.

### 9. Close the loop

Ask the user to report the actual result back. A prediction that is never checked has no
error bar, and over several posts their record of your calls is worth more than any
rubric on this page.

With a paid plan, keep that record for them: `log_call` stores the verdict, band and
confidence; `record_result` logs how the post actually landed; `review_calls` shows the
running tally — exact band, one band off, further out. When the record shows the calls
running hot or cold, say so before making the next one.

## Presentation

Write like an editor handing back a draft: direct, specific, unsentimental, short.
Quote the draft when you criticise it — vague praise is worse than nothing. Lead with
the fold reconstruction, then the single most likely failure, then the verdict, and put
the panel and the scoring table after for the reader who wants the working. Do not open
with reassurance.

## What this skill cannot do

- **It cannot predict engagement.** No text-only method can. Timing, follower
  composition, recent account history, what else is in the feed that hour, and chance all
  matter more than copy on any single post.
- **The personas are assumptions, not people.** If the real audience differs — a niche
  technical following, an existing customer list — the panel is weaker, and you should
  say so.
- **Platform mechanics change without notice.** Everything in
  `references/platform-mechanics.md` is a best current understanding, not documented
  behaviour. Treat fold lengths as approximate, ranking weights as directional.
- **It cannot judge whether a claim is true.** It reads how a claim lands, not whether it
  is accurate. Flag anything that reads as an unverifiable statistic.
- **It does not know the account.** A strong post on a cold account underperforms a weak
  post on a warm one.
- **It cannot assess visuals from a description.** Where the first frame or thumbnail
  decides the outcome, the visual is the variable and the copy read is secondary.

## Licensing

`fold_test` and `platform_mechanics` are open. `draft_lint` and the prediction log
require a paid licence, and return `license_required` or `upgrade_required`
when the plan does not cover them. Handle it plainly: say what is missing, call
`list_plans`, and offer `start_checkout`. Never work around a gate by inventing what the
paid tool would have said — and never let a licensing miss stall the review itself,
which needs no tools.

## References

- `references/platform-mechanics.md` — what each ranking system rewards, fold lengths, format rules, and the mistake specific to each platform
- `references/hook-patterns.md` — the hook taxonomy, the four failure modes, worked before/after rewrites
- `references/persona-panel.md` — the personas, what each notices, what makes each bounce
