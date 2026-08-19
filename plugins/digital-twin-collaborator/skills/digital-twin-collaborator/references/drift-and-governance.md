# Drift, scoring and governance

A style profile is a living document with an owner, a version and an audit schedule. Without
those it becomes a file someone wrote once and nobody trusts.

## Scoring a draft

Score each weighted dimension 0 to 4.

| Score | Meaning | Typical evidence |
| --- | --- | --- |
| 4 | Indistinguishable from corpus work on this dimension | Values sit inside the profile's stated range |
| 3 | In range. A reviewer would not stop on it | Close to the range, no jarring departure |
| 2 | Plausible but generic — could be anyone in this genre | Nothing wrong, nothing identifying |
| 1 | Off-profile. A reviewer would notice and comment | Outside the stated range in a visible way |
| 0 | Violates a never-list entry | Breach, named |

**Any 0 is a hard fail.** Report the breached entry first, before the mean. Do not average it
away — a mean of 3.4 with one breach is a reject.

### Reading the mean

| Weighted mean | Read as |
| --- | --- |
| 3.5+ | On profile. Direct it as you would a good junior draft |
| 2.8-3.4 | Usable with named corrections on the two weakest dimensions |
| 2.0-2.7 | The generic-output signature. The preamble is not landing. Do not polish — rebrief |
| Under 2.0 | Either the profile is wrong for this brief, or the brief is outside the profile's scope. Say which |

A flat set of 2s across every dimension is diagnostically different from a mix of 4s and 1s.
Flat 2s mean the constraints never reached the model. Mixed scores mean specific dimensions
are weak, which is a correction problem, not a briefing problem.

## The re-audit protocol

Run **every quarter, or every 20 outputs, whichever comes first.**

1. **Sample.** Take at least eight recent outputs, chosen at random rather than by quality.
   Cherry-picked samples make a clean audit and a false one.
2. **Score blind where possible.** Score the sample before re-reading the profile's baseline
   numbers, so the baseline does not anchor the scoring.
3. **Compare per dimension.** Set each dimension's current mean against the baseline recorded
   when the profile was built.
4. **Flag regressions.** A dimension is flagged if either holds:
   - its mean has fallen by **1.0 or more** from baseline, or
   - **40% or more** of samples score 2 or below on it.
5. **Count breaches.** Any never-list breach in the sample is flagged regardless of the mean.
   More than one breach of the same entry means the entry is not reaching the preamble.
6. **Diagnose before rewriting.** Use the table below.
7. **Record.** Add a dated changelog entry: what was audited, what was flagged, what changed.

### Diagnosing a flagged dimension

| Pattern | Likely cause | Fix |
| --- | --- | --- |
| Every dimension down slightly, none badly | Preamble has been trimmed or reordered over time | Restore the full preamble; re-check the never list is verbatim |
| One dimension down sharply, others stable | The entry is vague and cannot be checked | Rewrite it with a number or a count |
| Never-list breaches rising | Never list is being cut for length, or has grown past what fits | Move the never list to the top of the preamble; consolidate to 20 entries |
| Scores fine, director still unhappy | The profile has fallen behind the director's current work | Re-curate: add the last quarter's work, drop the oldest |
| Flat 2s from the first output onward | The preamble was never effective | Rebuild it from the profile rather than patching |

### Baseline

Take the baseline at profile build time by scoring three corpus pieces against the finished
profile. They should score 3.5 or above. If a corpus piece scores below 3, the profile does not
describe the corpus and the extraction is wrong — fix that before generating anything.

## Rights and provenance checklist

Work through this before extraction, and state the answers rather than assuming them.

- [ ] The director owns each piece, or holds a licence that permits this reuse
- [ ] Work-for-hire pieces have been identified. Unless a clause assigns rights back to the
      director, they are the client's and are excluded
- [ ] No piece comes from another person's or studio's portfolio
- [ ] Collaborative work is excluded, or the director's contribution is separable and stated
- [ ] Pieces containing identifiable people have whatever release the original use required,
      and this reuse does not exceed it
- [ ] Client confidentiality: nothing unreleased or under embargo is in the corpus
- [ ] Where the corpus is stored, and who can read it, is written down

### Stated plainly

Style itself is generally not copyrightable. Specific works are, and a corpus is made of
specific works. Those two facts sit together uncomfortably and the practical consequence is
simple: extracting a profile from work the director owns is theirs to do; doing it from someone
else's portfolio is not, and this skill refuses it.

Refuse it clearly and without a lecture. "I will not build a profile from another
photographer's work. Give me fifteen of yours and we will get further anyway" is the whole
response.

**None of this is legal advice.** Where rights are genuinely contested — a disputed
work-for-hire clause, an agency claiming ownership, a client asserting rights over a style —
the answer is the director's lawyer, not this skill. Say so and stop.

## Disclosure checklist

Agree these before the first generated draft leaves the studio, and record the answers in the
profile's scope section.

- [ ] What is said to a client about generative involvement, in one sentence
- [ ] Whether it is said proactively or only when asked
- [ ] Which clients contractually prohibit it — check the contracts, do not assume
- [ ] Whether generated first drafts may go to a client at all, or only director-edited work
- [ ] Who in the studio may run the apprentice, and who may not
- [ ] Whether the profile itself is ever shared outside the studio

The position can be anything the director chooses. It cannot be undecided at the moment a
client asks, and it cannot be different for different clients by accident.

## Governance minimums

- The profile has a named owner. One person, not the studio
- The profile has a version number and a dated changelog
- The corpus list is stored with the profile, not in someone's memory
- The audit date is in a calendar, not an intention
- Corrections are written into the profile the day they are made, or they are lost
