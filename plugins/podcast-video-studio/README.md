# Podcast & Video Studio

Turns a long recording into a scored cut list: which moments earn a clip, where each one
starts and ends, where it goes, and what it is called.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

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
| Skill `auto-clip` | Automatically clips the most engaging ≤60s segments and formats them for TikTok/Reels/Shorts |
| MCP server | Archetype tell scan, rubric arithmetic, destination bands, clip log, licensing |

### Tools

**Open** — no licence needed, enough to inspect the method before buying

- `moment_archetypes` — the seven archetypes, their tells and best-fit destinations
- `scoring_rubric` — the four axes, disqualifiers, thresholds and worked examples
- `destination_specs` — length, aspect, safe areas, captions and pacing per destination

**Licensed** — requires a pro or team key

- `scan_candidates` — find the archetype tells in a transcript, with evidence quoted and timecodes attached
- `score_clip` — the rubric applied mechanically: disqualifiers, thresholds, the terminal premise rule, destination fit by length
- `log_clip` / `record_footage_pass` / `review_clips` — the local clip log that turns the assumed one-third footage-pass failure rate into your own measured count

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

The server is deterministic throughout: it matches literal tells, does threshold
arithmetic and counts outcomes. It never assigns the four axis scores, never judges a
moment and never predicts views — that split is the design, not a gap.

## Requirements

A transcript with timecodes at sentence level or finer, speaker labels, and verbatim text.
Any ASR output with word or sentence timings works. A tidied transcript with no timecodes
is not enough — the skill will say so rather than guessing at in-points.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan from the pricing page (or with `start_checkout` from inside a
conversation) and paste the key — it will be stored at
`~/.config/plugin-suite/podcast-video-studio.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export PODCAST_VIDEO_STUDIO_LICENSE_KEY=PS-PVS-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-PVS-...
```

## Free and paid

The skill content and the three browsing tools are free — the whole method can be read
and inspected before buying. A licence gates the compute and the history: the transcript
scan, the threshold arithmetic and the clip log.

The server runs locally over stdio, so no part of your recording leaves the machine.
The clip log is written only to `~/.config/plugin-suite/podcast-video-studio-clips.json`;
the billing service sees a licence key, a plugin id and a hashed device identifier — never
a transcript.

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

Served by `services/billing` in this repo; the catalog lives in its `catalog.js`:
pro $40/month (2 seats) and team $70/month (10 seats). Both plans include the same
tools — the licence gates `scan_candidates`, `score_clip` and the clip log
(`log_clip`, `record_footage_pass`, `review_clips`); the skill content and the
browsing tools stay open.
