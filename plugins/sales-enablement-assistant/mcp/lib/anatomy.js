/**
 * Message structure and constraints, ported from references/message-anatomy.md
 * and the skill's step 4 table. Data only — the lint pass that measures a
 * draft against these numbers lives in lint.js.
 */

export const ANATOMY = [
  { part: 'Subject', words: '2-5', job: 'Earn the open without promising anything' },
  { part: 'Opening line', words: '15-25', job: 'Prove this was written for this account' },
  { part: 'The bridge', words: '25-40', job: 'Connect the trigger to a consequence they own' },
  { part: 'The ask', words: '10-20', job: 'One question, answerable in under 15 seconds' },
];

export const HARD_CONSTRAINTS = [
  { constraint: 'Total length', threshold: 'Under 120 words, greeting and sign-off included' },
  { constraint: 'Ideas', threshold: 'Exactly one. A second idea competes with the first for the reply' },
  { constraint: 'Links', threshold: 'One at most, and only where the trigger needs evidence' },
  { constraint: 'Questions', threshold: 'Exactly one, in the body, at the end' },
  { constraint: 'The ask', threshold: "Answerable in under 15 seconds of the recipient's thought" },
  { constraint: 'First-touch ask', threshold: 'Never "quick call?", "15 minutes?", or a calendar link' },
  { constraint: 'Subject line', threshold: 'Two to five words, lowercase, no colon, no company name' },
  { constraint: 'Paragraph length', threshold: 'Three lines maximum on a phone' },
];

export const SUBJECT_RULES =
  'Two to five words, lowercase, no colon, no company name, no question mark. It should read like ' +
  "an internal note, not a campaign. Do not use the recipient's first name in the subject — " +
  'merge-field placement is the oldest bulk-mail tell there is.';

export const SUBJECT_EXAMPLES = {
  good: [
    { subject: 'soc 2 timeline', why: 'Specific, flat, plausible from a colleague' },
    { subject: 'your platform posting', why: 'Points at the trigger' },
    { subject: 'after the series b', why: 'Situational' },
    { subject: 'migration ownership', why: 'Names a problem, not a product' },
  ],
  bad: [
    { subject: 'Quick question for you, Sarah!', why: 'Padded, punctuated, obviously bulk' },
    { subject: 'Unlock 3x pipeline efficiency', why: 'Promise with no evidence' },
    { subject: 'Acme x YourCo — partnership?', why: 'The x-format is a sequencer signature' },
    { subject: 'Following up', why: 'Nothing has happened yet' },
  ],
};

export const FIND_AND_REPLACE_TEST =
  "Take the opening line. Swap the company name and the person's name for a different company and " +
  'a different person. Read it again. If it still makes sense, it is a template. Rewrite it. The ' +
  'opening line must be one the sender could not have sent to any other company on earth.';

export const FIND_AND_REPLACE_EXAMPLES = {
  fails: [
    {
      line: 'Hi Sarah, I came across Acme and was impressed by your growth in the logistics space.',
      why: 'Swap in "Globex" and "Tom" and it is unchanged. It is a template with a merge field.',
    },
    {
      line: 'Hi Sarah, congratulations on the recent funding — exciting times at Acme.',
      why: 'Any funded company, any name. Congratulation is not information.',
    },
  ],
  passes: [
    {
      line:
        'Your platform engineer posting lists "own the SOC 2 evidence pipeline" under day-to-day ' +
        'duties, which is an unusual thing to put on an engineer.',
      why: "Cannot survive the swap: it depends on one company's posting, one specific line of it, and a judgement about that line.",
    },
    {
      line:
        'You said on the Infra Weekly podcast that you would rather run three tools well than ten ' +
        'badly. That is the opposite of how most teams handle this, and I want to ask about the third one.',
      why: 'Depends entirely on something this person said.',
    },
  ],
};

export const ASK_EXAMPLES = [
  { fifteen_second_ask: '"Is this your team\'s problem or platform\'s?"', essay_prompt: '"How are you approaching this today?"' },
  { fifteen_second_ask: '"Is the deadline still Q3 for you?"', essay_prompt: '"What are your priorities this year?"' },
  { fifteen_second_ask: '"Worth me sending the two-page version?"', essay_prompt: '"Would you like to explore how we could help?"' },
  { fifteen_second_ask: '"Did the new hire inherit this?"', essay_prompt: '"Can we book 15 minutes?"' },
];

export const ASK_RULE =
  'The question must ask for a fact the buyer already holds, not for their analysis and not for ' +
  'their calendar. Never ask for a call on the first touch: the call is what you earn from a reply, ' +
  'and asking for it before the reply reverses the order. A "yes, send it" is a much cheaper first ' +
  'commitment and converts to a call anyway.';

export const FORMATTING_RULES = [
  'Two or three paragraphs, each under three lines on a phone.',
  'No bold, no bullet lists, no images, no signature block with six social icons.',
  'One link at most, and only when the trigger needs evidence. Zero links is stronger.',
  'First name only in the greeting, no comma-heavy salutation.',
  'Sign off with a first name. No "Best regards, Alex Smith | Senior Account Executive | YourCo | Book time with me".',
  'Identification and opt-out belong at the foot, in plain text, one line.',
];

export const FINISHED_WHEN =
  'The message is finished when all four are true: the opening cannot survive the name swap, the ' +
  'body carries one idea, the question costs under 15 seconds, and the word count is under 120. If ' +
  'any one is false, the fix is in the message, not in the send time.';

/** Step 7's honesty list: things this plugin will not write into a message. */
export const NEVER_ADD = [
  'A mutual connection, referral or introduction that does not exist',
  'A deadline, price expiry or capacity limit that is not real',
  'Any reference to a prior conversation, meeting, call or email that did not happen',
  'A claim that a named competitor is a customer without a public, citable reference',
  'Metrics, case study numbers or customer counts the user has not supplied',
];

export const COMPLIANCE_CHECKLIST = [
  {
    jurisdiction: 'EU (GDPR + national e-privacy rules)',
    check:
      'A documented lawful basis, usually legitimate interest, plus an assessment; identification ' +
      'of the sender; a working opt-out',
  },
  {
    jurisdiction: 'UK (PECR + UK GDPR)',
    check:
      'Corporate subscribers (limited companies, LLPs) may be emailed without prior consent; sole ' +
      'traders and partnerships are treated as individuals and generally need consent',
  },
  {
    jurisdiction: 'US (CAN-SPAM)',
    check:
      'No prior consent needed, but a valid physical postal address, a working opt-out honoured ' +
      'within 10 business days, and non-deceptive headers and subject lines are mandatory',
  },
  {
    jurisdiction: 'Canada (CASL)',
    check: 'Consent-based and stricter than the US. Do not assume implied consent',
  },
];

export const COMPLIANCE_NOTE =
  'A structured checklist, not legal advice. Where the recipient\'s jurisdiction is unknown, say ' +
  'that rather than guessing.';
