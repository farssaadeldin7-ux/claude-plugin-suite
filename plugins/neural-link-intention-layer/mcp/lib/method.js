/**
 * The method's fixed numbers: normalisation rules, minimum log sizes, expected
 * accuracy ranges, the audit reading bands, scoring constants and the
 * confidence-floor arithmetic. Ported from references/sequence-analysis.md and
 * the skill — every threshold here traces to those files.
 */

export const FRAMING =
  'There is no neural link and nothing here reads minds. The name is a product name. The ' +
  '"prediction" is P(next action | the last one or two actions) — n-gram counting over a ' +
  'command history the user recorded themselves, and nothing else. A good model of a creative ' +
  'workflow is still wrong more often than right.';

export const CEILING =
  'For a heavy keyboard-driven user a well-executed audit recovers 20 to 90 minutes per week — ' +
  'not hours, and nothing at all for decision-making, client revision or asset sourcing.';

export const NORMALISATION_RULES = [
  {
    rule: 'Parameter noise',
    do: 'Collapse "set_brush_size:41" and "set_brush_size:43" to "set_brush_size"',
    do_not: 'Collapse "blend_mode:soft_light" and "blend_mode:overlay" — the parameter is the action',
  },
  {
    rule: 'Repeats',
    do: 'Replace N consecutive identical actions with one token carrying run=N',
    do_not: 'Leave runs in; they inflate accuracy to meaninglessness',
  },
  {
    rule: 'Idle gaps',
    do: 'End a sequence at a gap over 3 min, end a session at 30 min',
    do_not: 'Let a bigram span a break',
  },
  {
    rule: 'Duplicate emissions',
    do: 'Drop the second line when the app logs one command as two states',
    do_not: 'Assume the log is clean',
  },
  {
    rule: 'Undo and redo',
    do: 'Keep as first-class tokens',
    do_not: 'Strip them as noise — they are the best signal in the log',
  },
];

export const MIN_LOG_SIZES = [
  { actions: 'under 500', may_report: 'Nothing numeric. Keep recording' },
  { actions: '500-2,000', may_report: 'Action frequencies and obvious repeated sequences, marked provisional' },
  { actions: '2,000-5,000', may_report: 'Bigram statistics, top sequences, candidate scoring' },
  { actions: '5,000+', may_report: 'Trigrams with backoff, held-out accuracy' },
  { actions: '20,000+', may_report: 'Separate models per project type' },
];

export const SESSION_REQUIREMENT =
  'Also require three sessions across two different pieces of work. A single session models one job.';

export const EVALUATION_RULES = [
  'Split chronologically — last 20% held out. Random splitting leaks adjacency and inflates ' +
    'top-1 by 15-25 points.',
  'Exclude self-transitions from the headline number. Predicting "you will paint again" is ' +
    'free and worth nothing. Quote the excluded figure; footnote the other.',
  'Always report the baseline — always predicting the single most frequent action.',
  'Require a 10 point absolute lift over baseline. Below that, report that the log contains no ' +
    'learnable sequence structure and proceed with the audit alone.',
];

export const EXPECTED_ACCURACY = {
  note: 'Self-transitions excluded, top-1 then top-3, for a creative workflow.',
  unigram_baseline: { top1: '8-15%', top3: '20-28%' },
  bigram: { top1: '25-35%', top3: '45-58%' },
  trigram_with_backoff: { top1: '30-45%', top3: '55-70%' },
  bug_threshold: 'Anything above 70% top-1 is a bug until disproved — nearly always leaked test data or uncollapsed runs.',
};

export const UNDO_SHARE_BANDS = [
  { share: 'under 3%', reading: 'Healthy, or the log is not capturing undos' },
  { share: '3-8%', reading: 'Normal for exploratory creative work' },
  { share: '8-15%', reading: 'Investigate what precedes the undos' },
  { share: 'over 15%', reading: 'Wrong defaults, or a destructive rather than non-destructive process' },
];

export const PER_ACTION_UNDO = {
  min_occurrences: 20,
  threshold: 0.25,
  reading:
    "Above 0.25 the action's default parameters are wrong. Fix the default; do not build a " +
    'macro around a step that gets reversed a quarter of the time.',
};

export const NAVIGATION_NOTE =
  'Zoom, pan and layer-visibility toggles as a percentage of all actions — commonly 20-35% in ' +
  'retouching and illustration. Usually the biggest single cost in the log, and almost never ' +
  'fixable by a macro: the answers are hardware (tablet rocker ring, ExpressKeys, the ' +
  'Navigator panel) and habit.';

export const SCORING = {
  formulas: {
    value: 'value = F x (K + C) / (S + R)',
    payback_weeks: 'payback_weeks = S x 1.3 / (F x (K + C))',
  },
  terms: [
    { term: 'F', meaning: 'Occurrences per week, from the log', typical: 'never from recall' },
    { term: 'K', meaning: 'Seconds saved per occurrence', typical: 'keystroke 0.3 s, menu trip 1.5 s, modal dialogue 4 s' },
    { term: 'C', meaning: 'Context-switch cost, seconds', typical: '0 hand stays put, 1.5 mouse-to-menu, 4 dialogue, 15 leaving the app' },
    { term: 'S', meaning: 'Setup seconds; the 1.3 factor adds 30% annualised maintenance', typical: '180 keymap, 300 action, 900 component set, 1200 OS macro, 5400 plugin' },
    { term: 'R', meaning: 'Wrong-fire risk, (1 - p) x severity', typical: 'severity 2 s if easily undone, 30 s if silently wrong, unbounded if destructive' },
  ],
  build_rule: 'Build when payback is under 8 weeks and the sequence is stable across the whole log.',
  payback_threshold_weeks: 8,
  maintenance_factor: 1.3,
  context_switch_note:
    'The 15 s figure for leaving the application is a deliberately conservative in-app ' +
    'resumption cost. Do not reach for the widely quoted "23 minutes to refocus" number: it ' +
    'comes from research on a different kind of interruption and does not describe switching ' +
    'panel inside a design tool.',
};

export const CONFIDENCE_FLOOR = {
  rule:
    'Let k be how many times worse a wrong suggestion is than a right one is good. Surface ' +
    'only when p > k / (1 + k).',
  table: [
    { k: 2, floor: 0.67 },
    { k: 3, floor: 0.75 },
    { k: 4, floor: 0.8 },
    { k: 6, floor: 0.86 },
    { k: 8, floor: 0.89 },
  ],
  default_k: 4,
  default_floor: 0.8,
  note:
    'Default to k = 4 and a floor of 0.80. Most trigram models over a design log clear 0.80 in ' +
    'a handful of contexts and nowhere else, which is the correct outcome. Three reliable ' +
    'suggestions beat forty speculative ones.',
  never:
    'Never auto-execute a predicted action — surface it as an accelerator needing a deliberate ' +
    'keystroke. For anything destructive or hard to undo, such as flatten, merge, delete, close ' +
    'or overwrite on export, do not surface it at any confidence.',
};

export const REFIT_RULE =
  'Workflows are non-stationary. Refit anything built on a log older than about eight weeks or ' +
  'predating a major version change, and report the date range every time.';

export const REMEASURE_RULE =
  'Two weeks later, log again and check each new macro is firing at the predicted rate. Remove ' +
  'the ones that are not — dead automation is worse than none, because it still occupies a ' +
  'hotkey and a slot in the designer\'s memory.';

/** floor = k / (1 + k), the surfacing threshold for a given cost asymmetry. */
export function floorForK(k) {
  return k / (1 + k);
}
