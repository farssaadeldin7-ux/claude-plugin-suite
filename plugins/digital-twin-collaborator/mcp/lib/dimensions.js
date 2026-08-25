/**
 * The style dimension taxonomy, ported from
 * skills/digital-twin-collaborator/references/style-dimensions.md. Data only —
 * what to measure, how to extract it, and what a checkable entry looks like.
 * Extracting the values from a real corpus is the skill's job.
 */

export const DIMENSIONS = {
  visual: {
    label: 'Visual work',
    dimensions: [
      {
        id: 'composition_negative_space',
        name: 'Composition and negative space',
        what_to_measure: 'Ratio of empty to occupied area; where the subject sits on the frame; whether the frame is ever centred',
        how_to_extract: 'Sample 10 pieces, estimate empty area to the nearest 10%, mark subject position on a 3x3 grid',
        checkable_entry_example: '40-60% negative space; subject on a third, never centred; weight low-left in 14 of 20',
      },
      {
        id: 'palette_discipline',
        name: 'Palette discipline',
        what_to_measure: 'Number of distinct hues per piece; accent share; whether neutrals carry the piece',
        how_to_extract: 'Pull a 5-swatch average from each piece, count hues over 5% of area',
        checkable_entry_example: 'Two neutrals plus one accent; accent never above 12% of area; no gradient over three stops',
      },
      {
        id: 'contrast_value_structure',
        name: 'Contrast and value structure',
        what_to_measure: 'Distance between darkest and lightest value; whether midtones dominate; where the eye lands first',
        how_to_extract: 'Desaturate each piece and read the histogram shape — bimodal, midtone-heavy, or high-key',
        checkable_entry_example: 'Midtone-heavy, no true black; highlight roll-off soft; 3-stop working range',
      },
      {
        id: 'type_system',
        name: 'Type system',
        what_to_measure: 'Families, weights, sizes per layout; alignment; case; tracking at display size',
        how_to_extract: 'Count distinct type styles per piece and take the median',
        checkable_entry_example: 'One grotesque, two weights, max three sizes; left-aligned; sentence case; negative tracking above 48pt',
      },
      {
        id: 'texture_grain',
        name: 'Texture and grain',
        what_to_measure: 'Presence and coarseness of grain, paper, noise, halation; whether surfaces are ever perfectly clean',
        how_to_extract: 'Zoom to 200% on a flat area in each piece and note what is there',
        checkable_entry_example: 'Fine grain on every image; no perfectly flat fills; slight halation on highlights',
      },
      {
        id: 'subject_distance',
        name: 'Subject distance',
        what_to_measure: 'Framing distance across the corpus, and whether it varies with brief',
        how_to_extract: 'Bucket each image: wide, medium, close, macro. Count',
        checkable_entry_example: 'Medium and close, 17 of 20; one wide per sequence at most; never macro',
      },
      {
        id: 'motion_cadence',
        name: 'Motion cadence',
        what_to_measure: 'Average shot length, cut rhythm, camera movement, relation of cut to music',
        how_to_extract: 'Time 10 cuts per film; note whether the camera is locked, handheld or motorised',
        checkable_entry_example: 'Average shot 4.5s; never under 1s; locked-off or slow dolly only; cuts land off the beat',
      },
    ],
    extraction_order:
      'Do palette, value and composition first. They are the fastest to read, the most consistent across a body of ' +
      'work, and they carry most of the recognisability. Type and texture come next. Subject distance is often ' +
      'brief-driven rather than style-driven, so check whether it varies with the client before treating it as a style rule.',
  },

  written: {
    label: 'Written work',
    dimensions: [
      {
        id: 'sentence_length_distribution',
        name: 'Sentence length distribution',
        what_to_measure: 'Median length; share over 30 words; shortest sentence; whether short sentences cluster',
        how_to_extract: 'Word-count every sentence in 3,000 words of corpus and take the distribution, not the mean',
        checkable_entry_example: 'Median 14 words; 8% over 30; at least one under 6 per paragraph',
      },
      {
        id: 'register',
        name: 'Register',
        what_to_measure: 'Contractions, first or second person, jargon tolerance, hedging density, profanity',
        how_to_extract: 'Count contractions per 500 words; count hedges ("perhaps", "arguably", "somewhat")',
        checkable_entry_example: 'Contractions throughout; second person; under 2 hedges per 500 words; no jargon without a gloss',
      },
      {
        id: 'metaphor_density',
        name: 'Metaphor density',
        what_to_measure: 'Figurative expressions per 500 words, and which domains they are drawn from',
        how_to_extract: 'Mark every metaphor and simile in 2,000 words; note the source domains',
        checkable_entry_example: '3-5 per 500 words, drawn from craft and building; never sport, never war',
      },
      {
        id: 'opening_move',
        name: 'Opening move',
        what_to_measure: 'What the first sentence does — scene, claim, number, anecdote, refusal, direct address',
        how_to_extract: 'Read only the first two sentences of every piece, in a list, and classify',
        checkable_entry_example: 'Opens on a concrete scene or a flat claim; never a question; never a definition',
      },
      {
        id: 'closing_move',
        name: 'Closing move',
        what_to_measure: 'What the last paragraph does — return, widen, instruct, undercut, stop abruptly',
        how_to_extract: 'Read only the last paragraph of every piece and classify',
        checkable_entry_example: 'Returns to the opening image, then stops; never summarises; never a call to action',
      },
      {
        id: 'refusals',
        name: 'Refusals',
        what_to_measure: 'What the writing consistently will not do',
        how_to_extract: 'Look for absences: no exclamation marks, no rhetorical questions, no lists of three',
        checkable_entry_example: 'No rhetorical questions; no rule of three; no em-dash asides over one per 500 words',
      },
      {
        id: 'paragraph_shape',
        name: 'Paragraph shape',
        what_to_measure: 'Lines per paragraph; whether single-line paragraphs are used, and for what',
        how_to_extract: 'Count paragraph lengths across 10 pieces',
        checkable_entry_example: '2-5 sentences; single-line paragraphs used only for a turn, roughly one per 800 words',
      },
    ],
    distribution_note:
      'The distribution matters more than the average. A writer with a median of 14 words and a quarter of sentences ' +
      'over 25 reads nothing like a writer with a flat 14-word median. Record the spread. "Varied sentence length" is ' +
      'the single most common useless entry in a style profile.',
  },

  motion: {
    label: 'Motion and time-based work',
    dimensions: [
      {
        id: 'shot_length',
        name: 'Shot length',
        what_to_measure: 'Mean and shortest shot; whether length varies by act',
        how_to_extract: 'Time every cut in two full pieces',
      },
      {
        id: 'cut_logic',
        name: 'Cut logic',
        what_to_measure: 'Cut on action, on dialogue, on beat, or on nothing',
        how_to_extract: 'Watch 20 cuts and classify each',
      },
      {
        id: 'camera_behaviour',
        name: 'Camera behaviour',
        what_to_measure: 'Locked, handheld, dolly, crane, drone; how much movement per shot',
        how_to_extract: 'Note the dominant mode per shot across two pieces',
      },
      {
        id: 'sound_relation',
        name: 'Sound relation',
        what_to_measure: 'Whether picture follows music or music follows picture; use of silence',
        how_to_extract: 'Mark every point where sound leads the cut',
      },
      {
        id: 'title_text_treatment',
        name: 'Title and text treatment',
        what_to_measure: 'When titles appear, how long they hold, whether they animate',
        how_to_extract: 'Log every text event with in and out timings',
      },
      {
        id: 'grade',
        name: 'Grade',
        what_to_measure: 'Where the shadows sit, whether skin is warmer or cooler than surround',
        how_to_extract: 'Sample three frames per piece',
      },
    ],
  },
};

export const EXTRACTION_RULES = [
  'Measure, do not ask. The director\'s account of their own style is a hypothesis. The corpus is the evidence. ' +
    'Where they disagree, report the count and let them decide which one to keep.',
  'Every entry must be checkable. If you cannot look at a draft and say whether it satisfies the entry, the entry ' +
    'is decoration. Write numbers, ratios, counts and prohibitions.',
];

export const WEIGHTING = {
  method:
    'Not all dimensions matter equally. After extraction, ask the director to pick the five they would notice first ' +
    'in a bad draft. Those get the highest weight in the prompt preamble and in the scoring pass.',
  usual_visual: ['palette', 'negative space', 'value structure', 'type', 'grain'],
  usual_written: ['opening move', 'sentence distribution', 'register', 'metaphor domain'],
  record_it:
    'Record the weighting in the profile. It is what makes the score mean something, and it is the first thing to ' +
    'revisit at re-audit.',
};

export const BRIEF_DRIVEN = {
  check_against_client: [
    'subject matter',
    'format and aspect ratio',
    'length',
    'colour where the client owns a brand colour',
    'language level',
  ],
  why:
    'A dimension that varies with the client is not a style rule, it is a constraint the director works inside — ' +
    'and encoding it will make the apprentice wrong on the next brief.',
};

export function mediumFor(name) {
  return DIMENSIONS[String(name ?? '').trim().toLowerCase()] ?? null;
}
