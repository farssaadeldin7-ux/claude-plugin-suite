# Podcast & Video Studio

Turns a long recording into a scored cut list: which moments earn a clip, where each one
starts and ends, where it goes, and what it is called.

Part of a 14-plugin suite. This one is a pure skill — no MCP server, no external calls.

## What it does

The amateur clips the moment that felt good in the room. The practitioner clips the moment
that still works for a stranger holding a phone. This plugin enforces the second habit.

- A four-axis clip-worthiness rubric scored 0–3 each, with a publish threshold and a set of
  hard disqualifiers applied before scoring
- Seven moment archetypes that reliably travel, each with the transcript-level tells that
  let you find them by scanning rather than by re-listening
- Cold-open construction: cut in late, top and tail, and mark non-linear lifts for the editor
- Length, aspect, safe-area, caption and pacing rules per destination
- Titles and hooks built from the segment's own words, with an anti-overclaiming rule
  argued on retention economics rather than on manners
- Output as a cut list an editor can work from: timecode in/out, score, destination,
  cold-open line, three title options, caption first line

## Who it is for

Content agencies cutting client episodes at volume, and solo creators repurposing their own.

**The skill you must bring is content strategy.** The plugin will tell you which segments
are structurally clippable. It cannot tell you which of them are worth your audience's
attention, which claims your brand can stand behind, or which hooks are worth feeding it in
the first place. Point it at the right recording and it saves hours; point it at a bad
recording and it will faithfully score forty bad moments.

## Components

| Component | Purpose |
| --- | --- |
| Skill `podcast-video-studio` | The eight-step procedure, from transcript to cut list |
| `references/clip-scoring.md` | Rubric, band descriptors, disqualifiers, worked examples |
| `references/moment-archetypes.md` | The seven archetypes and how to spot each in text |
| `references/destination-specs.md` | Per-platform length, aspect, safe areas, captions, pacing |

## Requirements

A transcript with timecodes at sentence level or finer, speaker labels, and verbatim text.
Any ASR output with word or sentence timings works. A tidied transcript with no timecodes
is not enough — the skill will say so rather than guessing at in-points.

## Free and paid

Everything here is free. There are no gated tools, no usage counter and no licence key,
because there is no server to gate: the skill and its references run entirely inside the
conversation, and no part of your recording leaves the machine on this plugin's account.

## What this is not

- **It is not a view predictor.** The score measures whether a clip is comprehensible and
  complete standing alone. That is a precondition for retention, not a cause of it. Nothing
  in a transcript predicts performance.
- **It does not watch the footage.** It reads language and structure — not audio energy,
  laughter, timing, expression, framing or audio quality. A human pass on the actual
  footage is required before anything is published; budget for a substantial fraction —
  assume around a third — of threshold-clearing clips failing that pass for reasons
  invisible in text.
- **It is not an editor.** It produces a cut list, not a rendered file. Timecodes come from
  ASR and drift by around a second.
- **It does not fact-check.** Specific numbers make strong clips and carry real liability.
  Every factual claim is flagged for someone to source.
- **It does not handle rights, music clearance or guest approval**, and a guest who agreed
  to an episode has not agreed to a clip of one sentence from it.

## The skill you bring

**Content Strategy.** Identify the high-retention hooks yourself — the tool ranks and cuts what it is told to prioritise, and it is only as good as those segments.

## Plans

Pricing is defined in the suite catalog for when this plugin's tool server ships:
pro $40/month (2 seats) and team $70/month (10 seats), with a 14-day single-seat
trial. Until the server exists, the skill content is open and nothing is gated.
