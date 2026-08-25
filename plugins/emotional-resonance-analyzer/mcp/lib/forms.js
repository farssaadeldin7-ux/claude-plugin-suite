/**
 * Form conventions, ported from the skill's references/form-conventions.md.
 * There is no form-neutral pacing judgement: every threshold check runs
 * against the conventions of the form the editor names, and these are
 * conventions of the form as practitioners describe them, not measurements
 * taken from an audience.
 */

export const CONVENTION_NOTE =
  'These are conventions of the form as practitioners describe them, not measurements taken from an ' +
  'audience. Treat the departure points as where to look, not as what will happen. Where the editor ' +
  'has a real retention curve, ignore all of this and read the curve.';

export const UNLISTED_FORM_NOTE =
  'This form is not encoded. Ask the editor what the form expects at its known departure points and ' +
  'use their answer, rather than stretching the nearest row to fit.';

export const FORMS = {
  short_doc: {
    label: 'Short doc, under 10 minutes',
    attention_shape: 'Front-loaded. The audience decides in the first 20 seconds and rarely reconsiders.',
    question_must_open_by_seconds: 20,
    person_with_want_by_seconds: 45,
    typical_departure_points: ['00:15', '01:30', 'any point the film appears to have finished'],
    sag_risk_window: '01:30–03:00',
    central_close_window: { earliest: 0.70, latest: 0.85 },
    texture_tolerance: 'Low. 30 seconds of unbroken talking head is already long.',
    talking_head_limit_seconds: 30,
    notes: [
      'The characteristic failure is a film that spends its first minute establishing context it has not earned the right to give. The characteristic fix is to start at the second scene.',
      'A short doc has room for one central question, one person and one turn. Two central questions in under 10 minutes read as an unfinished feature.',
    ],
  },
  feature_doc: {
    label: 'Feature doc, 70–110 minutes',
    attention_shape: 'Slow build tolerated, sustained middle required, third act must escalate.',
    question_must_open_by_seconds: 300,
    person_with_want_by_seconds: 180,
    typical_departure_points: ['08:00', 'the 45–65 minute band — the classic sag'],
    sag_risk_window: '45:00–65:00',
    central_close_window: { earliest: 0.80, latest: 0.90 },
    texture_tolerance: 'High, if the images are doing work.',
    talking_head_limit_seconds: 60,
    notes: [
      'Feature audiences are captive, self-selected and have paid something, in money or intention. They will grant patience they would not grant a feed. They will not grant a flat middle.',
      'The 45–65 minute band is where almost every feature doc fails, and it fails for one reason above the others: the film runs out of new questions and starts developing existing ones. Three or four subsidiary questions opening across the middle hour is the structural requirement, not an option.',
    ],
  },
  branded: {
    label: 'Branded film, 2–8 minutes',
    attention_shape: 'Hostile start, forgiving middle if the start lands.',
    question_must_open_by_seconds: 10,
    person_with_want_by_seconds: 15,
    typical_departure_points: ['00:08', 'the moment the film becomes an advertisement'],
    sag_risk_window: 'at the pivot',
    central_close_window: { earliest: 0.75, latest: 0.85 },
    central_close_note: 'Immediately before the brand resolution.',
    texture_tolerance: 'Very low.',
    talking_head_limit_seconds: 25,
    feed_based: true,
    notes: [
      'The specific failure mode of the form is the pivot: the point where a piece that has been a human story visibly turns into a product argument. Audiences leave at the pivot, not at the product. Find the pivot in the paper edit and flag it by timecode — it is usually the most valuable single note on a branded piece.',
      'The client\'s brief will nearly always ask for the product earlier. That is a conversation for the director, but say clearly where the structural cost falls.',
    ],
  },
  youtube_longform: {
    label: 'YouTube long-form, 12–40 minutes',
    attention_shape: 'Brutal first 30 seconds, then a long tolerant plateau.',
    question_must_open_by_seconds: 8,
    person_with_want_by_seconds: 20,
    typical_departure_points: ['00:30', '02:00', 'every chapter boundary'],
    sag_risk_window: 'chapter boundaries',
    central_close_window: { earliest: 0.85, latest: 0.95 },
    texture_tolerance: 'Low early, moderate later.',
    talking_head_limit_seconds: 40,
    feed_based: true,
    notes: [
      'Two form-specific structures matter. The open loop — state the question in the first ten seconds, explicitly, often in words. And chaptering — every chapter boundary is an exit the audience is offered, so each one must open a question before it closes the previous one.',
      'The audience for this form is unusually tolerant of length and unusually intolerant of preamble. Long is fine. Slow to start is not.',
    ],
  },
  broadcast: {
    label: 'Broadcast with ad breaks',
    attention_shape: 'Segmented. Each part re-earns the audience from zero.',
    question_must_open_by_seconds: 60,
    question_open_note: 'By 01:00, and again before every break.',
    person_with_want_by_seconds: 90,
    typical_departure_points: ['every ad break, without exception'],
    sag_risk_window: 'every break',
    // Not a ratio: the central question closes in the last segment only, which
    // cannot be checked without the break timecodes.
    central_close_window: null,
    central_close_note: 'Last segment only. Not checkable as a ratio — supply the break timecodes and judge it against the last segment.',
    texture_tolerance: 'Moderate.',
    talking_head_limit_seconds: 45,
    notes: [
      'The break is the structure. Every part must end on an open question and every part must open by re-establishing who this is about, because a meaningful share of the audience joined at the break and another share stopped attending during it.',
      'Check two things mechanically: no break falls within 30 seconds of a question closing, and no part opens with exposition. A part that opens on a recap of what the viewer just watched wastes the one moment the form gives you.',
    ],
  },
};

/**
 * The generic thresholds from the skill's tell table, used when no form is
 * named. The per-form talking-head limit and central-close window replace
 * these the moment a form is fixed.
 */
export const BASELINES = {
  talking_head_limit_seconds: 40,
  central_close_ratio: 2 / 3,
  no_question_stretch_seconds: 90,
  no_question_scene_run: 3,
  stakes_stretch_seconds: 90,
  monotony_window_seconds: 300,
};

export function formFor(id) {
  return FORMS[String(id ?? '').trim().toLowerCase()] ?? null;
}
