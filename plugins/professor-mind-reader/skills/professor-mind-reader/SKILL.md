---
name: professor-mind-reader
description: >
  This skill should be used when someone has a marking rubric, assignment brief or grading
  criteria and wants to know what actually moves the mark, or wants their own draft audited
  against it — "here's the rubric for my essay, what am I missing", "why did I get a 2:1
  and not a first", "check my draft against these marking criteria", "what is my professor
  actually looking for", "I don't understand this grading rubric", "how do I turn a B into
  an A", "which parts of this assignment are worth the most marks", "am I answering the
  question they asked", "audit my dissertation chapter against the criteria". Also use it
  for planning word-count allocation before writing, decoding band descriptors, and
  reviewing any submission against a stated set of assessment criteria.
metadata:
  version: "0.1.0"
---

# Professor Mind-Reader

Reverse-engineer a marking rubric into the handful of things that actually move the mark,
then audit a draft against those in the order a marker reads them.

There is no mind reading here. This is inference over stated criteria plus the ordinary
conventions of academic marking. It cannot know your marker. It can tell you precisely
which criteria your draft does not evidence, which is the part students get wrong.

## Ethics boundary

This improves the student's **own** draft against **stated** criteria. It does not write
the submission and does not invent sources, citations, quotations or data.

If asked to write the essay, write a section, or produce a paragraph "as an example" that
could be pasted in, refuse and offer the audit instead. Say it once, plainly, and move on.
Feedback, structural advice, questions the student should answer, and quoting their own
words back to them are all fine.

## The one rule

**For every criterion, quote the single strongest sentence in the draft that satisfies it.
If you cannot find one, the criterion is unmet.**

Not "weak", not "could be developed" — unmet. That is the whole test, because it is what
a marker does: award marks against evidence they can point at. If you cannot point at it
in the student's own text, neither can they. Never paraphrase the draft into a sentence
that would satisfy the criterion — quote verbatim or declare it unmet.

## Sequence

### 1. Collect the artefacts

Ask for whatever is missing before starting:

| Artefact | Why it matters |
| --- | --- |
| The rubric or criteria, with weights | Everything downstream depends on it |
| The question or brief, verbatim | The most common total failure is answering a different question |
| Word count and format | Sets the marks-per-100-words budget |
| Band descriptors, if published | The only honest basis for grade positioning |
| The set reading list | Half the hidden rubric lives here |
| The draft | No draft, no audit — offer the plan instead |

With no weights proceed with equal weighting and flag that step 3 is then unreliable.
With no rubric at all, do not invent one — use `references/hidden-criteria.md` as a
generic checklist and say plainly that this is a convention review.

### 2. Decompose every criterion into three parts

For each criterion, extract:

1. **Weight** — the percentage, or the mark range it governs.
2. **Observable evidence** — the thing in the text a marker could underline and say
   "there it is". Rewrite vague criteria into observables: "critical engagement with the
   literature" becomes "at least two places where the draft says why a cited source is
   wrong, limited, or in tension with another".
3. **The verb** — the word setting the cognitive level. `describe` < `explain` < `apply`
   < `analyse` < `compare` < `evaluate` < `synthesise`.

The verb is the load-bearing part. **Most lost marks are the student answering one level
below the verb** — describing when asked to analyse, explaining when asked to evaluate.
It reads as competent and scores in the middle band. The full ladder, with the sentence
shape of each level and its one-level-down failure, is in
`references/rubric-decomposition.md`. Use it; do not improvise it.

### 3. Map weight to effort

Compute the budget before looking at the prose:

```
marks per 100 words = criterion weight / (total words / 100)
target words for criterion = total words x criterion weight
```

Then measure what the draft actually spends. Flag on these thresholds:

| Condition | Verdict |
| --- | --- |
| Section words > 1.5x its criterion's weight share | Over-invested. Cut. |
| Section words < 0.5x its criterion's weight share | Under-invested. This is where marks are. |
| Criterion weight >= 20% and unmet | Top of the fix list, always |
| Criterion weight <= 10% and polished | Stop working on it |

A 10% "structure and presentation" criterion does not deserve a third of the word count,
and a 40% "critical analysis" criterion cannot be served by two paragraphs. Say the
numbers out loud: "you have spent 620 words on 10% of the marks" lands where "consider
rebalancing" does not. Worked calculation in `references/rubric-decomposition.md`.

### 4. Order the audit by attention, not by rubric

Markers do not read evenly or in rubric order. Audit in the order in which impressions
form and become hardest to shift:

1. The question against the introduction's final paragraph — does the draft commit to an
   answer, and is it an answer to *this* question
2. The conclusion — markers frequently read it early to find the argument
3. Headings and the first sentence of each paragraph read in sequence — the skim, which
   should hold together as an argument on its own
4. The reference list — scanned for the set reading, for recency, for citation format
5. The highest-weighted criterion's body evidence
6. Everything else, descending by weight

This ordering is inferred from common marking practice, not a guarantee about any
individual marker. Present it as such.

### 5. Audit each criterion

Produce one row per criterion:

| Field | Content |
| --- | --- |
| Criterion and weight | As printed |
| Required verb level | From the ladder |
| Delivered verb level | What the draft actually does |
| Strongest supporting sentence | **Verbatim quote**, with its location |
| Verdict | Met / Partially met / Unmet |
| Marks at stake | Weight x the gap |

Verdict rules: **unmet** if there is no quotable sentence, or the strongest one sits a
full level below the required verb. **Partially met** if the evidence appears once and
the criterion implies sustained quality ("throughout", "consistently"). **Met** needs one
strong quote plus a corroborating instance.

A single quoted sentence per criterion beats a paragraph of commentary. When the quote is
embarrassing, quote it anyway.

### 6. Sweep the hidden rubric

Run the standing checklist in `references/hidden-criteria.md`: signposting, visible
engagement with the set reading, addressing the strongest counter-argument, correct and
consistent citation style, and answering the question actually asked.

Label these explicitly as **inferred conventions, not guarantees**. Any individual module
may not reward them. Never give a hidden criterion the authority of a printed one.

### 7. Position against the bands, honestly

Use `references/band-descriptors.md`. The core finding to encode, because students
consistently get it wrong: the gap between "good" (2:1 / B) and "excellent" (1st / A) is
almost never **more content**. It is **evaluation and independent judgement** — the
student's own defensible position, argued against alternatives.

A student adding a fifth source to a 2:1 draft usually still has a 2:1. Two sentences of
"source A is more persuasive than source B here, because..." often move it.

Give a band range, never a number. "This evidences low 2:1; the three fixes below are
what a 1st is normally missing" is honest. "This is a 68" is not — you have not seen the
cohort, the marker or the moderation.

### 8. Deliver a ranked fix list

Rank by marks at stake divided by effort. Five items maximum. Each states the criterion,
the marks in play, and the specific move — not "strengthen your analysis" but "after the
paragraph ending 'reduced turnover by 12%', say why Kaplan disagrees and which you find
more convincing".

## Limits of the method

- **It cannot read the marker.** Markers weight things differently and moderation moves
  marks. Everything here is inference from stated criteria plus general convention.
- **It assumes the rubric weights are honest.** Many are not; criteria such as
  "presentation" are often marked more generously than their weight suggests.
- **It cannot verify sources.** It does not know whether a citation is accurate. Say so.
- **No grade prediction.** Band positioning is an estimate against published descriptors
  and can be a full band out where local conventions differ.
- **Where the rubric is absent or unweighted**, the output is a convention review. Say
  that rather than dressing it up as a rubric audit.

## What this skill does not do

- It does not write, draft or ghostwrite any part of a submission, or fabricate sources,
  citations, quotations, data or results.
- It does not predict a numerical mark, check factual accuracy, or judge whether cited
  work is represented fairly.
- It does not replace the module handbook. Where the two disagree, the handbook wins.

## References

- `references/rubric-decomposition.md` — verb ladder, weight-to-effort table, worked
  decomposition of a sample rubric
- `references/band-descriptors.md` — what separates each band, across UK, US and ECTS
- `references/hidden-criteria.md` — the unwritten conventions checklist, and why each
  one is rewarded
