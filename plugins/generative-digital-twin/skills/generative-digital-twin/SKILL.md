---
name: generative-digital-twin
description: >
  This skill should be used when a creative director, designer, writer or studio head wants
  generative output to come back in their own voice rather than a generic one — "make it write
  like me", "train an AI on my own work", "build a style guide from my portfolio", "the drafts
  all sound like everyone else", "capture my visual style", "why doesn't this look like our
  work", "set up a style profile for the studio", "critique this draft against my style",
  "our AI output has drifted", "score this against our house style". Also use it for auditing
  an existing style profile, for onboarding a junior to a studio's style, and for deciding what
  to disclose to a client about generative involvement.
metadata:
  version: "0.1.0"
---

# Generative Digital Twin

Build an explicit, written style profile from a director's own body of work, then use it to
brief and to grade generative output.

Be clear about what this is, because the name oversells it. There is no twin — nothing here
models a person, learns from them, or reproduces their judgement. It produces a **document**:
named, checkable style rules extracted from work the director has already made, plus a prompt
preamble derived from it and a scoring pass for drafts. The honest metaphor is an
**apprentice** — first drafts at a junior's quality, in roughly the right voice, to be directed
and corrected. It does not improve on its own; it improves when someone edits the profile. Say
so early. A director expecting a twin will be disappointed by an apprentice; one expecting an
apprentice gets real hours back.

## The one rule

**No profile ships without a "never" list.** A style is defined more by refusals than by
preferences. The positive half of any profile drifts toward the genre average — "warm",
"considered", "human", "cinematic" describe a thousand people. Refusals do not. "Never a
centred layout", "never a stock smile", "never open on a question", "never three adjectives in
a row" cannot be satisfied by generic output, and are the fastest lever for making a draft
recognisably theirs.

Target **12 to 20 never entries**. Below eight, output still reads as house-average with a
tint. If the director cannot produce them unprompted, extract them from the corpus by looking
for what is conspicuously absent.

## Sequence

### 1. Clear rights before you look at anything

A gate, not a formality. Ask three questions and get real answers.

| Question | If the answer is bad |
| --- | --- |
| Do you own this, or hold a licence covering reuse? | Exclude the piece |
| Was it work-for-hire? | Usually owned by the client. Exclude unless a clause says otherwise |
| Is any of this someone else's portfolio? | **Refuse.** Do not proceed |

A profile built on a third party's body of work is out of scope, including "a mix of mine and
people I admire" — decline, say why in one sentence, and offer their own corpus instead. Style
in general is not copyrightable; specific works are, and a corpus is made of specific works.
This is not legal advice. Full checklist in `references/drift-and-governance.md`.

### 2. Curate and label the corpus

**15 to 40 pieces.** Below 10 the profile over-fits to whatever happened to be included,
and 10 to 14 is workable but provisional; above
40 the marginal return falls and older work drags the profile toward who they used to be.

Three rules do most of the work; the full set, with a worked 20-piece example, is in
`references/corpus-curation.md`.

- **Only work they would show a client.** The corpus is a standard, not an archive.
- **Exclude work heavily shaped by a client's brand guidelines.** The rule people resist, and
  the one that matters most: a piece made inside someone else's colour system and type stack
  encodes the client's style, not the director's. If guidelines drove more than roughly a third
  of the decisions, leave it out.
- **Include two or three deliberate near-misses, labelled as such.** Work that is almost theirs
  and not quite. The boundary teaches more than the centre, and a profile of greatest hits
  cannot tell an apprentice where the edge is.

Label every piece with brief, medium, and how well it landed — `landed`, `mixed`, or
`near-miss`. Unlabelled corpora produce unweighted profiles.

### 3. Extract the positive dimensions

Work dimension by dimension, not impression by impression. The taxonomy and the extraction
method for each are in `references/style-dimensions.md`. Visual: composition and negative space, palette discipline, contrast and value structure, type
system, texture and grain, subject distance, motion cadence. Written: sentence length
distribution, register, metaphor density, how a piece opens, how it closes, what it refuses to do.

Every entry must be **checkable against a draft**. This is the difference between a profile
that works and a mood board with headings.

| Not this | This |
| --- | --- |
| "Restrained palette" | "Three hues maximum per frame; one saturated accent under 10% of area" |
| "Conversational" | "Median sentence 14 words; one under 6 per paragraph; contractions throughout" |
| "Bold type" | "One grotesque, two weights, never more than three sizes in a layout" |
| "Cinematic pacing" | "Average shot 4.5s; never a cut under 1s; no cut on a beat drop" |

Where the director's account and the corpus disagree, **the corpus wins**. People misremember
their own habits, usually toward who they want to be. Show the count and let them decide
whether to keep the habit or change it deliberately.

### 4. Write the never list

Derive it from three sources, in this order:

1. **Absences in the corpus.** What never appears across 20+ pieces is a rule, not a
   coincidence. No centred type in any of 22 pieces is a never.
2. **The near-misses.** Ask what is wrong with each — the answer is usually a never entry
   stated as a complaint.
3. **The director's own list.** Ask: what would make you reject a draft on sight?

Write each as an imperative prohibition with an observable trigger. "Never use stock imagery"
is checkable. "Avoid clichés" is not.

### 5. Assemble the style profile document

One file, sections in this order: **scope** (which media, which briefs); **never list**, first,
because it is the operative part; **dimensions**, each with its extracted value and one corpus
example cited by name; **anchors**, the three to five pieces that best represent the profile;
**boundary**, the near-misses with a sentence each on what is wrong; **provenance** — corpus
size, date range, ownership confirmed, date built; and a dated **changelog**. Version it: a
profile without a version cannot be audited for drift.

### 6. Derive the prompt preamble

The preamble is not the profile pasted in — a 2,000-word profile buries its own constraints and
the model averages them away. Compress to **300 to 600 words**, ordered: the never list complete
and verbatim; the five to seven highest-weight positive dimensions with their numbers; two short
excerpts or descriptions from anchor pieces; then the brief. Keep the never list uncut when
trimming for length. It does the work; the positive dimensions can be summarised.

### 7. Critique a draft: the scoring pass

Score the draft against each profile dimension, 0 to 4.

| Score | Meaning |
| --- | --- |
| 4 | Indistinguishable from corpus work on this dimension |
| 3 | In range. A reviewer would not stop on it |
| 2 | Plausible but generic — could be anyone working in this genre |
| 1 | Off-profile. A reviewer would notice and comment |
| 0 | Violates a never-list entry |

**Any 0 is a hard fail regardless of the total.** Report it first, name the entry it breached,
and do not average it away. A draft scoring 3.4 with one never-list breach is a reject, not a
strong draft with a note. Otherwise report the mean, the per-dimension scores, the two weakest
dimensions, and one specific correction for each, citing the draft when you criticise it. A
draft scoring 2 across the board is the generic-output signature: the preamble is not landing,
and polish will not fix it.

### 8. Feed corrections back

When the director corrects a draft, ask what rule the correction implies, and add it. Most
corrections are one of three things: a missing never entry, a dimension stated too vaguely to
check, or a one-off that should not be encoded at all. Ask which rather than assuming.
Corrections not written into the profile are lost — nothing here learns from being told twice.

### 9. Re-audit on schedule

**Every quarter, or every 20 outputs, whichever comes first.** Sample at least eight recent
outputs, score each against the profile, and compare per-dimension means to the baseline taken
when the profile was built. Flag any dimension whose mean has fallen by 1.0 or more, or where
40% or more of samples score 2 or below — that is regression toward house-average output.
Drift is usually the preamble being trimmed, the corpus ageing, or corrections never being fed
back; diagnose which before rewriting anything. Protocol and remedies in
`references/drift-and-governance.md`.

## The commercial application: the Junior-to-Senior Bridge

What this sells is standardised quality control. The profile turns senior taste into a
checkable document, and the scoring pass grades a draft against it before a senior ever
looks — so junior staff produce work that arrives at review already inside the house
style. Priced for a studio, that is the **Junior-to-Senior Bridge**: the cost of
senior-level oversight is senior hours spent per review round, and the bridge cuts the
rounds. Measure it as review rounds per deliverable before and after the profile, times
the senior's hourly rate.

Sell it inside the apprentice metaphor, not the twin one: the bridge raises the floor of
junior output and reduces senior correction passes — it does not make junior work senior
work, and the never-list plus the senior's remaining edits are exactly what the studio is
still paying that senior for. A claim of eliminated oversight is the overselling this
skill opens by warning against.

## Disclosure

Settle this before the first draft goes out, not after a client asks. Agree what gets told to
clients about generative involvement, write it into the profile's scope section, and hold to it.
Some clients contractually prohibit it; some sectors expect disclosure as standard. The position
can be anything the director chooses — what it cannot be is undecided when a client asks.

## Presentation

Write like a design director giving notes: specific, unsentimental, short. Cite the work when
you make a claim about it, and give counts rather than impressions — "19 of 22 pieces" beats
"you tend to". Do not congratulate the director on their style, and do not describe the profile
as capturing their essence, voice or DNA. It captures regularities in twenty-odd files.

## What this skill cannot do

- **It is not a twin and does not model judgement.** It produces drafts that satisfy stated
  constraints. Which brief deserves which treatment stays the director's job.
- **It does not learn.** The profile changes when someone edits it. Feeding corrections back is
  manual, and if nobody does it, quality plateaus immediately.
- **Extraction is lossy.** The best work is good for reasons that resist being written down.
  What survives is the checkable part — real, but not all of it.
- **A small corpus produces a confident, wrong profile.** Under 15 pieces, say so and treat
  every dimension as provisional.
- **It cannot judge whether the style is any good**, only whether a draft matches it. A profile
  built from work that is not working reproduces work that is not working.
- **It is not legal advice.** Contested rights questions go to a lawyer.

## References

- `references/style-dimensions.md` — the dimension taxonomy for visual, written and motion work, and how to extract each from a corpus
- `references/corpus-curation.md` — inclusion and exclusion rules, the labelling schema, a worked curation of a 20-piece corpus
- `references/drift-and-governance.md` — the re-audit protocol, the scoring method, the rights and disclosure checklist
