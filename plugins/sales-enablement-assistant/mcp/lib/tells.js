/**
 * The AI-tell taxonomy, ported from references/ai-tells.md: the markers that
 * make a cold email read as generated, each with a before and after rewrite,
 * plus the ten-point pre-send self-audit. The regexes at the bottom are what
 * lint.js scans a draft with — each match is reported as evidence with the
 * tell it belongs to, never as a score.
 */

export const TELLS_PREAMBLE =
  'Buyers now read cold email with one question running underneath it: did a person write this. ' +
  'Once a reader decides the answer is no, nothing later in the message recovers. Each fix is a ' +
  'rewrite, not a deletion — a tell is usually filler standing where a fact should be, so removing ' +
  'it without adding the fact leaves the sentence emptier than before.';

export const TELLS = [
  {
    id: 'em_dash_cadence',
    name: 'Em-dash cadence',
    detail:
      'Two em dashes in a message under 120 words is the classic marker. The pattern is a clause, ' +
      'a dash, and a summarising flourish. Use a full stop. Occasionally a comma. In a short ' +
      'message, zero em dashes.',
    before: 'We help logistics teams cut manual work — freeing your engineers to focus on what matters.',
    after: 'We cut the manual export step. At two companies that gave an engineer about a day a week back.',
  },
  {
    id: 'tricolon',
    name: 'Tricolons',
    detail:
      'Three parallel items where the writer only had evidence for one. It scans as rhythm rather ' +
      'than content. If you have three real items, you still only get one, because the message ' +
      'carries one idea.',
    before: 'reduce costs, improve visibility, and accelerate growth',
    after: 'cut the reconciliation step from four hours to about twenty minutes',
  },
  {
    id: 'hope_this_finds_you_well',
    name: '"I hope this finds you well"',
    detail:
      'Dead on arrival. It tells the reader the sender had nothing to open with. Open on the ' +
      'trigger — there is no warm-up in a cold email; the first line is the whole audition.',
    before: 'Hi Sarah, I hope this finds you well. I wanted to reach out because...',
    after: 'Sarah, your platform posting lists SOC 2 evidence collection as a day-to-day duty.',
  },
  {
    id: 'narrating_the_email',
    name: '"I wanted to reach out" / "I came across"',
    detail: 'Both narrate the act of emailing instead of saying anything. The reader can see that you reached out.',
    before: 'I wanted to reach out after coming across your recent announcement.',
    after: 'Your Series B announcement commits to opening a Berlin office by Q1.',
  },
  {
    id: 'growth_flattery',
    name: 'Flattery about growth',
    detail:
      '"Impressive growth", "exciting momentum", "incredible traction". Praise from a stranger ' +
      "carries no information and signals that the sender read a data provider's chart. Replace " +
      'praise with an observation precise enough to be wrong.',
    before: "I was impressed by Acme's impressive growth in the logistics space.",
    after:
      'You went from one warehouse integration to nine in eight months, which is usually where the ' +
      'mapping layer starts breaking.',
  },
  {
    id: 'balanced_sentence_lengths',
    name: 'Perfectly balanced sentence lengths',
    detail:
      'Three sentences of 18, 19 and 18 words in a row read as generated even when every word is ' +
      'fine. Human writing is lumpy. Aim for a mix: one sentence under 6 words somewhere in the message.',
    before:
      'We work with teams in your sector to improve their reporting workflows. Our platform ' +
      'integrates with the tools your team already uses every day. Many customers see meaningful ' +
      'improvements within the first month of use.',
    after:
      'Your team exports this by hand. We remove that step. The first month is usually where ' +
      'people find out how much of it was never needed.',
  },
  {
    id: 'unearned_enthusiasm',
    name: '"excited to", "thrilled to", "passionate about"',
    detail:
      'Enthusiasm the reader has not agreed to share. It also concedes that the sender wants this ' +
      'more than the recipient does, which is the wrong footing.',
    before: 'I would be excited to explore how we could support your team.',
    after: 'Worth me sending the two-page version?',
  },
  {
    id: 'two_closing_questions',
    name: 'Closing with two questions',
    detail:
      'Two questions invite answering neither, and the classic second one ("or is there someone ' +
      'better to speak to?") reads as pre-emptive surrender. One question. At the end. Then stop typing.',
    before: 'Would you be open to a quick call? Or should I speak to someone else on your team?',
    after: "Is this your team's or has it moved to platform?",
  },
];

export const LOW_FREQUENCY_TELLS = [
  { tell: '"In today\'s fast-paced landscape"', fix: 'Delete the clause; start at the noun' },
  { tell: '"leverage" as a verb', fix: '"use"' },
  { tell: '"solutions", "offerings", "capabilities"', fix: 'Name the actual thing' },
  { tell: '"It\'s not just X, it\'s Y"', fix: 'Say Y' },
  { tell: '"reach out", "circle back", "touch base"', fix: '"email", "reply", "ask"' },
  { tell: '"seamlessly integrates"', fix: 'Say what connects to what' },
  { tell: '"at scale" with no number', fix: 'Give the number or drop it' },
  { tell: 'Bold text mid-sentence for emphasis', fix: 'Nobody bolds words in a real email' },
  { tell: 'A closing line that restates the opening', fix: 'Cut it; the message is already short' },
  { tell: '"Let me know your thoughts"', fix: 'Ask the specific question instead' },
];

export const SELF_AUDIT = [
  'Read the opening line with a different company and person substituted. Does it still work? If yes, rewrite.',
  'Count em dashes. More than zero in a short message needs a reason.',
  'Count questions in the body. More than one, cut to one.',
  'Count words. Over 120, cut the second idea rather than trimming adjectives.',
  'Find the three longest sentences. Are they within four words of each other? Break one.',
  'Search for: "hope this finds", "wanted to reach out", "came across", "impressive", "excited", ' +
    '"passionate", "leverage", "solutions", "at scale", "just", "simply".',
  'Is there a claim with a number in it that the user did not supply? Remove it.',
  'Is there a link? If it is not the evidence for the trigger, remove it.',
  'Read the ask aloud and time the answer. Over 15 seconds, make it a yes/no.',
  'Would the sender be embarrassed if this were quoted publicly with their name on it?',
];

export const HUMAN_TELLS =
  'Real messages tend to contain: a specific number that is oddly precise, an admission of ' +
  'uncertainty ("I might have this wrong"), one short sentence with no verb, a mild opinion, and ' +
  'an abrupt ending. None of these are decoration to be added on top. They appear naturally when ' +
  'the sender actually knows something about the account.';

/**
 * The scan list lint.js runs. Each entry names the tell a match belongs to and
 * the fix from the tables above, so a finding always points back at a rewrite.
 */
export const PHRASE_SCANS = [
  { pattern: /hope this (email )?finds you/i, tell: 'hope_this_finds_you_well', fix: 'Open on the trigger instead.' },
  { pattern: /i wanted to reach out/i, tell: 'narrating_the_email', fix: 'Say the thing, not the act of emailing.' },
  { pattern: /i came across/i, tell: 'narrating_the_email', fix: 'Say the thing, not the act of emailing.' },
  { pattern: /impressive/i, tell: 'growth_flattery', fix: 'Replace praise with an observation precise enough to be wrong.' },
  { pattern: /\bexcited\b/i, tell: 'unearned_enthusiasm', fix: 'Cut the enthusiasm; make the offer concrete.' },
  { pattern: /\bthrilled\b/i, tell: 'unearned_enthusiasm', fix: 'Cut the enthusiasm; make the offer concrete.' },
  { pattern: /passionate/i, tell: 'unearned_enthusiasm', fix: 'Cut the enthusiasm; make the offer concrete.' },
  { pattern: /\bleverage\b/i, tell: 'low_frequency', fix: '"use"' },
  { pattern: /\bsolutions\b/i, tell: 'low_frequency', fix: 'Name the actual thing.' },
  { pattern: /\bofferings\b/i, tell: 'low_frequency', fix: 'Name the actual thing.' },
  { pattern: /\bcapabilities\b/i, tell: 'low_frequency', fix: 'Name the actual thing.' },
  { pattern: /at scale/i, tell: 'low_frequency', fix: 'Give the number or drop it.' },
  { pattern: /\bjust\b/i, tell: 'self_audit_search', fix: 'On the self-audit search list; usually padding.' },
  { pattern: /\bsimply\b/i, tell: 'self_audit_search', fix: 'On the self-audit search list; usually padding.' },
  { pattern: /in today'?s (fast-paced )?(landscape|world|market|environment)/i, tell: 'low_frequency', fix: 'Delete the clause; start at the noun.' },
  { pattern: /it'?s not just [^,.]+, it'?s/i, tell: 'low_frequency', fix: 'Say Y.' },
  { pattern: /circle back/i, tell: 'low_frequency', fix: '"reply"' },
  { pattern: /touch base/i, tell: 'low_frequency', fix: '"ask"' },
  { pattern: /seamlessly/i, tell: 'low_frequency', fix: 'Say what connects to what.' },
  { pattern: /let me know your thoughts/i, tell: 'low_frequency', fix: 'Ask the specific question instead.' },
  { pattern: /(exciting|incredible) (momentum|traction|growth)/i, tell: 'growth_flattery', fix: 'Replace praise with an observation precise enough to be wrong.' },
];

export function tellById(id) {
  return TELLS.find((t) => t.id === id) ?? null;
}
