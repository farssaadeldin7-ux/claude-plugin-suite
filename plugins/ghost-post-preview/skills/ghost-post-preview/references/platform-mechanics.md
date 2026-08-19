# Platform mechanics

What each ranking system rewards, where the post gets cut off, and the mistake specific
to that platform.

**Treat every number here as approximate and every weighting as directional.** None of
it is documented behaviour. Platforms change ranking without announcement, fold lengths
vary by device, font size and accessibility settings, and the same post renders
differently on mobile web, native app and desktop. Use these to reason with, not to
quote as fact.

## The fold table

The fold is the truncation point — the amount visible before a reader has to tap "see
more", "more", or scroll. Assume mobile unless told otherwise, because most feeds are
mobile.

| Platform | Visible before truncation | Notes |
| --- | --- | --- |
| LinkedIn | ~140-210 characters, roughly 3 lines | Tighter on mobile; a line break costs a whole line of the allowance |
| X | ~280 characters in-timeline for long posts | Longer posts collapse behind "Show more"; the first 2 lines carry it |
| Instagram | ~125 characters of caption | The caption is secondary — the first frame is the real hook |
| TikTok | ~1 line of caption, ~100 characters | The caption is barely read; the first 1.5 seconds of video is the hook |
| Reddit | Title in full, ~3 lines of self-text on card view | Title limit ~300 characters; the title is the entire hook |
| YouTube | Title ~60 characters before truncation; ~100-157 characters of description | Description below the fold is effectively unread |
| Facebook | ~250 characters | Link previews rank differently from native text |
| Threads | ~4-5 lines | Behaves closer to X than to Instagram |

Blank lines count against the fold on LinkedIn, X and Threads. A draft that opens with
a line break has spent part of its visible allowance on nothing.

## Per-platform mechanics

### LinkedIn

| What it rewards | What suppresses reach |
| --- | --- |
| Dwell time — how long the post holds a scroll | Outbound links in the post body |
| Comments, weighted far above likes | Engagement-bait phrasing ("comment YES below") |
| Substantive replies over one-word replies | Reposts without commentary |
| Early engagement from your own first-degree network | Posting more than once in ~18 hours |

The dominant mechanic is dwell time, which is why the "see more" tap matters so much:
the tap is itself the signal. A post that earns the expand has already won something.

Move links to the first comment or the profile. Say this every time a draft has a link
in the body — it is the single most common LinkedIn mistake and it is trivially fixed.

Comments are weighted heavily enough that a post which provokes disagreement can
outperform a better post that provokes agreement. Note this, but do not recommend
manufactured controversy; the reputational cost lands on the author, not on the post.

Format rules that hold: short lines, one idea per line, no more than two consecutive
lines of prose before a break. Carousels (PDF documents) reliably hold dwell time.

### X

| What it rewards | What suppresses reach |
| --- | --- |
| Reply velocity in the first ~30 minutes | Outbound links, moderately |
| Replies over likes; likes over reposts for early ranking | Posts nobody replies to within the first hour |
| Time spent on the post, including profile clicks | Deleted-and-reposted content |
| Author replying inside their own thread | Hashtags, which do nothing useful |

The first 30 minutes decide the outcome. If the user cannot be present to reply during
that window, say so — it is a scheduling problem, not a copy problem, and it will
dominate anything you can fix in the text.

**Quote-tweet risk** is specific to X and worth its own check. Read the draft for a
sentence that is more entertaining to dunk on than to agree with: an overreach, a
sweeping generalisation, a self-congratulatory line, a claim that invites a
counterexample. Quote-tweets do drive reach, but hostile ones drive reach to the critic
and reputational damage to the author. Name the exact sentence at risk.

### Instagram

| What it rewards | What suppresses reach |
| --- | --- |
| Saves and sends, above all | Text-heavy first frames |
| Sends to DMs — the strongest single signal | Watermarked reposts from other platforms |
| Watch-through on Reels | Captions that repeat the image |
| Comment threads with replies | Link stickers in feed posts |

The question to ask of any Instagram draft: **is there a reason to save this or send it
to one specific person?** If not, expect likes and nothing else. Saves come from
utility — a list, a reference, a how-to. Sends come from recognition — "this is you".

First-frame stop rate governs whether the caption exists at all. If the user has
described the image only in words, say the visual is the variable you cannot assess.

### TikTok

| What it rewards | What suppresses reach |
| --- | --- |
| Watch-through percentage, above everything | A slow first 1.5 seconds |
| Rewatches and loops | Length beyond what the idea supports |
| Comments and shares | Obvious ad structure in the first frames |
| Completion on short videos, which is easier at 15-25s | Uploading with another platform's watermark |

Watch-through is a percentage, so length is a strategic choice. A fifteen-second point
stretched to sixty seconds does not gain reach; it loses it. If the script has thirty
seconds of preamble, that is the finding.

The first 1.5 seconds must contain motion, a face, a visual anomaly or a spoken claim.
"Hi guys, so today I wanted to talk about" is a completed loss.

### Reddit

| What it rewards | What suppresses reach |
| --- | --- |
| Early upvote velocity in the first hour | Anything that reads as marketing |
| Titles that state the substance plainly | Accounts with no history in the subreddit |
| Comment depth and the author replying | Cross-posting the same text to several subreddits |
| Genuine specificity and receipts | Links to the author's own site or newsletter |

Subreddit norms override every general rule on this page. Each subreddit has its own
rules, format conventions, flair requirements and tolerance for self-promotion, and
those rules are enforced by humans who remove posts.

The self-promotion allergy is real and severe. If the draft promotes the author's own
product, service or content, and the account has no established history of contributing
to that subreddit, the honest prediction is removal or downvoting — not underperformance.
Say that plainly rather than scoring the copy.

Reddit titles carry the whole hook. Curiosity-gap titles that work on LinkedIn read as
clickbait here and are punished.

### YouTube

| What it rewards | What suppresses reach |
| --- | --- |
| Click-through rate on the thumbnail and title | Titles that overpromise relative to the video |
| Average view duration and average percentage viewed | Slow openings before the payoff is named |
| Session time — viewers who keep watching afterwards | Thumbnails that require reading to understand |
| Returning-viewer signals | Keyword-stuffed titles |

The governing product is **CTR multiplied by AVD**. Either alone is misleading. A title
that wins the click and loses retention teaches the system to stop recommending the
channel, so a high-CTR title over a weak video is a net negative.

Title truncation at roughly 60 characters means the load-bearing words must come first.
The first 15 seconds should restate the title's promise and say when it will be paid off.
