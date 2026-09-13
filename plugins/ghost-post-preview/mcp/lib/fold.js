import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'platforms.json'), 'utf8'));

export const PLATFORMS = data.platforms;
export const APPROXIMATION_NOTE = data.note;

export function platformFor(name) {
  // hasOwn, not `?? null`: an inherited name like "constructor" returns
  // Object.prototype.constructor — truthy, so `?? null` would not catch it,
  // and every caller of this (requirePlatform, foldTest, lintDraft) treats a
  // truthy result as a real, resolved platform and crashes reading .fold or
  // .label off it instead of getting the unknown-platform error.
  const key = String(name ?? '').trim().toLowerCase();
  return Object.hasOwn(PLATFORMS, key) ? PLATFORMS[key] : null;
}

/**
 * A platform's fold is either one spec, or split by part where the title and
 * the body truncate differently (Reddit, YouTube). Either cap may be null —
 * no limit of that kind.
 */
export function foldSpec(platform, part = 'body') {
  const fold = platform.fold;
  if (fold.title || fold.body) return { spec: fold[part] ?? fold.body ?? fold.title, part };
  return { spec: fold, part: null };
}

/**
 * Reconstruct what a reader sees before truncation: the character cap and the
 * line cap both apply, whichever bites first. On platforms where a blank line
 * costs a line of the allowance, blank lines are counted against the line cap.
 *
 * Deterministic mechanics only — no judgement of the fragment. Everything is
 * approximate by nature (device, font size, A/B state) and the result says so.
 */
export function foldTest(platformId, text, part = 'body') {
  const platform = platformFor(platformId);
  if (!platform) return null;

  const { spec, part: appliedPart } = foldSpec(platform, part);
  const charCap = spec.chars ?? Infinity;
  const lineCap = spec.lines ?? Infinity;
  const blanksCost = Boolean(spec.blank_lines_cost_a_line);

  const draft = String(text ?? '').replace(/\r\n/g, '\n');
  const lines = draft.split('\n');
  const visibleLines = [];
  let linesUsed = 0;
  let charsUsed = 0;
  let truncatedBy = null;

  for (const line of lines) {
    const isBlank = line.trim() === '';
    const lineCost = isBlank ? (blanksCost ? 1 : 0) : 1;
    if (linesUsed + lineCost > lineCap) { truncatedBy = 'line_cap'; break; }

    if (charsUsed + line.length > charCap) {
      const remaining = charCap - charsUsed;
      if (remaining > 0) {
        let cut = line.slice(0, remaining);
        // .slice() counts UTF-16 code units, not characters — an emoji or
        // other astral character is two code units, and a cut landing
        // between them leaves a lone, invalid surrogate at the end, which
        // renders as a broken character rather than the cut character
        // being cleanly dropped or kept.
        const lastCode = cut.charCodeAt(cut.length - 1);
        if (lastCode >= 0xd800 && lastCode <= 0xdbff) cut = cut.slice(0, -1);
        visibleLines.push(cut);
      }
      truncatedBy = 'char_cap';
      break;
    }

    visibleLines.push(line);
    linesUsed += lineCost;
    charsUsed += line.length + 1; // the newline itself
  }

  const visible = visibleLines.join('\n');
  // Whether the draft was actually truncated is decided by the loop that
  // just ran (it set truncatedBy the moment it broke early on a real cap),
  // not re-derived from what's left over — when everything past the cut is
  // blank lines, stripping *leading* newlines for the human-readable
  // preview below can leave nothing to show, which must not be read back
  // as "nothing was truncated" while characters_hidden still reports a
  // nonzero count for the very same cut.
  const truncated = truncatedBy !== null;
  const hiddenPreview = draft.slice(visible.length).replace(/^\n+/, '');
  const openingBlankLines = /^\n/.test(draft) ? draft.match(/^\n+/)[0].length : 0;

  return {
    platform: platform.label,
    ...(appliedPart ? {
      applies_to: appliedPart,
      part_note: appliedPart === 'body'
        ? `On ${platform.label} the title truncates separately and carries the hook — run fold_test with part "title" on it as well.`
        : null,
    } : {}),
    approximate: true,
    fold_limits: {
      characters: spec.chars ?? null,
      lines: spec.lines ?? null,
      blank_lines_cost_a_line: blanksCost,
    },
    visible_text: visible,
    truncated,
    truncated_by: truncated ? truncatedBy : null,
    characters_visible: visible.length,
    characters_hidden: truncated ? Math.max(0, draft.length - visible.length) : 0,
    first_hidden_line: truncated && hiddenPreview ? hiddenPreview.split('\n').find((l) => l.trim()) ?? null : null,
    opening_blank_lines: openingBlankLines,
    ...(openingBlankLines && blanksCost
      ? { note: 'The draft opens with a blank line, which spends part of the visible allowance on nothing.' }
      : {}),
  };
}
