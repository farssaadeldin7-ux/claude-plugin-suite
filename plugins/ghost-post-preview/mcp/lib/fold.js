import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'platforms.json'), 'utf8'));

export const PLATFORMS = data.platforms;
export const APPROXIMATION_NOTE = data.note;

export function platformFor(name) {
  return PLATFORMS[String(name ?? '').trim().toLowerCase()] ?? null;
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
      if (remaining > 0) visibleLines.push(line.slice(0, remaining));
      truncatedBy = 'char_cap';
      break;
    }

    visibleLines.push(line);
    linesUsed += lineCost;
    charsUsed += line.length + 1; // the newline itself
  }

  const visible = visibleLines.join('\n');
  const hidden = draft.slice(visible.length).replace(/^\n+/, '');
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
    truncated: hidden.length > 0,
    truncated_by: hidden.length ? truncatedBy ?? 'char_cap' : null,
    characters_visible: visible.length,
    characters_hidden: Math.max(0, draft.length - visible.length),
    first_hidden_line: hidden ? hidden.split('\n').find((l) => l.trim()) ?? null : null,
    opening_blank_lines: openingBlankLines,
    ...(openingBlankLines && blanksCost
      ? { note: 'The draft opens with a blank line, which spends part of the visible allowance on nothing.' }
      : {}),
  };
}
