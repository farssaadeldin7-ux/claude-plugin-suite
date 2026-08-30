import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ToolError } from '../mcp-lite.js';
import { parseDay, isoDay } from './triggers.js';
import { addWorkingDays, addCalendarDays, SEQUENCE_RULES } from './sequence.js';

/**
 * The local outreach log: which accounts have been touched, when, with what
 * trigger, and how the sequence ended. It exists to make the sequence rules
 * from the skill's step 6 mechanical — three touches then stop, 90 days of
 * quiet after the breakup, no restart on a timer, and a new rank 1-3 trigger
 * as the only thing that reopens an account. Stored on the user's machine
 * only; nothing here is sent to a server.
 */

const OUTCOMES = ['replied', 'no_reply', 'opted_out'];

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'haptic-feedback-mapper-outreach.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.accounts) ? parsed.accounts : [];
  } catch {
    return [];
  }
}

function writeAll(accounts) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the log.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, accounts }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

const sameAccount = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Record a touch, an outcome, or both, against an account's current sequence.
 * The sequence rules are enforced here, mechanically: touches go 1, 2, 3 in
 * order; there is no touch 4; an opted-out account is never reopened; and a
 * new sequence on a previously worked account needs a rank 1-3 trigger.
 */
export function logOutreach({ account, buyer, trigger_rank, trigger_summary, touch, sent_on, outcome, notes }) {
  if (!account?.trim()) throw new ToolError('invalid_request', 'An account name is required.');
  if (touch === undefined && outcome === undefined) {
    throw new ToolError('invalid_request', 'Nothing to record — pass "touch" (1, 2 or 3), "outcome", or both.');
  }
  if (outcome !== undefined && !OUTCOMES.includes(outcome)) {
    throw new ToolError('invalid_outcome', `"${outcome}" is not an outcome.`, { valid: OUTCOMES });
  }

  const accounts = readAll();
  const history = accounts.filter((r) => sameAccount(r.account, account));
  const open = history.find((r) => r.outcome === null);
  const day = sent_on ? parseDay(sent_on, 'sent_on') : parseDay(isoDay(new Date()), 'today');
  let record = open;

  if (touch !== undefined) {
    if (![1, 2, 3].includes(touch)) {
      throw new ToolError('breakup_rule', touch > 3
        ? 'Three touches, then stop. There is no touch 4 — after the breakup the account goes quiet for 90 days.'
        : `"${touch}" is not a touch — use 1, 2 or 3.`);
    }

    if (touch === 1) {
      if (open) {
        throw new ToolError('sequence_in_progress',
          `"${account}" already has an open sequence (${open.id}) — record touch ${open.touches.length + 1} on it, or an outcome.`);
      }
      const previous = history[0];
      if (previous?.outcome === 'opted_out') {
        throw new ToolError('opted_out',
          `"${account}" opted out on ${previous.resolved_at?.slice(0, 10) ?? 'a previous sequence'}. A working opt-out is honoured — this account is not contacted again.`);
      }
      if (previous && !(Number(trigger_rank) >= 1 && Number(trigger_rank) <= 3)) {
        throw new ToolError('reset_rule',
          `"${account}" has been worked before. ${SEQUENCE_RULES.breakup} Pass trigger_rank 1, 2 or 3 with the new trigger to reopen it.`);
      }
      record = {
        id: `acct_${crypto.randomBytes(6).toString('hex')}`,
        created_at: new Date().toISOString(),
        account: account.trim(),
        buyer: buyer?.trim() ?? null,
        trigger_rank: trigger_rank ?? null,
        trigger_summary: trigger_summary ?? null,
        touches: [],
        outcome: null,
        quiet_until: null,
        notes: notes ?? null,
      };
      accounts.unshift(record);
    }

    if (!record) {
      throw new ToolError('no_open_sequence',
        `"${account}" has no open sequence — start one by recording touch 1 (with its trigger).`);
    }
    if (record.touches.some((t) => t.touch === touch)) {
      throw new ToolError('touch_already_recorded', `Touch ${touch} is already recorded for "${account}".`);
    }
    if (touch !== record.touches.length + 1) {
      throw new ToolError('sequence_order',
        `Touches go in order — the next touch for "${account}" is ${record.touches.length + 1}.`);
    }
    record.touches.push({ touch, sent_on: isoDay(day), ...(notes && touch !== 1 ? { notes } : {}) });
    if (touch === 3) {
      record.quiet_until = isoDay(addCalendarDays(day, 90));
    }
  }

  if (outcome !== undefined) {
    if (!record) {
      throw new ToolError('no_open_sequence', `"${account}" has no open sequence to record an outcome on.`);
    }
    record.outcome = outcome;
    record.resolved_at = new Date().toISOString();
    if (notes) record.outcome_notes = notes;
  }

  writeAll(accounts.slice(0, 2000));
  return {
    logged: true,
    account_id: record.id,
    account: record.account,
    touches_recorded: record.touches.map((t) => t.touch),
    outcome: record.outcome,
    ...(record.quiet_until ? { quiet_until: record.quiet_until, breakup_rule: SEQUENCE_RULES.breakup } : {}),
    stored_at: storePath(),
  };
}

function statusOf(record, today) {
  if (record.outcome === 'opted_out') {
    return { status: 'opted_out', note: 'A working opt-out is honoured — this account is not contacted again.' };
  }
  if (record.outcome === 'replied') return { status: 'replied' };
  if (record.outcome === 'no_reply') return { status: 'closed_no_reply' };

  const last = record.touches[record.touches.length - 1];
  if (!last) return { status: 'open_no_touches', note: 'Touch 1 has not been recorded yet.' };

  if (last.touch === 3) {
    const quietUntil = record.quiet_until;
    const inQuiet = quietUntil && isoDay(today) < quietUntil;
    return {
      status: inQuiet ? 'quiet_period' : 'quiet_period_elapsed',
      quiet_until: quietUntil,
      note: inQuiet
        ? 'Sequence complete. No contact before this date, and no restart on a timer after it.'
        : 'The 90 days have passed, but never restart on a timer — only a new rank 1-3 trigger reopens this account.',
    };
  }

  const sent = parseDay(last.sent_on, 'sent_on');
  const due = last.touch === 1 ? addWorkingDays(sent, 4) : addWorkingDays(sent, 7);
  const dueIso = isoDay(due);
  return {
    status: isoDay(today) < dueIso ? 'in_sequence' : 'touch_due',
    next_touch: last.touch + 1,
    next_touch_due: dueIso,
    ...(isoDay(today) > dueIso ? { note: 'Past its send day. Late is recoverable; sending with nothing new to add is not.' } : {}),
  };
}

/** The log with each account's mechanically computed position in the sequence. */
export function reviewOutreach({ limit = 20, as_of } = {}) {
  const accounts = readAll();
  const today = as_of ? parseDay(as_of, 'as_of') : parseDay(isoDay(new Date()), 'today');

  const rows = accounts.map((r) => ({
    id: r.id,
    account: r.account,
    buyer: r.buyer,
    trigger_rank: r.trigger_rank,
    trigger_summary: r.trigger_summary,
    touches: r.touches,
    ...statusOf(r, today),
  }));

  const tally = {};
  for (const row of rows) tally[row.status] = (tally[row.status] ?? 0) + 1;

  return {
    as_of: isoDay(today),
    total_accounts: rows.length,
    tally,
    accounts: rows.slice(0, limit),
    rules: SEQUENCE_RULES,
    stored_at: storePath(),
  };
}

export const OUTREACH_FILE = storePath();
export { OUTCOMES };
