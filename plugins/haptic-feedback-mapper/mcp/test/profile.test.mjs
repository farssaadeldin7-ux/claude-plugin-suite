#!/usr/bin/env node
/**
 * Regression tests for lib/profile.js: the export/emit bridge. An export that
 * fails its own audit must be refused with the failures named, a clean export
 * must produce the canonical JSON profile and the POSIX-sh notify hook, and
 * emit_event must append the documented NDJSON line — with structured errors
 * for unmapped events, silent events and a missing profile.
 *
 * profile.js resolves its store (and the config directory) the moment it is
 * imported, so each scenario gets its own XDG_CONFIG_HOME and a fresh module
 * instance via a cache-busting query string, the same way sessions.test.mjs
 * isolates the session log.
 *
 *   node plugins/haptic-feedback-mapper/mcp/test/profile.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const tmpDirs = [];
let importSeq = 0;
async function freshProfileLib() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haptic-feedback-mapper-profile-test-'));
  tmpDirs.push(dir);
  process.env.XDG_CONFIG_HOME = dir;
  importSeq += 1;
  const lib = await import(`../lib/profile.js?instance=${importSeq}`);
  return { lib, dir };
}

const PATTERNS = [
  { id: 'single_tap', meaning: 'the wait ended, work can resume', count: 1, intensity: 'medium', rhythm: 'even' },
  { id: 'triple_buzz', meaning: 'something failed and needs you', count: 3, intensity: 'high', rhythm: 'even', is_failure: true },
];
const EVENTS = [
  { event: 'build failed', class: 'act_now', decision_fed: 'fix or requeue', haptic: 'triple_buzz' },
  { event: 'export done', class: 'done', decision_fed: 'ship it', haptic: 'single_tap', cooldown_seconds: 30 },
  { event: 'render progress', class: 'ambient' },
  { event: 'likes arrived', class: 'noise' },
];

try {
  // ---- an export that fails its own audit is refused, failures named ------
  {
    const { lib, dir } = await freshProfileLib();
    const out = path.join(dir, 'out');
    assert.throws(
      () => lib.exportProfile({
        directory: out,
        events: [...EVENTS, { event: 'newsletter', class: 'noise', haptic: 'single_tap' }],
        patterns: PATTERNS,
      }),
      (e) => e instanceof ToolError && e.code === 'audit_failed'
        && e.detail.mapping_findings.some((f) => f.rule === 'noise_gets_nothing'),
      'a noise event carrying a haptic must refuse the export and name the rule'
    );
    assert.equal(fs.existsSync(out), false, 'a refused export must write nothing');
    ok('audit-failing mapping refused, nothing written');

    assert.throws(
      () => lib.exportProfile({
        directory: out,
        events: [{ event: 'x', class: 'done', decision_fed: 'd', haptic: 'ghost' }],
        patterns: PATTERNS,
      }),
      (e) => e instanceof ToolError && e.code === 'audit_failed'
        && e.detail.export_findings.some((f) => f.rule === 'unknown_pattern'),
      'a haptic pointing at no vocabulary pattern must refuse the export'
    );
    ok('unknown pattern id refused');
  }

  // ---- a clean export compiles the canonical profile and the notify hook --
  {
    const { lib, dir } = await freshProfileLib();
    const out = path.join(dir, 'out');
    const res = lib.exportProfile({ directory: out, profile_name: 'studio', events: EVENTS, patterns: PATTERNS });

    const profile = JSON.parse(fs.readFileSync(res.files.profile, 'utf8'));
    assert.equal(profile.format, 'haptic-feedback-mapper.profile');
    assert.equal(profile.events.length, 4);
    const bf = profile.events.find((e) => e.id === 'build_failed');
    // triple_buzz: high -> amplitude 1, defaults 150ms pulse / 100ms gap, repeat = count 3
    assert.deepEqual(
      [bf.pattern.tuple.amplitude, bf.pattern.tuple.pulse_ms, bf.pattern.tuple.gap_ms, bf.pattern.tuple.repeat],
      [1, 150, 100, 3]
    );
    assert.equal(bf.priority, 1, 'act_now is priority 1');
    assert.equal(profile.events.find((e) => e.id === 'export_done').cooldown_seconds, 30);
    assert.match(profile.delivery_statement, /driver on the user's machine does the vibrating/);
    assert.notEqual(fs.statSync(res.files.notify_hook).mode & 0o111, 0, 'notify must be executable');
    assert.deepEqual(res.emitted_events, ['build_failed', 'export_done']);
    assert.deepEqual(res.silent_events, ['render_progress', 'likes_arrived']);
    ok('clean export: profile JSON, tuples, priorities, executable notify hook');

    // ---- emit_event appends the documented line ----------------------------
    lib.emitEvent({ event: 'build_failed', profile: 'studio', note: 'ci job 42' });
    const logFile = lib.eventLogPath();
    const line = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    assert.equal(line.event, 'build_failed');
    assert.equal(line.class, 'act_now');
    assert.deepEqual([line.pattern.id, line.pattern.amplitude, line.pattern.repeat], ['triple_buzz', 1, 3]);
    assert.equal(line.source, 'emit_event');
    assert.equal(line.note, 'ci job 42');
    assert.ok(!Number.isNaN(Date.parse(line.ts)), 'ts must be a parseable timestamp');
    ok('emit_event appends the NDJSON contract line');

    // ---- structured errors -------------------------------------------------
    assert.throws(() => lib.emitEvent({ event: 'no_such_event', profile: 'studio' }),
      (e) => e instanceof ToolError && e.code === 'unmapped_event' && e.detail.mapped_events.includes('build_failed'));
    assert.throws(() => lib.emitEvent({ event: 'render_progress', profile: 'studio' }),
      (e) => e instanceof ToolError && e.code === 'silent_event');
    assert.throws(() => lib.emitEvent({ event: 'build_failed', profile: 'other' }),
      (e) => e instanceof ToolError && e.code === 'no_profile');
    ok('structured errors: unmapped_event, silent_event, no_profile');

    // ---- the notify hook lands the same contract, in plain sh -------------
    execFileSync('sh', [res.files.notify_hook, 'export_done'], {
      env: { ...process.env, XDG_CONFIG_HOME: dir },
      encoding: 'utf8',
    });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    const shLine = JSON.parse(lines[1]);
    assert.equal(shLine.event, 'export_done');
    assert.equal(shLine.source, 'notify');
    assert.equal(shLine.pattern.id, 'single_tap');
    assert.equal(shLine.cooldown_seconds, 30);
    ok('notify hook appends the same NDJSON contract line');

    for (const [ev, exitCode] of [['render_progress', 3], ['bogus', 4]]) {
      let status = 0;
      try {
        execFileSync('sh', [res.files.notify_hook, ev], { env: { ...process.env, XDG_CONFIG_HOME: dir }, stdio: 'pipe' });
      } catch (e) { status = e.status; }
      assert.equal(status, exitCode, `notify must refuse "${ev}" with exit ${exitCode}`);
    }
    assert.equal(fs.readFileSync(logFile, 'utf8').trim().split('\n').length, 2, 'refusals must append nothing');
    ok('notify hook refuses silent and unmapped events, appending nothing');

    // ---- re-export replaces the stored profile, same name ------------------
    lib.exportProfile({ directory: out, profile_name: 'studio', events: EVENTS.slice(0, 3), patterns: PATTERNS });
    assert.throws(() => lib.emitEvent({ event: 'likes_arrived', profile: 'studio' }),
      (e) => e instanceof ToolError && e.code === 'unmapped_event',
      'an event dropped from the re-exported profile must no longer emit');
    ok('re-export replaces the stored profile');
  }

  console.log(`\nprofile.test.mjs: ${passed} checks passed`);
} finally {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
}
