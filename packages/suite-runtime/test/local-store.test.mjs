#!/usr/bin/env node
/**
 * Regression tests for local-store.js, the shared JSON-array store every
 * plugin's local history log (runs, cases, sessions, ...) is built on.
 *
 *   node packages/suite-runtime/test/local-store.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createJsonArrayStore } from '../local-store.js';

const writerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'concurrent-writer.mjs');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'local-store-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

function runWriter(fileName, key, count, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [writerPath, fileName, key, String(count), label], {
      env: process.env,
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`writer exited ${code}: ${stderr}`))));
  });
}

try {
  // ---- basic read/update round-trip ---------------------------------------
  {
    const store = createJsonArrayStore('basic-test.json', 'items');
    assert.deepEqual(store.readAll(), []);
    const added = store.update((items) => {
      items.unshift({ id: 1 });
      return { items, result: { id: 1 } };
    });
    assert.deepEqual(added, { id: 1 });
    assert.deepEqual(store.readAll(), [{ id: 1 }]);
  }
  ok('update() persists and returns the caller-chosen result; readAll() reflects it');

  // ---- two concurrent processes never lose an update ----------------------
  // Regression test: the plugin store modules this replaces did
  // readAll()-mutate-writeAll() with no coordination at all. Two processes
  // racing on the same file — entirely realistic, since each plugin server
  // is a long-running process and a user can easily have more than one open
  // against the same ~/.config/plugin-suite file — read the same snapshot
  // and whichever wrote back second silently discarded the other's record.
  // This only reproduces across real OS processes: two synchronous calls
  // within one process can't interleave mid-read-modify-write at all.
  {
    const fileName = 'concurrent-test.json';
    // High enough that, without the lock, the two processes' read-modify-write
    // windows overlap and lose records on effectively every run (confirmed:
    // reverting the lock lost the majority of writes at this volume) — not
    // just occasionally, which a flaky-by-nature race test would be.
    const perWriter = 150;
    await Promise.all([
      runWriter(fileName, 'items', perWriter, 'a'),
      runWriter(fileName, 'items', perWriter, 'b'),
    ]);
    const store = createJsonArrayStore(fileName, 'items');
    const items = store.readAll();
    assert.equal(items.length, perWriter * 2, 'every append from both processes must survive, none lost to a race');
    assert.equal(items.filter((r) => r.from === 'a').length, perWriter);
    assert.equal(items.filter((r) => r.from === 'b').length, perWriter);
  }
  ok('two processes updating the same store concurrently lose no records');

  // ---- a lock left behind by a crashed process is not fatal ---------------
  {
    const store = createJsonArrayStore('stale-lock-test.json', 'items', { staleMs: 50, timeoutMs: 2000 });
    fs.mkdirSync(path.dirname(store.file), { recursive: true });
    fs.writeFileSync(`${store.file}.lock`, '999999');
    const old = Date.now() - 1000;
    fs.utimesSync(`${store.file}.lock`, old / 1000, old / 1000);
    const result = store.update((items) => {
      items.push({ ok: true });
      return { items, result: 'done' };
    });
    assert.equal(result, 'done');
    assert.equal(store.readAll().length, 1);
  }
  ok('a stale lock (older than staleMs) is taken over rather than blocking forever');

  // ---- a lock genuinely held by a live process times out with an error ----
  {
    const store = createJsonArrayStore('held-lock-test.json', 'items', { timeoutMs: 150, retryDelayMs: 10 });
    fs.mkdirSync(path.dirname(store.file), { recursive: true });
    fs.writeFileSync(`${store.file}.lock`, String(process.pid)); // fresh — not stale
    await assert.rejects(
      async () => store.update((items) => ({ items, result: null })),
      /Timed out waiting for the lock/
    );
  }
  ok('a lock genuinely held by another live process times out rather than corrupting the store');

  console.log(`\n${passed} local-store checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
