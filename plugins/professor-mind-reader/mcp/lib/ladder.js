/**
 * The verb ladder from references/rubric-decomposition.md, as data. A rubric
 * criterion's verb fixes the cognitive level the draft must reach; the rung a
 * verb sits on is a table lookup, not a judgement. Whether a given sentence in
 * a draft reaches its rung is a judgement, and it lives in the skill.
 */

export const VERB_LADDER = [
  {
    level: 1,
    name: 'Describe',
    verbs: ['describe', 'outline', 'identify', 'state', 'summarise', 'define'],
    marker_underlines: 'Accurate account of what the thing is',
    one_level_down_failure: 'Listing without accuracy or relevance',
  },
  {
    level: 2,
    name: 'Explain',
    verbs: ['explain', 'illustrate', 'demonstrate', 'account for', 'clarify'],
    marker_underlines: 'A mechanism or cause: X happens because Y',
    one_level_down_failure: 'Describing the thing and stopping',
  },
  {
    level: 3,
    name: 'Apply',
    verbs: ['apply', 'use', 'calculate', 'implement', 'model'],
    marker_underlines: 'The concept operating on the specific case in front of it',
    one_level_down_failure: 'Explaining the concept in the abstract',
  },
  {
    level: 4,
    name: 'Analyse',
    verbs: ['analyse', 'examine', 'investigate', 'distinguish', 'deconstruct'],
    marker_underlines: 'The thing broken into parts, with the relationship between parts named',
    one_level_down_failure: 'Applying a framework and not saying what it reveals',
  },
  {
    level: 5,
    name: 'Compare',
    verbs: ['compare', 'contrast', 'relate', 'differentiate'],
    marker_underlines: 'An explicit stated basis of comparison, and both sides on it',
    one_level_down_failure: 'Two descriptions side by side with no bridge',
  },
  {
    level: 6,
    name: 'Evaluate',
    verbs: ['evaluate', 'critique', 'assess', 'justify', 'argue', 'appraise', 'judge'],
    marker_underlines: 'A verdict, with the criteria used to reach it, and the strongest objection answered',
    one_level_down_failure: 'Analysing thoroughly and never committing',
  },
  {
    level: 7,
    name: 'Synthesise',
    verbs: ['synthesise', 'integrate', 'formulate', 'design', 'propose', 'theorise'],
    marker_underlines: 'Something new built from parts that were separate — a framework, position or model',
    one_level_down_failure: 'Evaluating each source in turn without joining them',
  },
];

export const DEMOTION_TEST =
  'For each criterion, take the strongest sentence the draft offers and ask which rung it sits on. ' +
  'If it is one below, that criterion loses roughly a band. This is the single most common cause of a ' +
  'competent essay landing in the middle: it reads fluently, is factually fine, and answers a lower ' +
  'question than the one asked.';

export const DEMOTION_SIGNALS = [
  '"This shows that..." followed by restating the evidence rather than interpreting it',
  'A source summarised in three sentences with no sentence about what it is worth',
  'A framework named and applied, with no sentence on what the application revealed',
  'A conclusion that recaps the sections rather than answering the question',
  'Hedged non-commitment: "both views have merit" with no basis for preferring one',
];

export const PROMOTION_MOVES = [
  { from: 'Describe', to: 'Explain', move: 'Add "because" and a mechanism' },
  { from: 'Explain', to: 'Apply', move: 'Attach it to the case, with specifics from the case' },
  { from: 'Apply', to: 'Analyse', move: 'Name what the application revealed that was not obvious' },
  { from: 'Analyse', to: 'Compare', move: 'Put two analysed things on one explicit, stated basis of comparison' },
  { from: 'Compare', to: 'Evaluate', move: 'State the criteria for judgement, then judge which side wins on them' },
  { from: 'Evaluate', to: 'Synthesise', move: 'Reconcile two positions into one that is yours' },
];

/**
 * Exact lookup of a rubric verb against the ladder. Unrecognised verbs return
 * null rather than a guessed rung — a wrong level poisons everything downstream.
 */
export function levelForVerb(verb) {
  const needle = String(verb ?? '').trim().toLowerCase();
  if (!needle) return null;
  return VERB_LADDER.find((rung) => rung.verbs.includes(needle)) ?? null;
}
