/**
 * The fixed one-page format, ported from
 * skills/five-minute-fluency/references/cheat-sheet-template.md, plus the
 * trigger-phrase and success-check rules from SKILL.md that the lint checks
 * mechanically.
 *
 * The format is load-bearing: the player learns where to look, and a sheet
 * laid out identically every time is scannable in the ninety seconds before a
 * queue pops.
 */

/** Section headings, in the only permitted order. */
export const SECTIONS = [
  'Situation',
  'Three changes',
  'One thing to stop doing',
  'Drill',
  'Success check',
];

export const TEMPLATE = `## Situation
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
[A number the player can report without a replay. Roughly a coin flip at their level.]`;

export const CUT_LIST_FORMAT =
  'Under the sheet, three lines maximum: '
  + 'Cut: [item] — [reason]. [item] — [reason]. Next session: [the strongest cut item].';

export const LENGTH_RULE =
  'Total length: the sheet must fit on one screen without scrolling. If it does not, something '
  + 'on it is not one of the three.';

/** Trigger phrase rules, from SKILL.md step 6. */
export const TRIGGER_RULES = [
  'Five words or fewer',
  'Sayable in under a second, during a fight',
  'No computation — "count their cooldowns" is a task, "is it up?" is a trigger',
  'Imperative or a yes/no question, never a paragraph',
];

export const TRIGGER_EXAMPLES = [
  { weak: 'Consider whether you have a trade partner nearby', strong: 'Who trades me?' },
  { weak: 'Be more aware of the enemy jungler\'s position', strong: 'Where is he?' },
  { weak: 'Do not use your ultimate as soon as it is available', strong: 'Hold it for theirs' },
];

/** Success check rules and examples, from SKILL.md step 8. */
export const SUCCESS_CHECK_RULE =
  'A success check must be a number the player can report after one session without a replay. '
  + 'Set the bar so it is roughly a coin flip at their current level: a check they will '
  + 'certainly pass teaches nothing; one they will certainly fail is discouraging.';

export const SUCCESS_CHECK_EXAMPLES = [
  { example: 'Died fewer than 4 times outside of trades', countable: true },
  { example: 'Was never the first to enter a site without utility', countable: true },
  { example: 'Lap time varied by under 0.5 seconds across ten laps', countable: true },
  { example: 'Felt more confident', countable: false },
];

/** Common ways the format fails, with the fix — the table the lint automates where it can. */
export const FORMAT_FAILURES = [
  { failure: 'A change that is a principle, not an action', fix: 'Rewrite until it names a moment and a behaviour' },
  { failure: 'A trigger phrase longer than five words', fix: 'It will not be said mid-fight. Cut it down.' },
  { failure: 'Two motor-skill changes on one sheet', fix: 'Keep one, cut the other to next session' },
  { failure: 'A success check that needs a replay to score', fix: 'Replace with something countable in the moment' },
  { failure: 'A drill over ten minutes', fix: 'It competes with queueing and loses' },
  { failure: 'Balance numbers stated as fact', fix: 'Mark [verify] or ask the player' },
];
