import fs from 'node:fs';
import path from 'node:path';
import { ToolError } from '../mcp-lite.js';
import { createJsonArrayStore } from '../local-store.js';
import { auditMapping, classById, EVENT_CLASSES } from './classes.js';
import { checkVocabulary, INTENSITIES } from './vocabulary.js';

/**
 * The export and emit half of the delivery chain.
 *
 * An MCP text server cannot drive haptic hardware, and nothing here pretends
 * to. What it can do is make the designed mapping consumable by the software
 * that can: compile an audited mapping into a canonical, machine-readable
 * profile plus a POSIX-sh notify hook, and append mapped events — with their
 * amplitude/duration/repeat tuples — to a local event log any haptic driver,
 * Stream Deck plugin or automation tool can watch. The plugin designs and
 * exports the mapping and emits the events; the driver on the user's machine
 * does the vibrating.
 */

export const DELIVERY_STATEMENT =
  'This plugin designs and exports the mapping and emits events; the hardware driver on the ' +
  'user\'s machine does the vibrating. No haptic hardware is driven directly by this server.';

export const PROFILE_FORMAT = 'haptic-feedback-mapper.profile';
export const PROFILE_FORMAT_VERSION = 1;

/** The classes whose events are emitted to the log; the others map to silence. */
export const EMITTED_CLASSES = ['act_now', 'done'];

/** Priority rank per class, 1 highest — carried on every event and every emitted line. */
export const PRIORITIES = { act_now: 1, done: 2, ambient: 3, noise: 4 };

/**
 * Normalised amplitude per vocabulary intensity, 0..1. The profile carries the
 * scale itself so a driver can remap it to its own hardware range.
 */
export const AMPLITUDES = { low: 0.3, medium: 0.6, high: 1.0 };

/** Uniform pulse defaults, overridable per pattern (pulse_ms / gap_ms). */
export const PULSE_DEFAULTS = { pulse_ms: 150, gap_ms: 100 };

export const LOG_FILE_NAME = 'haptic-feedback-mapper-events.log';
/** The documented, environment-independent spelling of the log path. */
export const LOG_CONTRACT_PATH =
  '${XDG_CONFIG_HOME:-$HOME/.config}/plugin-suite/haptic-feedback-mapper-events.log';

const store = createJsonArrayStore('haptic-feedback-mapper-profiles.json', 'profiles');
const configDirPath = () => path.dirname(store.file);
export const eventLogPath = () => path.join(configDirPath(), LOG_FILE_NAME);

const LINE_FIELDS = {
  ts: 'UTC ISO-8601 timestamp of the emit',
  profile: 'the exported profile name the event came from',
  event: 'the event id, as listed in the profile',
  class: `one of ${EMITTED_CLASSES.join(', ')} — silent classes are never emitted`,
  pattern: 'the vocabulary tuple: { id, amplitude (0..1), pulse_ms, gap_ms, repeat, rhythm }',
  priority: '1 (act_now) or 2 (done)',
  cooldown_seconds: 'advisory minimum gap between deliveries of this event; the consumer enforces it',
  source: '"emit_event" (this server) or "notify" (the exported shell hook)',
  note: 'optional free text passed by the emitter',
};

const LOG_CONTRACT = {
  path: LOG_CONTRACT_PATH,
  format: 'NDJSON — one JSON object per line, appended atomically (single O_APPEND write)',
  fields: LINE_FIELDS,
  consume: `tail -F "${LOG_CONTRACT_PATH}" and translate each line's pattern tuple into a vibration`,
  statement: DELIVERY_STATEMENT,
};

function slug(label, what) {
  const id = String(label ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) throw new ToolError('invalid_request', `${what} "${label}" reduces to an empty id.`);
  return id;
}

function compilePattern(p) {
  const intensity = String(p.intensity ?? 'medium').trim().toLowerCase();
  const count = Number(p.count);
  return {
    id: p.id,
    meaning: p.meaning ?? null,
    is_failure: p.is_failure === true,
    axes: { count, intensity, rhythm: p.rhythm ?? null },
    tuple: {
      amplitude: AMPLITUDES[intensity],
      pulse_ms: Number(p.pulse_ms) > 0 ? Number(p.pulse_ms) : PULSE_DEFAULTS.pulse_ms,
      gap_ms: Number(p.gap_ms) >= 0 ? Number(p.gap_ms) : PULSE_DEFAULTS.gap_ms,
      repeat: count,
      rhythm: p.rhythm ?? null,
    },
    tuple_note:
      'Uniform pulses: repeat x (pulse_ms on at amplitude, gap_ms off). The rhythm label is ' +
      'carried verbatim for drivers that can shape it; the tuple is the deterministic fallback.',
  };
}

// ------------------------------------------------------------------- export

/**
 * Compile an audited mapping + vocabulary into a canonical profile, persist it
 * locally (so emit_event can validate against it), and write the artefacts —
 * the JSON profile and the `notify` shell hook — to the caller's directory.
 * Refuses to export a mapping that fails its own audit, naming the failures.
 */
export function exportProfile({ directory, profile_name, events, patterns }) {
  const dir = String(directory ?? '').trim();
  if (!dir) throw new ToolError('invalid_request', 'Pass "directory": where to write the exported artefacts.');
  const name = profile_name === undefined ? 'default' : slug(profile_name, 'profile_name');

  // The mapping must pass the plugin's own rules before it becomes an
  // artefact someone wires hardware to. Both checks throw on malformed input
  // and report rule findings on well-formed input; findings refuse the export.
  const audit = auditMapping({ events });
  const vocab = checkVocabulary({ patterns });

  const patternById = new Map(patterns.map((p) => [String(p.id).trim(), p]));
  const exportFindings = [];
  const seenIds = new Map();
  const compiledEvents = events.map((entry) => {
    const id = slug(entry.event, 'event');
    if (seenIds.has(id)) {
      exportFindings.push({
        rule: 'duplicate_event_id',
        events: [seenIds.get(id), entry.event],
        evidence: `Both reduce to the id "${id}".`,
        note: 'Event ids must be unique in a profile — rename one of them.',
      });
    }
    seenIds.set(id, entry.event);

    const cls = classById(entry.class);
    const emitted = EMITTED_CLASSES.includes(entry.class);
    let pattern = null;
    if (emitted) {
      if (typeof entry.haptic !== 'string' || !entry.haptic.trim()) {
        exportFindings.push({
          rule: 'unnamed_haptic',
          event: entry.event,
          note: 'An exported event needs a named pattern id in "haptic" — "true" designs nothing a driver can play.',
        });
      } else if (!patternById.has(entry.haptic.trim())) {
        exportFindings.push({
          rule: 'unknown_pattern',
          event: entry.event,
          evidence: `haptic: ${JSON.stringify(entry.haptic)}`,
          note: `No pattern with that id in the vocabulary. Available: ${[...patternById.keys()].join(', ')}.`,
        });
      } else {
        pattern = compilePattern(patternById.get(entry.haptic.trim()));
      }
    }

    const cooldown = entry.cooldown_seconds === undefined ? 0 : Number(entry.cooldown_seconds);
    if (!(cooldown >= 0)) {
      exportFindings.push({ rule: 'invalid_cooldown', event: entry.event, note: 'cooldown_seconds must be zero or positive.' });
    }

    return {
      id,
      event: entry.event,
      class: entry.class,
      channel: cls?.channel ?? null,
      decision_fed: entry.decision_fed ?? null,
      emitted,
      priority: PRIORITIES[entry.class],
      cooldown_seconds: cooldown >= 0 ? cooldown : 0,
      pattern,
    };
  });

  if (audit.finding_count > 0 || vocab.finding_count > 0 || exportFindings.length > 0) {
    throw new ToolError(
      'audit_failed',
      `Export refused: the mapping fails its own audit (${audit.finding_count} mapping finding(s), ` +
      `${vocab.finding_count} vocabulary finding(s), ${exportFindings.length} export finding(s)). ` +
      'Fix the named findings and export again — an artefact that fails the stated rules must not reach a driver.',
      {
        mapping_findings: audit.findings,
        vocabulary_findings: vocab.findings,
        export_findings: exportFindings,
      }
    );
  }

  const profile = {
    format: PROFILE_FORMAT,
    format_version: PROFILE_FORMAT_VERSION,
    name,
    generated_at: new Date().toISOString(),
    delivery_statement: DELIVERY_STATEMENT,
    amplitude_scale: {
      values: AMPLITUDES,
      note: `Normalised 0..1 from the vocabulary intensities (${INTENSITIES.join(', ')}); the driver maps them to its hardware range.`,
    },
    event_log: LOG_CONTRACT,
    classes: EVENT_CLASSES.map(({ id, name: className, channel }) => ({ id, name: className, channel })),
    events: compiledEvents,
    patterns: patterns.map(compilePattern),
    audit: {
      events_audited: audit.events_audited,
      distribution: audit.distribution,
      quiet_share: audit.quiet_share,
      finding_count: 0,
      patterns_checked: vocab.patterns_checked,
    },
  };

  // Hosts pass tool arguments verbatim, so "~/exports" arrives with the ~
  // unexpanded — resolve it against HOME rather than creating a literal "~".
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const resolvedDir = dir === '~' || dir.startsWith('~/')
    ? path.join(home, dir.slice(1))
    : path.resolve(dir);
  fs.mkdirSync(resolvedDir, { recursive: true });

  const profilePath = path.join(resolvedDir, `${name}.haptic-profile.json`);
  fs.writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o644 });

  const notifyPath = path.join(resolvedDir, 'notify');
  fs.writeFileSync(notifyPath, renderNotifyScript(profile), { mode: 0o755 });

  store.update((profiles) => {
    const kept = profiles.filter((p) => p.name !== name);
    kept.unshift({ name, exported_at: profile.generated_at, artefacts: [profilePath, notifyPath], profile });
    return { items: kept.slice(0, 50), result: null };
  });

  const emittedIds = compiledEvents.filter((e) => e.emitted).map((e) => e.id);
  return {
    exported: true,
    profile: name,
    files: { profile: profilePath, notify_hook: notifyPath },
    events: compiledEvents.length,
    emitted_events: emittedIds,
    silent_events: compiledEvents.filter((e) => !e.emitted).map((e) => e.id),
    patterns: profile.patterns.length,
    event_log: LOG_CONTRACT,
    delivery_statement: DELIVERY_STATEMENT,
    next: `emit_event appends a mapped event to the log; or run "notify <event_id>" from any tool. ` +
      `A driver consumes it with: tail -F "${LOG_CONTRACT_PATH}".`,
  };
}

// ------------------------------------------------------------- notify script

const shQuote = (v) => `"${String(v).replace(/(["\\$`])/g, '\\$1')}"`;

function renderNotifyScript(profile) {
  const emitted = profile.events.filter((e) => e.emitted);
  const silent = profile.events.filter((e) => !e.emitted);

  const cases = emitted.map((e) => {
    const t = e.pattern.tuple;
    const patternJson = JSON.stringify({
      id: e.pattern.id, amplitude: t.amplitude, pulse_ms: t.pulse_ms, gap_ms: t.gap_ms, repeat: t.repeat, rhythm: t.rhythm,
    });
    return [
      `  ${e.id})`,
      `    CLASS=${e.class}`,
      `    PATTERN=${shQuote(patternJson)}`,
      `    PRIORITY=${e.priority}`,
      `    COOLDOWN=${e.cooldown_seconds}`,
      '    ;;',
    ].join('\n');
  }).join('\n');

  const silentCase = silent.length > 0
    ? [
      `  ${silent.map((e) => e.id).join('|')})`,
      `    echo "event '$EVENT' maps to silence (ambient/noise) and is never emitted" >&2`,
      '    exit 3',
      '    ;;',
    ].join('\n')
    : '';

  return `#!/bin/sh
# haptic-feedback-mapper - notify hook for profile "${profile.name}"
# Generated ${profile.generated_at} by export_profile. POSIX sh, no dependencies.
#
# Usage:
#   notify <event_id>
#
# Appends one timestamped NDJSON line for a mapped event to the local event
# log. This log is the documented contract any haptic driver, Stream Deck
# plugin or automation tool can watch:
#
#   log:     ${LOG_CONTRACT_PATH}
#   consume: tail -F on the log; each line is one JSON object with
#            ts, profile, event, class, pattern {id, amplitude (0..1),
#            pulse_ms, gap_ms, repeat, rhythm}, priority, cooldown_seconds,
#            source. cooldown_seconds is advisory: the consumer enforces it.
#
# The plugin designs and exports the mapping and emits events; the hardware
# driver on this machine does the vibrating. No hardware is driven directly
# by this script - it only appends the line.
set -eu

CONFIG_DIR="\${XDG_CONFIG_HOME:-\$HOME/.config}/plugin-suite"
LOG="\$CONFIG_DIR/${LOG_FILE_NAME}"

EVENT="\${1:-}"
if [ -z "\$EVENT" ]; then
  echo "usage: \$0 <event_id>   mapped events: ${emitted.map((e) => e.id).join(' ')}" >&2
  exit 2
fi

case "\$EVENT" in
${cases}
${silentCase}
  *)
    echo "unmapped event '\$EVENT' - mapped events: ${emitted.map((e) => e.id).join(' ')}" >&2
    exit 4
    ;;
esac

TS="\$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p "\$CONFIG_DIR"
# One printf, one line, appended with O_APPEND - atomic for a line this size.
printf '{"ts":"%s","profile":"%s","event":"%s","class":"%s","pattern":%s,"priority":%s,"cooldown_seconds":%s,"source":"notify"}\\n' \\
  "\$TS" "${profile.name}" "\$EVENT" "\$CLASS" "\$PATTERN" "\$PRIORITY" "\$COOLDOWN" >> "\$LOG"
echo "emitted \$EVENT -> \$LOG"
`;
}

// --------------------------------------------------------------------- emit

/**
 * Append one mapped event to the local event log, validated against the
 * exported profile. This is the bridge: the line lands in the documented log,
 * and whatever haptic-capable watcher the user runs turns it into the buzz.
 */
export function emitEvent({ event, profile: profileName, note }) {
  const wanted = String(event ?? '').trim();
  if (!wanted) throw new ToolError('invalid_request', 'Pass "event": the event id to emit.');
  const name = profileName === undefined ? 'default' : slug(profileName, 'profile');

  const profiles = store.readAll();
  const record = profiles.find((p) => p.name === name);
  if (!record) {
    throw new ToolError(
      'no_profile',
      `No exported profile "${name}" — run export_profile first; emit_event only emits events a profile maps.`,
      { available_profiles: profiles.map((p) => p.name) }
    );
  }

  const { profile } = record;
  const entry = profile.events.find((e) => e.id === wanted || e.event === wanted);
  if (!entry) {
    throw new ToolError('unmapped_event', `"${wanted}" is not an event in profile "${name}".`, {
      mapped_events: profile.events.filter((e) => e.emitted).map((e) => e.id),
      silent_events: profile.events.filter((e) => !e.emitted).map((e) => e.id),
    });
  }
  if (!entry.emitted) {
    throw new ToolError(
      'silent_event',
      `"${entry.id}" is classed ${entry.class} and maps to silence — it is never emitted. ` +
      'The channel works because it is scarce: reclassify the event if it genuinely needs the wrist.',
      { class: entry.class, channel: entry.channel }
    );
  }

  const t = entry.pattern.tuple;
  const line = {
    ts: new Date().toISOString(),
    profile: name,
    event: entry.id,
    class: entry.class,
    pattern: { id: entry.pattern.id, amplitude: t.amplitude, pulse_ms: t.pulse_ms, gap_ms: t.gap_ms, repeat: t.repeat, rhythm: t.rhythm },
    priority: entry.priority,
    cooldown_seconds: entry.cooldown_seconds,
    source: 'emit_event',
    ...(note !== undefined && String(note).trim() !== '' ? { note: String(note) } : {}),
  };

  const logFile = eventLogPath();
  fs.mkdirSync(path.dirname(logFile), { recursive: true, mode: 0o700 });
  // A single appendFileSync call is one O_APPEND write — atomic against the
  // notify hook and against a second server appending concurrently.
  fs.appendFileSync(logFile, `${JSON.stringify(line)}\n`, { mode: 0o600 });

  return {
    emitted: true,
    log: logFile,
    line,
    consumer_contract: LOG_CONTRACT,
    delivery_statement: DELIVERY_STATEMENT,
  };
}
