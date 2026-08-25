/**
 * Band data from references/band-descriptors.md: the naming map across
 * grading systems, what separates the bands, the 2:1 to 1st pivot, and the
 * descriptor-phrase translations. Positioning a draft within these bands is a
 * judgement and belongs to the skill; this module only carries the tables.
 */

/** Ordered worst to best. Ids are what the audit log stores. */
export const BAND_ORDER = ['fail', 'third', 'two_two', 'two_one', 'first'];

export const BAND_LABELS = {
  fail: 'Fail',
  third: 'Third',
  two_two: 'Lower second (2:2)',
  two_one: 'Upper second (2:1)',
  first: 'First (1st)',
};

export const NAMING_MAP = [
  { band: 'first', uk: 'First (1st)', uk_percent: '70-100', us_letter: 'A / A+', us_gpa: '4.0', ects: 'A', plain_name: 'Excellent' },
  { band: 'two_one', uk: 'Upper second (2:1)', uk_percent: '60-69', us_letter: 'B+ / A-', us_gpa: '3.3-3.7', ects: 'B', plain_name: 'Good' },
  { band: 'two_two', uk: 'Lower second (2:2)', uk_percent: '50-59', us_letter: 'B / B-', us_gpa: '2.7-3.0', ects: 'C', plain_name: 'Satisfactory' },
  { band: 'third', uk: 'Third', uk_percent: '40-49', us_letter: 'C / C+', us_gpa: '2.0-2.3', ects: 'D/E', plain_name: 'Adequate' },
  { band: 'fail', uk: 'Fail', uk_percent: '0-39', us_letter: 'D / F', us_gpa: '0-1.0', ects: 'F', plain_name: 'Fail' },
];

export const NAMING_CAUTIONS = [
  'UK 70% and US "A" are not the same object: a UK first is a band that runs to 100 and is rarely ' +
    'awarded above 85, while a US A commonly means 93-100. A UK mark of 65 is a solid grade, not the ' +
    'near-fail an American reader hears.',
  'Where an institution publishes its own descriptors, those override this table.',
];

export const POSTGRADUATE_NOTE =
  'Postgraduate UK typically shifts the boundaries up: 70+ distinction, 60-69 merit, 50-59 pass, ' +
  'below 50 fail. Check the handbook.';

export const BAND_SEPARATION = [
  {
    band: 'fail',
    evidence_use: 'Absent, wrong, or not on topic',
    argument: 'No thread',
    sources: 'None, or uncited',
    judgement: 'None',
  },
  {
    band: 'third',
    evidence_use: 'Present but descriptive',
    argument: 'Assertion without support',
    sources: 'Few, mostly lecture slides',
    judgement: 'None',
  },
  {
    band: 'two_two',
    evidence_use: 'Accurate, summarised source by source',
    argument: 'A position stated, unevenly supported',
    sources: 'Set reading, used as summary',
    judgement: 'Occasional, unsupported',
  },
  {
    band: 'two_one',
    evidence_use: 'Accurate, relevant, well organised',
    argument: 'A clear position sustained throughout',
    sources: 'Set reading plus some independent, used correctly',
    judgement: 'Present but borrowed — reports what critics say',
  },
  {
    band: 'first',
    evidence_use: 'Selected, weighed, some sources rejected on stated grounds',
    argument: 'A position the student owns, with the strongest objection answered',
    sources: 'Independent reading, including material against the position',
    judgement: "The student's own, defended",
  },
];

export const PIVOT = {
  finding:
    'The difference between a 2:1 and a first is evaluation and independent judgement — almost never ' +
    'more research, more sources or more content. A 2:1 draft demonstrates the student has understood ' +
    'the field; a first demonstrates a defensible position within it, held against the best argument ' +
    'on the other side.',
  moves_in_order_of_return: [
    {
      move: 'Adjudicate',
      detail: 'Wherever two sources are cited near each other, add a sentence saying which is more ' +
        'persuasive here and on what grounds. Two or three of these across an essay is often the entire gap.',
    },
    {
      move: 'Steelman then answer',
      detail: 'Find the strongest argument against the position — not a weak one that is easy to ' +
        'dismiss — state it fairly, then say why the position survives it. Markers reward this because ' +
        'it is the hardest thing to fake.',
    },
    {
      move: 'Show selection',
      detail: 'Say why a source was chosen, or why a widely cited one is not used. This signals that ' +
        'reading was directed rather than accumulated.',
    },
  ],
  what_does_not_move_it: [
    'More sources. A draft with 14 references and no judgement stays a 2:1.',
    'More length. Beyond the word count, length is a penalty.',
    'Better prose. Fluency lifts a 2:2 to a 2:1; it does not lift a 2:1 to a first.',
    'More theory explained. That is knowledge-criterion work, and the knowledge criterion is usually cheap.',
  ],
};

export const DESCRIPTOR_PHRASES = [
  { phrase: 'comprehensive understanding', demands: 'Coverage. Rung 1-2. Cheap.' },
  { phrase: 'systematic', demands: 'Structure and completeness, not insight' },
  { phrase: 'critical', demands: 'Rung 6. Judgement with stated criteria.' },
  { phrase: 'sophisticated', demands: 'Conditions and exceptions named — "X holds, except where Y"' },
  { phrase: 'nuanced', demands: 'Conditions and exceptions named — "X holds, except where Y"' },
  { phrase: 'originality', demands: "Rung 6-7. A position, or a synthesis, that is the student's" },
  { phrase: 'independent thought', demands: "Rung 6-7. A position, or a synthesis, that is the student's" },
  { phrase: 'authoritative', demands: 'Sources beyond the reading list, used confidently' },
  { phrase: 'publishable quality', demands: 'Realistically: a strong first. Do not treat literally.' },
  { phrase: 'some evidence of', demands: 'The band below the one where the phrase is absent' },
];

export const CRITICAL_SIGNAL =
  'The word "critical" appearing anywhere in the top band and not in the band below is the clearest ' +
  'signal a descriptor set can give: evaluation is the boundary.';

export const HONESTY_RULES = [
  'Give a range spanning at least one band boundary when the draft is near a boundary.',
  'Name what is holding it at the lower band, as a specific missing observable.',
  'Never state or imply a percentage.',
  'Say explicitly that this is a reading of published descriptors, not a prediction of the mark, ' +
    'and that markers and moderation vary.',
  'If no band descriptors were supplied, say the positioning is generic and weaker for it.',
];

export function bandIsValid(band) {
  return BAND_ORDER.includes(band);
}

export function bandIndex(band) {
  return BAND_ORDER.indexOf(band);
}
