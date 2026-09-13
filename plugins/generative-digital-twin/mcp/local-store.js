/**
 * A small, dependency-free JSON-array store shared by every plugin's local
 * history log (runs, cases, sessions, estimates, ...).
 *
 * Each plugin's MCP server is a long-running process, and a user very
 * plausibly has more than one open at once — two chat windows, an IDE pane
 * and a terminal — every one of them pointed at the same file under
 * ~/.config/plugin-suite. Read-modify-write with no coordination between
 * separate processes is a classic lost update: two processes both read the
 * same N records, both append one in memory, and whichever writes back
 * second overwrites the file with its own N+1 — silently erasing the first
 * process's record, with no error anywhere to say so. An exclusive lock file
 * held for the whole read-modify-write closes that window.
 *
 * A plain read (list/get) does not need the lock: write-then-rename is
 * atomic, so a reader only ever sees a complete old file or a complete new
 * one, never a torn write, and a read by itself has nothing to lose to a
 * race — only a read *paired with* a write that depends on it does.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_LOCK_STALE_MS = 10_000;
const DEFAULT_LOCK_RETRY_DELAY_MS = 20;
const DEFAULT_LOCK_TIMEOUT_MS = 5_000;

function configDir() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite');
}

// A synchronous sleep with no dependency and no CPU-spinning: Atomics.wait
// blocks the calling thread on a futex, the same primitive a real mutex's
// wait queue uses, rather than burning cycles polling as fast as possible.
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLock(lockPath, { staleMs, retryDelayMs, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        // A lock this old was almost certainly left behind by a process that
        // crashed or was killed mid-update and never got to remove it —
        // stealing it is safer than leaving the store wedged shut forever.
        if (Date.now() - fs.statSync(lockPath).mtimeMs > staleMs) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        continue; // the lock vanished between the failed create and this stat — retry now
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for the lock on ${lockPath} — another process is holding it.`);
      }
      sleepSync(retryDelayMs);
    }
  }
}

function releaseLock(lockPath) {
  try { fs.rmSync(lockPath, { force: true }); } catch { /* already gone */ }
}

function fsyncDirIfSupported(dir) {
  let fd;
  let bestEffort = false;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } catch (err) {
    // Some platforms do not allow opening or fsyncing a directory at all.
    // The file fsync above still buys durable contents there; best-effort the
    // directory flush rather than failing the whole write on that platform.
    if (!['EACCES', 'EISDIR', 'EINVAL', 'EPERM', 'ENOTSUP'].includes(err.code)) throw err;
    bestEffort = true;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (err) {
        if (!(bestEffort && ['EACCES', 'EISDIR', 'EINVAL', 'EPERM', 'ENOTSUP'].includes(err.code))) throw err;
      }
    }
  }
}

/**
 * @param {string} fileName e.g. "diagnose-by-sound-cases.json"
 * @param {string} key the array's key inside the JSON file, e.g. "cases"
 * @param {{staleMs?: number, retryDelayMs?: number, timeoutMs?: number}} [lockOptions]
 */
export function createJsonArrayStore(fileName, key, lockOptions = {}) {
  const file = path.join(configDir(), fileName);
  const lockPath = `${file}.lock`;
  const lock = {
    staleMs: lockOptions.staleMs ?? DEFAULT_LOCK_STALE_MS,
    retryDelayMs: lockOptions.retryDelayMs ?? DEFAULT_LOCK_RETRY_DELAY_MS,
    timeoutMs: lockOptions.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
  };

  function readRaw() {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      // No file we can even open yet — a first run, or the directory not
      // created. Not corruption; nothing to load.
      return [];
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      // The file exists and was readable, but isn't valid JSON — most likely
      // truncated or corrupted. Treating that as "empty, start fresh" would
      // let the very next update() overwrite real history with nothing.
      // Fail loudly instead, the same way services/billing/lib/store.js does.
      throw new Error(`${file} exists but is not valid JSON (${err.message}) — refusing to treat it as empty and risk overwriting it.`);
    }
    return Array.isArray(parsed[key]) ? parsed[key] : [];
  }

  function ensureDir() {
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    // mkdirSync's mode is only honoured for a directory it actually creates —
    // if the directory already existed (from an older version of this code,
    // or anything else), recursive:true silently succeeds without touching
    // its mode at all, and a private history could sit in a world-readable
    // folder indefinitely. chmod unconditionally rather than trusting mkdir.
    fs.chmodSync(dir, 0o700);
  }

  function writeRaw(items) {
    ensureDir();
    // Write-then-rename so a crash mid-write can never truncate the file.
    const tmp = `${file}.tmp`;
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify({ version: 1, [key]: items }, null, 2), 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
    fsyncDirIfSupported(path.dirname(file));
  }

  return {
    file,

    readAll: readRaw,

    /**
     * The one place a read-modify-write happens. `updater(items)` receives
     * the current array and must return `{ items, result }` — the array to
     * persist and whatever the caller wants back. Held under an exclusive
     * lock so a concurrent update from another process can never read the
     * same snapshot and silently overwrite this one.
     */
    update(updater) {
      ensureDir();
      acquireLock(lockPath, lock);
      try {
        const { items, result } = updater(readRaw());
        writeRaw(items);
        return result;
      } finally {
        releaseLock(lockPath);
      }
    },
  };
}
