import { PHRASE_SCANS } from './tells.js';
import { COMPLIANCE_CHECKLIST, COMPLIANCE_NOTE } from './anatomy.js';

/**
 * Mechanical draft checks against the anatomy thresholds and the tell list.
 * Every finding is a measurable fact with the evidence quoted — a count
 * exceeded, a phrase matched, a pattern present. No scores, no verdicts, no
 * reply-rate claims: the two checks that decide a message — does the opening
 * survive find-and-replace, does the body carry one idea — are judgements,
 * and they stay in the skill.
 */

const URL_PATTERN = /https?:\/\/[^\s)>\]]+|(?:^|\s)www\.[^\s)>\]]+/gi;

const CALENDAR_ASK = [
  /quick call/i,
  /\b(10|15|20|30)[ -]?min(ute)?s?\b/i,
  /calendly\.com|cal\.com\/|savvycal|hubspot\.com\/meetings/i,
  /book (a |some )?time/i,
  /hop on a call/i,
  /grab (some )?time/i,
];

const OPT_OUT_PATTERN =
  /unsubscribe|opt[ -]?out|reply ["'“]?(no|stop|no thanks)|(will not|won'?t) (write|email|contact)( you)? again|remove (me|you) from/i;

// Approximate by nature: a street number plus a street word, or a UK postcode
// or US ZIP. Absence of a match does not prove absence of an address.
const POSTAL_ADDRESS_PATTERN =
  /\b\d+[a-z]? [A-Z][A-Za-z]+ (Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Way|Place|Pl|Court|Square|Boulevard|Blvd)\b|\b[A-Z]{1,2}\d{1,2}[A-Z]? ?\d[A-Z]{2}\b|\b\d{5}(-\d{4})?\b/;

// The "X, Y(,) and Z" shape. Whether the three items are rhythm or content is
// a judgement the finding does not make.
const TRICOLON_SHAPE = /\b[^,.\n;:?!]{3,40}, [^,.\n;:?!]{3,40},? and [^,.\n;:?!]{3,40}/;

function normalise(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => wordCount(s) > 0);
}

/**
 * @param {{subject?: string, body: string, company_name?: string,
 *          first_name?: string, jurisdiction?: string}} args
 */
export function lintMessage({ subject, body, company_name, first_name, jurisdiction }) {
  const draft = normalise(body);
  const findings = [];
  const flag = (check, evidence, threshold) => findings.push({ check, evidence, threshold });

  // ---- the hard thresholds ------------------------------------------------
  const words = wordCount(draft);
  if (words >= 120) {
    flag('over_length', `${words} words`,
      'Under 120 words, greeting and sign-off included. Cut the second idea rather than trimming adjectives.');
  }

  const questionMarks = (draft.match(/\?/g) ?? []).length;
  if (questionMarks === 0) {
    flag('no_question', '0 question marks in the body', 'Exactly one question, in the body, at the end.');
  } else if (questionMarks > 1) {
    flag('multiple_questions', `${questionMarks} question marks`, 'Exactly one question. Two questions invite answering neither.');
  }
  const sents = sentences(draft);
  const lastTwo = sents.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((s) => s.endsWith('?'))) {
    flag('two_closing_questions', lastTwo.join(' '),
      'The classic second question ("or is there someone better to speak to?") reads as pre-emptive surrender.');
  }

  const links = draft.match(URL_PATTERN) ?? [];
  if (links.length > 1) {
    flag('multiple_links', links.map((l) => l.trim()).join(', '),
      'One link at most, and only where the trigger needs evidence. Zero links is stronger.');
  }

  const emDashes = (draft.match(/—/g) ?? []).length + (draft.match(/\s--\s/g) ?? []).length;
  if (emDashes > 0) {
    flag('em_dash_cadence', `${emDashes} em dash${emDashes === 1 ? '' : 'es'}`,
      'More than zero in a short message needs a reason. Use a full stop; occasionally a comma.');
  }

  for (const pattern of CALENDAR_ASK) {
    const m = pattern.exec(draft);
    if (m) {
      flag('calendar_ask', m[0],
        'Never "quick call?", "15 minutes?", or a calendar link on a first touch. The call is what you earn from a reply.');
      break;
    }
  }

  // ---- tell phrases, evidence quoted -------------------------------------
  for (const scan of PHRASE_SCANS) {
    const m = scan.pattern.exec(draft);
    if (m) flag(`tell:${scan.tell}`, m[0], scan.fix);
  }

  const tricolon = TRICOLON_SHAPE.exec(draft);
  if (tricolon) {
    flag('tricolon_shape', tricolon[0].trim(),
      'Three parallel items where two would do scans as rhythm rather than content. Whether these three are earned is a judgement this check does not make.');
  }

  if (/\*\*[^*\n]+\*\*|__[^_\n]+__/.test(draft)) {
    flag('bold_for_emphasis', (draft.match(/\*\*[^*\n]+\*\*|__[^_\n]+__/) ?? [''])[0],
      'Nobody bolds words in a real email.');
  }

  // Self-audit item 5: the three longest sentences within four words of each other.
  const lengths = sents.map(wordCount).sort((a, b) => b - a);
  const topThree = lengths.slice(0, 3);
  if (topThree.length === 3 && topThree[0] - topThree[2] <= 4) {
    flag('balanced_sentence_lengths', `three longest sentences: ${topThree.join(', ')} words`,
      'Within four words of each other — break one. Human writing is lumpy.');
  }

  // Blank-line blocks include the greeting, the question line and the
  // identification footer, so a block count cannot stand in for "two or three
  // paragraphs" — it is reported as a metric, not a finding.
  const paragraphs = draft.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  // ---- subject line -------------------------------------------------------
  if (subject !== undefined) {
    const subj = normalise(subject).trim();
    const subjWords = wordCount(subj);
    if (subjWords < 2 || subjWords > 5) {
      flag('subject_length', `"${subj}" (${subjWords} words)`, 'Two to five words.');
    }
    if (subj !== subj.toLowerCase()) flag('subject_not_lowercase', subj, 'Lowercase — it should read like an internal note, not a campaign.');
    if (subj.includes(':')) flag('subject_colon', subj, 'No colon.');
    if (subj.includes('?')) flag('subject_question_mark', subj, 'No question mark.');
    if (subj.includes('!')) flag('subject_exclamation', subj, 'Padded punctuation is a bulk-mail tell.');
    if (/\s[x×]\s/i.test(subj)) flag('subject_x_format', subj, 'The "Acme x YourCo" format is a sequencer signature.');
    if (company_name && subj.toLowerCase().includes(company_name.trim().toLowerCase())) {
      flag('company_name_in_subject', subj, 'No company name in the subject.');
    }
    if (first_name && new RegExp(`\\b${first_name.trim()}\\b`, 'i').test(subj)) {
      flag('first_name_in_subject', subj, 'Merge-field placement is the oldest bulk-mail tell there is.');
    }
  }

  // ---- facts that need the user's verification ---------------------------
  const numbers = draft.match(/\d[\d,.]*[x%]?/g) ?? [];
  const compliance = {
    opt_out_line_found: OPT_OUT_PATTERN.test(draft),
    postal_address_found: POSTAL_ADDRESS_PATTERN.test(draft),
    scan_note:
      'Pattern scan only, and approximate in both directions: a match is not compliance and a miss ' +
      'is not a violation. ' + COMPLIANCE_NOTE,
    checklist: jurisdiction
      ? COMPLIANCE_CHECKLIST.filter((c) => c.jurisdiction.toLowerCase().includes(jurisdiction.trim().toLowerCase()))
      : COMPLIANCE_CHECKLIST,
    ...(jurisdiction ? {} : { jurisdiction_note: 'No jurisdiction given — all four rows shown; say the jurisdiction is unknown rather than guessing.' }),
  };

  return {
    findings,
    metrics: {
      words,
      question_marks: questionMarks,
      links: links.length,
      em_dashes: emDashes,
      sentences: sents.length,
      shortest_sentence_words: lengths.length ? lengths[lengths.length - 1] : 0,
      longest_sentence_words: lengths.length ? lengths[0] : 0,
      blank_line_blocks: paragraphs.length,
      numeric_claims_present: numbers,
    },
    numeric_claims_note: numbers.length
      ? 'Numbers found in the draft are listed above. Any the user did not supply must be removed — this check cannot know which those are.'
      : null,
    compliance,
    not_checked_here:
      'The two checks that decide the message are judgements and stay with the skill: whether the ' +
      'opening survives find-and-replace, and whether the body carries exactly one idea. Passing ' +
      'this lint does not mean the message is good.',
  };
}
