/**
 * Corpus curation rules and the mechanical corpus check, ported from
 * skills/digital-twin-collaborator/references/corpus-curation.md and the rights
 * checklist in references/drift-and-governance.md.
 *
 * corpusCheck() reports facts a machine can verify about a labelled corpus
 * list: sizes, missing fields, label values outside the schema, near-miss and
 * constraint bookkeeping, date spread. Whether a piece belongs in the corpus —
 * ownership, quality, whose decisions it encodes — is judgement, and nothing
 * here claims to have checked it.
 */

export const SIZE_BANDS = [
  {
    range: 'under 10',
    min: 0, max: 9,
    reading: 'The profile over-fits. Two pieces sharing an accident become a rule. Do not report dimension values as settled.',
  },
  {
    range: '10-14',
    min: 10, max: 14,
    reading: 'Workable for a single medium if the pieces are recent and consistent. Mark every dimension provisional.',
  },
  {
    range: '15-40',
    min: 15, max: 40,
    reading: 'The useful range. Regularities separate from accidents; absences become credible.',
  },
  {
    range: 'over 40',
    min: 41, max: Infinity,
    reading: 'Diminishing returns, and older work drags the profile toward who the director used to be. Trim by date before adding.',
  },
];

export const INCLUSION_RULES = [
  'Only work they would show a client today. The corpus sets a standard. Work they are fond of but would not show does not belong.',
  'Owned or licensed. No ownership, no inclusion.',
  'Recent enough to be current. Prefer the last three to five years. A style from ten years ago is someone else\'s.',
  'Spread across brief types, so the profile does not encode one client\'s product.',
  'Two or three near-misses, deliberately chosen and clearly labelled.',
];

export const EXCLUSION_RULES = [
  {
    exclude: 'Work heavily shaped by a client\'s brand guidelines',
    why: 'Encodes the client\'s colour system and type stack, not the director\'s. If guidelines drove more than roughly a third of the decisions, leave it out.',
  },
  {
    exclude: 'Work-for-hire the director does not own',
    why: 'Rights, and it usually falls foul of the brand-guidelines rule as well.',
  },
  {
    exclude: 'Collaborations where someone else led',
    why: 'You cannot separate the two hands after the fact.',
  },
  {
    exclude: 'Pitch work that was never made',
    why: 'Unresolved, and usually over-styled.',
  },
  {
    exclude: 'Personal experiments in an unrelated medium',
    why: 'Interesting, and noise for this purpose.',
  },
  {
    exclude: 'Anything from another person\'s portfolio',
    why: 'Out of scope. Refuse.',
  },
];

export const BRAND_GUIDELINES_TEST =
  'The test is not whether the work is good, it is whether the decisions were theirs. If the client\'s guidelines ' +
  'had said something different, would this piece look different? If yes, and in more than a couple of dimensions, ' +
  'it belongs in the archive, not the corpus. A useful middle path: include the piece but exclude the dimensions ' +
  'the guidelines governed — record that in the label\'s "contributes" field.';

export const LABEL_SCHEMA = {
  id: 'Short name you can cite in the profile',
  brief: 'One sentence — what was asked for',
  medium: 'film, stills, identity, editorial, campaign, longform, script',
  year: 'Four digits',
  landed: '"landed", "mixed", or "near-miss"',
  constraints: '"none", "light", "heavy" — how much a client\'s guidelines shaped it',
  contributes: '"all", or a list of dimensions if the piece is partial',
  note: 'Only for near-misses: one sentence on what is wrong with it',
};

export const LABEL_NOTE =
  '"landed" and "mixed" record how the work performed against the brief, not its quality. "near-miss" is the ' +
  'exception: it records style distance — a piece that is almost the author\'s voice and not quite, however it ' +
  'performed against the brief. A piece can be exemplary and have landed badly. Keep both facts.';

export const MEDIA = ['film', 'stills', 'identity', 'editorial', 'campaign', 'longform', 'script'];
export const LANDED_VALUES = ['landed', 'mixed', 'near-miss'];
export const CONSTRAINT_VALUES = ['none', 'light', 'heavy'];

export const RIGHTS_CHECKLIST = [
  'The director owns each piece, or holds a licence that permits this reuse',
  'Work-for-hire pieces have been identified. Unless a clause assigns rights back to the director, they are the client\'s and are excluded',
  'No piece comes from another person\'s or studio\'s portfolio',
  'Collaborative work is excluded, or the director\'s contribution is separable and stated',
  'Pieces containing identifiable people have whatever release the original use required, and this reuse does not exceed it',
  'Client confidentiality: nothing unreleased or under embargo is in the corpus',
  'Where the corpus is stored, and who can read it, is written down',
];

/** The worked 20-piece curation, kept whole as the reference example. */
export const WORKED_EXAMPLE = {
  setting: 'A freelance creative director working in brand film and editorial stills. Started with 34 candidate pieces.',
  corpus: [
    { id: 'harbour-film', brief: 'Founder story for a boatbuilder', medium: 'film', year: 2024, landed: 'landed', constraints: 'none' },
    { id: 'harbour-stills', brief: 'Stills set from the same shoot', medium: 'stills', year: 2024, landed: 'landed', constraints: 'none' },
    { id: 'tannery', brief: 'Process film, leather workshop', medium: 'film', year: 2024, landed: 'landed', constraints: 'light' },
    { id: 'coldstore', brief: 'Recruitment film, logistics', medium: 'film', year: 2023, landed: 'mixed', constraints: 'light' },
    { id: 'almanac-01', brief: 'Editorial spread, food quarterly', medium: 'editorial', year: 2024, landed: 'landed', constraints: 'none' },
    { id: 'almanac-02', brief: 'Editorial spread, same title', medium: 'editorial', year: 2024, landed: 'landed', constraints: 'none' },
    { id: 'almanac-cover', brief: 'Cover for the same title', medium: 'editorial', year: 2023, landed: 'landed', constraints: 'none' },
    { id: 'quarry', brief: 'Long-exposure landscape series', medium: 'stills', year: 2023, landed: 'landed', constraints: 'none' },
    { id: 'quarry-essay', brief: '1,800-word accompanying essay', medium: 'longform', year: 2023, landed: 'landed', constraints: 'none' },
    { id: 'bellweather', brief: 'Identity for a small distillery', medium: 'identity', year: 2023, landed: 'landed', constraints: 'none' },
    { id: 'bellweather-film', brief: 'Launch film for the same', medium: 'film', year: 2023, landed: 'mixed', constraints: 'none' },
    { id: 'nightshift', brief: 'Portrait series, hospital staff', medium: 'stills', year: 2022, landed: 'landed', constraints: 'none' },
    { id: 'nightshift-text', brief: 'Captions and short essay', medium: 'longform', year: 2022, landed: 'landed', constraints: 'none' },
    { id: 'ferrous', brief: 'Product film, tool manufacturer', medium: 'film', year: 2024, landed: 'landed', constraints: 'heavy', contributes: ['cadence', 'cut logic', 'framing'] },
    { id: 'saltmarsh', brief: 'Self-initiated short', medium: 'film', year: 2022, landed: 'mixed', constraints: 'none' },
    { id: 'ledger', brief: 'Annual report photography', medium: 'stills', year: 2023, landed: 'landed', constraints: 'light' },
    { id: 'pilot-script', brief: 'Script for an unmade series', medium: 'script', year: 2024, landed: 'landed', constraints: 'none' },
    { id: 'verge', brief: 'Campaign stills, cycling brand', medium: 'stills', year: 2022, landed: 'near-miss', constraints: 'none', note: 'Over-lit and over-saturated. Client pushed for reach and the palette discipline went' },
    { id: 'chorus', brief: 'Charity film', medium: 'film', year: 2023, landed: 'near-miss', constraints: 'light', note: 'Sentimental score, cuts land on the music. Everything else does the opposite' },
    { id: 'foundry-copy', brief: 'Web copy, metalwork studio', medium: 'longform', year: 2024, landed: 'near-miss', constraints: 'none', note: 'Three rhetorical questions in 600 words. Reads like a different writer' },
  ],
  excluded: [
    'Six pieces for a telecoms client — heavy brand guidelines across palette, type and grade. Would have pulled the palette dimension toward a corporate blue that appears nowhere else.',
    'Four pieces from 2016-2018 — pre-date a clear change in the director\'s framing and grade. Kept as an archive to test the profile against, not as input.',
    'Two collaborations with a co-director. Attribution is not separable.',
    'Two unmade pitches, over-styled and never tested.',
  ],
  what_the_near_misses_bought: [
    'Never let an accent colour exceed roughly 12% of frame area, even for reach.',
    'Never cut on a musical beat.',
    'Never use a score that states the emotion the picture is already carrying.',
    'Never open written work with a rhetorical question.',
    'Never use more than one rhetorical device per 600 words.',
  ],
};

export function sizeBand(count) {
  return SIZE_BANDS.find((band) => count >= band.min && count <= band.max);
}

/**
 * Mechanical checks on a labelled corpus list. Every finding is a fact with
 * the evidence named. Nothing here reads the work itself.
 */
export function corpusCheck(pieces, { currentYear = new Date().getFullYear() } = {}) {
  const findings = [];
  const flag = (check, evidence, rule) => findings.push({ check, evidence, rule });

  const seen = new Set();
  pieces.forEach((piece, index) => {
    const where = piece?.id ? `"${piece.id}"` : `piece ${index + 1}`;

    for (const field of ['id', 'brief', 'medium', 'year', 'landed']) {
      if (piece?.[field] === undefined || piece?.[field] === null || piece?.[field] === '') {
        flag('missing_field', `${where}: no "${field}"`, 'Label every piece with the full schema — unlabelled corpora produce unweighted profiles.');
      }
    }
    if (piece?.id) {
      if (seen.has(piece.id)) flag('duplicate_id', `"${piece.id}" appears more than once`, 'Each id must be citable unambiguously in the profile.');
      seen.add(piece.id);
    }
    if (piece?.medium && !MEDIA.includes(piece.medium)) {
      flag('medium_outside_schema', `${where}: medium "${piece.medium}"`, `The labelling schema's media are: ${MEDIA.join(', ')}.`);
    }
    if (piece?.landed && !LANDED_VALUES.includes(piece.landed)) {
      flag('landed_outside_schema', `${where}: landed "${piece.landed}"`, `Valid values: ${LANDED_VALUES.join(', ')}.`);
    }
    if (piece?.constraints && !CONSTRAINT_VALUES.includes(piece.constraints)) {
      flag('constraints_outside_schema', `${where}: constraints "${piece.constraints}"`, `Valid values: ${CONSTRAINT_VALUES.join(', ')}.`);
    }
    if (piece?.year && (!Number.isInteger(piece.year) || piece.year < 1000 || piece.year > 9999)) {
      flag('year_not_four_digits', `${where}: year "${piece.year}"`, 'Year is four digits.');
    }
    if (piece?.landed === 'near-miss' && !piece?.note) {
      flag('near_miss_without_note', where, 'A near-miss carries one sentence on what is wrong with it — that sentence is where never entries come from.');
    }
    if (piece?.constraints === 'heavy' && !(Array.isArray(piece?.contributes) && piece.contributes.length)) {
      flag('heavy_constraints_without_contributes', where, 'A heavy-constraint piece has a "contributes" list of the dimensions the guidelines did not govern, or it is out.');
    }
  });

  const nearMisses = pieces.filter((p) => p?.landed === 'near-miss');
  if (nearMisses.length < 2) {
    flag('too_few_near_misses', `${nearMisses.length} labelled near-miss`,
      'Include two or three deliberate near-misses, labelled as such. The boundary teaches more than the centre.');
  }

  const years = pieces.map((p) => p?.year).filter((y) => Number.isInteger(y)).sort((a, b) => a - b);
  const medianYear = years.length ? years[Math.floor((years.length - 1) / 2)] : null;
  const stale = years.filter((y) => y < currentYear - 5).length;
  if (stale > 0) {
    flag('pieces_older_than_five_years', `${stale} of ${pieces.length}`,
      'Prefer the last three to five years. A style from ten years ago is someone else\'s.');
  }

  const band = sizeBand(pieces.length);
  return {
    pieces: pieces.length,
    size_band: band.range,
    size_reading: band.reading,
    ...(pieces.length > 40
      ? { oversize_remedy: 'Take the most recent 30 and set the rest aside as an archive to check the profile against later.' }
      : {}),
    near_misses: nearMisses.length,
    date_range: years.length ? { earliest: years[0], latest: years[years.length - 1], median: medianYear } : null,
    media_spread: Object.fromEntries(MEDIA.map((m) => [m, pieces.filter((p) => p?.medium === m).length]).filter(([, n]) => n > 0)),
    findings,
    not_checked_here:
      'Ownership, rights and whose decisions each piece encodes cannot be verified from labels. Work through the ' +
      'rights checklist aloud before extraction — state the answers, do not assume them.',
    rights_checklist: RIGHTS_CHECKLIST,
  };
}
