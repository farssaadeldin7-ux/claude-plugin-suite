/**
 * The clip-scoring rubric: four axes, 0–3 each, twelve points available, with
 * the hard disqualifiers applied before scoring and the threshold table
 * applied after.
 *
 * This module does the arithmetic only. Assigning the four axis scores — the
 * actual judgement — is the skill's job; nothing here reads a transcript or
 * decides what a moment deserves.
 */

export const DISQUALIFIERS = [
  {
    id: 'unresolved_referent',
    label: 'Unresolved referent',
    tell: '"that", "he", "the thing we mentioned", "as I said earlier" with no antecedent inside the clip',
  },
  {
    id: 'payoff_outside_out_point',
    label: 'Payoff outside the out-point',
    tell: 'The answer to the tension arrives after the last usable sentence boundary',
  },
  {
    id: 'callback',
    label: 'Callback',
    tell: 'The line is funny or sharp only because of a bit established earlier in the episode',
  },
  {
    id: 'off_screen_visual',
    label: 'Off-screen visual dependency',
    tell: '"as you can see", "look at this chart", "the one on the left"',
  },
  {
    id: 'crosstalk_over_key_line',
    label: 'Crosstalk over the key line',
    tell: 'Overlapping speaker labels, [inaudible], [crosstalk] inside the thesis sentence',
  },
  {
    id: 'no_clean_in_point',
    label: 'No clean in-point',
    tell: 'No sentence start within 4 seconds before the thesis',
  },
  {
    id: 'named_third_party',
    label: 'Named third party in an unflattering claim',
    tell: 'Legal and relational risk that a clip amplifies and the episode buried',
  },
  {
    id: 'unverifiable_claim',
    label: 'Unverifiable factual claim presented as fact',
    tell: 'A number or attribution nobody on the team can source',
  },
];

export const DISQUALIFIER_NOTE =
  'Any one of these removes the candidate. They are not deductions. The unresolved referent is the ' +
  'most common by a wide margin and the easiest to miss, because you have read the previous ' +
  'paragraph and the viewer has not.';

export const AXES = [
  {
    id: 'premise',
    name: 'Self-contained premise',
    question: 'Can someone with zero context follow it?',
    descriptors: {
      3: 'Opens with its own subject. No proper noun, product or prior claim needs explaining. Works cold.',
      2: 'One unfamiliar term, but the clip defines it in passing or the meaning is inferable',
      1: 'Needs one sentence of setup that is not in the clip. Recoverable only via an on-screen caption.',
      0: 'Only makes sense inside the episode. Disqualified regardless of total.',
    },
    note: 'A 0 here is terminal. This is the one rule in numeric form.',
  },
  {
    id: 'tension',
    name: 'Tension',
    question: 'Is there a claim someone could disagree with, or a stake?',
    descriptors: {
      3: 'A named position that a reasonable, informed person would argue against',
      2: 'A surprising fact or an admission — no opponent, but it violates an expectation',
      1: 'Mildly interesting, broadly agreed. Nobody would reply.',
      0: 'Consensus stated warmly. Pleasant, inert.',
    },
    note:
      'Agreement is the enemy here. Two people nodding at each other for 40 seconds scores 0 no matter ' +
      'how true it is. The reliable test: can you write the disagreeing comment? If you cannot, nobody ' +
      'else will either.',
  },
  {
    id: 'payoff',
    name: 'Payoff inside the clip',
    question: 'Does the thing the opening implies actually land before the out-point?',
    descriptors: {
      3: 'Setup and resolution both inside, with the resolution in the final third',
      2: 'Resolves, but the last 20% is trailing-off restatement that must be trimmed',
      1: 'Partial — implies more than it delivers. The clip ends on an unpaid promise.',
      0: 'Pure setup. The answer is elsewhere in the episode.',
    },
    note:
      'A 1 here is the source of most clips that get high tap rates and terrible completion. It is ' +
      'worth more than any other axis to fix, and usually the fix is moving the out-point later rather ' +
      'than cleverer titling.',
  },
  {
    id: 'boundaries',
    name: 'Clean boundaries',
    question: 'Can it be cut on sentence boundaries without surgery?',
    descriptors: {
      3: 'Clean sentence start and end, no crosstalk, single speaker or a clean handover',
      2: 'Needs 1–2 internal trims (a tangent, a filler run) that do not break continuity',
      1: 'Needs 3+ trims, or a jump cut across a change of subject that will show',
      0: 'Cannot be cut without an edit a viewer will notice as manipulation',
    },
    note:
      'Internal trims are legitimate and normal. The line is whether the trimmed version still ' +
      'represents what the person meant. If it does not, it is a 0 and it is also an ethics problem, ' +
      'not just a craft one.',
  },
];

export const THRESHOLDS = [
  { total: '10–12', action: 'publish_candidate', rule: 'Publish candidate. Goes on the cut list.' },
  { total: '9', action: 'publish_candidate_conditional', rule: 'Publish candidate only if no single axis is below 2.' },
  { total: '7–8', action: 'rework_list', rule: 'Rework list — name the one axis holding it back.' },
  { total: '0–6', action: 'leave_in_episode', rule: 'Leave it in the episode.' },
];

export const VOLUME_NOTE =
  'Raise the threshold, do not lower it, when volume is the problem. A weekly show that needs four ' +
  'clips and produces eleven at 9+ should publish the top four, not all eleven. Publishing the weak ' +
  'ones trains the account\'s distribution downward.';

export const WORKED_EXAMPLES = [
  {
    title: '"We stopped hiring senior people entirely"',
    quote:
      'Guest: We stopped hiring senior people entirely for about eighteen months. Everyone told us it ' +
      'was insane. But what we found was that a senior hire spends the first quarter arguing that the ' +
      'way they did it at their last company was better, and by the time they stop arguing, the thing ' +
      'they wanted to build has been built by someone with two years\' experience who just did it.',
    scores: { premise: 3, tension: 3, payoff: 3, boundaries: 3 },
    verdict:
      '12/12. Shorts and LinkedIn. Cold open on "We stopped hiring senior people entirely".',
  },
  {
    title: '"That\'s exactly the thing Dave was talking about"',
    quote:
      'Host: Right, and that\'s exactly the thing Dave was talking about, isn\'t it? That whole ' +
      'dynamic. It\'s the same problem.',
    scores: null,
    verdict:
      'Disqualified on unresolved referent before scoring. It was a genuinely good moment in the ' +
      'episode and it is not a clip. This is the most common false positive.',
  },
  {
    title: 'The 40-second pricing walkthrough',
    quote:
      'Guest: So the way we price it now — first, we work out what the customer saves in a year. Then ' +
      'we take a fifth of that. Then we sanity-check it against what the incumbent charges, and if ' +
      'we\'re above them we go back to step one. That\'s the whole method.',
    scores: { premise: 3, tension: 1, payoff: 3, boundaries: 3 },
    verdict:
      '10/12. Publishes, but as a practical how-to rather than a hook clip. Expect saves and shares ' +
      'rather than comments — the correct destination is LinkedIn or a carousel-style Short, not a ' +
      'debate-bait Reel.',
  },
  {
    title: 'The near-miss confession',
    quote:
      'Guest: We were about six weeks from not making payroll. I hadn\'t told anyone on the team. My ' +
      'co-founder didn\'t know either, which — yeah, I would do that differently.',
    scores: { premise: 3, tension: 2, payoff: 2, boundaries: 2 },
    verdict:
      '9/12, no axis below 2, so it publishes. Out-point at "didn\'t know either" and cut the rest.',
  },
];

export function disqualifierFor(id) {
  return DISQUALIFIERS.find((d) => d.id === String(id ?? '').trim().toLowerCase()) ?? null;
}

export const scoreIsValid = (value) => Number.isInteger(value) && value >= 0 && value <= 3;

/**
 * Apply the rubric mechanically to four already-assigned axis scores.
 * Disqualifiers first — they are cheaper than scoring and they remove more —
 * then the terminal premise rule, then the threshold table.
 */
export function scoreClip({ premise, tension, payoff, boundaries, disqualifiers = [] }) {
  if (disqualifiers.length) {
    return {
      disqualified: true,
      scored: false,
      by: disqualifiers.map((id) => disqualifierFor(id)),
      note: DISQUALIFIER_NOTE,
    };
  }

  const scores = { premise, tension, payoff, boundaries };
  const total = premise + tension + payoff + boundaries;

  if (premise === 0) {
    return {
      disqualified: true,
      scored: true,
      scores,
      total,
      reason: AXES[0].descriptors[0],
      note: AXES[0].note,
    };
  }

  const lowest = Math.min(tension, payoff, boundaries, premise);
  const lowestAxes = AXES.filter((a) => scores[a.id] === lowest).map((a) => a.id);

  let action, rule;
  if (total >= 10) {
    ({ action, rule } = THRESHOLDS[0]);
  } else if (total === 9) {
    if (lowest >= 2) ({ action, rule } = THRESHOLDS[1]);
    else {
      action = 'rework_list';
      rule = `Total is 9 but an axis is below 2 (${lowestAxes.join(', ')} at ${lowest}), so it does not publish: "${THRESHOLDS[1].rule}"`;
    }
  } else if (total >= 7) {
    ({ action, rule } = THRESHOLDS[2]);
  } else {
    ({ action, rule } = THRESHOLDS[3]);
  }

  return {
    disqualified: false,
    scores,
    total,
    action,
    rule,
    ...(action === 'rework_list'
      ? { lowest_axes: lowestAxes, lowest_score: lowest }
      : {}),
    ...(payoff === 1 ? { payoff_note: AXES[2].note } : {}),
  };
}
