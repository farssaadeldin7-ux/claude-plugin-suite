---
name: five-minute-fluency
description: >
  This skill should be used when a competitive player describes a gameplay problem and wants
  something they can actually act on before the next match — "I keep dying and I don't know
  why", "how do I climb out of gold", "I've plateaued", "I lose every early game", "I win my
  lane but we lose the game", "give me a cheat sheet for this matchup", "what should I focus on
  this session", "I do no damage and I don't know why", "how do I stop tilting". Also use it to
  turn a coaching conversation, a VOD note or a long tip list into one page of three changes,
  and to build a pre-session focus plan for ranked play.
metadata:
  version: "0.1.0"
---

# 5-Minute Fluency

Turn a described gameplay problem into a one-page cheat sheet the player can absorb in
five minutes and apply in the next match.

The constraint is the product. Anyone can produce twelve pieces of true advice about a
plateau. A good coach produces three, in the right order, and throws away nine things
that were also true. The discipline that separates them is not knowing more — it is
being willing to discard correct advice that will not fit inside one session.

## The one rule

**Three changes. Never four.**

A player can hold roughly three deliberate changes in working memory during live play.
The fourth does not add — it evicts. A sheet with six items produces zero applied
changes and a player who feels worse for having read it.

This holds even when the fourth item is genuinely important. If something matters and
does not make the cut, put it in the cut list with a reason and a note that it is next
session's sheet. Do not smuggle it in as a sub-bullet of change two.

## Sequence

### 1. Diagnose before prescribing

The stated problem is a symptom. "I keep dying" is a report of an outcome, not a
diagnosis, and the four common causes of it need four different sheets.

Work through `references/symptom-to-cause.md`. It maps each common complaint onto its
candidate root causes and gives the **discriminating question** for each — the one
question whose answer eliminates the most candidates.

Budget: **at most three questions, asked in one message, before you write the sheet.**
The product promises five minutes; an intake interview breaks that promise. If you still
cannot name a root cause you would bet 60% on, say so, write the sheet against the most
likely cause, and add one line naming what would change the diagnosis.

### 2. Fix the genre axis

Every genre has a primary skill axis — the dimension along which rating actually moves
at that player's level. `references/genre-axes.md` gives, for each of MOBA, hero
shooter, tactical FPS, fighting game, RTS/auto-battler and racing: the primary axis,
the plateau that most players are stuck at, and the highest-yield drill.

Advice that is off-axis is the most common way a sheet fails. Aim training given to a
tactical FPS player who dies because they take untradeable duels is true, useful and
irrelevant. If the game is not in the table, ask which of the six axes it most
resembles rather than inventing a seventh.

### 3. Establish what is patch-sensitive

**This skill has no live patch feed and no meta database.** You do not know the current
version, the current tier list, or any current balance number.

So:

- Ask the player what patch or season they are on, and take their word for it.
- Anything that depends on a number — cooldowns, costs, damage, charge rates, interest
  thresholds, pool odds — is either **asked from the player** or written on the sheet
  as `[verify]`.
- Never write a balance number as current fact. "Her ultimate is on a 90-second
  cooldown" is a claim you cannot support. "Confirm her ultimate cooldown in the client,
  then track it as a timer" is a change they can act on.
- Structural advice does not expire. Trade discipline, wave state, ult economy and
  braking consistency survive every patch. Weight the sheet towards those and it stays
  correct. If the player wants a current tier list, say plainly that this tool has none.

### 4. Rank by yield, then cut

Generate every change you would recommend — six to ten is normal. Then score each:

| Factor | Scale | Meaning |
| --- | --- | --- |
| **Impact** | 1–5 | How much the outcome of a round or game moves when it is applied |
| **Transfer** | 1–3 | 3 = every game; 2 = most games; 1 = this matchup or this patch only |
| **Cost** | 1–5 | Reps before it is default. 1 = a conscious decision available today; 5 = motor skill, weeks |

`Yield = (Impact × Transfer) ÷ Cost`

| Yield | Action |
| --- | --- |
| 3.0 and above | Goes on the sheet |
| 1.5 – 3.0 | Candidate; include only if a slot is unfilled |
| Below 1.5 | Cut, and name it in the cut list |

Two hard constraints on the final three:

- **At most one change with Cost 4 or 5.** One motor-skill change per session is the
  ceiling; two compete for the same practice attention and neither lands.
- **At least one change with Cost 1 or 2.** The sheet needs something that works in the
  very next match, or the player has nothing to feel by the end of the session.

If nothing scores above 1.5, the bottleneck is not knowledge. Say so directly: it is
usually tilt control, sleep, session length, or playing a role or character they do not
enjoy. Write the sheet about that instead.

### 5. Write the "stop doing" separately

Subtraction is cheaper than addition. Removing one habit costs a fraction of the
attention that adding one does, because the player only has to notice and abort rather
than notice, choose and execute.

Pick exactly one: the most frequent action that loses them value, usually the behaviour
the root cause expresses itself through. It does not count against the three.

### 6. Attach a trigger phrase to each change

Each change gets a phrase short enough to say to oneself mid-fight. This is the
retention mechanism: a change that cannot be recalled under pressure has not been
learned, it has been read.

Rules:

- Five words or fewer
- Sayable in under a second, during a fight
- No computation — "count their cooldowns" is a task, "is it up?" is a trigger
- Imperative or a yes/no question, never a paragraph

| Weak | Strong |
| --- | --- |
| "Consider whether you have a trade partner nearby" | "Who trades me?" |
| "Be more aware of the enemy jungler's position" | "Where is he?" |
| "Do not use your ultimate as soon as it is available" | "Hold it for theirs" |

### 7. Fill the template

`references/cheat-sheet-template.md` holds the fixed format and a fully worked example.
Do not vary the section order or add sections. The format is load-bearing: the player
learns where to look, and a sheet that is laid out the same way every time is scannable
in the ninety seconds before a queue pops.

Sections, in order: **Situation · Three changes · One thing to stop doing · Drill (under
10 minutes) · Success check**.

### 8. Make the success check countable

The last section fails most often. "Play better positioning" is not a check. A success
check must be a number the player can report after one session without a replay:

- "Died fewer than 4 times outside of trades" — countable
- "Was never the first to enter a site without utility" — countable
- "Lap time varied by under 0.5 seconds across ten laps" — countable
- "Felt more confident" — not a check

Set the bar so it is roughly a coin flip at their current level. A check they will
certainly pass teaches nothing; one they will certainly fail is discouraging.

## Presentation

Deliver the sheet and almost nothing else. A page of preamble defeats the point.

State the diagnosis in one line at the top of Situation so the player can disagree with
it. They know their own play and will sometimes correct you — that is the sheet working.

Show the cut list in two or three lines underneath, with reasons. It stops the player
wondering whether you missed the obvious thing, and it makes next session's sheet
obvious. Mark patch-sensitive items `[verify]` in the sheet itself, not in a footnote.

## What this skill cannot do

Be direct about all of these when they come up.

- **No live patch data.** No current tier lists, no current balance numbers, no build
  paths that depend on this week's costs. Anything numeric is asked or marked
  `[verify]`.
- **It cannot see the player.** Every diagnosis runs on their own description of their
  play, which is the least reliable source available on the subject. A replay reviewed
  by a human beats this on accuracy every time. The trade is speed.
- **It cannot rank them.** It has no access to their account, match history or MMR.
- **It does not train mechanics.** Aim, execution consistency and combo reps come from
  weeks of deliberate practice. The sheet points at the drill; it cannot do the reps.
- **It will not fix tilt in one page.** If the description is mostly about frustration,
  say so and write the sheet about session structure rather than tactics.
- **Three is a working-memory heuristic, not a measured law.** Roughly three is what
  people apply under pressure. Treat it as a discipline, not a finding.

## References

- `references/symptom-to-cause.md` — symptoms, candidate root causes, and the
  discriminating question for each
- `references/genre-axes.md` — per-genre primary axis, common plateau, highest-yield
  drill, and what is patch-sensitive
- `references/cheat-sheet-template.md` — the fixed one-page format with a fully worked
  example
