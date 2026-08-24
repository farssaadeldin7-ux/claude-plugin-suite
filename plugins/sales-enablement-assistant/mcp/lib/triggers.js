import { ToolError } from '../mcp-lite.js';

/**
 * The ranked trigger hierarchy, ported from references/trigger-hierarchy.md.
 * A trigger is a dated, verifiable event that makes contacting an account this
 * week different from contacting it last week. Every entry carries where to
 * verify it, the freshness window past which it inverts, and the failure mode
 * that makes it read as fake. Nothing here decides whether an event happened —
 * verification is research the user does; this file only holds the table and
 * the date arithmetic.
 */

export const REQUIRED_FIELDS_NOTE =
  'Every trigger must carry three things into the brief: what happened, the source, and the date. ' +
  'Missing any of the three, it does not go in the message.';

export const TRIGGERS = [
  {
    rank: 1,
    id: 'funding_round_or_acquisition',
    name: 'Funding round or acquisition',
    freshness_days: 70, // 10 weeks
    freshness: '10 weeks. Best inside the first 3.',
    best_by_day: 21,
    where_to_verify: [
      "The company's own newsroom or blog",
      "The investor's portfolio announcement",
      'A filing (Companies House in the UK, SEC Form D in the US)',
      "The CEO's own post",
    ],
    what_to_do:
      'Money creates a spending plan, and a spending plan creates scrutiny. The useful angle is what ' +
      'the round obliges them to do next (hire, expand a region, ship a platform), not congratulations.',
    failure_mode:
      '"Congratulations on the Series B" as an opening line. Half their inbox says that. Reference ' +
      'the specific commitment made in the announcement instead.',
    note: 'The strongest trigger there is, because it changes budget, mandate and urgency at once.',
  },
  {
    rank: 2,
    id: 'relevant_executive_hire',
    name: 'Relevant executive hire',
    freshness_days: 91, // 13 weeks
    freshness:
      '13 weeks — the first 90 days, when a new executive is visibly reviewing what they inherited ' +
      'and has permission to change it.',
    where_to_verify: [
      'Their LinkedIn start date',
      'The hire announcement',
      'The company leadership page',
    ],
    what_to_do:
      'Address the thing they were hired to fix, which is usually stated in the announcement itself.',
    failure_mode: 'Contacting the new hire on day 2, or naming their predecessor.',
    note:
      'Relevant is doing the work in that heading. A new VP in the function you sell into is a ' +
      'trigger; a new Chief People Officer, when you sell observability, is not.',
  },
  {
    rank: 3,
    id: 'job_posting',
    name: 'Public job posting that implies the pain',
    freshness_days: 42, // 6 weeks
    freshness: '6 weeks, or until the posting closes, whichever comes first.',
    where_to_verify: [
      'Their careers page (the primary source)',
      "The posting's own text",
      'The date it went live',
    ],
    what_to_do:
      'Quote the requirement, not the job title. "Your platform engineer posting lists SOC 2 ' +
      'evidence collection under day-to-day duties" is specific. Three of the same role posted at ' +
      'once is a stronger signal than one.',
    failure_mode:
      'Implying they should not hire, or that your product replaces the role. It reads as an insult ' +
      'to the person you are emailing, who wrote the posting.',
    note:
      'An underrated trigger, because a job posting is the company paying real money to describe a ' +
      'problem in its own words.',
  },
  {
    rank: 4,
    id: 'product_launch_or_pricing_change',
    name: 'Product launch or pricing change',
    freshness_days: 56, // 8 weeks
    freshness: '8 weeks.',
    where_to_verify: [
      'Changelog',
      'Release notes',
      'Pricing page (compare against an archived version)',
      'Launch post',
    ],
    what_to_do:
      'A launch creates load somewhere, and a pricing change signals a shift in who they are ' +
      'selling to. Name the second-order consequence.',
    failure_mode:
      'Describing their launch back to them. They know. Go straight to the consequence you can speak to.',
  },
  {
    rank: 5,
    id: 'compliance_deadline',
    name: 'Compliance or regulatory deadline',
    freshness_days: null, // valid until the deadline itself
    freshness:
      'Valid until the deadline, and strongest 3 to 9 months out. Inside a month, the vendor ' +
      'decision has already been made.',
    where_to_verify: [
      "The regulator's published timetable",
      'Evidence this specific account is in scope (sector, size threshold, jurisdiction, listed status)',
    ],
    what_to_do:
      'Only usable if you can show in-scope status. A generic regulation email to an out-of-scope ' +
      'company is worse than no email.',
    failure_mode:
      'Manufactured urgency, or misstating the deadline. Buyers in regulated functions know the ' +
      'date better than you do, and one wrong date ends it.',
  },
  {
    rank: 6,
    id: 'competitor_switch_or_vendor_change',
    name: 'Competitor switch or vendor change',
    freshness_days: 91, // 13 weeks
    freshness: '13 weeks.',
    where_to_verify: [
      'A public case study appearing or disappearing',
      "A logo added to a vendor's site",
      'A conference talk',
      'A technical job posting naming the new stack',
      'A status page or integration directory listing',
    ],
    what_to_do:
      'A switch means someone owns the migration and is exposed if it goes badly. That person is your buyer.',
    failure_mode:
      'Guessing at the switch from a job posting that merely lists a tool as "nice to have", then ' +
      'asserting it as fact. If you cannot cite it, it is rank 3.',
  },
  {
    rank: 7,
    id: 'public_commentary',
    name: 'Public commentary by the buyer themselves',
    freshness_days: 21, // 3 weeks
    freshness:
      '3 weeks. Commentary ages faster than anything else on this list, because it is a moment ' +
      'rather than a state.',
    where_to_verify: ['The post itself. Link to it or quote it exactly.'],
    what_to_do:
      'Respond to the argument, not to the fact that they posted. Disagreeing well outperforms ' +
      'agreeing blandly.',
    failure_mode:
      '"Loved your post on X" with nothing after it. If you cannot name the specific claim you are ' +
      'responding to, you did not read it.',
  },
];

/** Events the list does not name — layoffs, an executive departure, a public
 *  outage, a lawsuit, an expansion announced outside a funding round. */
export const OTHER_EVENTS = {
  id: 'other_dated_event',
  name: 'Anything else dated and verifiable',
  rank_equivalent: 6,
  freshness_days: 91, // treated at rank-6-equivalent strength
  rule:
    'Events the hierarchy does not name — layoffs, an executive departure, a public outage or ' +
    'incident, a lawsuit, an expansion announced outside a funding round — qualify when they are ' +
    'dated, verifiable at a primary source, and map to the pain you solve. Treat them at ' +
    'rank-6-equivalent strength. What disqualifies an event is a missing date or source, not ' +
    'absence from this list.',
};

export const NOT_TRIGGERS = [
  '"We noticed you\'re in the logistics industry"',
  '"I see you\'re using HubSpot" (from a technology-detection tool, with no event)',
  '"Companies your size usually struggle with X"',
  "Headcount growth on a data provider's chart, with no named event behind it",
  'A birthday, work anniversary, or "5 years at the company" notification',
  'The fact that they opened a previous email',
  'Anything a list-building tool produced without a date attached',
];

export const NOT_TRIGGERS_RULE =
  'These are firmographics. They describe a state that has been true for months and will be true ' +
  'next month, so they carry no answer to "why now". Treat their presence as a stop condition: ' +
  'return the brief, say no trigger was found, and name the specific event you would watch for.';

export const STALENESS_RULE =
  'Triggers do not fade evenly, they invert. Inside the window, referencing an event shows ' +
  'attention. Outside it, the same reference shows that the sender has been holding a list and ' +
  'finally got to this row. If the only trigger available is stale, treat the account as untriggered ' +
  'and say so.';

export const MULTIPLE_TRIGGERS_RULE =
  'Two triggers that agree are worth more than either alone, but the message still carries one ' +
  'idea. Lead with the strongest, put the second in the follow-up as the new information touch 2 is ' +
  'required to add.';

export function triggerByRank(rank) {
  if (rank === 'other') return OTHER_EVENTS;
  return TRIGGERS.find((t) => t.rank === Number(rank)) ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDay(value, field) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) throw new ToolError('invalid_date', `"${field}" must be a date in YYYY-MM-DD form, got "${value}".`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== m[0]) {
    throw new ToolError('invalid_date', `"${value}" is not a real calendar date.`);
  }
  return date;
}

export function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Date arithmetic against the freshness table. Reports whether the event is
 * inside its window and what the table says about it. It does not verify that
 * the event happened, and it does not upgrade a stale trigger — staleness
 * inverts, it does not merely weaken.
 */
export function checkTrigger({ rank, event_date, deadline, posting_closed, as_of }) {
  const trigger = triggerByRank(rank);
  if (!trigger) {
    throw new ToolError('unknown_rank', `"${rank}" is not a rank — use 1 to 7, or "other" for an unlisted dated event.`, {
      note: 'Firmographics ("you\'re in industry X") have no rank: they are a stop condition, not a weak trigger. See trigger_hierarchy.',
    });
  }

  const today = as_of ? parseDay(as_of, 'as_of') : parseDay(isoDay(new Date()), 'today');
  const event = parseDay(event_date, 'event_date');
  const daysSince = Math.floor((today - event) / DAY_MS);
  if (daysSince < 0) {
    throw new ToolError('future_event', `event_date ${isoDay(event)} is after ${isoDay(today)} — an event that has not happened is not a trigger.`);
  }

  const result = {
    rank: trigger.rank ?? `other (rank-${OTHER_EVENTS.rank_equivalent}-equivalent)`,
    trigger: trigger.name,
    event_date: isoDay(event),
    as_of: isoDay(today),
    days_since_event: daysSince,
    freshness_rule: trigger.freshness ?? OTHER_EVENTS.rule,
    notes: [],
  };

  // Rank 5 is windowed by the deadline itself, not by the event date.
  if (trigger.rank === 5) {
    if (!deadline) {
      throw new ToolError('missing_deadline', 'Rank 5 is windowed by the regulatory deadline — pass "deadline" (YYYY-MM-DD).');
    }
    const due = parseDay(deadline, 'deadline');
    const daysToDeadline = Math.floor((due - today) / DAY_MS);
    result.deadline = isoDay(due);
    result.days_to_deadline = daysToDeadline;
    result.within_window = daysToDeadline > 0;
    if (daysToDeadline <= 0) {
      result.verdict = 'stale';
      result.notes.push('The deadline has passed. Valid until the deadline only.');
    } else if (daysToDeadline < 30) {
      result.verdict = 'usable_but_late';
      result.notes.push('Inside a month of the deadline, the vendor decision has already been made.');
    } else {
      result.verdict = 'usable';
      if (daysToDeadline >= 90 && daysToDeadline <= 274) {
        result.notes.push('Strongest position: 3 to 9 months out from the deadline.');
      }
    }
    result.notes.push('Only usable if you can show this account is in scope — sector, size threshold, jurisdiction or listed status.');
    return finish(result, trigger);
  }

  const windowDays = trigger.freshness_days ?? OTHER_EVENTS.freshness_days;
  result.window_days = windowDays;
  result.days_remaining_in_window = Math.max(0, windowDays - daysSince);
  result.within_window = daysSince <= windowDays;

  // Rank 3 also closes when the posting closes, whichever comes first.
  if (trigger.rank === 3 && posting_closed === true) {
    result.within_window = false;
    result.notes.push('The posting has closed, which ends the window regardless of the date.');
  }

  if (result.within_window) {
    result.verdict = 'usable';
    if (trigger.best_by_day && daysSince > trigger.best_by_day) {
      result.notes.push(`Past the strongest stretch — this trigger is best inside the first ${trigger.best_by_day / 7} weeks.`);
    }
  } else {
    result.verdict = 'stale';
    result.notes.push(STALENESS_RULE);
  }
  return finish(result, trigger);
}

function finish(result, trigger) {
  result.failure_mode_to_avoid = trigger.failure_mode ?? null;
  result.required_in_brief = REQUIRED_FIELDS_NOTE;
  result.note =
    'Date arithmetic against the freshness table only. Whether the event really happened, has a ' +
    'citable source, and maps to the pain you solve is research this tool cannot do.';
  return result;
}
