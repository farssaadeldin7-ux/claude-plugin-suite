/**
 * Scoring anchors, the scene-boundary definition, the series-pattern table
 * and the Q&A ledger format, ported from the skill's
 * references/arc-scoring.md. Scoring itself is an act of reading, not
 * measurement, and it happens in the skill — this module only carries the
 * anchors the scores are read against.
 */

export const SCORING_NOTE =
  'Scoring is an act of reading, not measurement. Two experienced editors scoring the same cut will ' +
  'land within about one point of each other on most scenes and disagree sharply on a few. That is ' +
  'expected and it is fine — the analysis depends on the shape of the series, not on the absolute ' +
  'value of any single scene.';

export const SCENE_BOUNDARIES = {
  a_new_scene_starts_at:
    'A change of location, a change of time, a change of speaker where the speaker becomes the ' +
    'subject, or a change of function (exposition to testimony, testimony to observation). A ' +
    'cutaway inside a continuous interview is not a new scene.',
  scene_count:
    'Aim for 8 to 30 scenes. Fewer than 8 and the derivative is meaningless. More than 30 and you ' +
    'are scoring shots.',
};

/** Valence: the emotional charge of the scene as cut, from the viewer's seat. */
export const VALENCE_ANCHORS = {
  '+3': 'Release, triumph, reunion, the thing they wanted',
  '+2': 'Warmth, competence, progress that is clearly progress',
  '+1': 'Mild positive; things are working',
  '0': 'Neutral, procedural, expository, observational',
  '-1': 'Unease, friction, mild setback',
  '-2': 'Loss, failure, betrayal, real damage',
  '-3': 'Devastation, the worst thing in the film',
};

export const VALENCE_NOTE =
  'Valence is the emotional charge of the scene as cut, from the viewer\'s seat — not the subject\'s ' +
  'mood and not the film-maker\'s sympathy. Score 0 honestly. A film full of ±1 scores is usually a ' +
  'scorer who is reluctant to call anything neutral, and it hides monotony rather than revealing it.';

/** Intensity: how much is being demanded of the viewer. */
export const INTENSITY_ANCHORS = {
  '0': 'Wallpaper. Establishing, transitional, breathing',
  '1': 'Low. Ambient observation, gentle context',
  '2': 'Steady. Ordinary conversational testimony',
  '3': 'Engaged. Something is at stake and the viewer knows it',
  '4': 'High. Confrontation, revelation, dense information under pressure',
  '5': 'Peak. Once or twice per film, three times in a feature at most',
};

export const INTENSITY_NOTE =
  'Intensity is how much is being demanded of the viewer: emotional load, information density, pace ' +
  'of cutting, or all three at once. More than three 5s means the scale has drifted. Rescore rather ' +
  'than argue with the flags that result.';

/** Reading the series: differences between consecutive scenes, not values. */
export const SERIES_PATTERNS = [
  { pattern: 'Valence flat for five minutes', reading: 'Tonal monotony, whatever the level' },
  { pattern: 'Intensity flat at 3–4 for a long stretch', reading: 'Fatigue; the viewer cannot tell what matters' },
  { pattern: 'Intensity 5 not followed by a drop to 1 or below', reading: 'No landing. The peak is wasted' },
  { pattern: 'Valence swinging ±3 every scene', reading: 'Whiplash; nothing accumulates' },
  { pattern: 'Rising intensity across the last quarter', reading: 'Correct for nearly every form' },
];

export const DERIVED_FIGURE_NOTE =
  'The single most useful derived figure is the largest gap between valence changes of two or more ' +
  'points. In a film of any length, if that gap exceeds five minutes, look there first.';

/** The Q&A ledger: one row per question, reproduced in full in the output. */
export const LEDGER_FORMAT = {
  columns: ['#', 'Question', 'Opens', 'Closes', 'How it closes', 'Weight'],
  weights: {
    central: 'Exactly one question is Central. If you cannot identify a single Central question, that is the finding — say so before anything else, because a film with two central questions and no hierarchy will read as two films.',
    major: 'A question the film substantially depends on, short of Central.',
    minor: 'An unclosed Minor question is often fine and occasionally deliberate.',
  },
  how_it_closes: {
    on_screen: 'On screen, explicit — strongest.',
    implied: 'Implied, in testimony — acceptable.',
    off_screen: 'Closed off-screen, never acknowledged — needs flagging; reads as a plot hole even in non-fiction.',
    never: 'Never closed — needs flagging. An unclosed Central question at the end credits is the whole note.',
  },
  example_rows: [
    { number: 'Q1', question: 'Will the yard reopen?', opens: '00:15', closes: '09:45', how: 'On screen, explicit', weight: 'Central' },
    { number: 'Q2', question: 'Why did Dan stay?', opens: '00:40', closes: '07:00', how: 'Implied, in testimony', weight: 'Major' },
    { number: 'Q3', question: 'What is in the ledger book?', opens: '05:50', closes: null, how: 'Never closed', weight: 'Minor' },
  ],
};

/** The edit effort scale used to rank the three highest-leverage cuts. */
export const EFFORT_SCALE = {
  1: 'Any change inside one scene using material already in the project — trim, split, cutaway; no assembly ripple, no new material',
  2: 'Reorder or lift a whole scene; ripple through the assembly',
  3: 'Needs new material, a reshoot, a rewrite of narration, or a rescore',
};

export const EXPOSED_RUNTIME_NOTE =
  'Exposed run-time is run-time currently sitting under a flag. It is not a prediction of watch time ' +
  'gained, and this analysis does not produce one.';
