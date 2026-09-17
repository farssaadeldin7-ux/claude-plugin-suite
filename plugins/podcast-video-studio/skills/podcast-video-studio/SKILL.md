---
name: podcast-video-studio
description: >
  This skill should be used when someone wants to find the clip-worthy moments in a long
  recording and cut them down — "find the best clips in this podcast episode", "what should I
  clip from this interview", "turn this transcript into shorts", "cut this webinar into reels",
  "give me a cut list", "which moments from this will travel on TikTok", "write titles for
  these clips", "pull the highlights out of this recording", "repurpose this episode for
  LinkedIn". Also use it for scoring a shortlist an editor has already pulled, for choosing
  in-points and out-points on a segment, and for writing titles, cold opens and caption first
  lines that quote the segment rather than describing it.
metadata:
  version: "0.1.0"
---

# Podcast & Video Studio

Turn a long recording into a scored cut list: which moments earn a clip, where each one
starts and ends, where it goes, and what it is called.

The amateur clips the moment that felt good in the room. The practitioner clips the moment
that still works for someone who has never heard of the show and is holding a phone
one-handed. Those are different moments, and the gap between them is where most
repurposing effort is wasted.

## What you are actually reading

A transcript: language and structure — what was said, how it was framed, where the
sentences break, who said it. You are **not** reading audio energy, laughter, the pause
before the good line, the look someone gave, whether the shot was usable or whether the mic
clipped. None of that is in the text.

So the deliverable is a **cut list, not a publish queue**. A human watches the actual
footage for every clip clearing the threshold, before anything ships. Say this to the user
once, plainly, and build the handoff in step 8.

## The one rule

**A segment that needs context is not a clip, however good it was in the room.**

If a viewer arriving with zero knowledge — no episode, no guest bio, no previous sentence
— cannot follow it, it is disqualified. Not downgraded. Disqualified, regardless of what it
scored elsewhere. This rule gets broken because the person clipping has heard the whole
episode and cannot un-hear it. Read every candidate as if the ten minutes before it do not
exist.

## Sequence

### 1. Get a timecoded transcript

Requirements, in order of how much they matter.

| Requirement | Why |
| --- | --- |
| Timecodes at sentence level or finer (≤5s granularity) | You cannot set an in-point against a paragraph timestamp |
| Speaker labels | Half the archetypes are speaker-interaction patterns |
| Verbatim, not tidied | Removed filler hides the run-up you need to cut past |

Handed a cleaned-up transcript with no timecodes, say so and stop: every in/out would be a
guess, and a cut list of guesses costs an editor more time than it saves. ASR timecodes
drift roughly 0.5–1.5 seconds, more after crosstalk — treat every timecode you output as
the editor's starting point.

### 2. First pass — mark candidates by archetype

Mark anything matching a known archetype. Do not score or trim yet. Over-collect: aim for
three to four times the number of clips you expect to ship. The seven archetypes that
reliably travel, with the transcript-level tells for spotting each, are in
`references/moment-archetypes.md`. Use the tells literally — "everyone thinks", "say that
again", "we went from", "it's basically like" are searchable surface markers.

### 3. Score every candidate

Score each candidate 0–3 on four axes — self-contained premise, tension, payoff inside the
clip, clean boundaries. Twelve points available.

| Total | Action |
| --- | --- |
| 10–12 | Publish candidate. Goes on the cut list. |
| 9 | Publish candidate only if no single axis is below 2. |
| 7–8 | Rework list — name the one axis holding it back |
| 0–6 | Leave it in the episode |

The full rubric, band descriptors, hard disqualifiers and four worked scored examples are
in `references/clip-scoring.md`. Read it before scoring anything — the band descriptors are
what stop scores drifting upward across a long session. Apply the disqualifiers first: they
are cheaper than scoring and they remove more.

### 4. Set the in-point and the out-point

Both land on sentence boundaries — a clip starting mid-clause reads as broken, not urgent.

**Cut in late.** The strongest 1.5 seconds is almost never where the thought started.
Speakers run up to a claim: "So, yeah, I mean, I think the interesting thing here, and this
is something we talked about before, is that..." — the clip starts at the word after "is
that". Delete leading `so`, `yeah`, `I mean`, `right`, `you know`, `look`, `I think`,
`basically`, `kind of`, and any clause that positions the statement instead of making it.

**Top and tail.** Head: first stressed syllable of the thesis sentence, minus 0.3–0.5s of
room tone so the first word is not clipped. Tail: last word of the payoff, plus 0.4s. Cut
the trailing "...you know?" and the other person's "yeah, totally" — agreement after the
payoff drains it.

**The lift.** If the strongest line arrives 40 seconds into an otherwise good segment, lift
it to the front as a hard cold open, then jump to the segment start. Mark it as
`LIFT @ mm:ss` so the editor knows the clip is non-linear. Do not lift a line whose meaning
changes when it moves — check the pronouns. And if you cannot name the first four words of
the clip, the in-point is not set yet.

### 5. Assign a destination and trim to length

Match natural length to destination rather than stretching or crushing it. Full
per-platform length, aspect, safe area, caption and pacing rules are in
`references/destination-specs.md`.

| Destination | Length | The constraint that governs the edit |
| --- | --- | --- |
| Shorts / Reels / TikTok | 20–60s | The payoff must be **promised in the first 2 seconds** |
| LinkedIn native | 45–90s | Plays muted by default — captions carry it |
| X | 30–140s | Autoplay muted, and the reply context does some of the framing |
| YouTube chapter | 3–8 min | Needs a full arc, not a moment |

A 25-second contrarian claim is a Short. Do not pad it to 90 seconds — cut a different
segment for LinkedIn.

### 6. Write the cold-open line

One line, spoken in the clip, occupying the first 1.5–2 seconds. It promises the payoff,
and it is quoted, not written. Test it alone: does it make someone want the next sentence,
and is the thing it implies actually delivered before the out-point? If either answer is
no, move the in-point or drop the clip.

### 7. Titles, hooks and the caption's first line

**Quote the segment. Do not describe it.** A title must contain at least three consecutive
words the speaker actually said. "An interesting perspective on hiring" is written by
someone who did not listen; "We stopped hiring senior people entirely" is the clip. Three
title options per clip:

1. **The pull quote** — the strongest clause, verbatim, trimmed to fit
2. **Claim plus stake** — the claim, then who it costs something
3. **The question the clip answers** — only when the clip genuinely answers it

**Do not promise what the clip does not pay off.** The reason is retention economics, not
manners. Shorts, Reels and TikTok rank on watch-through and average view duration far more
than on the tap. A title with a high tap rate and a collapse at four seconds scores worse
than a modest title that plays to the end, and on most of these systems that
under-performance follows the account into the next upload. Overclaiming buys the cheapest
metric with the expensive one — a bad trade before it is a bad look.

The check: could the person in the clip read the title and say "I did say that"?

**Caption first line** — survives truncation at roughly 100 characters, does not restate
the title, and is never "Full episode in bio". It either adds the one piece of context the
clip deliberately left out, or takes a position on the claim.

### 8. Ship the cut list, then hand off for the footage pass

Output one row per clip:

| In | Out | Dur | Score | Destination | Cold open | Titles | Caption line 1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 00:14:22.4 | 00:15:09.1 | 46.7s | 11/12 | Reels, LinkedIn | "We stopped hiring senior people entirely" | 3 options | one line |

Then state the footage pass explicitly. The editor checks what you could not see: is the
framing usable in 9:16, does the audio clip, is anyone off-camera at the in-point, is there
a cough or crosstalk over the key line, does the expression match the claim, is the claim
safe to publish. Anything that fails comes off the list. That is the system working.

## Presentation

Rank the table by score, one line of reasoning per clip. Editors work from cut lists, not
essays. Say how many candidates you screened and how many cleared — "nine clips from 62
marked moments" tells someone the filter ran; nine with no denominator does not.

For anything on the rework list, name the single axis holding it back and what would fix
it. "Payoff scores 1 — the answer arrives 30 seconds after the natural out-point" is
actionable. "Could be stronger" is not.

## Limits of the method

- **The score is not a view forecast.** It measures whether a clip is comprehensible and
  complete standing alone — a precondition for retention, not a cause of it. Nothing in a
  transcript predicts performance, and a number that claims to is worth nothing.
- **Budget for a substantial fraction — assume around a third — of threshold-clearing
  clips failing the footage pass**,
  for reasons invisible in text. Budget for that rather than treating it as an error.
- **Delivery is not in the text.** A flat reading of a brilliant line and a brilliant
  reading of a flat line look identical on the page — the largest single source of both
  false positives and false negatives.
- **You cannot verify claims.** A specific number is a strong archetype and a liability at
  once. Flag every factual claim for checking before it goes out under the account's name.
- **Timecodes are approximate.** Every in/out is within about a second, not frame-accurate.
- **Rights, clearance and guest approval are out of scope**, including a guest who agreed
  to an episode but not to one sentence lifted out of it.

## References

- `references/clip-scoring.md` — the rubric, disqualifiers, worked scored examples
- `references/moment-archetypes.md` — the seven archetypes, with transcript-level tells
- `references/destination-specs.md` — length, aspect, safe areas, captions, pacing
