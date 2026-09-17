import { ToolError } from '../mcp-lite.js';
import { CAPTION_RULES, DESTINATIONS, SPEC_CAVEAT } from './destinations.js';

/**
 * Deterministic caption scaffolding. Given a clip's transcript text and a
 * destination, this returns the destination's caption spec applied to that
 * text: the hook line (the clip's first sentence, verbatim), the actual
 * character counts against the spec's limits, and the hashtag rule. It
 * structures what it is given — it never writes copy. The judgement lines
 * (the context-or-position line, the actual tags) are returned as named
 * slots for the skill or the user to fill.
 */

/** The first sentence of a text, verbatim apart from whitespace collapsing. */
export function firstSentence(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = /^.*?[.!?]+(?=\s|$)/.exec(t);
  return (m ? m[0] : t).trim();
}

/** Basic well-formedness of supplied hashtags — deterministic checks only. */
function checkHashtags(hashtags, rule) {
  const problems = [];
  if (hashtags.length > rule.max) {
    problems.push(`${hashtags.length} hashtags supplied; the spec allows at most ${rule.max}.`);
  }
  for (const tag of hashtags) {
    if (!/^#[^\s#]+$/.test(tag)) {
      problems.push(`"${tag}" is not a well-formed hashtag (one leading #, no spaces).`);
    }
  }
  return problems;
}

export function captionPack({ transcript, destination, hashtags }) {
  const key = String(destination ?? '').trim().toLowerCase();
  if (!Object.hasOwn(CAPTION_RULES, key)) {
    throw new ToolError('unknown_destination', `No destination "${destination}".`, {
      available: Object.keys(CAPTION_RULES),
    });
  }
  const text = String(transcript ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    throw new ToolError('empty_transcript', 'The clip transcript is empty — there is nothing to build a caption from.');
  }

  const rule = CAPTION_RULES[key];
  const dest = DESTINATIONS[key];
  const hook = firstSentence(text);
  const hookFits = hook.length <= rule.truncation_chars;
  const suppliedTags = Array.isArray(hashtags) ? hashtags.map((t) => String(t).trim()).filter(Boolean) : null;

  return {
    destination: key,
    label: dest.label,
    spec: {
      field: rule.field,
      ...(rule.field_note ? { field_note: rule.field_note } : {}),
      max_chars: rule.max_chars,
      truncation_chars: rule.truncation_chars,
      hashtags: rule.hashtags,
      caveat: SPEC_CAVEAT,
    },
    hook_line: {
      text: hook,
      chars: hook.length,
      source: 'The clip\'s first sentence, verbatim. If the hook should be a different line, re-cut the clip so it opens on that line — do not caption a promise the clip does not open with.',
      fits_before_truncation: hookFits,
      ...(hookFits
        ? {}
        : {
            over_truncation_by: hook.length - rule.truncation_chars,
            visible_before_truncation: hook.slice(0, rule.truncation_chars),
            note: `The feed truncates this ${rule.field} at about ${rule.truncation_chars} characters; the hook runs ${hook.length}. Everything after the visible part is behind a tap.`,
          }),
      ...(hook.length > rule.max_chars
        ? { over_hard_limit_by: hook.length - rule.max_chars, hard_limit_note: `Over the ${rule.max_chars}-character hard limit for the ${rule.field} — it cannot ship as-is.` }
        : {}),
    },
    scaffold: [
      { slot: 'line_1_hook', text: hook, chars: hook.length },
      {
        slot: 'line_2_context_or_position',
        fill: 'One line that adds the context the clip left out or takes a position on the claim — never a restatement of the hook and never "full episode at the link". Not written here: this tool does not invent copy.',
        budget_chars: Math.max(0, rule.max_chars - hook.length - 1),
      },
      {
        slot: 'hashtags',
        rule: rule.hashtags,
        ...(suppliedTags
          ? {
              supplied: suppliedTags,
              count: suppliedTags.length,
              problems: checkHashtags(suppliedTags, rule.hashtags),
            }
          : { fill: `Up to ${rule.hashtags.max}, ${rule.hashtags.placement}. Not invented here.` }),
      },
    ],
    counts: {
      transcript_chars: text.length,
      hook_chars: hook.length,
      field_max_chars: rule.max_chars,
      remaining_after_hook: Math.max(0, rule.max_chars - hook.length - 1),
    },
  };
}
