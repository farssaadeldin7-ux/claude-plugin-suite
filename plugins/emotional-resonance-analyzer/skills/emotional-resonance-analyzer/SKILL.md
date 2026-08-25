---
name: emotional-resonance-analyzer
description: >
  This skill should be used when an editor or film-maker wants to know where a cut loses
  the audience and why — "why does my documentary sag in the middle", "the second act
  drags and I can't work out why", "where are people dropping off in this cut", "review
  the pacing of my paper edit", "map the emotional arc of this film", "my retention graph
  falls off a cliff at four minutes, what's happening there", "is this too long for a
  branded piece", "which scene should I cut", "the ending feels flat", "check the
  structure of this timecoded transcript". Also use it for planning a structure before
  the assembly, for choosing between two versions of a cut, and for interpreting a real
  retention curve against the shape of the edit.
metadata:
  version: "0.1.0"
---

# Emotional Resonance Analyzer

Map the emotional arc of a cut against the attention the chosen form expects, so an
editor can see where the film loses people and why.

**This measures structure, not feeling.** There is no audience here and no biometric
signal. Nothing in this skill senses emotion, and it cannot tell you how anyone felt.
What it produces is a modelled arc, derived from craft variables known to correlate with
sustained attention — scene length, information density, stakes clarity,
question-and-answer spacing, tonal variance, cut rhythm — evaluated against the
conventions of the form you name. It reads the edit the way a script editor reads a
script. Every output is a hypothesis about the cut, testable by watching the cut.

## The one rule

**Ask for real retention data first, and where it exists the curve wins.**

If the film has been posted anywhere that reports audience retention — YouTube,
Vimeo, a Wistia embed, an internal player, a test screening with dial data — ask for
it before you analyse anything. Real data on a real audience outranks any model,
always, including when the model disagrees loudly.

Where a curve exists, the job changes. You are no longer estimating where attention
drops; you are explaining a drop that has already been measured. That is a better job
and a more honest one. The model becomes the diagnostic vocabulary, not the finding.

Where no curve exists, say so once, plainly, in the output: this is a structural
reading, not a measurement. Then get on with it.

## Sequence

### 1. Collect the inputs

| Input | Why it matters | If missing |
| --- | --- | --- |
| Paper edit or timecoded transcript | Every flag must anchor to a timecode | Cannot proceed — ask for it |
| Intended form and target length | Sets the entire attention convention | Ask; do not assume |
| Intended venue and viewing context | Festival, feed, client boardroom, broadcast slot | Ask; changes the thresholds |
| Real retention curve | Overrides the model | Say so in the output |
| Who the film is for | Prior interest changes tolerance for slow openings | Ask |

A transcript without timecodes is workable but weak. Say that the analysis will be
ordinal rather than temporal, and that every duration-based tell is unavailable.

### 2. Fix the form before you judge anything

A 90-second stretch of ambient observation is a defect in a YouTube long-form opening
and a virtue in a feature doc's second act. There is no form-neutral pacing judgement.

Pull the attention shape, the expected beats and the typical departure points for the
stated form from `references/form-conventions.md`. State which form you are judging
against, at the top of the output, before any finding.

### 3. Score the scenes

Break the edit into scenes or beats and score each on valence (−3 to +3) and intensity
(0 to 5), with duration and a one-line description. The anchors, the definition of a
scene boundary and a worked 12-scene example are in `references/arc-scoring.md`.

Score the scene as cut, not as intended. What is on the timeline is the film.

### 4. Build the question-and-answer ledger

This is the single most useful artefact the skill produces. Build it before you form
any opinion about pacing.

Log every question the film opens, where it opens, where it closes and how. A question
is anything the viewer is waiting to find out: will she get the money back, what is in
the box, why did the town vote that way, does he know yet.

| Symptom | Reading |
| --- | --- |
| Question open at the end credits | Unsatisfying, unless deliberately ambiguous and earned |
| Central question closed before the two-thirds mark | Premature resolution — the pull is gone |
| No question open for a stretch longer than 90 seconds | Dead air, whatever else is happening |
| More than four questions open at once | Load, not intrigue — the viewer stops tracking |
| A question closed off-screen, never acknowledged | Reads as a plot hole even in non-fiction |

The ledger format is in `references/arc-scoring.md`. Reproduce it in full in the output
even when it is long. Editors use this directly.

### 5. Run the five drop-off tells

Each of the five diagnosable causes has a structural tell you can check mechanically
against the scored table. Full definitions, worked examples and the standard fix for
each are in `references/dropoff-causes.md`.

| Cause | Structural tell | Threshold |
| --- | --- | --- |
| No question open | Consecutive scenes that only deliver information | 3 in a row, or any 90-second stretch with nothing open — whichever trips first |
| Stakes not personalised | Subject is a topic, not a person | over 90 seconds |
| Tonal monotony | No valence change | across 5 minutes |
| Premature resolution | Central question answered early | before the 2/3 mark |
| Texture starvation | Uninterrupted talking head, no cutaway or shift | beyond 40 seconds |

Check all five across the whole timeline. Report the timecode range of every stretch
that trips a tell, and name the cause. Do not soften a tripped tell because the
material is strong — the tell is about structure, and strong material has bored
audiences before.

Where two causes overlap on the same stretch, report both and raise its priority.
Overlapping tells are where films actually die.

### 6. Read the derivative, not the level

Plot valence and intensity as a text table across the timeline, then look at the rate
of change. **Flat stretches are the problem, not low stretches.**

A sustained −2 with movement in it holds attention; a flat +1 for six minutes does not.
Grief that deepens is watchable, contentment that never varies is not. When you report a
monotony flag, quote the two scores at either end of the flat stretch to show the absence
of movement, rather than asserting that a section feels slow. Intensity behaves the same
way: a film that sits at intensity 3 for its whole middle has no middle.

### 7. Reconcile with the real curve

If a retention curve exists, overlay it. Then classify each drop:

- **Explained** — the drop lands on or just after a tripped tell. Say which cause, and
  hand the editor the fix.
- **Unexplained** — a real drop with no structural tell. Say so directly. This is
  usually performance, music, sound, grade or a shot that does not work, and this skill
  cannot see any of those. Point the editor at the moment and let them watch it.
- **Model-only** — a tell with no drop in the data. The model was wrong here. Say that
  too, and drop it down the ranking.

Never adjust the model's flags to fit the curve retrospectively and present the result
as agreement.

### 8. Rank the three highest-leverage cuts

Rank by exposed run-time recovered per unit of edit effort. Define effort explicitly:

| Effort | Meaning |
| --- | --- |
| 1 | Any change inside one scene using material already in the project — trim, split, cutaway; no assembly ripple, no new material |
| 2 | Reorder or lift a whole scene; ripple through the assembly |
| 3 | Needs new material, a reshoot, a rewrite of narration, or a rescore |

"Minutes recovered" is the run-time currently sitting under a flag, not a predicted
gain in watch time. Say that in the output, in those words or close to them. Never
convert it into a retention percentage.

Give exactly three. A ranked list of eleven changes is a way of not having an opinion.

## Output

1. The form being judged against, and whether real retention data was supplied
2. Annotated timeline — every scene, with flagged stretches marked by cause and timecode
3. The question-and-answer ledger, in full
4. The valence and intensity plot as a text table
5. The three highest-leverage cuts, ranked, each with effort rating and exposed run-time
6. A short honest-limits note

## What this skill cannot do

Say these plainly whenever they are relevant, rather than at the end as boilerplate.

- **It cannot measure emotion.** No audience, no biometrics, no sentiment reading of a
  face. A modelled arc is not a felt arc.
- **It will not give a predicted retention percentage.** Any number of that kind would
  be invented. Refuse the request and explain why.
- **It cannot judge performance.** Whether a contributor is compelling on camera
  routinely decides whether a scene works, and nothing here sees it.
- **It cannot hear music, sound design or silence.** A needle drop can rescue a flat
  stretch that this model flags, and a bad score can sink a well-structured one.
- **It cannot see the pictures.** Colour, composition, whether a shot is beautiful,
  whether an edit point lands cleanly on a movement — all invisible here.
- **It does not know your audience.** A committed audience for a niche subject tolerates
  structures a general feed audience abandons in fifteen seconds.

When an editor asks a question that lands in this list, say the tool cannot answer it,
say what would answer it — a test screening, a retention curve, another pair of eyes in
the room — and stop. Do not produce a confident structural answer to a question about
whether a scene is moving.

## References

- `references/dropoff-causes.md` — the five causes, their tells, the standard fix for
  each, and worked examples
- `references/form-conventions.md` — attention shape, expected beats and typical
  departure points for each form
- `references/arc-scoring.md` — valence and intensity anchors, the Q&A ledger format,
  and a fully worked 12-scene example
