import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ToolError } from '../mcp-lite.js';
import { DESTINATIONS } from './destinations.js';

/**
 * The mechanics of actually cutting media: timecode arithmetic, deterministic
 * output naming, ffmpeg command construction, and running ffmpeg when it is
 * installed. The plain cut is a stream copy — no re-encode — and lands on the
 * nearest keyframe at or before the in-point, so it can carry up to a few
 * seconds of lead-in. The destination variant is re-encoded to the frame the
 * destination spec names, which makes it frame-accurate.
 *
 * Nothing here decides what to cut. In-points, out-points and destinations
 * arrive from the caller; this file refuses what the specs refuse and reports
 * exactly what ffmpeg did — or, when ffmpeg is absent, returns the commands
 * without pretending anything ran.
 */

const FFMPEG_PROBE_TIMEOUT_MS = 4000;
const FFMPEG_RUN_TIMEOUT_MS = 10 * 60 * 1000;
const STDERR_TAIL_CHARS = 800;

// ---- timecodes -------------------------------------------------------------

/** "hh:mm:ss(.s)", "mm:ss(.s)" or plain seconds (number or numeric string) → seconds, or null. */
export function parseTimecode(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number.parseFloat(s);
  const m = /^(?:(\d+):)?([0-5]?\d):([0-5]?\d(?:\.\d+)?)$/.exec(s);
  if (!m) return null;
  const hours = Number.parseInt(m[1] ?? '0', 10);
  const minutes = Number.parseInt(m[2], 10);
  const seconds = Number.parseFloat(m[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

/** Seconds → "hh:mm:ss" or "hh:mm:ss.mmm", the form ffmpeg takes as -ss/-to. */
export function formatTimecode(totalSeconds) {
  const whole = Math.floor(totalSeconds);
  const ms = Math.round((totalSeconds - whole) * 1000);
  const h = String(Math.floor(whole / 3600)).padStart(2, '0');
  const m = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
  const s = String(whole % 60).padStart(2, '0');
  return ms ? `${h}:${m}:${s}.${String(ms).padStart(3, '0')}` : `${h}:${m}:${s}`;
}

/** A filename-safe token for a timecode: colons to dashes, dot to underscore. */
export function timecodeToken(totalSeconds) {
  return formatTimecode(totalSeconds).replace(/:/g, '-').replace(/\./g, '_');
}

// ---- destination output formats -------------------------------------------

/**
 * The render target for a destination, derived from the spec table in
 * destinations.js: the first frame the spec lists is the one the variant is
 * rendered at (9:16 1080×1920 for the vertical short-form group).
 */
export function formatSpecFor(id) {
  const key = String(id ?? '').trim().toLowerCase();
  if (!Object.hasOwn(DESTINATIONS, key)) return null;
  const dest = DESTINATIONS[key];
  const firstFrame = dest.frame.split('/')[0].trim();
  const [width, height] = firstFrame.split(/[×x]/).map((n) => Number.parseInt(n, 10));
  return {
    id: key,
    label: dest.label,
    aspect: dest.aspect,
    width,
    height,
    min_seconds: dest.length_seconds.min,
    max_seconds: dest.length_seconds.max,
  };
}

// ---- planning ---------------------------------------------------------------

const slug = (text) =>
  String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/**
 * Validate a cut request and turn it into an executable plan. All-or-nothing:
 * any invalid clip — unparseable timecode, out before in, unknown destination,
 * longer than the destination's spec allows — refuses the whole request with
 * every problem named, so nothing is half cut.
 */
export function planCuts({ source, clips, out_dir }) {
  const src = String(source ?? '').trim();
  if (!src) throw new ToolError('missing_source', 'source is required — the path to a local media file.');
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new ToolError('source_not_found', `No file at "${src}". cut_clips works on a local media file — check the path.`);
  }
  if (!Array.isArray(clips) || clips.length === 0) {
    throw new ToolError('no_clips', 'clips is required — at least one {start, end} entry.');
  }

  const outDir = String(out_dir ?? '').trim() || path.join(path.dirname(path.resolve(src)), 'clips');
  const ext = path.extname(src) || '.mp4';
  const base = path.basename(src, path.extname(src));

  const problems = [];
  const planned = clips.map((clip, i) => {
    const n = i + 1;
    const startSeconds = parseTimecode(clip.start);
    const endSeconds = parseTimecode(clip.end);
    if (startSeconds === null) problems.push(`clip ${n}: start "${clip.start}" is not a timecode (hh:mm:ss, mm:ss or seconds)`);
    if (endSeconds === null) problems.push(`clip ${n}: end "${clip.end}" is not a timecode (hh:mm:ss, mm:ss or seconds)`);
    if (startSeconds === null || endSeconds === null) return null;
    if (endSeconds <= startSeconds) {
      problems.push(`clip ${n}: end (${formatTimecode(endSeconds)}) is not after start (${formatTimecode(startSeconds)})`);
      return null;
    }
    const duration = endSeconds - startSeconds;

    let format = null;
    if (clip.destination !== undefined && clip.destination !== null && String(clip.destination).trim() !== '') {
      format = formatSpecFor(clip.destination);
      if (!format) {
        problems.push(`clip ${n}: unknown destination "${clip.destination}" — one of: ${Object.keys(DESTINATIONS).join(', ')}`);
        return null;
      }
      if (duration > format.max_seconds) {
        problems.push(
          `clip ${n}: ${duration.toFixed(1)}s is longer than ${format.label} allows — the spec's length band is ` +
          `${format.min_seconds}–${format.max_seconds}s. Shorten the clip or drop the destination; it will not be cut oversize.`
        );
        return null;
      }
    }

    const stem = [
      base,
      `clip${String(n).padStart(2, '0')}`,
      ...(clip.label ? [slug(clip.label)].filter(Boolean) : []),
      `${timecodeToken(startSeconds)}-${timecodeToken(endSeconds)}`,
    ].join('.');

    const outputs = [
      {
        kind: 'lossless_cut',
        file: path.join(outDir, `${stem}${ext}`),
        args: buildCutArgs({ source: src, startSeconds, endSeconds, outFile: path.join(outDir, `${stem}${ext}`) }),
      },
    ];
    if (format) {
      const file = path.join(outDir, `${stem}.${format.id}.mp4`);
      outputs.push({
        kind: 'destination_format',
        destination: format.id,
        frame: `${format.width}×${format.height}`,
        file,
        args: buildFormatArgs({ source: src, startSeconds, endSeconds, outFile: file, width: format.width, height: format.height }),
      });
    }

    return {
      index: n,
      ...(clip.label ? { label: clip.label } : {}),
      start: formatTimecode(startSeconds),
      end: formatTimecode(endSeconds),
      duration_seconds: Math.round(duration * 10) / 10,
      ...(format ? { destination: format.id } : {}),
      outputs,
    };
  });

  if (problems.length) {
    throw new ToolError('clips_rejected', `Nothing was cut. ${problems.length === 1 ? 'One clip was' : `${problems.length} clips were`} refused:`, {
      problems,
      note: 'The request is all-or-nothing so a batch is never half cut. Fix the listed clips and call again.',
    });
  }

  return { source: src, out_dir: outDir, clips: planned.filter(Boolean) };
}

// ---- ffmpeg command construction --------------------------------------------

/** The plain cut: input-seeked stream copy, no re-encode. */
export function buildCutArgs({ source, startSeconds, endSeconds, outFile }) {
  return [
    'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', formatTimecode(startSeconds), '-to', formatTimecode(endSeconds),
    '-i', source,
    '-c', 'copy',
    outFile,
  ];
}

/** The destination variant: scale to cover the target frame, centre-crop, re-encode. */
export function buildFormatArgs({ source, startSeconds, endSeconds, outFile, width, height }) {
  const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
  return [
    'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', formatTimecode(startSeconds), '-to', formatTimecode(endSeconds),
    '-i', source,
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    outFile,
  ];
}

/** Render an argv as a paste-able shell command, quoting only what needs it. */
export function shellCommand(args) {
  return args
    .map((a) => (/^[A-Za-z0-9_@%+=:,./×-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`))
    .join(' ');
}

// ---- running ffmpeg ----------------------------------------------------------

/** Is ffmpeg on PATH? Short timeout; found:false on any failure. */
export function probeFfmpeg() {
  try {
    const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', timeout: FFMPEG_PROBE_TIMEOUT_MS });
    if (probe.error || probe.status !== 0) return { found: false };
    const firstLine = String(probe.stdout ?? '').split('\n')[0].trim();
    return { found: true, version: firstLine };
  } catch {
    return { found: false };
  }
}

/**
 * Run one planned ffmpeg command. Success means ffmpeg exited 0 AND the
 * output file exists with bytes in it — never one without the other, so a
 * cut is only ever reported when the file is actually there.
 */
export function runFfmpeg(args, outFile) {
  const run = spawnSync(args[0], args.slice(1), {
    encoding: 'utf8',
    timeout: FFMPEG_RUN_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
  });
  const stderr = String(run.stderr ?? '');
  const timedOut = run.error?.code === 'ETIMEDOUT';
  const produced = fs.existsSync(outFile) && fs.statSync(outFile).size > 0;
  const ok = !run.error && run.status === 0 && produced;
  if (ok) return { ok: true };
  return {
    ok: false,
    stderr_tail: (timedOut ? `[timed out after ${FFMPEG_RUN_TIMEOUT_MS / 1000}s] ` : '') +
      (stderr.trim().slice(-STDERR_TAIL_CHARS) || run.error?.message || `ffmpeg exited ${run.status} with no stderr`),
    ...(run.status === 0 && !produced ? { note: 'ffmpeg exited 0 but the output file is missing or empty — treated as a failure.' } : {}),
  };
}

export const KEYFRAME_NOTE =
  'The plain cut is a stream copy: it starts on the nearest keyframe at or before the in-point, so it ' +
  'can carry a few seconds of lead-in depending on the source\'s keyframe interval. The destination ' +
  'variant is re-encoded and frame-accurate. Trim the plain cut in an editor if the lead-in matters.';
