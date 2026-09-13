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

  // ---- a corrupted file is a loud failure, never a silent empty history ---
  // Regression test: readRaw() caught every read error the same way,
  // including a truncated or corrupted JSON file — treating that as "start
  // empty" meant the very next update() overwrote the real (if damaged)
  // history with nothing at all, destroying it for good.
  {
    const store = createJsonArrayStore('corrupt-test.json', 'items');
    fs.mkdirSync(path.dirname(store.file), { recursive: true });
    fs.writeFileSync(store.file, '{"version":1,"items":[{"a":1},{"a":2}TRUNCATED');
    assert.throws(() => store.readAll(), /is not valid JSON/);
    // And critically: the original file must still be there, untouched.
    assert.match(fs.readFileSync(store.file, 'utf8'), /TRUNCATED/);
  }
  ok('a corrupted store file throws loudly on read instead of being silently treated as empty');

  // ---- the config directory is tightened even if it already existed ------
  // Regression test (#68): mkdirSync's `mode` option is only honoured for a
  // directory it actually creates — recursive:true on an already-existing
  // directory silently succeeds without touching its permissions, so a
  // private history could sit in a world-readable folder indefinitely.
  {
    const store = createJsonArrayStore('mode-test.json', 'items');
    // The directory may already exist (other tests in this file share the
    // same config home) — mkdirSync's mode is a no-op on an existing
    // directory, exactly the bug under test, so force it loose with chmod.
    fs.mkdirSync(path.dirname(store.file), { recursive: true });
    fs.chmodSync(path.dirname(store.file), 0o755);
    assert.equal(fs.statSync(path.dirname(store.file)).mode & 0o777, 0o755, 'test setup: directory must start loose');
    store.update((items) => ({ items, result: null }));
    assert.equal(fs.statSync(path.dirname(store.file)).mode & 0o777, 0o700, 'the config directory must be tightened even though it already existed');
  }
  ok('the config directory is chmod 0700 even when it already existed with looser permissions');

  // ---- writes are durable: fsync on both the data file and its rename -----
  // Regression test: writeRaw() only ever wrote-then-renamed with no fsync
  // at all. The lock this module adds only orders two writers against each
  // other — it says nothing about a write actually reaching disk, so a
  // power cut right after a successful update() could still leave the
  // store pointing at a stale or missing file. Spied rather than actually
  // pulling the plug: fsyncSync must be called once for the data file and
  // (off Windows) once for the directory it was renamed into.
  {
    const store = createJsonArrayStore('fsync-test.json', 'items');
    const originalFsync = fs.fsyncSync;
    let fsyncCalls = 0;
    fs.fsyncSync = (...args) => { fsyncCalls++; return originalFsync.apply(fs, args); };
    try {
      store.update((items) => {
        items.push({ id: 1 });
        return { items, result: null };
      });
    } finally {
      fs.fsyncSync = originalFsync;
    }
    const expected = process.platform === 'win32' ? 1 : 2;
    assert.equal(fsyncCalls, expected, 'both the data file and (off Windows) its directory must be fsynced on every write');
  }
  ok('update() fsyncs the write and the rename so a crash right after cannot lose it');

  console.log(`\n${passed} local-store checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
