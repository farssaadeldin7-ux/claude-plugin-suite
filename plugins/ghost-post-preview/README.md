# Ghost Post Preview

Reads a draft post the way its audience and its ranking system will read it, then names
the single most likely reason it will underperform.

Part of a 14-plugin suite. A skill carrying the judgement, plus a small deterministic
MCP server: exact fold reconstruction, mechanical draft lint, the platform data, and a
local prediction log. Drafts are analysed on your machine and never leave it — the only
network calls are licence checks.

## What it does

Anyone can say a post is good. What a strong editor does is read the first line cold, in
the format it will actually appear in, as someone who does not care about the author.
This plugin enforces that order of operations.

- **Fold test** — reconstructs what a reader actually sees before "see more" truncates
  the post, per platform, and judges only that fragment
- **Hook audit** — classifies the first line into one of six hook types and scores it
  0-10 across specificity, subject position, stakes, curiosity honesty and reader fit
- **Platform mechanics** — LinkedIn dwell time and comment weighting, X reply velocity
  in the first 30 minutes, Instagram saves and sends, TikTok watch-through, Reddit
  subreddit norms, YouTube CTR x AVD. Modelled separately, because they differ
- **Persona panel** — five stated reader personas, including the algorithm-as-reader and
  the hostile quote-tweeter, each read for where they stop and why
- **One named failure** — not a list of observations. One cause, ranked
- **Kill, rewrite or ship**, plus exactly two rewrites of the hook using only facts
  already in the draft

## Who it is for

Creators, social teams and small businesses in the last five minutes before publishing.
It is most useful on the posts you are unsure about, and on the post that flopped last
week when you want to know why.

## What you need to bring

**Your own baseline.** The plugin will not report an engagement band without the rough
performance of your last twenty posts on that platform — low, typical, high. This is not
optional politeness; the band is meaningless without it, and the skill is instructed to
withhold it rather than guess.

You also need to be willing to hear "kill this post". That verdict exists because most
weak posts are weak for lack of anything to say, and a better hook on an empty post is
just a better opening to a post nobody needed.

## Components and plans

| Component | Purpose |
| --- | --- |
| Skill `ghost-post-preview` | The judgement: hook audit, persona read, the one named failure, the band |
| MCP server | The mechanics: fold reconstruction, draft lint, platform data, prediction log, licensing |

**Open** — no licence needed:

- `fold_test` — exactly what survives truncation on a platform, and the first hidden line
- `platform_mechanics` — what each ranking system rewards and suppresses

**Licensed** — requires a pro or team key:

- `draft_lint` — mechanical failures with the evidence quoted: links where the platform
  punishes them, hashtags on X, throat-clearing openers, engagement bait, wall-of-text
  shape, and the counts. Facts only; no scores
- `log_call` / `record_result` / `review_calls` — the prediction log that gives the
  review record an error bar, stored only on this machine

There is no free plan and no trial. Served by `services/billing` in this repo; the
catalog lives in its `catalog.js`.

| Plan | Price | Seats | Lint passes / month |
| --- | --- | --- | --- |
| Pro | $40/month | 2 | unlimited |
| Team | $70/month | 10 | unlimited |

The review method itself — the skill — loads as content and needs no licence; a
licensing miss never blocks the manual review.

## What this is not

**It does not predict engagement, and it will not give you a number.** No estimated
likes, no projected impressions, no percentage lift. Nothing in a block of text supports
a numeric prediction, and a precise-looking number would be believed. The output is an
ordinal band — well below, below, at, above, well above your own baseline — with
reasoning and a stated confidence that defaults to low.

**The personas are assumptions, not an audience.** There is no panel and nobody has been
surveyed. It is a structured re-read from five defined points of view, chosen because
they are the ones that historically kill posts. It is useful because it is systematic,
not because it is empirical.

**The platform mechanics are a best current understanding, not documented behaviour.**
Fold lengths vary by device and font size. Ranking weights change without announcement.
Treat them as directional.

It also cannot judge whether your claims are true, cannot see your follower composition or posting history, and cannot assess a thumbnail or first frame from a description — which matters, because on Instagram, TikTok and YouTube the visual usually decides the outcome and the copy is secondary.

## The skill you bring

**Predictive Analytics.** The commercial skill this plugin pairs with. Businesses buy certainty about social spend, and the honest route to it is calibration, not fabricated forecasts: keep a baseline, log every call with the prediction log, and let the record against actual results become the model. The plugin refuses invented engagement numbers precisely so the analytics built on top of it are real.
