/**
 * The yield arithmetic from SKILL.md step 4: score every candidate change,
 * apply the thresholds, take the top three, and check the two hard
 * constraints. Everything here is the mechanical part of the method — the
 * scores themselves (Impact, Transfer, Cost) are judgements the caller
 * supplies, and when a constraint is violated the choice of which change to
 * keep is the skill's, not this module's.
 */

/** The three factors and their scales, verbatim from the skill. */
export const FACTORS = {
  impact: {
    scale: '1-5',
    min: 1,
    max: 5,
    meaning: 'How much the outcome of a round or game moves when it is applied',
  },
  transfer: {
    scale: '1-3',
    min: 1,
    max: 3,
    meaning: '3 = every game; 2 = most games; 1 = this matchup or this patch only',
  },
  cost: {
    scale: '1-5',
    min: 1,
    max: 5,
    meaning: 'Reps before it is default. 1 = a conscious decision available today; 5 = motor skill, weeks',
  },
};

export const FORMULA = 'Yield = (Impact x Transfer) / Cost';

/** The action thresholds, verbatim from the skill. */
export const THRESHOLDS = [
  { yield: '3.0 and above', action: 'Sheet candidate — take the top three by yield' },
  { yield: '1.5 - under 3.0', action: 'Include only if a slot is unfilled' },
  { yield: 'Below 1.5', action: 'Cut, and name it in the cut list' },
];

/** The two hard constraints on the final three, verbatim from the skill. */
export const CONSTRAINTS = {
  one_motor_skill:
    'At most one change with Cost 4 or 5. One motor-skill change per session is the ceiling; '
    + 'two compete for the same practice attention and neither lands.',
  one_cheap:
    'At least one change with Cost 1 or 2. The sheet needs something that works in the very '
    + 'next match, or the player has nothing to feel by the end of the session.',
};

/** What the skill says when nothing clears 1.5. */
export const NOTHING_SCORES_NOTE =
  'Nothing scores above 1.5, so the bottleneck is not knowledge. Say so directly: it is usually '
  + 'tilt control, sleep, session length, or playing a role or character the player does not '
  + 'enjoy. Write the sheet about that instead.';

/** Returns a list of problems with a candidate; empty when it is valid. */
export function candidateProblems(candidate, index) {
  const problems = [];
  const label = `candidate ${index + 1}`;
  if (!candidate || typeof candidate !== 'object') {
    return [`${label}: not an object`];
  }
  if (typeof candidate.change !== 'string' || !candidate.change.trim()) {
    problems.push(`${label}: "change" must be a non-empty string`);
  }
  for (const [factor, spec] of Object.entries(FACTORS)) {
    const value = candidate[factor];
    if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
      problems.push(`${label}: "${factor}" must be an integer ${spec.min}-${spec.max} (${spec.meaning.toLowerCase()})`);
    }
  }
  return problems;
}

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Score candidates, sort by yield, select the top three, and report any
 * constraint violation as a fact — never resolving it. Ties in yield keep the
 * input order, so the result is deterministic for a given input.
 */
export function scoreChanges(candidates) {
  const scored = candidates.map((c, index) => {
    const yieldValue = (c.impact * c.transfer) / c.cost;
    return {
      change: c.change.trim(),
      impact: c.impact,
      transfer: c.transfer,
      cost: c.cost,
      yield: round1(yieldValue),
      verdict: yieldValue >= 3 ? 'sheet_candidate'
        : yieldValue >= 1.5 ? 'fill_only'
        : 'cut',
      _exact: yieldValue,
      _index: index,
    };
  });

  const byYield = [...scored].sort((a, b) => b._exact - a._exact || a._index - b._index);

  // Top three by yield from the 3.0-and-above band; the 1.5-to-3.0 band fills
  // only slots the first band leaves empty. Cut items never fill a slot.
  const selected = byYield.filter((c) => c.verdict === 'sheet_candidate').slice(0, 3);
  if (selected.length < 3) {
    for (const c of byYield) {
      if (selected.length === 3) break;
      if (c.verdict === 'fill_only') selected.push(c);
    }
  }

  const violations = [];
  const motorSkill = selected.filter((c) => c.cost >= 4);
  if (motorSkill.length > 1) {
    violations.push({
      constraint: 'one_motor_skill',
      rule: CONSTRAINTS.one_motor_skill,
      offending: motorSkill.map((c) => c.change),
      resolution: 'Which one to keep is a judgement — keep one, cut the other to next session.',
    });
  }
  if (selected.length > 0 && !selected.some((c) => c.cost <= 2)) {
    violations.push({
      constraint: 'one_cheap',
      rule: CONSTRAINTS.one_cheap,
      offending: selected.map((c) => c.change),
      resolution: 'Swap something in with Cost 1 or 2 — which change gives way is a judgement.',
    });
  }

  const strip = ({ _exact, _index, ...rest }) => rest;
  const selectedSet = new Set(selected);
  const cut = byYield.filter((c) => !selectedSet.has(c));

  return {
    formula: FORMULA,
    scored: byYield.map(strip),
    top_three: selected.map(strip),
    cut_list: cut.map((c) => ({ change: c.change, yield: c.yield, verdict: c.verdict })),
    constraint_violations: violations,
    ...(scored.every((c) => c._exact <= 1.5) ? { note: NOTHING_SCORES_NOTE } : {}),
  };
}
