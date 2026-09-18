# Corpus curation

The corpus is the whole product. A carefully extracted profile from a badly chosen corpus is a
precise description of the wrong style.

## Size

**15 to 40 pieces.**

| Corpus size | What happens |
| --- | --- |
| Under 10 | The profile over-fits. Two pieces sharing an accident become a rule. Do not report dimension values as settled |
| 10-14 | Workable for a single medium if the pieces are recent and consistent. Mark every dimension provisional |
| 15-40 | The useful range. Regularities separate from accidents; absences become credible |
| Over 40 | Diminishing returns, and older work drags the profile toward who the director used to be. Trim by date before adding |

If a director insists on 60 pieces, take the most recent 30 and set the rest aside as an
archive to check the profile against later. Do not refuse; explain the ageing effect.

## Inclusion rules

1. **Only work they would show a client today.** The corpus sets a standard. Work they are
   fond of but would not show does not belong.
2. **Owned or licensed.** See the rights checklist in `drift-and-governance.md`. No ownership,
   no inclusion.
3. **Recent enough to be current.** Prefer the last three to five years. A style from ten years
   ago is someone else's.
4. **Spread across brief types**, so the profile does not encode one client's product.
5. **Two or three near-misses**, deliberately chosen and clearly labelled.

## Exclusion rules

| Exclude | Why |
| --- | --- |
| Work heavily shaped by a client's brand guidelines | Encodes the client's colour system and type stack, not the director's. If guidelines drove more than roughly a third of the decisions, leave it out |
| Work-for-hire the director does not own | Rights, and it usually falls foul of the rule above as well |
| Collaborations where someone else led | You cannot separate the two hands after the fact |
| Pitch work that was never made | Unresolved, and usually over-styled |
| Personal experiments in an unrelated medium | Interesting, and noise for this purpose |
| Anything from another person's portfolio | Out of scope. Refuse |

### The brand-guidelines rule is the one that gets argued

Directors resist it because their best-paid work is often their most constrained. The test is
not whether the work is good, it is whether the decisions were theirs. Ask: if the client's
guidelines had said something different, would this piece look different? If yes, and in more
than a couple of dimensions, it belongs in the archive, not the corpus.

A useful middle path: include the piece but exclude the dimensions the guidelines governed.
A film made in a mandated palette can still contribute its cadence, framing and cut logic.
Record that in the label.

## Labelling schema

One line per piece, with these fields.

| Field | Values |
| --- | --- |
| `id` | Short name you can cite in the profile |
| `brief` | One sentence — what was asked for |
| `medium` | film, stills, identity, editorial, campaign, longform, script |
| `year` | Four digits |
| `landed` | `landed`, `mixed`, `near-miss` |
| `constraints` | `none`, `light`, `heavy` — how much a client's guidelines shaped it |
| `contributes` | `all`, or a list of dimensions if the piece is partial |
| `note` | Only for near-misses: one sentence on what is wrong with it |

`landed` and `mixed` record how the work performed against the brief, not its quality.
`near-miss` is the exception: it records style distance — a piece that is almost the
author's voice and not quite, however it performed against the brief. A piece can
be exemplary and have landed badly. Keep both facts.

## Worked curation: a 20-piece corpus

A freelance creative director working in brand film and editorial stills. Started with 34
candidate pieces.

| id | brief | medium | year | landed | constraints | note |
| --- | --- | --- | --- | --- | --- | --- |
| harbour-film | Founder story for a boatbuilder | film | 2024 | landed | none | |
| harbour-stills | Stills set from the same shoot | stills | 2024 | landed | none | |
| tannery | Process film, leather workshop | film | 2024 | landed | light | |
| coldstore | Recruitment film, logistics | film | 2023 | mixed | light | |
| almanac-01 | Editorial spread, food quarterly | editorial | 2024 | landed | none | |
| almanac-02 | Editorial spread, same title | editorial | 2024 | landed | none | |
| almanac-cover | Cover for the same title | editorial | 2023 | landed | none | |
| quarry | Long-exposure landscape series | stills | 2023 | landed | none | |
| quarry-essay | 1,800-word accompanying essay | longform | 2023 | landed | none | |
| bellweather | Identity for a small distillery | identity | 2023 | landed | none | |
| bellweather-film | Launch film for the same | film | 2023 | mixed | none | |
| nightshift | Portrait series, hospital staff | stills | 2022 | landed | none | |
| nightshift-text | Captions and short essay | longform | 2022 | landed | none | |
| ferrous | Product film, tool manufacturer | film | 2024 | landed | heavy | contributes: cadence, cut logic, framing only |
| saltmarsh | Self-initiated short | film | 2022 | mixed | none | |
| ledger | Annual report photography | stills | 2023 | landed | light | |
| pilot-script | Script for an unmade series | script | 2024 | landed | none | |
| verge | Campaign stills, cycling brand | stills | 2022 | near-miss | none | Over-lit and over-saturated. Client pushed for reach and the palette discipline went |
| chorus | Charity film | film | 2023 | near-miss | light | Sentimental score, cuts land on the music. Everything else does the opposite |
| foundry-copy | Web copy, metalwork studio | longform | 2024 | near-miss | none | Three rhetorical questions in 600 words. Reads like a different writer |

### What was excluded, and why

- **Six pieces for a telecoms client** — heavy brand guidelines across palette, type and grade.
  Would have pulled the palette dimension toward a corporate blue that appears nowhere else.
- **Four pieces from 2016-2018** — pre-date a clear change in the director's framing and grade.
  Kept as an archive to test the profile against, not as input.
- **Two collaborations** with a co-director. Attribution is not separable.
- **Two unmade pitches**, over-styled and never tested.

### What the three near-misses bought

They produced five never entries that the seventeen good pieces could not have:

1. Never let an accent colour exceed roughly 12% of frame area, even for reach.
2. Never cut on a musical beat.
3. Never use a score that states the emotion the picture is already carrying.
4. Never open written work with a rhetorical question.
5. Never use more than one rhetorical device per 600 words.

That is the argument for near-misses in one table. The centre of a corpus tells you what the
work is; the boundary tells you where it stops being theirs.

## Before extraction, confirm

- Every piece is owned or licensed, and that has been stated aloud, not assumed
- The `heavy` constraint pieces have a `contributes` list, or are out
- At least two near-misses are present and labelled
- The date range is written down and the median year is recent
- The director has seen the final list and agreed it is a fair representation
