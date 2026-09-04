/**
 * The seven moment archetypes and the transcript scan that finds their tells.
 *
 * Everything here is pattern-matching on language — the tells are literal
 * surface markers ported from the reference, and a match is a candidate, not
 * a clip. Roughly a third of archetype matches die on the scoring rubric.
 * Nothing in this module scores, ranks or judges a moment.
 * Source: skills/auto-clip/SKILL.md, step 2 (Find the engaging segments automatically).
 */

export const ARCHETYPES = [
  {
    id: 'contrarian_claim',
    name: 'The contrarian claim',
    shape: 'A named consensus, then its negation.',
    tells:
      '"everyone says", "everyone thinks", "the conventional wisdom", "people will tell you", ' +
      '"the standard advice is", "I know this is unpopular", "we\'re supposed to", any sentence where a ' +
      'concessive clause ("...but actually", "...and that\'s wrong") pivots off a stated norm.',
    typical_length: '25–50s',
    best_fit: ['Shorts', 'Reels', 'X'],
    watch_for:
      'Contrarian framing with no substance behind it — the pivot is stated and never supported. ' +
      'That scores 1 on payoff and should not ship. The clip needs the because.',
  },
  {
    id: 'specific_number',
    name: 'The specific number',
    shape: 'A figure with a unit and a referent, doing argumentative work.',
    tells:
      'Digits alongside "we went from X to Y", "it costs", "about N per cent", "N out of N", ' +
      '"in the first N months", "we did N in revenue". Round numbers are weaker than odd ones — ' +
      '"roughly a million" travels less well than "£840,000".',
    typical_length: '20–40s',
    best_fit: ['Shorts', 'LinkedIn'],
    watch_for:
      'The number must be sourceable. Flag it in the cut list. A wrong number in a clip outlives the ' +
      'correction, and a clip is the format least able to carry a caveat.',
  },
  {
    id: 'confession',
    name: 'The confession',
    shape: 'An admission that costs the speaker something.',
    tells:
      'First-person past with an admission verb — "I was wrong about", "I\'ve never said this publicly", ' +
      '"we nearly", "I hadn\'t told anyone", "looking back, that was", "I\'d do that differently". ' +
      'Sentence length usually drops. Hedging disappears. Filler often increases just before the ' +
      'admission and stops during it.',
    typical_length: '30–70s',
    best_fit: ['LinkedIn', 'Reels'],
    watch_for:
      'The confession needs a resolution or a lesson inside the clip, otherwise it is just exposure. ' +
      'Also check the person is happy for it to leave the episode — agreeing to a two-hour conversation ' +
      'is not agreeing to a clip of the worst forty seconds of it.',
  },
  {
    id: 'vivid_analogy',
    name: 'The vivid analogy',
    shape: 'An abstract point made concrete.',
    tells:
      '"it\'s like", "imagine", "picture", "think of it as", "it\'s basically a", a sudden concrete noun ' +
      '(a fridge, a queue, a bad landlord) in an otherwise abstract passage.',
    typical_length: '20–45s',
    best_fit: ['Shorts', 'Reels', 'TikTok'],
    watch_for:
      'The analogy must complete. Speakers frequently open one and abandon it mid-sentence, which reads ' +
      'as a dropped thought when the surrounding conversation is gone. The clip needs both halves: the ' +
      'thing and what it is like.',
  },
  {
    id: 'host_disagreement',
    name: 'The disagreement between hosts',
    shape: 'Two people who actually diverge, briefly.',
    tells:
      'Speaker labels alternating at a shorter interval than the rest of the episode, interruption ' +
      'markers, "hold on", "no, but", "I don\'t think that\'s right", "see, I\'d disagree", [crosstalk]. ' +
      'Turn length collapsing from paragraphs to single lines is the strongest structural tell in the ' +
      'whole document.',
    typical_length: '40–90s',
    best_fit: ['LinkedIn', 'X', 'Reels'],
    watch_for:
      'Crosstalk is both the tell and the disqualifier. If the overlap sits on top of the key line, the ' +
      'clip is unusable however good the exchange was. Also check it resolves or lands somewhere — an ' +
      'unresolved argument reads as an edit fault.',
  },
  {
    id: 'say_that_again',
    name: 'The "wait, say that again"',
    shape: 'The other person in the room tells you where the clip is.',
    tells:
      '"say that again", "sorry, what?", "hang on, back up", "wait, how much?", "can you repeat that", ' +
      '"that\'s a big claim", "hold on, I want to sit with that", a laugh transcribed as [laughs] ' +
      'immediately after a short declarative.',
    typical_length: '25–60s',
    best_fit: ['all short-form'],
    watch_for:
      'Almost nothing. This is the highest-precision tell in the list, because a professional ' +
      'interviewer\'s instinct has already done the scoring for you. Cut so the clip opens on the ' +
      'original line, not on the reaction — the reaction goes second, where it functions as social proof.',
  },
  {
    id: 'practical_how_to',
    name: 'The practical how-to under 45 seconds',
    shape: 'A complete method, small enough to fit.',
    tells:
      'Enumeration — "first", "then", "the second thing", "and finally", "three things"; imperative ' +
      'verbs directed at the listener; second person ("you want to", "what you do is"). A numbered list ' +
      'spoken aloud is the shape.',
    typical_length: '30–45s',
    best_fit: ['LinkedIn', 'Shorts', 'carousel-style edits'],
    watch_for:
      'A method with more than four steps will not fit and should not be crushed. If the speaker lists ' +
      'six things, either clip the strongest one as a standalone or send the whole passage to a YouTube ' +
      'chapter. Steps also frequently continue past the natural out-point, so check where the last one ' +
      'actually ends.',
  },
];

export const COMBINATIONS_NOTE =
  'The strongest clips usually carry two archetypes. A contrarian claim supported by a specific ' +
  'number, or a confession delivered through a vivid analogy, outperforms either alone because the ' +
  'second archetype supplies the payoff the first one promises. If a candidate matches only one ' +
  'archetype and scores 9, look for whether an adjacent 15 seconds brings a second one inside the ' +
  'length budget.';

export function archetypeFor(id) {
  return ARCHETYPES.find((a) => a.id === String(id ?? '').trim().toLowerCase()) ?? null;
}

// ------------------------------------------------------------------ scanning
//
// Only the literal surface tells are matched. What the scan cannot see is
// stated in its output rather than approximated: turn-length collapse
// (archetype 5) has no numeric threshold in the reference, and "a sudden
// concrete noun" (archetype 4) is not a string.

const PHRASE_TELLS = {
  contrarian_claim: [
    'everyone says', 'everyone thinks', 'the conventional wisdom', 'people will tell you',
    'the standard advice is', 'i know this is unpopular', "we're supposed to",
    'but actually', "and that's wrong",
  ],
  // Matched only where a digit sits in the same sentence — the tell is digits
  // alongside these phrases, not the phrases alone.
  specific_number: [
    'we went from', 'it costs', 'per cent', 'percent', '%', 'out of', 'in the first', 'in revenue',
  ],
  confession: [
    'i was wrong about', "i've never said this publicly", 'we nearly', "i hadn't told anyone",
    'looking back, that was', "i'd do that differently",
  ],
  vivid_analogy: [
    "it's like", 'imagine', 'picture', 'think of it as', "it's basically a", "it's basically like",
  ],
  host_disagreement: [
    'hold on', 'no, but', "i don't think that's right", "see, i'd disagree", '[crosstalk]',
  ],
  say_that_again: [
    'say that again', 'sorry, what?', 'hang on, back up', 'wait, how much?', 'can you repeat that',
    "that's a big claim", 'hold on, i want to sit with that', '[laughs]',
  ],
};

// Enumeration words are too common to flag alone; the scan requires two
// distinct enumeration markers in the same turn, which is what "a numbered
// list spoken aloud" looks like on the page. The direct-address tells flag on
// their own.
const ENUMERATION_TELLS = ['first', 'then', 'the second thing', 'and finally', 'three things'];
const DIRECT_ADDRESS_TELLS = ['you want to', 'what you do is'];

const TIMECODE = /\b\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\b/;
const LEADING_TIMECODE = /^\s*[[(]?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?[\])]?\s*(?:-->?\s*[[(]?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?[\])]?\s*)?/;
const SPEAKER_LINE = /^\s*(?:\*\*)?([A-Za-z][A-Za-z0-9 .'’_-]{0,38}?)(?:\*\*)?\s*:\s+(.*)$/;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Word boundaries only where the phrase starts or ends on a word character —
// \b next to "[" or "%" would never match.
const wordPattern = (phrase) =>
  new RegExp(`${/^\w/.test(phrase) ? '\\b' : ''}${escapeRegExp(phrase)}${/\w$/.test(phrase) ? '\\b' : ''}`, 'i');

const normalise = (text) =>
  String(text ?? '').replace(/\r\n/g, '\n').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

/** Split a transcript into speaker turns, keeping line numbers and the last timecode seen. */
function toTurns(text) {
  const lines = normalise(text).split('\n');
  const turns = [];
  let current = null;
  let lastTimecode = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const timecode = TIMECODE.exec(raw);
    if (timecode) lastTimecode = timecode[0];

    // A leading "[00:14:22]" (or "00:14:22 --> 00:14:29") is a timecode, not
    // part of what was said — strip it before reading the speaker label.
    const line = raw.replace(LEADING_TIMECODE, '');

    const speaker = SPEAKER_LINE.exec(line);
    if (speaker && !TIMECODE.test(speaker[1])) {
      current = { speaker: speaker[1].trim(), text: speaker[2], line: i + 1, timecode: lastTimecode };
      turns.push(current);
    } else if (line.trim()) {
      if (!current) {
        current = { speaker: null, text: line, line: i + 1, timecode: lastTimecode };
        turns.push(current);
      } else {
        current.text += `\n${line}`;
      }
    } else {
      current = null; // a blank line ends the turn
    }
  }
  return { turns, anyTimecode: turns.some((t) => t.timecode) };
}

const sentencesOf = (text) => text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());

/** The sentence containing the match, trimmed for quoting. */
function evidenceFor(turnText, pattern) {
  for (const sentence of sentencesOf(turnText)) {
    if (pattern.test(sentence)) {
      const s = sentence.replace(/\s+/g, ' ').trim();
      return s.length > 240 ? `${s.slice(0, 240)}…` : s;
    }
  }
  return null;
}

/**
 * Scan a transcript for archetype tells. Returns matched turns with the tells
 * named and the evidence quoted — candidates for the rubric, nothing more.
 */
export function scanCandidates(text) {
  const { turns, anyTimecode } = toTurns(text);
  const candidates = [];

  for (const turn of turns) {
    const matched = [];

    for (const [archetypeId, phrases] of Object.entries(PHRASE_TELLS)) {
      const hits = [];
      for (const phrase of phrases) {
        const pattern = wordPattern(phrase);
        if (!pattern.test(turn.text)) continue;
        if (archetypeId === 'specific_number') {
          // The tell is a digit alongside the phrase, in the same sentence.
          const sentence = sentencesOf(turn.text).find((s) => pattern.test(s) && /\d/.test(s));
          if (!sentence) continue;
        }
        hits.push(phrase);
      }
      if (hits.length) matched.push({ archetype: archetypeId, tells: hits });
    }

    // Enumeration needs two distinct markers in one turn; direct address flags alone.
    const enumHits = ENUMERATION_TELLS.filter((p) => wordPattern(p).test(turn.text));
    const directHits = DIRECT_ADDRESS_TELLS.filter((p) => wordPattern(p).test(turn.text));
    if (enumHits.length >= 2 || directHits.length) {
      matched.push({ archetype: 'practical_how_to', tells: [...enumHits, ...directHits] });
    }

    if (!matched.length) continue;
    const firstPattern = wordPattern(matched[0].tells[0]);
    candidates.push({
      line: turn.line,
      timecode: turn.timecode,
      speaker: turn.speaker,
      archetypes: matched,
      evidence: evidenceFor(turn.text, firstPattern) ?? turn.text.replace(/\s+/g, ' ').trim().slice(0, 240),
    });
  }

  const full = normalise(text);
  const markerCount = (marker) => (full.toLowerCase().split(marker).length - 1);

  return {
    turns_scanned: turns.length,
    candidates_found: candidates.length,
    candidates,
    transcript_markers: {
      crosstalk: markerCount('[crosstalk]'),
      inaudible: markerCount('[inaudible]'),
      laughs: markerCount('[laughs]'),
    },
    timecodes_found: anyTimecode,
    ...(anyTimecode
      ? { timecode_note: 'ASR timecodes drift roughly 0.5–1.5 seconds, more after crosstalk — every timecode is the editor\'s starting point.' }
      : { timecode_note: 'No timecodes were found. Without timecodes every in-point and out-point would be a guess, and a cut list of guesses costs an editor more time than it saves.' }),
    not_scanned: [
      'Turn length collapsing from paragraphs to single lines (the strongest structural tell for a disagreement) — no numeric threshold exists for it, so it is read, not matched.',
      'A sudden concrete noun in an abstract passage (vivid analogy) — not a fixed string.',
      'Delivery, energy, laughter timing, or anything else that is not in the text.',
    ],
    note:
      'A moment matching an archetype is a candidate, not a clip; roughly a third of archetype matches ' +
      'die on the scoring rubric. Scan first, then score every candidate with score_clip.',
  };
}
