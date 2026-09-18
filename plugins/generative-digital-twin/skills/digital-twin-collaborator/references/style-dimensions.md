# Style dimensions

The taxonomy, and how to get each value out of a corpus rather than out of a conversation.

Two rules apply to every dimension below.

**Measure, do not ask.** The director's account of their own style is a hypothesis. The corpus
is the evidence. Where they disagree, report the count and let them decide which one to keep.

**Every entry must be checkable.** If you cannot look at a draft and say whether it satisfies
the entry, the entry is decoration. Write numbers, ratios, counts and prohibitions.

## Visual work

| Dimension | What to measure | How to extract | Checkable entry looks like |
| --- | --- | --- | --- |
| Composition and negative space | Ratio of empty to occupied area; where the subject sits on the frame; whether the frame is ever centred | Sample 10 pieces, estimate empty area to the nearest 10%, mark subject position on a 3x3 grid | "40-60% negative space; subject on a third, never centred; weight low-left in 14 of 20" |
| Palette discipline | Number of distinct hues per piece; accent share; whether neutrals carry the piece | Pull a 5-swatch average from each piece, count hues over 5% of area | "Two neutrals plus one accent; accent never above 12% of area; no gradient over three stops" |
| Contrast and value structure | Distance between darkest and lightest value; whether midtones dominate; where the eye lands first | Desaturate each piece and read the histogram shape — bimodal, midtone-heavy, or high-key | "Midtone-heavy, no true black; highlight roll-off soft; 3-stop working range" |
| Type system | Families, weights, sizes per layout; alignment; case; tracking at display size | Count distinct type styles per piece and take the median | "One grotesque, two weights, max three sizes; left-aligned; sentence case; negative tracking above 48pt" |
| Texture and grain | Presence and coarseness of grain, paper, noise, halation; whether surfaces are ever perfectly clean | Zoom to 200% on a flat area in each piece and note what is there | "Fine grain on every image; no perfectly flat fills; slight halation on highlights" |
| Subject distance | Framing distance across the corpus, and whether it varies with brief | Bucket each image: wide, medium, close, macro. Count | "Medium and close, 17 of 20; one wide per sequence at most; never macro" |
| Motion cadence | Average shot length, cut rhythm, camera movement, relation of cut to music | Time 10 cuts per film; note whether the camera is locked, handheld or motorised | "Average shot 4.5s; never under 1s; locked-off or slow dolly only; cuts land off the beat" |

### Extraction order for visual corpora

Do palette, value and composition first. They are the fastest to read, the most consistent
across a body of work, and they carry most of the recognisability. Type and texture come next.
Subject distance is often brief-driven rather than style-driven, so check whether it varies
with the client before treating it as a style rule.

## Written work

| Dimension | What to measure | How to extract | Checkable entry looks like |
| --- | --- | --- | --- |
| Sentence length distribution | Median length; share over 30 words; shortest sentence; whether short sentences cluster | Word-count every sentence in 3,000 words of corpus and take the distribution, not the mean | "Median 14 words; 8% over 30; at least one under 6 per paragraph" |
| Register | Contractions, first or second person, jargon tolerance, hedging density, profanity | Count contractions per 500 words; count hedges ("perhaps", "arguably", "somewhat") | "Contractions throughout; second person; under 2 hedges per 500 words; no jargon without a gloss" |
| Metaphor density | Figurative expressions per 500 words, and which domains they are drawn from | Mark every metaphor and simile in 2,000 words; note the source domains | "3-5 per 500 words, drawn from craft and building; never sport, never war" |
| Opening move | What the first sentence does — scene, claim, number, anecdote, refusal, direct address | Read only the first two sentences of every piece, in a list, and classify | "Opens on a concrete scene or a flat claim; never a question; never a definition" |
| Closing move | What the last paragraph does — return, widen, instruct, undercut, stop abruptly | Read only the last paragraph of every piece and classify | "Returns to the opening image, then stops; never summarises; never a call to action" |
| Refusals | What the writing consistently will not do | Look for absences: no exclamation marks, no rhetorical questions, no lists of three | "No rhetorical questions; no rule of three; no em-dash asides over one per 500 words" |
| Paragraph shape | Lines per paragraph; whether single-line paragraphs are used, and for what | Count paragraph lengths across 10 pieces | "2-5 sentences; single-line paragraphs used only for a turn, roughly one per 800 words" |

### The distribution matters more than the average

A writer with a median of 14 words and a quarter of sentences over 25 reads nothing like a
writer with a flat 14-word median. Record the spread. "Varied sentence length" is the single
most common useless entry in a style profile.

## Motion and time-based work

| Dimension | What to measure | How to extract |
| --- | --- | --- |
| Shot length | Mean and shortest shot; whether length varies by act | Time every cut in two full pieces |
| Cut logic | Cut on action, on dialogue, on beat, or on nothing | Watch 20 cuts and classify each |
| Camera behaviour | Locked, handheld, dolly, crane, drone; how much movement per shot | Note the dominant mode per shot across two pieces |
| Sound relation | Whether picture follows music or music follows picture; use of silence | Mark every point where sound leads the cut |
| Title and text treatment | When titles appear, how long they hold, whether they animate | Log every text event with in and out timings |
| Grade | Where the shadows sit, whether skin is warmer or cooler than surround | Sample three frames per piece |

## Weighting

Not all dimensions matter equally. After extraction, ask the director to pick the **five they
would notice first in a bad draft**. Those get the highest weight in the prompt preamble and in
the scoring pass. In most visual corpora it is palette, negative space, value structure, type
and grain. In most written corpora it is opening move, sentence distribution, register and
metaphor domain.

Record the weighting in the profile. It is what makes the score mean something, and it is the
first thing to revisit at re-audit.

## Dimensions that usually turn out to be brief-driven

Check these against the client rather than the director before encoding them: subject matter,
format and aspect ratio, length, colour where the client owns a brand colour, and language
level. A dimension that varies with the client is not a style rule, it is a constraint the
director works inside — and encoding it will make the apprentice wrong on the next brief.
