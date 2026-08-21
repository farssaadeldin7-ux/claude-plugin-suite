import { platformFor } from './fold.js';

/**
 * Mechanical draft checks. Every finding is a measurable fact with the
 * evidence quoted — a URL present, a phrase matched, a count exceeded. No
 * scores, no verdicts, no predictions: interpreting the facts is the skill's
 * job, and keeping judgement out of here is what keeps the findings honest.
 */

const THROAT_CLEARING = [
  /^so[, ]/i,
  /^hi (everyone|guys|all|folks)/i,
  /^hope (you('re| are)|everyone('s| is))/i,
  /^i('ve| have) been (thinking|reflecting|meaning)/i,
  /^i wanted to (share|take a moment|talk about|write)/i,
  /^long post/i,
  /^(just|quick) (a )?(thought|update|note)/i,
  /^today i want(ed)? to talk about/i,
];

const SCROLLER_BOUNCE_PHRASES = [
  /excited to (share|announce)/i,
  /thrilled to announce/i,
  /in today('s| s)? (landscape|world|market)/i,
  /game.?chang/i,
  /humbled (and honou?red )?to/i,
];

const ENGAGEMENT_BAIT = [
  /comment ["']?(yes|below|interested)/i,
  /like (this )?if you/i,
  /tag (a|someone|three)/i,
  /follow (me|us)? ?for more/i,
  /smash that/i,
  /drop a .{0,12}(below|in the comments)/i,
];

const YES_NO_OPENERS = /^(are|do|did|have|has|is|was|were|would|will|can|could|should) (you|your|we|anyone)\b/i;

const URL_PATTERN = /https?:\/\/[^\s)]+|(?:^|\s)(?:www\.)[^\s)]+|\b[a-z0-9-]+\.(?:com|io|co|net|org|ai|dev)\/[^\s)]+/gi;

const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

const matchAgainst = (line, patterns) => {
  for (const pattern of patterns) {
    const m = pattern.exec(line);
    if (m) return m[0];
  }
  return null;
};

export function lintDraft(platformId, text) {
  const platform = platformFor(platformId);
  if (!platform) return null;

  const draft = String(text ?? '').replace(/\r\n/g, '\n');
  const lines = draft.split('\n');
  const firstLine = lines.find((l) => l.trim()) ?? '';
  const words = firstLine.trim().split(/\s+/).filter(Boolean);

  const findings = [];
  const flag = (check, evidence, why) => findings.push({ check, evidence, why });

  // Opener mechanics.
  const clearing = matchAgainst(firstLine.trim(), THROAT_CLEARING);
  if (clearing) {
    flag('throat_clearing_opener', clearing,
      'The opening is the author warming up, not the post starting; the second sentence is usually the real first sentence.');
  }
  if (YES_NO_OPENERS.test(firstLine.trim()) && /\?/.test(firstLine)) {
    flag('yes_no_question_opener', firstLine.trim(),
      'A yes/no question is a permission slip to scroll; question hooks are the weakest type on average.');
  }
  const bounce = matchAgainst(draft, SCROLLER_BOUNCE_PHRASES);
  if (bounce) {
    flag('scroller_bounce_phrase', bounce,
      'A phrase the skeptical scroller pattern-matches as content marketing.');
  }

  // Platform-mechanical issues.
  const links = draft.match(URL_PATTERN) ?? [];
  if (links.length && ['LinkedIn', 'X', 'Facebook', 'Threads'].includes(platform.label)) {
    flag('link_in_body', links[0].trim(),
      platform.label === 'LinkedIn'
        ? 'LinkedIn suppresses outbound links in the body — move it to the first comment.'
        : `${platform.label} downranks outbound links, moderately.`);
  }
  const hashtags = draft.match(/#[\p{L}\d_]+/gu) ?? [];
  if (hashtags.length && platform.label === 'X') {
    flag('hashtags_on_x', hashtags.join(' '), 'Hashtags do nothing useful on X.');
  }
  const bait = matchAgainst(draft, ENGAGEMENT_BAIT);
  if (bait) {
    flag('engagement_bait', bait, 'Pattern-matchable engagement bait is suppressed on most platforms.');
  }

  // Shape on screen.
  let run = 0, longestRun = 0;
  for (const line of lines) {
    run = line.trim() ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }
  if (platform.label === 'LinkedIn' && longestRun > 2) {
    flag('wall_of_text', `${longestRun} consecutive lines of prose`,
      'LinkedIn format rule: no more than two consecutive lines of prose before a break.');
  }
  const openingBlank = /^\n/.test(draft);
  if (openingBlank && platform.fold.blank_lines_cost_a_line) {
    flag('opening_blank_line', '(draft begins with a line break)',
      'A blank first line spends part of the fold allowance on nothing.');
  }

  const firstNumberMatch = /\d[\d,.]*%?/.exec(firstLine);

  return {
    platform: platform.label,
    findings,
    metrics: {
      characters_total: draft.length,
      first_line_characters: firstLine.length,
      first_line_words: words.length,
      first_number_in_line_one: firstNumberMatch ? firstNumberMatch[0] : null,
      first_number_word_position: firstNumberMatch
        ? firstLine.slice(0, firstNumberMatch.index).trim().split(/\s+/).filter(Boolean).length + 1
        : null,
      links: links.length,
      hashtags: hashtags.length,
      emoji: (draft.match(EMOJI_PATTERN) ?? []).length,
      longest_prose_run_lines: longestRun,
    },
    note: 'Mechanical facts only. Whether any of it matters for this draft is a judgement the findings do not make.',
  };
}
