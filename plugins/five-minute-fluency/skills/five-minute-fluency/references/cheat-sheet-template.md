# The one-page format

Fixed sections, fixed order. Do not add sections and do not reorder them. The player
learns where to look, and a sheet laid out identically every time is scannable in the
ninety seconds before a queue pops.

Total length: it must fit on one screen without scrolling. If it does not, something on
it is not one of the three.

## Template

```
## Situation
[Game, rank or level, role or character. One line.]
Diagnosis: [root cause, one sentence, stated so the player can disagree with it.]
Patch: [what the player told you] — anything marked [verify] must be checked in client.

## Three changes

1. [Change, one sentence, an action not a principle]
   Trigger: "[five words or fewer]"
   Why: [one line — what it wins]

2. [Change]
   Trigger: "[...]"
   Why: [...]

3. [Change]
   Trigger: "[...]"
   Why: [...]

## One thing to stop doing
[A single behaviour to abort, not a new habit to build. One line.]
Trigger: "[...]"

## Drill — [N] minutes
[Exactly what to do, where, and what to count. Must be doable before queueing.]

## Success check — next session
[A number the player can report without a replay. Roughly a coin flip at their level.]
```

Under the sheet, three lines maximum:

```
Cut: [item] — [reason]. [item] — [reason]. Next session: [the strongest cut item].
```

## Worked example

**Player's message:** "I'm in the middle ranks of a tactical shooter, I keep dying and I
don't know why. My aim is honestly fine, I win most of my 1v1s."

**Three questions asked, in one message:**

1. When you die, are you usually in a fight with the team, or on your own?
2. In the fights you lose, do you die early or late?
3. What had just happened in the ten seconds before you died?

**Answers:** "Usually first contact, on my own or slightly ahead. Early — I'm often the
first one down. Usually nothing much, we were just moving up."

**Diagnosis:** untraded entries. Not positioning in the abstract and not aim — they win
duels, so the duels are not the problem. They are taking first contact in places where
no teammate can trade the death, which converts a 50/50 duel into a lost round even
when they win it half the time.

**Axis check:** tactical FPS, primary axis is utility and trade discipline. On axis.

**Candidate changes, scored** (Yield = Impact × Transfer ÷ Cost):

| Candidate | Impact | Transfer | Cost | Yield | Verdict |
| --- | --- | --- | --- | --- | --- |
| Never take first contact without a trade partner within ~2s | 5 | 3 | 2 | 7.5 | In |
| Throw one piece of utility before entering, every time | 4 | 3 | 2 | 6.0 | In |
| Call the death before it happens ("I'm going in, follow") | 4 | 3 | 3 | 4.0 | In |
| Play the retake rather than the entry on eco rounds | 3 | 2 | 2 | 3.0 | Candidate |
| Learn the off-angle spots on each map | 3 | 2 | 5 | 1.2 | Cut |
| Crosshair placement drill, 15 min daily | 3 | 3 | 5 | 1.8 | Cut |
| Tighten the buy discipline on force rounds | 2 | 2 | 3 | 1.3 | Cut |

Cost constraints: no change scores Cost 4 or 5, and two are Cost 2. Both satisfied.

**The sheet:**

```
## Situation
Tactical FPS, mid ranked, entry-ish role. Aim is not the problem — duels are being won.
Diagnosis: you are taking first contact where nobody can trade you, so winning half your
duels still loses the round.
Patch: current season per your report — no numbers on this sheet need verifying.

## Three changes

1. Before any first contact, find the teammate who can trade you within two seconds.
   No trade partner, no contact — wait or reposition.
   Trigger: "Who trades me?"
   Why: turns a 50/50 duel from a coin flip on the round into a guaranteed even trade.

2. One piece of utility into the space before you step into it. Every time, even when
   the space looks empty.
   Trigger: "Nade first, feet second"
   Why: cheap information, and it delays the duel until your team has caught up.

3. Say the entry out loud a beat before you make it, so the trade is arranged rather
   than hoped for.
   Trigger: "Say it, then go"
   Why: a trade only happens if someone is already looking at your fight.

## One thing to stop doing
Stop re-peeking the same angle after a trade goes badly. That second peek is the death
that ends the round.
Trigger: "Once only"

## Drill — 6 minutes
Load one map you play often. Walk the two most common entry routes and, at each first
contact point, stop and name out loud where your trade partner would have to stand.
Six positions, no shooting.

## Success check — next session
Count untraded deaths. Under 4 across the session is a pass. Anything you die to with a
teammate within two seconds of you does not count.
```

```
Cut: crosshair placement drill — real, but Cost 5, and it is not what is killing you.
Off-angles — matchup-narrow. Next session: retake role on eco rounds (Yield 3.0).
```

## Why the example works

- The diagnosis is stated as a claim, so the player can reject it in one line.
- No balance numbers appear, so nothing on it goes stale.
- Two changes are pure decisions, available in the very next round; the third is a
  communication habit that costs a few games.
- The stop-doing item is the second-order failure — what they do after change one goes
  wrong. Those are usually the most valuable subtraction.
- The drill needs no server, no aim trainer and no queue, and the success check is a
  count they can hold in their head, which makes it a fourth reminder of change one.

## Common ways the format fails

| Failure | Fix |
| --- | --- |
| A change that is a principle, not an action | Rewrite until it names a moment and a behaviour |
| A trigger phrase longer than five words | It will not be said mid-fight. Cut it down. |
| Two motor-skill changes on one sheet | Keep one, cut the other to next session |
| A success check that needs a replay to score | Replace with something countable in the moment |
| A drill over ten minutes | It competes with queueing and loses |
| Balance numbers stated as fact | Mark `[verify]` or ask the player |
