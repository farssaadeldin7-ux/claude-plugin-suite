/**
 * Article architecture: the template, the style rules, the policy/procedure
 * split, the anti-patterns and the four retrieval failure modes — ported from
 * references/article-template.md and step 4 of the skill. The lint applies
 * only the checks those rules state mechanically, with the evidence quoted;
 * whether a finding matters for a given article is the skill's judgement.
 */

export const MAX_ARTICLE_WORDS = 400;

export const ARTICLE_TEMPLATE = `# <Intent, in the customer's words>

Applies to: <plan / region / order state, or "all customers">   Kind: policy | procedure
Owner: <name>   Last reviewed: <YYYY-MM-DD>   Review by: <YYYY-MM-DD>

<The answer, in one or two sentences. No preamble.>

## Preconditions
- <What must be true for the answer above to hold>

## Steps            (procedure articles only)
1. <Literal UI labels in bold or quotes>

## Exact strings and codes
- "<user-facing message>" (<error_code>)

## If this does not apply
<One-line pointer to the sibling article, or "escalate to a human">`;

export const TEMPLATE_NOTE =
  'Keep it under 400 words — longer articles get chunked, and a chunk from the middle rarely contains the answer.';

export const STYLE_RULES = [
  { rule: 'Title is the customer\'s question, not a noun phrase', reason: '"Why was my card declined?" retrieves; "Payment troubleshooting" does not' },
  { rule: 'Answer in the first two sentences', reason: 'Retrieved chunks are short; the answer must be in the first chunk' },
  { rule: 'One intent per article', reason: 'Multi-intent articles are retrieved for all and resolve none' },
  { rule: 'Preconditions stated, never implied', reason: 'An unqualified answer is wrong for somebody' },
  { rule: 'Exact user-facing strings, verbatim', reason: 'Customers paste them, and that paste is the query' },
  { rule: 'Error codes and labels in text, never only in an image', reason: 'Images are invisible to retrieval' },
  { rule: 'Each number written once, in one place', reason: '"30 days" in nine articles becomes nine edits' },
  { rule: 'No cross-reference chains', reason: 'An answer two hops away will not be found' },
  { rule: 'Date and owner on every article', reason: 'Undated articles are unmaintainable and outrank current ones' },
];

export const POLICY_VERSUS_PROCEDURE = {
  procedure: 'How to do a thing; stable for years ("how to start a return").',
  policy: 'The rule that governs it; changes with the business ("returns window: 30 days from delivery, unworn, tags attached, final-sale excluded").',
  split:
    'The policy article is short, has a single owner — usually not support — and is the only place ' +
    'the number appears. Procedure articles reference it by name rather than restating it.',
  test:
    'If a policy changes tomorrow, how many articles need editing? More than one means the split has not been done.',
};

export const ANTI_PATTERNS = [
  {
    id: 'buried_answer',
    name: 'The buried answer',
    before:
      '# Returns — "At <brand> we want you to love what you ordered. We know that sometimes things ' +
      'do not work out, and our returns process is designed to be as simple as possible..." The ' +
      'answer to "how long do I have" never appears; the first chunk carries no information.',
    after:
      '# How do I return an item? — "You have 30 days from delivery to return an item. Start at ' +
      '<brand>.com/returns with your order number and the email address on the order." Then the ' +
      'preconditions: unworn, tags attached, final-sale excluded, delivered within 30 days.',
  },
  {
    id: 'unqualified_regional_answer',
    name: 'The unqualified regional answer',
    before:
      '"Shipping is free on orders over £50 and arrives in 2-3 working days." A customer in ' +
      'Ireland is now confidently told something false.',
    after:
      'A per-destination table — UK mainland free over £50, 2-3 working days; Highlands & Islands ' +
      'free over £75, 3-5 days; Ireland free over €70, 4-6 days; EU free over €90, 5-8 days, ' +
      'duties apply — ending with "If your destination is not listed: escalate; do not estimate."',
  },
  {
    id: 'near_duplicate_pair',
    name: 'The near-duplicate pair',
    before:
      'Two articles, "Payment issues" and "Card declined at checkout", both partially covering the ' +
      'same intent. Scores split, neither clears threshold, the agent guesses.',
    after:
      'Merge into one article titled with the customer\'s phrasing and delete the other from the ' +
      'index — a deprecated-but-indexed article is still a competing retrieval target.',
  },
  {
    id: 'product_vocabulary',
    name: 'Product vocabulary instead of customer vocabulary',
    before: '"# Configuring the Notification Preference Centre for sub-accounts". No customer types that.',
    after:
      '"# How do I stop getting emails for other people\'s accounts?" with an "Also asked as" block ' +
      'lifted verbatim from real tickets ("turn off notifications for my team", "why am I getting ' +
      'emails about someone else\'s project"), so retrieval matches the query the customer sends.',
  },
  {
    id: 'missing_error_string',
    name: 'The missing error string',
    before: '"If your payment fails, please check your card details and try again."',
    after:
      'The exact messages, verbatim with their codes: "Payment method declined (err_card_2041)", ' +
      '"Card expired (err_card_2012)", "Incorrect security code (err_card_2018)", "3D Secure ' +
      'authentication failed (err_3ds_5502)" — and "If none of these match your screen: escalate ' +
      'with the exact wording of the message."',
  },
];

export const MAINTENANCE = [
  'Review cadence: policy quarterly, procedure every six months.',
  'Change trigger: any release that changes a UI label an article quotes. Put it on the release checklist, or the agent will describe a button that no longer exists.',
  'Archive, do not deprecate. Remove it from the index; an article marked "outdated" at the top still gets retrieved and quoted.',
  'Every article change re-runs the regression set. Edits to first sentences are exactly what moves retrieval.',
];

// The four retrieval failure modes, from step 4 of the skill. Audited before
// launch because each produces confident wrong answers, not visible failures.
export const RETRIEVAL_FAILURE_MODES = [
  {
    mode: 'Near-duplicate split',
    symptom: 'Two articles cover the same intent; retrieval scores split between them and neither clears threshold',
    fix: 'Merge, then delete. Do not leave a redirect stub in the index',
  },
  {
    mode: 'Stale outranking',
    symptom: 'An old, well-written article outranks the current, thinner one',
    fix: 'Date-boost retrieval, and archive out of the index rather than "marking deprecated"',
  },
  {
    mode: 'Missing qualifier',
    symptom: 'Region-, plan- or currency-specific answer written as universal',
    fix: 'Add the qualifier to the title and the first sentence, or split per region',
  },
  {
    mode: 'Vocabulary mismatch',
    symptom: 'Article answers a question no customer phrases that way',
    fix: 'Retitle in customer words; add real ticket phrasings verbatim',
  },
];

export const RETRIEVAL_TEST_NOTE =
  'For vocabulary mismatch, test with actual ticket text, not paraphrases you wrote: sample 20 ' +
  'real tickets per intent and check whether the intended article is retrieved top-1.';

// Preamble the buried-answer anti-pattern opens with: the article warming up
// instead of answering. Matched literally, evidence quoted.
const PREAMBLE_PATTERNS = [
  /^at [\w<>-]+,? we (want|know|believe|love|are)/i,
  /^we (want you to|know that|understand|appreciate|are (sorry|thrilled|delighted))/i,
  /^thank you for (reaching out|contacting|getting in touch)/i,
  /^our (customer care|support) team is here/i,
  /^we're sorry to hear/i,
];

// A code-like token: err_card_2041, ERR-402, E1234, and similar. Underscores
// only on the lowercase branch — hyphens would match ordinary prose
// ("final-sale") and drown the check.
const CODE_PATTERN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\b[A-Z]{1,6}-?\d{2,}\b/;

// A policy-looking value: a duration or a currency amount.
const POLICY_VALUE_PATTERN = /\b\d+(?:-\d+)?\s*(?:working\s+)?(?:day|hour|week|month)s?\b|[£$€]\s?\d[\d,.]*/i;

const REGION_WORDS = /\b(UK|EU|USA?|Ireland|mainland|Highlands|international|domestic)\b/;

const splitSentences = (text) =>
  text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);

/**
 * Mechanical lint of one drafted article against the template and style
 * rules. Every finding is a measurable fact with the evidence quoted. The
 * checks that need the whole article set — near-duplicates, stale outranking,
 * cross-reference chains — cannot run on a single article and are not faked
 * here; run them across the set with the failure-mode table.
 */
export function lintArticle({ title = '', body = '', kind = null } = {}) {
  const text = String(body ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
  const cleanTitle = String(title ?? '').replace(/^#\s*/, '').trim();

  const findings = [];
  const flag = (check, evidence, why) => findings.push({ check, evidence, why });

  // Metadata lines from the template header.
  const appliesTo = /applies to:\s*(.+)/i.exec(text)?.[1]?.trim() ?? null;
  const owner = /owner:\s*(\S.*?)(?:\s{2,}|$)/im.exec(text)?.[1]?.trim() ?? null;
  const lastReviewed = /last reviewed:\s*(\S+)/i.exec(text)?.[1] ?? null;
  const declaredKind = /kind:\s*(policy|procedure)/i.exec(text)?.[1]?.toLowerCase()
    ?? (kind ? String(kind).toLowerCase() : null);

  // Body prose: strip headings and metadata lines before sentence work.
  const prose = text.split('\n')
    .filter((line) => !/^#/.test(line.trim()) && !/^(applies to|owner|last reviewed|review by|kind):/i.test(line.trim()))
    .join('\n');
  const sentences = splitSentences(prose);
  const firstTwo = sentences.slice(0, 2).join(' ');
  const words = prose.split(/\s+/).filter(Boolean);

  if (words.length > MAX_ARTICLE_WORDS) {
    flag('over_length', `${words.length} words`,
      'Keep it under 400 words — longer articles get chunked, and a chunk from the middle rarely contains the answer.');
  }
  if (cleanTitle && !cleanTitle.includes('?')) {
    flag('title_not_a_question', cleanTitle,
      'Title is the customer\'s question, not a noun phrase: "Why was my card declined?" retrieves; "Payment troubleshooting" does not.');
  }
  if (!appliesTo) {
    flag('missing_applies_to', '(no "Applies to:" line)',
      'Preconditions stated, never implied — an unqualified answer is wrong for somebody.');
  }
  if (!owner) {
    flag('missing_owner', '(no "Owner:" line)',
      'An article with no owner is stale within two quarters.');
  }
  if (!lastReviewed) {
    flag('missing_review_date', '(no "Last reviewed:" line)',
      'Undated articles are unmaintainable and outrank current ones.');
  }

  const preambleMatch = sentences.length
    ? PREAMBLE_PATTERNS.map((p) => p.exec(sentences[0])).find(Boolean)
    : null;
  if (preambleMatch) {
    flag('preamble_before_answer', preambleMatch[0],
      'The buried-answer anti-pattern: the first chunk carries no information. The answer belongs in the first two sentences, with no preamble.');
  }

  const mentionsFailure = /\b(error|declined|failed|fails|not working|not arriving)\b/i.exec(prose);
  const codes = text.match(new RegExp(CODE_PATTERN, 'g')) ?? [];
  if (mentionsFailure && !codes.length) {
    flag('no_exact_error_string', mentionsFailure[0],
      'The article discusses a failure but quotes no literal message or code. The exact string is what the customer will paste, and that paste is the query.');
  }

  const policyValue = declaredKind === 'procedure' ? POLICY_VALUE_PATTERN.exec(prose) : null;
  if (policyValue) {
    flag('policy_value_in_procedure', policyValue[0],
      'A procedure article restating a value is a policy-split candidate: the number belongs in one policy article, referenced by name. Whether this value is policy is a judgement this check does not make.');
  }

  if ((!appliesTo || /^all customers/i.test(appliesTo)) && REGION_WORDS.test(prose)) {
    flag('possible_missing_qualifier', REGION_WORDS.exec(prose)[0],
      'The body names a region while "Applies to" claims everyone (or is absent) — the missing-qualifier failure mode writes a specific answer as universal. Check whether this needs a qualifier table or a per-region split.');
  }

  return {
    findings,
    metrics: {
      word_count: words.length,
      first_two_sentences: firstTwo || null,
      metadata: { applies_to: appliesTo, owner, last_reviewed: lastReviewed, kind: declaredKind },
      sections_present: {
        preconditions: /^##\s*preconditions/im.test(text),
        steps: /^##\s*steps/im.test(text),
        exact_strings: /^##\s*exact/im.test(text),
        if_this_does_not_apply: /^##\s*if /im.test(text),
        also_asked_as: /^##\s*also asked/im.test(text),
      },
      exact_strings_and_codes_found: codes.slice(0, 20),
      references: (text.match(/\(see:?\s[^)]+\)|\[[^\]]+\]\([^)]+\)/gi) ?? []).length,
    },
    note:
      'Mechanical facts only. Whether the first two sentences actually answer the intent, and ' +
      'whether any finding matters for this article, are judgements the lint does not make. ' +
      'Near-duplicates and stale outranking are set-level failures this single-article lint cannot see.',
  };
}
