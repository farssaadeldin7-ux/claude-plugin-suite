import { SECTIONS, FORMAT_FAILURES } from './template.js';

/**
 * Mechanical checks on a drafted sheet against the fixed format. Every
 * finding is a measurable fact with the evidence quoted — a section missing
 * or out of order, a fourth change, a six-word trigger, a drill over ten
 * minutes. No judgement of whether a change is an action or a principle, or
 * whether a check is genuinely countable — that reading is the skill's job.
 */

const TRIGGER_PATTERN = /Trigger:\s*"([^"]*)"/g;

function wordCount(phrase) {
  return phrase.trim().split(/\s+/).filter(Boolean).length;
}

/** Split the text into { heading, body } blocks on "## " headings. */
function splitSections(text) {
  const blocks = [];
  const pattern = /^## +(.+)$/gm;
  let match;
  const marks = [];
  while ((match = pattern.exec(text)) !== null) {
    marks.push({ heading: match[1].trim(), start: match.index, bodyStart: match.index + match[0].length });
  }
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    blocks.push({ heading: marks[i].heading, body: text.slice(marks[i].bodyStart, end) });
  }
  return blocks;
}

/** Which fixed section a heading belongs to, if any ("Drill — 6 minutes" is "Drill"). */
function sectionFor(heading) {
  return SECTIONS.find((s) => heading.toLowerCase().startsWith(s.toLowerCase())) ?? null;
}

export function lintSheet(text) {
  const sheet = String(text ?? '').replace(/\r\n/g, '\n');
  const blocks = splitSections(sheet);

  const findings = [];
  const flag = (check, evidence, rule) => findings.push({ check, evidence, rule });

  // ---- sections: all five present, in order, and nothing extra ------------
  const found = blocks.map((b) => ({ ...b, section: sectionFor(b.heading) }));

  for (const name of SECTIONS) {
    if (!found.some((b) => b.section === name)) {
      flag('missing_section', `no "## ${name}" heading`,
        'Fixed sections, fixed order. The format is load-bearing — the player learns where to look.');
    }
  }
  for (const block of found) {
    if (!block.section) {
      flag('unknown_section', `## ${block.heading}`,
        'Do not add sections and do not reorder them.');
    }
  }
  const order = found.filter((b) => b.section).map((b) => SECTIONS.indexOf(b.section));
  if (order.some((position, i) => i > 0 && position < order[i - 1])) {
    flag('sections_out_of_order', found.filter((b) => b.section).map((b) => b.heading).join(' > '),
      'Fixed sections, fixed order: Situation, Three changes, One thing to stop doing, Drill, Success check.');
  }

  const body = (name) => found.find((b) => b.section === name)?.body ?? '';

  // ---- three changes, never four ------------------------------------------
  const changesBody = body('Three changes');
  const changeCount = (changesBody.match(/^\s*\d+\.\s/gm) ?? []).length;
  if (changesBody && changeCount !== 3) {
    flag('change_count', `${changeCount} numbered change${changeCount === 1 ? '' : 's'}`,
      changeCount > 3
        ? 'Three changes. Never four. The fourth does not add — it evicts.'
        : 'The sheet carries exactly three changes.');
  }

  // ---- trigger phrases ----------------------------------------------------
  const triggers = [...sheet.matchAll(TRIGGER_PATTERN)].map((m) => m[1]);
  for (const phrase of triggers) {
    const words = wordCount(phrase);
    if (words > 5) {
      flag('trigger_too_long', `"${phrase}" (${words} words)`,
        'Five words or fewer — it will not be said mid-fight. Cut it down.');
    }
  }
  // One per change plus one on the stop-doing item.
  const expectedTriggers = (changesBody ? changeCount : 0) + (body('One thing to stop doing') ? 1 : 0);
  if (expectedTriggers && triggers.length < expectedTriggers) {
    flag('missing_trigger', `${triggers.length} of ${expectedTriggers} Trigger lines found`,
      'Each change and the stop-doing item carry a trigger phrase — the retention mechanism.');
  }

  // ---- drill length -------------------------------------------------------
  const drillBlock = found.find((b) => b.section === 'Drill');
  if (drillBlock) {
    const minutes = /(\d+)\s*min/i.exec(drillBlock.heading);
    if (!minutes) {
      flag('drill_minutes_missing', `## ${drillBlock.heading}`,
        'The drill heading states its length: "## Drill — [N] minutes".');
    } else if (Number(minutes[1]) > 10) {
      flag('drill_over_ten_minutes', `## ${drillBlock.heading}`,
        'A drill over ten minutes competes with queueing and loses.');
    }
  }

  // ---- success check carries a number -------------------------------------
  const checkBody = body('Success check');
  if (checkBody && !/\d/.test(checkBody)) {
    flag('success_check_has_no_number', checkBody.trim().split('\n')[0] ?? '(empty)',
      'A success check must be a number the player can report after one session without a replay.');
  }

  // ---- cut list -----------------------------------------------------------
  const cutMatch = /^Cut:.*(?:\n(?!\s*$).*)*/m.exec(sheet);
  const cutLines = cutMatch ? cutMatch[0].split('\n').filter((l) => l.trim()).length : 0;
  if (!cutMatch) {
    flag('no_cut_list', '(no line starting "Cut:")',
      'Show the cut list under the sheet — it stops the player wondering whether the obvious thing was missed.');
  } else if (cutLines > 3) {
    flag('cut_list_too_long', `${cutLines} lines`, 'Under the sheet, three lines maximum.');
  }

  // ---- numbers in the sheet, for the [verify] review ----------------------
  // Facts only: structural counts ("within two seconds") are fine; balance
  // numbers must be marked [verify] or asked from the player. Which is which
  // is a judgement this lint does not make.
  const numberedLines = [];
  for (const name of ['Situation', 'Three changes']) {
    for (const line of body(name).split('\n')) {
      if (/\d/.test(line) && line.trim()) {
        numberedLines.push({ section: name, line: line.trim(), marked_verify: line.includes('[verify]') });
      }
    }
  }

  return {
    findings,
    counts: {
      sections_found: found.filter((b) => b.section).length,
      changes: changeCount,
      trigger_phrases: triggers.length,
      verify_markers: (sheet.match(/\[verify\]/g) ?? []).length,
      cut_list_lines: cutLines,
      total_lines: sheet.split('\n').filter((l) => l.trim()).length,
      total_characters: sheet.length,
    },
    numbers_for_review: numberedLines,
    format_failure_table: FORMAT_FAILURES,
    note: 'Mechanical facts only. Whether a change is an action rather than a principle, or a '
      + 'check is genuinely countable, is a judgement these findings do not make.',
  };
}
