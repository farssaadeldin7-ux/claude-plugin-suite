import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ToolError } from '../mcp-lite.js';

/**
 * The local measurement log: working sessions recorded before and after the
 * haptic mapping ships, so "the load dropped" is a computed delta instead of
 * a feeling. It also carries the trust metric — the share of delivered
 * haptics the user acted on — which is the mechanical early warning that the
 * vocabulary has started crying wolf. Stored on the user's machine only;
 * nothing here is sent to a server.
 */

export const PHASES = ['baseline', 'after'];

/** Below this many sessions in a phase, the averages are labelled noise. */
export const MIN_SESSIONS = 3;

/** An action rate below this on 10+ delivered haptics is flagged. */
export const TRUST_FLOOR = 0.5;

export const TRUST_RULE =
  'The share of haptics the user acted on should stay high. A falling action rate means the ' +
  'vocabulary has started crying wolf — and the fix is reclassifying events, not adding feedback.';

export const NOT_DROPPED_CAUSES = [
  'Ambient events got haptics.',
  'Noise was not actually silenced.',
  'The user does not yet trust silence to mean "nothing needs you" — fixed by reliability, not by more feedback.',
];

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'haptic-feedback-mapper-sessions.json');
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

/** Record one working session's counts. */
export function logSession({
  phase, session_date, duration_minutes, checks, haptics_delivered, haptics_acted_on, notes,
}) {
  if (!PHASES.includes(phase)) {
    throw new ToolError('invalid_phase', `"${phase}" is not a phase.`, { valid: PHASES });
  }
  const minutes = Number(duration_minutes);
  if (!(minutes > 0)) throw new ToolError('invalid_request', 'duration_minutes must be a positive number.');
  const checkCount = Number(checks);
  if (!(checkCount >= 0)) throw new ToolError('invalid_request', 'checks must be zero or a positive number.');
  const delivered = haptics_delivered === undefined ? null : Number(haptics_delivered);
  const acted = haptics_acted_on === undefined ? null : Number(haptics_acted_on);
  if (delivered !== null && !(delivered >= 0)) throw new ToolError('invalid_request', 'haptics_delivered must be zero or positive.');
  if (acted !== null && !(acted >= 0)) throw new ToolError('invalid_request', 'haptics_acted_on must be zero or positive.');
  if (acted !== null && delivered === null) {
    throw new ToolError('invalid_request', 'haptics_acted_on needs haptics_delivered alongside it.');
  }
  if (acted !== null && acted > delivered) {
    throw new ToolError('invalid_request', `haptics_acted_on (${acted}) cannot exceed haptics_delivered (${delivered}).`);
  }
  if (phase === 'baseline' && delivered !== null) {
    throw new ToolError('invalid_request', 'A baseline session predates the mapping — it has no delivered haptics. Record it under phase "after".');
  }

  const sessions = readAll();
  const record = {
    id: `sess_${crypto.randomBytes(6).toString('hex')}`,
    created_at: new Date().toISOString(),
    phase,
    session_date: isoDayOf(session_date, 'session_date'),
    duration_minutes: minutes,
    checks: checkCount,
    haptics_delivered: delivered,
    haptics_acted_on: acted,
    notes: notes ?? null,
  };
  sessions.unshift(record);
  writeAll(sessions.slice(0, 2000));

  const phaseCount = sessions.filter((s) => s.phase === phase).length;
  return {
    logged: true,
    session_id: record.id,
    phase,
    checks_per_hour: Number(((checkCount / minutes) * 60).toFixed(1)),
    sessions_in_phase: phaseCount,
    ...(phaseCount < MIN_SESSIONS
      ? { sample_note: `Fewer than ${MIN_SESSIONS} ${phase} sessions — averages over this phase are noise until there are more.` }
      : {}),
    stored_at: storePath(),
  };
}

function phaseStats(sessions) {
  if (sessions.length === 0) return null;
  const minutes = sessions.reduce((n, s) => n + s.duration_minutes, 0);
  const checks = sessions.reduce((n, s) => n + s.checks, 0);
  return {
    sessions: sessions.length,
    total_minutes: minutes,
    total_checks: checks,
    checks_per_hour: Number(((checks / minutes) * 60).toFixed(1)),
    ...(sessions.length < MIN_SESSIONS
      ? { sample_note: `Fewer than ${MIN_SESSIONS} sessions — treat this phase's average as noise.` }
      : {}),
  };
}

/** The log's computed position: per-phase averages, the delta, the trust metric. */
export function reviewSessions({ limit = 20 } = {}) {
  const sessions = readAll();
  const baseline = phaseStats(sessions.filter((s) => s.phase === 'baseline'));
  const after = phaseStats(sessions.filter((s) => s.phase === 'after'));

  let delta = null;
  const flags = [];
  if (baseline && after && baseline.checks_per_hour > 0) {
    const dropShare = (baseline.checks_per_hour - after.checks_per_hour) / baseline.checks_per_hour;
    delta = {
      checks_per_hour_baseline: baseline.checks_per_hour,
      checks_per_hour_after: after.checks_per_hour,
      drop_share: Number(dropShare.toFixed(2)),
    };
    if (dropShare <= 0) {
      flags.push({
        flag: 'checks_did_not_drop',
        usual_causes_in_order: NOT_DROPPED_CAUSES,
      });
    }
  }

  const afterSessions = sessions.filter((s) => s.phase === 'after' && s.haptics_delivered !== null);
  const delivered = afterSessions.reduce((n, s) => n + s.haptics_delivered, 0);
  const acted = afterSessions.reduce((n, s) => n + (s.haptics_acted_on ?? 0), 0);
  const trust = delivered > 0
    ? { haptics_delivered: delivered, haptics_acted_on: acted, action_rate: Number((acted / delivered).toFixed(2)), rule: TRUST_RULE }
    : null;
  if (trust && delivered >= 10 && trust.action_rate < TRUST_FLOOR) {
    flags.push({
      flag: 'vocabulary_crying_wolf',
      evidence: `Action rate ${trust.action_rate} over ${delivered} delivered haptics (floor ${TRUST_FLOOR}).`,
      note: TRUST_RULE,
    });
  }

  return {
    total_sessions: sessions.length,
    baseline,
    after,
    delta,
    trust,
    flags,
    sessions: sessions.slice(0, limit).map(({ id, phase, session_date, duration_minutes, checks, haptics_delivered, haptics_acted_on, notes }) => ({
      id, phase, session_date, duration_minutes, checks, haptics_delivered, haptics_acted_on, notes,
    })),
    what_this_did_not_judge:
      'Counting and division only. Whether the sessions were comparable — same kind of work, same ' +
      'deadline pressure — is the user\'s claim to defend, and the before/after pair is only as ' +
      'honest as the logging was.',
    stored_at: storePath(),
  };
}

export const SESSIONS_FILE = storePath();
