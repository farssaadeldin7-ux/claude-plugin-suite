/**
 * The five drop-off causes, ported from the skill's
 * references/dropoff-causes.md. Each has a tell that can be checked
 * mechanically against a scored scene table, and a standard fix an editor can
 * usually execute without new material. They are structural correlates, not
 * measurements.
 */

export const CORRELATE_NOTE =
  'These are structural correlates, not measurements. A stretch that trips a tell is worth watching ' +
  'again with a specific question in mind, not a proven defect.';

export const CAUSES = {
  no_question_open: {
    label: 'No question open',
    summary:
      'The viewer has nothing to wonder about. Information is arriving, it may even be good ' +
      'information, but nothing is pending, so there is no reason to stay through the next minute ' +
      'rather than the last one.',
    tell: 'Three consecutive scenes that only deliver information — no question opened, no stake raised, no complication introduced.',
    threshold: '3 in a row, or any 90-second stretch with nothing open — whichever trips first.',
    how_to_check:
      'In the Q&A ledger, find any span of three scenes with no entry in the "opens" column, then ' +
      'check the scene table — if all three are expository in function, the tell is tripped.',
    standard_fix:
      'Move an existing question earlier. Almost every documentary already contains the question it ' +
      'needs, usually sitting in the second half. Lift the line where the contributor says the thing ' +
      'that makes you want to know what happens, and put it in front of the expository block. Failing ' +
      'that, cut the block to a third of its length and let the information arrive inside a scene ' +
      'that has a question running.',
    worked_example:
      'A 22-minute film on a flood defence scheme. From 04:10 to 07:40: the engineering of the ' +
      'barrier, the funding history, the council timeline. Three scenes, all information, nothing ' +
      'pending. The line "we found out in March that it wasn\'t going to be finished in time" sits at ' +
      '14:20; moved to 04:05 it converts the whole block into evidence for a question the viewer is ' +
      'already holding. Effort 2, exposed run-time 3:30.',
  },
  stakes_not_personalised: {
    label: 'Stakes not personalised',
    summary:
      'The film is about a subject rather than about someone. Viewers track people; they tolerate ' +
      'topics only for as long as a person is implied to be coming.',
    tell: 'The subject is a topic, not a person, for over 90 seconds. No named individual with a want, on screen or in voice, across the stretch.',
    threshold: 'Over 90 seconds.',
    how_to_check:
      'Scan the transcript for first-person testimony and for named subjects with a stated desire or ' +
      'fear. Statistics, archive, narration and expert explanation do not count, however well ' +
      'delivered. Note that an expert becomes a person the moment they say something that costs them.',
    standard_fix:
      'Front the person. Find the earliest moment a named subject states what they want or fear and ' +
      'open with it, before the context. Context is retroactive — an audience accepts minutes of ' +
      'topic explanation once it knows whose life is inside it. Where no such moment exists in the ' +
      'rushes, that is a note for the director, not a cut.',
    worked_example:
      'An eight-minute branded film for a medical device. The first 2:10 is market context and ' +
      'product design. The founder\'s line "my mother waited eleven months for this" is at 05:30. ' +
      'Moved to 00:12, the market context becomes her argument rather than a pitch. Effort 2.',
  },
  tonal_monotony: {
    label: 'Tonal monotony',
    summary:
      'Everything is the same temperature. This is the most common failure in well-made films and the ' +
      'hardest to see in the room, because each individual scene is good.',
    tell: 'No valence change across five minutes. Formally, no shift of two or more valence points between any two scenes inside a five-minute window.',
    threshold: 'Across 5 minutes.',
    how_to_check:
      'Read the valence column as a series and take the differences. Flat is the flag. Note that ' +
      'this is about the derivative, not the level — a stretch that sits at −2 and moves is fine, a ' +
      'stretch that sits at +1 and never moves is not.',
    standard_fix:
      'Find the relief you already have. Almost every doc contains a wry moment, a moment of ' +
      'ordinary life, a joke a contributor made that got cut for being off-topic. Put one back inside ' +
      'the flat stretch. Relief is not decoration — it resets the scale so the next serious beat ' +
      'reads as serious. Where the flatness is at the high end, the fix is usually to cut, not to ' +
      'add: three strong emotional scenes back to back average out to one.',
    worked_example:
      'A feature doc on bereavement. 34:00 to 41:00 sits at valence −2 to −3 throughout, intensity 4. ' +
      'Restoring a 40-second scene of the family arguing about a parking space at 37:10 — valence 0, ' +
      'intensity 2 — raises the intensity of everything after it. Effort 2 — restoring a whole scene ' +
      'ripples the assembly.',
  },
  premature_resolution: {
    label: 'Premature resolution',
    summary:
      'The central question is answered while there is still film left. Attention collapses almost ' +
      'immediately after the answer lands, and no amount of good material afterwards recovers it, ' +
      'because the viewer has what they came for.',
    tell: 'The central question in the Q&A ledger closes before the two-thirds mark.',
    threshold: 'Before the 2/3 mark, or before the named form\'s central-close window. Below 0.5, treat it as the most urgent finding in the report.',
    how_to_check:
      'Identify the central question — the one the film is about, usually opened in the first eighth ' +
      '— and divide its close timecode by total run-time. Below 0.66 the tell is tripped. Below 0.5, ' +
      'treat it as the most urgent finding in the report.',
    standard_fix:
      'Withhold the close, or complicate it. Two moves, in order of preference. First, delay: move ' +
      'the answer later and fill the gap with the material that currently sits after it. Second, ' +
      'complicate: if the answer genuinely arrives early because that is what happened, open a second ' +
      'question at the moment it closes — the consequence question. "She got the money back" closes ' +
      'at 12:00 in a 30-minute film; "and then the others found out" opens at 12:05. Non-fiction ' +
      'usually has this material already.',
    worked_example:
      'A 26-minute film about a wrongful dismissal. The tribunal verdict lands at 15:40, ratio 0.60. ' +
      'Everything after is aftermath and it plays as an epilogue that will not end. Holding the ' +
      'verdict to 19:30 and moving two aftermath scenes in front of it costs nothing in material. ' +
      'Effort 2, exposed run-time 10:20.',
  },
  texture_starvation: {
    label: 'Texture starvation',
    summary:
      'The image stops giving the viewer anything new. The eye disengages before the ear does, and ' +
      'once the eye has gone the viewer is one notification from leaving.',
    tell: 'Uninterrupted talking head beyond 40 seconds without a cutaway, a reframe, an angle change or a shift in location.',
    threshold: 'Beyond 40 seconds, or beyond the named form\'s talking-head limit.',
    how_to_check:
      'Find every talking-head block, check its duration and whether any visual event interrupts it. ' +
      'A static wide of the same room does not reset the clock.',
    standard_fix:
      'Cut away, or earn the stare. Either lay B-roll or archive carrying the same information over ' +
      'the middle third of the block, or make a deliberate choice to hold on the face — which works ' +
      'only for a confession, a realisation, or the hardest thing the contributor says all film, and ' +
      'only once or twice in a piece. Holding on a face during exposition is not restraint, it is a ' +
      'missing shot.',
    worked_example:
      'A YouTube long-form piece with a 2:40 unbroken interview block at 06:00. Splitting it with 20 ' +
      'seconds of workshop at 06:50 and a reframe at 07:40 costs one afternoon of logging. Effort 1.',
  },
};

/** Priority when tells overlap, in order. */
export const OVERLAP_PRIORITY = [
  { overlap: 'Premature resolution anywhere', treat_as: 'Highest priority, always — it invalidates the back half' },
  { overlap: 'No question open plus tonal monotony', treat_as: 'Second — this is the classic mid-film sag' },
  { overlap: 'Stakes not personalised in the first 90 seconds', treat_as: 'Third, and urgent in feed-based forms' },
  { overlap: 'Texture starvation alone', treat_as: 'Lowest — real, but cheap to fix and rarely fatal' },
];

export const OVERLAP_NOTE =
  'A stretch tripping three tells is not three findings. Report it once, name all three causes, and ' +
  'fix the structural one first — texture problems often disappear once the scene has a question ' +
  'running through it.';

export function causeFor(id) {
  return CAUSES[String(id ?? '').trim().toLowerCase()] ?? null;
}
