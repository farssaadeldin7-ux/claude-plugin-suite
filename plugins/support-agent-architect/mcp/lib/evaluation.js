/**
 * The regression-set method and metric definitions, ported from
 * references/escalation-and-eval.md. The scorer is arithmetic over outcomes a
 * person has already assigned: it computes the three metrics by their stated
 * formulas, checks the set's composition, and reads the rollout gates. It does
 * not judge whether any individual answer was correct — that scoring is human
 * work, and the reference says why.
 */

export const OUTCOMES = {
  correct_contained: 'Answered, and the answer matches the known-good answer',
  correct_escalated: 'Escalated, and escalation was right',
  over_escalated: 'Escalated, but a good answer was available',
  false_contained: 'Answered, and the answer was wrong, incomplete or unqualified',
};

export const COMPOSITION = {
  size: '50 to 100 real tickets, first message verbatim, with a known-good answer written by a senior agent, spread across intents in rough proportion to volume',
  must_escalate_min: 10,
  near_miss_min: 5,
  no_answer_min: 5,
  must_escalate: 'at least 10 that must escalate, one per hard trigger where you have real examples',
  near_misses: 'at least 5 near-misses: tickets whose wording resembles a static intent but requires a lookup or a judgement',
  no_answer: 'at least 5 with no correct answer in the knowledge base, where "I don\'t know" is the only pass',
  freeze: 'Freeze it. Version it. Re-run on every article, prompt, retriever or model change.',
  refresh: 'The set ages: refresh 20% of the cases each quarter from recent traffic.',
};

export const SCORING_NOTE =
  'Score by a human on the first two runs. Automated scoring drifts on exactly the cases that ' +
  'matter — partially correct answers with a missing qualifier — so spot-check 20% by hand forever.';

export const METRICS = [
  { metric: 'Containment', formula: '(correct_contained + false_contained) / total', target: 'Capacity measure only' },
  { metric: 'Accuracy on contained', formula: 'correct_contained / (correct_contained + false_contained)', target: 'Above 95%' },
  { metric: 'False-containment', formula: 'false_contained / total', target: 'Under 2%, ideally under 1%' },
  { metric: 'Over-escalation', formula: 'over_escalated / total', target: 'Under 15%, tune last' },
];

export const DEFLECTION_NOTE =
  'Deflection rate — the share of conversations that did not reach a human — is a vanity metric. ' +
  'It counts an abandoned customer as a success. Never report it alone; give it alongside ' +
  'accuracy and false-containment, and say plainly what it does and does not measure.';

export const ROLLOUT_GATES = [
  { gate: 'Suggest-only, human sends', requires: 'Regression accuracy above 90%' },
  { gate: 'Auto-answer top 3 static intents', requires: 'Regression accuracy above 95%, false-containment under 2%' },
  { gate: 'Widen to all static intents', requires: 'Seven consecutive days live under 2% false-containment per intent' },
  { gate: 'Enable account-specific answers', requires: 'Live lookup verified, plus 20 regression cases with real account state' },
];

export const ROLLBACK_RULE =
  'Roll back on a single false-containment incident involving money, data deletion or safety. ' +
  'One is enough — those categories are why the escalation list is hard rather than advisory.';

export const UNCERTAINTY_NOTES = [
  'A regression set of 50-100 cases gives a false-containment estimate with a wide interval. At 2% observed on 100 cases, the true rate could plausibly be near 6%. Treat it as a floor on your uncertainty, not a measurement.',
  'Customer satisfaction is not in any of these metrics. An agent can be accurate and still annoying. Measure CSAT on contained conversations separately, against CSAT on human-handled conversations for the same intents.',
];

export const OVER_ESCALATION_NOTE =
  'Over-escalation is a real cost, but a recoverable one. Tune it down only after ' +
  'false-containment is under control, never before.';

const pct = (numerator, denominator) =>
  denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;

export function outcomeIsValid(outcome) {
  return Object.prototype.hasOwnProperty.call(OUTCOMES, outcome);
}

/**
 * Compute the metrics for one scored regression run. Pure arithmetic over the
 * four outcomes, by the stated formulas, plus the composition checks and the
 * two gates a regression run can actually assess. The live gates need live
 * data and are reported as not assessable rather than guessed at.
 */
export function scoreRegression(cases) {
  const counts = { correct_contained: 0, correct_escalated: 0, over_escalated: 0, false_contained: 0 };
  for (const c of cases) counts[c.outcome]++;

  const total = cases.length;
  const contained = counts.correct_contained + counts.false_contained;

  const containment = pct(contained, total);
  const accuracy = pct(counts.correct_contained, contained);
  const falseContainment = pct(counts.false_contained, total);
  const overEscalation = pct(counts.over_escalated, total);

  // Composition, where the case flags allow it to be checked.
  const composition = [];
  if (total < 50) {
    composition.push({ check: 'set_size', evidence: `${total} cases`, why: 'The method asks for 50 to 100 real tickets. Below 50 the estimates are too loose to gate a rollout on.' });
  }
  const flagged = (key) => cases.filter((c) => c[key] === true).length;
  const anyFlags = cases.some((c) => 'must_escalate' in c || 'near_miss' in c || 'no_answer_in_kb' in c);
  if (anyFlags) {
    const mustEscalate = flagged('must_escalate');
    const nearMisses = flagged('near_miss');
    const noAnswer = flagged('no_answer_in_kb');
    if (mustEscalate < COMPOSITION.must_escalate_min) {
      composition.push({ check: 'must_escalate_cases', evidence: `${mustEscalate} flagged`, why: COMPOSITION.must_escalate });
    }
    if (nearMisses < COMPOSITION.near_miss_min) {
      composition.push({ check: 'near_miss_cases', evidence: `${nearMisses} flagged`, why: COMPOSITION.near_misses });
    }
    if (noAnswer < COMPOSITION.no_answer_min) {
      composition.push({ check: 'no_answer_cases', evidence: `${noAnswer} flagged`, why: COMPOSITION.no_answer });
    }
  } else {
    composition.push({
      check: 'flags_not_supplied',
      evidence: 'no case carries must_escalate, near_miss or no_answer_in_kb flags',
      why: 'The must-escalate (10), near-miss (5) and no-answer (5) minimums could not be checked.',
    });
  }

  // Internal consistency: a case flagged must-escalate that was contained is a
  // containment of a hard trigger — the exact failure the set exists to catch.
  const inconsistencies = [];
  for (const c of cases) {
    const id = c.id ?? '(no id)';
    if (c.must_escalate === true && (c.outcome === 'correct_contained' || c.outcome === 'false_contained')) {
      inconsistencies.push({
        case: id, outcome: c.outcome,
        why: 'Flagged must-escalate but contained. A contained hard-trigger case is a false containment whatever the answer said — re-score it, and treat it as rollback-grade if it involves money, data deletion or safety.',
      });
    }
    if (c.no_answer_in_kb === true && c.outcome === 'correct_contained') {
      inconsistencies.push({
        case: id, outcome: c.outcome,
        why: 'Flagged as having no correct answer in the knowledge base, yet scored correct_contained. On these cases "I don\'t know" is the only pass — one of the two labels is wrong.',
      });
    }
  }

  const gates = [
    {
      gate: 'Suggest-only, human sends',
      requires: 'Regression accuracy above 90%',
      met: accuracy == null ? null : accuracy > 90,
    },
    {
      gate: 'Auto-answer top 3 static intents',
      requires: 'Regression accuracy above 95%, false-containment under 2%',
      met: accuracy == null ? null : accuracy > 95 && falseContainment < 2,
    },
    {
      gate: 'Widen to all static intents',
      requires: 'Seven consecutive days live under 2% false-containment per intent',
      met: 'not assessable from a regression run — needs live per-intent data',
    },
    {
      gate: 'Enable account-specific answers',
      requires: 'Live lookup verified, plus 20 regression cases with real account state',
      met: 'not assessable from outcome counts — needs the lookup verified and account-state cases',
    },
  ];

  return {
    cases: total,
    counts,
    metrics: {
      containment_percent: containment,
      containment_reading: 'Capacity, not quality. Never report it alone.',
      accuracy_on_contained_percent: accuracy,
      accuracy_target: 'Above 95% before wider rollout',
      false_containment_percent: falseContainment,
      false_containment_target: 'Under 2%, ideally under 1%. Investigate every instance.',
      over_escalation_percent: overEscalation,
      over_escalation_target: 'Under 15%. ' + OVER_ESCALATION_NOTE,
    },
    composition_findings: composition,
    ...(inconsistencies.length ? { inconsistencies } : {}),
    rollout_gates: gates,
    rollback_rule: ROLLBACK_RULE,
    uncertainty: UNCERTAINTY_NOTES[0],
    scoring_note: SCORING_NOTE,
  };
}
