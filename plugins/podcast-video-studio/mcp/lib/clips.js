import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The local clip log behind the footage pass: every threshold-clearing clip
 * is recorded, and once a human has watched the actual footage, the result is
 * recorded against it. The skill budgets for around a third of
 * threshold-clearing clips failing that pass; the log replaces the assumption
 * with this account's own count. Stored on the user's machine only.
 */

const FOOTAGE_RESULTS = ['passed', 'failed'];

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'podcast-video-studio-clips.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.clips) ? parsed.clips : [];
  } catch {
    return [];
  }
}

function writeAll(clips) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the log.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, clips }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function footageResultIsValid(result) {
  return FOOTAGE_RESULTS.includes(result);
}

export function logClip({
  episode, in_point, out_point, duration_seconds, scores, total,
  destinations, cold_open, archetypes, flagged_claims, notes,
}) {
  const clips = readAll();
  const record = {
    id: `clip_${crypto.randomBytes(6).toString('hex')}`,
    created_at: new Date().toISOString(),
    episode: episode ?? null,
    in_point: in_point ?? null,
    out_point: out_point ?? null,
    duration_seconds: duration_seconds ?? null,
    scores: scores ?? null,
    total: total ?? null,
    destinations: destinations ?? null,
    cold_open: cold_open ?? null,
    archetypes: archetypes ?? null,
    flagged_claims: flagged_claims ?? null,
    notes: notes ?? null,
    footage_pass: null,
  };
  clips.unshift(record);
  writeAll(clips.slice(0, 2000));
  return record;
}

export function recordFootagePass(id, { result, reason }) {
  const clips = readAll();
  const index = clips.findIndex((c) => c.id === id);
  if (index === -1) return null;
  clips[index] = {
    ...clips[index],
    footage_pass: result,
    ...(reason ? { footage_pass_reason: reason } : {}),
    resolved_at: new Date().toISOString(),
  };
  writeAll(clips);
  return clips[index];
}

/**
 * The record of logged clips, with a plain tally of the footage pass.
 * Counting only — the point is a measured local failure share to hold
 * against the assumed third, not a new claim.
 */
export function reviewClips({ limit = 20 } = {}) {
  const clips = readAll();
  const resolved = clips.filter((c) => c.footage_pass);
  const failed = resolved.filter((c) => c.footage_pass === 'failed').length;

  return {
    total_clips: clips.length,
    awaiting_footage_pass: clips.length - resolved.length,
    footage_pass: resolved.length
      ? {
          resolved: resolved.length,
          passed: resolved.length - failed,
          failed,
          reference_assumption:
            'The skill budgets for around a third of threshold-clearing clips failing the footage ' +
            'pass. Compare that with the counts above.',
        }
      : { resolved: 0, note: 'No clip has a recorded footage-pass result yet — record one with record_footage_pass.' },
    recent: clips.slice(0, limit).map((c) => ({
      id: c.id, created_at: c.created_at, episode: c.episode,
      in_point: c.in_point, out_point: c.out_point, total: c.total,
      destinations: c.destinations, footage_pass: c.footage_pass,
      ...(c.footage_pass_reason ? { footage_pass_reason: c.footage_pass_reason } : {}),
    })),
    stored_at: storePath(),
  };
}

export const CLIPS_FILE = storePath();
export { FOOTAGE_RESULTS };
