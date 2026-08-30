---
name: auto-clip
description: >
  This skill should be used when someone wants the most engaging short clips pulled out of
  an episode automatically — "clip this episode for TikTok", "find the best 60 seconds",
  "turn this podcast into Shorts", "cut this into Reels", "auto-clip this interview",
  "what should I post from this episode", "make vertical clips from this recording".
  Also use it for formatting chosen segments for TikTok, Reels and Shorts — vertical
  framing, captions, hook text and safe areas — and for writing the on-screen hook and
  caption for each clip.
metadata:
  version: "0.1.0"
---

# Auto-Clip

Automatically clips the most engaging 60-second segments of an episode and formats them
for TikTok/Reels/Shorts.

Given a transcript (timecoded, ideally with speaker labels), this skill finds the
segments most likely to hold a cold viewer for a full minute, cuts each to its strongest
60 seconds or less, and outputs everything an editor needs to ship it vertical: in/out
timecodes, the hook that occupies the first two seconds, on-screen text, and a caption —
formatted to the specs TikTok, Reels and Shorts share.

## The one rule

**Every clip must work for a viewer who has never heard of the show.** No context from
the rest of the episode, no knowing who the guest is, no previous sentence. A segment
that needs setup is not a clip, however good it was in the room — cut a different one.

## Sequence

### 1. Ingest the episode

Take a timecoded transcript (sentence-level or finer; speaker labels preferred). If the
transcript has no timecodes, say so and stop — every cut point would be a guess. Treat
ASR timecodes as approximate (±1s); every output timecode is the editor's starting
point, not a frame-accurate edit.

### 2. Find the engaging segments automatically

Scan the full transcript and mark every segment with the surface signals that predict a
watchable minute:

- **A strong claim stated plainly** — contrarian, costly, or checkable ("we stopped
  hiring senior people entirely")
- **A number that surprises** — specific, not rounded, with stakes attached
- **A story with a turn** — setup, reversal, and payoff inside the segment
- **Live disagreement or a "wait, say that again" moment** between speakers
- **A how-to compressed to steps** — a complete, usable answer in under a minute
- **An emotional spike readable in the text** — laughter markers, emphasis, confession

Over-collect: mark three to four times as many candidates as you expect to ship, then
keep only the segments where the payoff lands **inside** the clip. Rank the survivors
by how self-contained they are and how early the tension arrives.

### 3. Cut each to its best 60 seconds

Target 20–60 seconds; never over 60 — that is the ceiling the three platforms share for
their core feed treatment.

- **Cut in late.** Start at the thesis sentence, not the run-up. Strip leading "so",
  "yeah", "I mean", "I think", and any clause that positions the statement instead of
  making it.
- **Hook in the first 2 seconds.** The clip's strongest line, or the promise of it, must
  occupy seconds 0–2. If the best line arrives late, lift it to the front as a cold open
  and mark it `LIFT @ mm:ss` so the editor knows the clip is non-linear.
- **Cut out on the payoff.** End on the last word that lands, plus ~0.4s. Trim trailing
  agreement ("yeah, totally") — it drains the ending.
- Both cut points land on sentence boundaries; a clip that starts mid-clause reads as
  broken, not urgent.

### 4. Format for TikTok / Reels / Shorts

Apply the shared vertical spec to every clip:

| Element | Spec |
| --- | --- |
| Aspect | 9:16, 1080×1920 |
| Length | 20–60s; the whole clip earns its runtime or gets shorter |
| Hook text | On-screen in the first 2 seconds, quoted from the clip, ≤8 words |
| Captions | Burned-in, word- or phrase-timed; assume muted autoplay |
| Safe areas | Keep text out of the top ~15% and bottom ~25% (UI overlays); nothing critical in the right rail |
| Pacing | A visual or caption change every 2–3 seconds; no static stretch over 4s |

Platform nuances worth flagging per clip: TikTok rewards native-feeling rough cuts and
punishes visible watermarks from other apps; Reels favors clean captions and reshares;
Shorts feeds retention back into the main channel, so the hook matters even more than
the topic.

### 5. Write the hook and caption

For each clip:

1. **On-screen hook** — the strongest clause, verbatim, trimmed to ≤8 words. Quote the
   speaker; do not describe them. "An interesting take on hiring" is a description;
   "We stopped hiring senior people" is a hook.
2. **Caption first line** — survives truncation around 100 characters, adds the one
   piece of context the clip left out or takes a position on the claim. Never "full
   episode at the link".
3. **Never promise what the clip does not pay off.** These platforms rank on
   watch-through; an overclaiming hook that collapses at four seconds scores worse than
   a modest one that plays to the end, and the damage follows the account.

### 6. Ship the clip list

One row per clip, ranked by strength:

| In | Out | Dur | Destination | On-screen hook | Caption line 1 | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 00:14:22 | 00:15:08 | 46s | TikTok/Reels/Shorts | "We stopped hiring senior people" | one line | LIFT @ 14:51 |

Say how many segments were screened and how many made the list — "six clips from 54
marked moments" tells the user the filter ran. Then state the footage pass: a human
checks each clip against the actual video before publishing — framing in 9:16, audio
quality, whether the speaker is on camera at the in-point, whether the claim is safe to
publish. Anything that fails comes off the list.

## Limits of the method

- **Engagement is inferred from text.** Delivery, energy, facial expression and audio
  quality are invisible in a transcript; expect a share of clips to fail the footage
  pass for reasons the text could not show.
- **No view forecasts.** The ranking orders clips by structural strength; it does not
  predict numbers, and any number it produced would be invented.
- **Timecodes are approximate**, not frame-accurate.
- **Claims are not verified.** A surprising statistic is a strong clip and a liability
  at once — flag factual claims for checking before they ship under the account's name.
- **Rights and guest approval are out of scope**, including a guest who agreed to the
  episode but not to one sentence lifted out of it.
