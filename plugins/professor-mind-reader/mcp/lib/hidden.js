/**
 * The hidden rubric from references/hidden-criteria.md: the standing checklist
 * of things markers reward that the printed rubric usually does not list.
 * Every item is an inferred convention, not a guarantee, and the data says so —
 * running the checks against a draft is the skill's job.
 */

export const HIDDEN_RUBRIC_FRAMING =
  'These are inferred conventions, not guarantees. They come from how academic marking generally ' +
  'works, not from knowledge of any particular marker or module. A printed criterion is evidence; ' +
  'an item on this list is a reasonable bet. Where the module handbook contradicts one, the ' +
  'handbook wins. They matter because most rubrics are written to be defensible at appeal, not to ' +
  'describe what a marker notices at 11pm on the fortieth script.';

export const HIDDEN_CHECKLIST = [
  {
    id: 'question_asked',
    name: 'Answering the question actually asked',
    test: "Does the introduction's last paragraph contain the question's own key terms, and a commitment to an answer?",
    why_rewarded: 'The most common way a well-written essay fails is by answering the adjacent question — the one ' +
      'the student wanted, or the one the reading list implied. Markers see it constantly and it is the ' +
      'cheapest thing for them to penalise, because the brief is in writing.',
    failure_signature: 'The question says "to what extent" and the draft never says "to this extent". ' +
      'The question names two things and the draft covers one.',
  },
  {
    id: 'signposting',
    name: 'Signposting',
    test: 'Read only the headings and the first sentence of each paragraph, in order. Does that alone read as a coherent argument?',
    why_rewarded: 'Markers skim first, then read. Structure that survives the skim gets credit for structure it ' +
      'might not fully earn in the body. Structure that fails the skim means the marker reads the body ' +
      'already looking for the argument, which is a worse frame to be read in.',
    failure_signature: 'Paragraphs opening with a citation or a date rather than a claim.',
  },
  {
    id: 'set_reading',
    name: 'Visible engagement with the set reading',
    test: 'How many items from the reading list appear, and are any of them argued with rather than cited in passing?',
    why_rewarded: "The reading list is the marker's own curriculum, often their own selection, sometimes their own " +
      'work. Its absence reads as not having done the module. Its presence, used critically, reads as ' +
      'having done the module and gone further.',
    failure_signature: "A bibliography of plausible-looking sources with no overlap with the module's list.",
  },
  {
    id: 'counter_argument',
    name: 'Addressing the counter-argument',
    test: 'Is there a paragraph that states the strongest opposing position fairly, then answers it?',
    why_rewarded: 'It is the clearest available evidence of independent judgement, and it is the hardest thing to ' +
      'produce without having actually thought.',
    failure_signature: 'The counter-argument that appears is a weak one, chosen because it is easy to knock down. ' +
      'Markers notice this and it costs more than omitting it.',
  },
  {
    id: 'citation_style',
    name: 'Citation style, correct and consistent',
    test: 'Pick three in-text citations and their reference entries. Do they match each other and the required ' +
      'style? Is every reference cited in the text and every citation referenced?',
    why_rewarded: 'It is the cheapest available proxy for care, it is unambiguous, and some institutions treat ' +
      'missing references as an academic integrity matter rather than a presentation one.',
    failure_signature: 'Mixed styles across the reference list — the trace of sources copied from different databases.',
  },
  {
    id: 'first_last_paragraphs',
    name: 'The first and last paragraphs',
    test: 'Would the marker know the argument having read only these two?',
    why_rewarded: 'They are read most attentively, and the conclusion is often read early to locate the position. ' +
      'A conclusion that only recaps is a wasted, high-attention slot.',
    failure_signature: 'A conclusion introducing new material, or opening "In conclusion, this essay has discussed...".',
  },
  {
    id: 'stable_definitions',
    name: 'Terms defined once, early, and then used consistently',
    test: "Are the question's contestable terms defined, and does the definition stay fixed?",
    why_rewarded: 'Drifting definitions destroy an argument quietly, and markers read for this because it is where ' +
      'weak reasoning hides.',
  },
  {
    id: 'word_count',
    name: 'Word count compliance',
    test: 'Within the stated tolerance, usually 10%.',
    why_rewarded: 'It is often a hard penalty applied before marking, and it is trivially checkable. Under-length ' +
      'by more than 10% is usually worse than over-length, because it indicates missing content rather ' +
      'than indiscipline.',
  },
  {
    id: 'calibrated_hedging',
    name: 'Calibrated hedging',
    test: 'Do the claims carry the confidence the evidence supports?',
    why_rewarded: 'Overclaiming ("this proves") and underclaiming ("it could perhaps be suggested that") both read ' +
      'as poor judgement. The middle register — "the evidence suggests, though the sample limits this" — ' +
      'is the register of the top band.',
  },
  {
    id: 'source_recency_range',
    name: 'Recency and range of sources',
    test: 'What proportion is from the last five to ten years, and does the list mix foundational work with current work?',
    why_rewarded: 'An all-recent list suggests no grounding; an all-old list suggests the literature stopped. ' +
      'Field-dependent — in some humanities subfields, age is irrelevant.',
  },
  {
    id: 'presentation_mechanics',
    name: 'Presentation mechanics',
    test: 'Required cover sheet, student number not name where anonymous marking applies, page numbers, ' +
      'consistent heading levels, figures and tables captioned and referred to in the text, file format ' +
      'and naming as specified.',
    why_rewarded: 'Anonymity breaches can require administrative handling, and everything else here is friction ' +
      'the marker feels directly.',
  },
];

export const HIDDEN_REPORTING_RULES = [
  'Group failures into one short section headed as inferred conventions.',
  'List only the failures, each with the test and the fix in one line.',
  'Do not lecture, and do not pad the list with items that pass.',
  'Never present any of these as if the rubric had said it.',
];

export function hiddenItem(id) {
  return HIDDEN_CHECKLIST.find((item) => item.id === id) ?? null;
}
