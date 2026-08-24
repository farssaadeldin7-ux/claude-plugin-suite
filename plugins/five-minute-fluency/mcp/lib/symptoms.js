/**
 * The symptom-to-root-cause table, ported from
 * skills/five-minute-fluency/references/symptom-to-cause.md.
 *
 * Genre-general: it works on the structure of the mistake, not on any game's
 * specifics. Each cause carries the one discriminating question that
 * eliminates the most candidates. Reading the answers is the skill's job —
 * nothing here scores or ranks a cause.
 */

export const SYMPTOMS = {
  keep_dying: {
    complaint: 'I keep dying',
    note: 'The most common complaint and the least informative. Four causes, four different sheets. '
      + 'The tempo cause is the one players almost never self-diagnose: if deaths follow losses '
      + 'rather than causing them, the sheet is about disengaging after a loss, not positioning.',
    causes: [
      {
        cause: 'Positioning',
        looks_like: 'Dies first in fights, before doing damage. Deaths cluster at fight start.',
        question: 'In the fights you lose, are you dying early or late?',
      },
      {
        cause: 'Cooldown discipline',
        looks_like: 'Dies with defensive abilities on cooldown, spent offensively a moment earlier.',
        question: 'When you die, is your escape or defensive ability available?',
      },
      {
        cause: 'Map awareness',
        looks_like: 'Dies alone, to numbers, away from the team. Deaths cluster in the same places.',
        question: 'Are you usually dying in a fight, or on your own?',
      },
      {
        cause: 'Overextending on losing tempo',
        looks_like: 'Deaths follow a lost objective, a lost round or a teammate\'s death.',
        question: 'What had just happened, the ten seconds before you died?',
      },
    ],
  },

  lose_early_game: {
    complaint: 'I lose the early game',
    note: 'These three need opposite sheets. Opener knowledge is a memorisation problem — cheap to '
      + 'fix, Cost 1-2, huge yield. Mechanics is a reps problem — Cost 4-5, one per session. Risk '
      + 'tolerance is a decision problem — Cost 1, and usually the highest yield of the three. '
      + 'Check risk tolerance first.',
    causes: [
      {
        cause: 'Opener knowledge',
        looks_like: 'Behind before the first fight. Nothing went wrong; they were simply slower.',
        question: 'Are you behind before anything happens, or after the first fight?',
      },
      {
        cause: 'Mechanics under pressure',
        looks_like: 'Executes the opener fine in practice, drops it when contested.',
        question: 'Can you do it cleanly when nobody is contesting you?',
      },
      {
        cause: 'Risk tolerance',
        looks_like: 'Takes early fights or greedy lines with no information.',
        question: 'How often does your early game end because you chose a fight?',
      },
    ],
  },

  plateau: {
    complaint: 'I plateau / I\'m stuck at this rank',
    note: 'Almost never an execution problem. Players who have arrived at a plateau usually have '
      + 'adequate mechanics for one rank above it. Winning fights that did not matter is the '
      + 'signature plateau failure: it feels like playing well and does not move rating. Diagnose '
      + 'it by asking what the fight was for.',
    causes: [
      {
        cause: 'Decision quality',
        looks_like: 'Individual actions are clean; the choice of which action was wrong.',
        question: 'In your losses, do you lose fights you should win, or win fights that did not matter?',
      },
      {
        cause: 'Narrow pool',
        looks_like: 'Fine on two characters, unplayable otherwise; loses to counter-picks.',
        question: 'How many games do you start already at a disadvantage?',
      },
      {
        cause: 'Playing to not lose',
        looks_like: 'Passive, low variance, never converts an advantage into a win.',
        question: 'When you are ahead, what do you do differently?',
      },
      {
        cause: 'Session structure',
        looks_like: 'Wins early in a session, loses it back over the next four games.',
        question: 'Where in your session are your losses?',
      },
    ],
  },

  win_lane_lose_match: {
    complaint: 'I win my lane / round / early game but lose the match',
    note: 'One cause, three flavours: an advantage acquired is not being converted. The single '
      + 'question separates the answers cleanly.',
    single_question: 'What do you do in the two minutes after you win?',
    answers: [
      { answer: '"Look for the next fight"', reading: 'No conversion plan; the sheet is about objectives.' },
      { answer: '"Play safe so I don\'t lose it"', reading: 'Hoarding a decaying resource.' },
      { answer: '"I don\'t know"', reading: 'The honest and most common answer; the sheet is a conversion checklist.' },
    ],
    causes: [],
  },

  no_damage: {
    complaint: 'I do no damage / I feel useless',
    causes: [
      {
        cause: 'Target selection — attacking what is hard to kill rather than what matters',
        question: 'Who are you usually attacking first?',
      },
      {
        cause: 'Uptime — alive and present, but not engaged; damage windows missed',
        question: 'What fraction of a fight are you actually attacking?',
      },
      {
        cause: 'Role misread — doing the job the character is not for',
        question: 'What do you think your job is in a fight?',
      },
    ],
  },

  inconsistent: {
    complaint: 'I\'m inconsistent',
    causes: [
      {
        cause: 'Adapting to the game rather than running a plan',
        question: 'Do you decide your plan before the match or during it?',
      },
      {
        cause: 'Fatigue — quality falls off a cliff after N games',
        question: 'Which game of a session is your worst?',
      },
      {
        cause: 'Genuine matchup variance, not inconsistency',
        question: 'Are your bad games against particular opponents?',
      },
    ],
  },

  tilt: {
    complaint: 'I tilt',
    note: 'Do not write a tactical sheet for a tilt problem. It will not be read. The changes go on '
      + 'session structure instead: a hard game cap, a stop rule after two consecutive losses, one '
      + 'physical reset between games. Say plainly that this is what the sheet is about.',
    causes: [],
  },
};

/** The rules the reference gives for using the table, verbatim in substance. */
export const USAGE_RULES = [
  'Ask at most three questions. Pick the ones that separate, not the ones that are interesting.',
  'Take contradictions seriously. If the answers point at two causes, the sheet goes to the one '
    + 'with the cheaper fix — a Cost 1 decision change tested for one session is better evidence '
    + 'than more questions.',
  'The player\'s own diagnosis is data, not the answer. Someone who says "I know my positioning '
    + 'is bad" has usually diagnosed the symptom they can see. Test it against the discriminating '
    + 'question anyway.',
  'If nothing fits, say so. Ask for one specific recent loss, described in order: what happened, '
    + 'what they chose, and what happened next. That narrative resolves more cases than another '
    + 'round of questions.',
];

export function symptomFor(id) {
  return SYMPTOMS[String(id ?? '').trim().toLowerCase()] ?? null;
}
