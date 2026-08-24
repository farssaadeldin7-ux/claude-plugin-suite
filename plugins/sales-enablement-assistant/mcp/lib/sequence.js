import { parseDay, isoDay } from './triggers.js';

/**
 * The three-touch sequence from the skill's step 6, as date arithmetic:
 * touch 2 lands 4 working days after touch 1, touch 3 lands 7 working days
 * after touch 2, and after touch 3 the account goes quiet for 90 days.
 * Working days skip Saturday and Sunday only — public holidays vary by
 * country and are not modelled. What each touch must contain is the table's
 * rule, restated; whether the follow-up actually adds new information is a
 * judgement this file cannot make.
 */

export const TOUCH_RULES = [
  {
    touch: 1,
    timing: 'Day 0',
    must_add: 'The trigger and the 15-second question',
    ask: 'One question',
  },
  {
    touch: 2,
    timing: '+4 working days',
    must_add: 'New information the first touch did not contain: a number, a comparable account, a short artefact',
    ask: 'Softer, still a question',
  },
  {
    touch: 3,
    timing: '+7 working days after touch 2',
    must_add: 'The breakup: state your assumption and close the loop',
    ask: 'Yes/no only',
  },
];

export const SEQUENCE_RULES = {
  new_information:
    'Every follow-up must add something the previous one did not contain. "Just bumping this" is ' +
    'new pleading, not new information, and it teaches the reader to ignore the thread. If you ' +
    'cannot find something to add, the sequence is over early, which is a legitimate outcome.',
  breakup:
    'After touch 3, stop for 90 days, and never restart on a timer. A new rank 1-3 trigger resets ' +
    'the account to a first touch and restarts the sequence at step 2 of the method; nothing weaker does.',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function addWorkingDays(date, count) {
  let current = new Date(date.getTime());
  let remaining = count;
  while (remaining > 0) {
    current = new Date(current.getTime() + DAY_MS);
    if (!isWeekend(current)) remaining--;
  }
  return current;
}

export function addCalendarDays(date, count) {
  return new Date(date.getTime() + count * DAY_MS);
}

/** @param {{first_touch_date: string}} args */
export function planSequence({ first_touch_date }) {
  const touch1 = parseDay(first_touch_date, 'first_touch_date');
  const touch2 = addWorkingDays(touch1, 4);
  const touch3 = addWorkingDays(touch2, 7);
  const quietUntil = addCalendarDays(touch3, 90);

  const weekendNote = isWeekend(touch1)
    ? 'The first touch falls on a weekend; the follow-up arithmetic still counts working days from it.'
    : null;

  return {
    touches: TOUCH_RULES.map((rule, i) => ({
      ...rule,
      send_on: isoDay([touch1, touch2, touch3][i]),
    })),
    quiet_until: isoDay(quietUntil),
    rules: SEQUENCE_RULES,
    ...(weekendNote ? { note: weekendNote } : {}),
    working_days_note: 'Working days skip Saturday and Sunday only. Public holidays are not modelled — shift by hand where one lands.',
  };
}
