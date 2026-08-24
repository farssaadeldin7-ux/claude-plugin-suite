/**
 * Weight-to-effort arithmetic from references/rubric-decomposition.md:
 *
 *   words per criterion (target) = total words x criterion weight
 *   marks per 100 words          = criterion weight / (total words / 100)
 *   investment ratio             = actual section words / target words
 *
 * Pure arithmetic against the reference's threshold table. Whether a heavy
 * ratio is justified by a high-verb criterion is a judgement, and the output
 * says so rather than making it.
 */

/** The investment-ratio verdict table, verbatim thresholds. */
export const RATIO_TABLE = [
  { ratio: 'above 1.5', verdict: 'over_invested', action: 'Cut. The marks are not there.' },
  { ratio: '1.5 to 1.2', verdict: 'slightly_heavy', action: 'Acceptable if the criterion is high-verb.' },
  { ratio: '1.2 to 0.8', verdict: 'on_budget', action: 'Leave it.' },
  { ratio: '0.8 to 0.5', verdict: 'thin', action: 'Expand if the criterion is unmet.' },
  { ratio: 'below 0.5', verdict: 'under_invested', action: 'Usually the biggest available gain.' },
];

export const STANDING_RULES = [
  'A criterion at or above 20% that is unmet outranks every other fix, regardless of effort.',
  'A criterion at or below 10% that is already met is finished. Additional polish there converts into no marks.',
];

export const HIGH_VERB_NOTE =
  'High-verb criteria justify a ratio above 1.0: evaluation costs more words per mark than ' +
  'description, because it needs the evidence, the judgement and the objection.';

export function ratioVerdict(ratio) {
  if (ratio > 1.5) return RATIO_TABLE[0];
  if (ratio > 1.2) return RATIO_TABLE[1];
  if (ratio >= 0.8) return RATIO_TABLE[2];
  if (ratio >= 0.5) return RATIO_TABLE[3];
  return RATIO_TABLE[4];
}

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * @param {number} totalWords
 * @param {Array<{name: string, weight: number, actual_words?: number}>} criteria
 *   weight as a percentage (40 means 40%); actual_words optional.
 */
export function effortMap(totalWords, criteria) {
  const rows = criteria.map((criterion) => {
    const target = totalWords * (criterion.weight / 100);
    const row = {
      criterion: criterion.name,
      weight_percent: criterion.weight,
      target_words: Math.round(target),
      marks_per_100_words: round(criterion.weight / (totalWords / 100)),
    };
    if (typeof criterion.actual_words === 'number') {
      const ratio = target > 0 ? criterion.actual_words / target : null;
      row.actual_words = criterion.actual_words;
      row.investment_ratio = ratio === null ? null : round(ratio);
      if (ratio !== null) {
        const { verdict, action } = ratioVerdict(ratio);
        row.verdict = verdict;
        row.action = action;
      }
    } else {
      row.actual_words = null;
      row.investment_ratio = null;
      row.note = 'No actual word count supplied — target only.';
    }
    return row;
  });

  const weightSum = round(criteria.reduce((sum, c) => sum + c.weight, 0));
  return {
    total_words: totalWords,
    weight_sum_percent: weightSum,
    ...(Math.abs(weightSum - 100) > 0.01
      ? { weight_warning: `Weights sum to ${weightSum}%, not 100% — targets use the weights as given. Check the rubric.` }
      : {}),
    criteria: rows,
    standing_rules: STANDING_RULES,
    high_verb_note: HIGH_VERB_NOTE,
  };
}
