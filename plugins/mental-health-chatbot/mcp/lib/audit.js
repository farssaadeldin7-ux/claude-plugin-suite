import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ToolError } from '../mcp-lite.js';
import { TRIGGER_CATEGORIES } from './escalation.js';

/**
 * The supervisor-summary template and the local session audit log — the two
 * deliverables the mental-health-chatbot skill's steps 5 and 6 produce, given
 * server support here.
 * Source: skills/mental-health-chatbot/SKILL.md, steps 5 and 6.
 *
 * The audit log is deliberately categorical: dates, counts, category numbers
 * and enumerated outcomes only. There is no free-text field, so nothing a
 * user typed can enter the log — the transcript lives wherever the
 * deployment's confidentiality notice says it lives, never here. Stored on
 * the operator's machine only; nothing here is sent to a server.
 */

export const SESSION_ENDINGS = ['completed', 'escalated', 'user_left', 'declined'];

/** Themes reported from fewer sessions than this risk identifying individuals. */
export const THEME_MIN_SESSIONS = 5;

export const SUMMARY_TEMPLATE = {
  audience: 'The programme supervisor. Honest about its own resolution.',
  sections: [
    {
      section: 'Reporting window',
      contents: 'The period covered, the number of sessions behind every claim in the summary, and the configuration version in force.',
    },
    {
      section: 'Participation',
      contents: 'Sessions run, completion share, and how sessions ended — counts only.',
    },
    {
      section: 'Escalations',
      contents:
        'Count by trigger category. Escalated sessions are referenced by case id for the receiving ' +
        'team, never narrated in the summary.',
    },
    {
      section: 'Themes',
      contents:
        'Recurring themes in the deployment\'s own vocabulary — workload, sleep, team friction — ' +
        `each backed by at least ${THEME_MIN_SESSIONS} sessions, with no quote attributable to an ` +
        'identifiable individual.',
    },
    {
      section: 'Standing caveat',
      contents: 'Themes are conversational patterns, not clinical findings, and the summary says so verbatim.',
    },
  ],
  resolution_rules: [
    'Individual detail appears only where the confidentiality notice users were shown says it does. Aggregate-only means aggregate only, and no supervisor request changes that mid-programme.',
    'Every claim states its denominator: the number of sessions behind it.',
    `No theme is reported from fewer than ${THEME_MIN_SESSIONS} sessions.`,
    'Nothing in a summary is a diagnosis, a risk score, or a treatment recommendation.',
  ],
};

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'mental-health-chatbot-audit.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.sessions) ? parsed.sessions : [];
  } catch {
    return [];
  }
}

function writeAll(sessions) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the log.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, sessions }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function isoDayOf(value, field) {
  if (value === undefined) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(value))) {
    throw new ToolError('invalid_date', `"${value}" is not a date — pass ${field} as YYYY-MM-DD.`);
  }
  return String(value);
}

const CATEGORY_NUMBERS = TRIGGER_CATEGORIES.map((c) => c.category);

/**
 * Append one session's categorical record. A trigger recorded without an
 * escalation is accepted — the log must capture misses honestly — and comes
 * back flagged, because that combination is the number the weekly review
 * exists to keep at zero.
 */
export function recordSession({
  session_date, config_version, messages, trigger_category, escalated,
  handover_packet_delivered, resources_shown, ended,
}) {
  if (!config_version?.trim()) {
    throw new ToolError('invalid_request', 'config_version is required — the scope statement, trigger list and resource block in force. A session that cannot name its configuration cannot be audited.');
  }
  const messageCount = Number(messages);
  if (!(messageCount >= 1)) throw new ToolError('invalid_request', 'messages must be a positive count — every message in the session is screened.');
  const category = trigger_category === undefined ? null : Number(trigger_category);
  if (category !== null && !CATEGORY_NUMBERS.includes(category)) {
    throw new ToolError('unknown_category', `"${trigger_category}" is not a trigger category.`, { valid: CATEGORY_NUMBERS });
  }
  if (!SESSION_ENDINGS.includes(ended)) {
    throw new ToolError('invalid_request', `"${ended}" is not a session ending.`, { valid: SESSION_ENDINGS });
  }
  const didEscalate = escalated === true;
  if (ended === 'escalated' && !didEscalate) {
    throw new ToolError('invalid_request', 'ended "escalated" requires escalated: true.');
  }
  if (didEscalate && handover_packet_delivered === undefined) {
    throw new ToolError('invalid_request', 'An escalated session must record handover_packet_delivered — the human does not restart from zero, and the log shows whether that held.');
  }

  const sessions = readAll();
  const record = {
    id: `case_${crypto.randomBytes(6).toString('hex')}`,
    created_at: new Date().toISOString(),
    session_date: isoDayOf(session_date, 'session_date'),
    config_version: config_version.trim(),
    messages: messageCount,
    trigger_category: category,
    escalated: didEscalate,
    handover_packet_delivered: didEscalate ? handover_packet_delivered === true : null,
    resources_shown: Number(resources_shown) >= 0 ? Number(resources_shown) : 0,
    ended,
  };
  sessions.unshift(record);
  writeAll(sessions.slice(0, 10000));

  const missed = category !== null && !didEscalate;
  return {
    recorded: true,
    case_id: record.id,
    ...(missed
      ? {
        flag: 'missed_escalation',
        note: 'A trigger with no escalation is recorded, not hidden — and it is an incident: review it now, not at the weekly tally.',
      }
      : {}),
    stored_at: storePath(),
  };
}

/**
 * The audit log's computed position: tallies, and the one number the weekly
 * review exists for — sessions containing a trigger where no escalation
 * fired. Target zero. Counting only.
 */
export function reviewAudit({ since, until, limit = 20 } = {}) {
  const sinceDay = since === undefined ? null : isoDayOf(since, 'since');
  const untilDay = until === undefined ? null : isoDayOf(until, 'until');
  const sessions = readAll().filter((s) =>
    (sinceDay === null || s.session_date >= sinceDay)
    && (untilDay === null || s.session_date <= untilDay));

  const byEnding = {};
  const escalationsByCategory = {};
  const missed = [];
  let resources = 0;
  for (const s of sessions) {
    byEnding[s.ended] = (byEnding[s.ended] ?? 0) + 1;
    resources += s.resources_shown;
    if (s.trigger_category !== null && s.escalated) {
      escalationsByCategory[s.trigger_category] = (escalationsByCategory[s.trigger_category] ?? 0) + 1;
    }
    if (s.trigger_category !== null && !s.escalated) missed.push({ case_id: s.id, session_date: s.session_date, trigger_category: s.trigger_category, config_version: s.config_version });
  }

  return {
    ...(sinceDay ? { since: sinceDay } : {}),
    ...(untilDay ? { until: untilDay } : {}),
    total_sessions: sessions.length,
    endings: byEnding,
    escalations: {
      total: Object.values(escalationsByCategory).reduce((n, c) => n + c, 0),
      by_category: escalationsByCategory,
    },
    resources_shown: resources,
    missed_escalations: {
      count: missed.length,
      target: 0,
      cases: missed,
      ...(missed.length > 0
        ? { note: 'Each of these is an incident. Root-cause the detector or the trigger list, then re-run the red-team set and record it with record_redteam_run before the next session runs.' }
        : {}),
    },
    sessions: sessions.slice(0, limit),
    what_this_did_not_judge:
      'Counting only, over what the operator recorded. It cannot see sessions that were never ' +
      'logged, and it does not judge whether an escalation was handled well — the incident review ' +
      'does that.',
    stored_at: storePath(),
  };
}

export const AUDIT_FILE = storePath();
