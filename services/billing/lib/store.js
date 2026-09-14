import fs from 'node:fs';
import path from 'node:path';

// A plain writeFileSync() can return before the bytes are actually on disk —
// the OS is free to hold them in its page cache. fsync-ing the descriptor
// before it's closed forces that flush, so a power cut right after this
// function returns can no longer leave the .tmp file truncated or missing.
function writeFileDurable(file, data, mode) {
  const fd = fs.openSync(file, 'w', mode);
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

// Even with the .tmp file itself synced, renameSync() only updates the
// directory entry in the page cache unless the directory's own descriptor is
// fsynced too — otherwise a crash right after a successful rename can still
// lose the rename on reboot, leaving the old file (or nothing) in its place.
// Directories can't be opened for fsync on Windows; skip there rather than
// fail a write over a guarantee that platform doesn't offer anyway.
function fsyncDirSync(dir) {
  if (process.platform === 'win32') return;
  let fd;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * JSON-file persistence. One file, written atomically, chmod 0600.
 *
 * Deliberately boring: at this stage the service has one instance and the
 * working set is small. The Store API is the seam — swapping in SQLite or
 * Postgres later touches nothing outside this file.
 */
export class Store {
  constructor(file) {
    this.file = file;
    this.data = { version: 1, licenses: {}, events: {} };
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      // No file we can even open yet — a first run, a not-yet-mounted
      // volume, a parent directory save() hasn't created. None of that is
      // corruption; it's "nothing to load", same as the previous behaviour.
      return;
    }
    try {
      this.data = { ...this.data, ...JSON.parse(raw) };
    } catch (err) {
      // The file exists and was readable, but isn't valid JSON — most likely
      // truncated or corrupted. Treating that as "empty, start fresh" (the
      // previous behaviour) would let the very next save() overwrite real
      // customer data with nothing. Fail loudly instead: refusing to start
      // gives an operator the chance to restore from backup before anything
      // gets silently destroyed.
      throw new Error(
        `Billing store at ${file} exists but is not valid JSON (${err.message}). ` +
        'Refusing to start and risk overwriting it — restore from backup or repair the file by hand.'
      );
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = `${this.file}.tmp`;
    writeFileDurable(tmp, JSON.stringify(this.data, null, 2), 0o600);
    fs.renameSync(tmp, this.file);
    // The rename above is only durable once the directory entry it updated
    // is itself synced — a power cut right after a successful rename can
    // otherwise still leave the old (or no) file behind on reboot.
    fsyncDirSync(path.dirname(this.file));
  }

  // ---- licenses ----------------------------------------------------------
  //
  // Every read below returns a detached copy, never the object living in
  // this.data. Callers commonly do getLicense() -> mutate the result in
  // place -> putLicense(that same object) (recordUsage, device
  // registration, both webhook subscription handlers all follow this
  // shape). If getLicense handed out the live object, that in-place
  // mutation would already be sitting in this.data.licenses before
  // putLicense ever ran — so putLicense's own "previous" snapshot, taken
  // from this.data at the top of the call, would already equal the
  // mutated value, and rolling back on a failed save would restore the
  // object to itself: a no-op. A failed write would then leave the
  // unpersisted change in memory anyway, for the next unrelated save to
  // resurrect. Returning a copy on read means a caller's mutation never
  // reaches this.data until putLicense is actually called.

  getLicense(key) {
    const license = this.data.licenses[key];
    return license ? structuredClone(license) : null;
  }

  putLicense(license) {
    const stored = structuredClone(license);
    const previous = this.data.licenses[stored.key];
    this.data.licenses[stored.key] = stored;
    try {
      this.save();
    } catch (err) {
      // Keep memory consistent with disk: an unpersisted write must not
      // linger in-memory, or findLicense (the /success page lookup) could
      // hand out a licence that vanishes the moment the process restarts.
      if (previous === undefined) delete this.data.licenses[stored.key];
      else this.data.licenses[stored.key] = previous;
      throw err;
    }
    return structuredClone(stored);
  }

  findLicense(predicate) {
    const license = Object.values(this.data.licenses).find(predicate);
    return license ? structuredClone(license) : null;
  }

  /**
   * Persist `license` and claim `id` as a single write. putLicense() and
   * claimEvent() used to be called back to back for exactly this shape
   * (issue/update a licence, then claim the event that caused it) — two
   * separate save() calls, which left a window where the first succeeded
   * and the second failed: the licence write was already durable, but the
   * event was never claimed, so a retry with the same id ran the work a
   * second time. checkout.session.completed happens to be protected from
   * that by its own checkout_session_id guard; recordUsage() has no
   * equivalent guard and double-counts on exactly this failure (confirmed
   * empirically: putLicense's write succeeding while claimEvent's
   * immediately-following write fails, then a same-id retry, recorded
   * usage twice). One write closes both the same way, and every future
   * caller of this shape for free.
   */
  putLicenseAndClaim(license, id) {
    const stored = structuredClone(license);
    const previousLicense = this.data.licenses[stored.key];
    const previousClaimedAt = this.data.events[id];
    this.data.licenses[stored.key] = stored;
    if (id) this.data.events[id] = Date.now();
    try {
      this.save();
    } catch (err) {
      if (previousLicense === undefined) delete this.data.licenses[stored.key];
      else this.data.licenses[stored.key] = previousLicense;
      if (previousClaimedAt === undefined) delete this.data.events[id];
      else this.data.events[id] = previousClaimedAt;
      throw err;
    }
    return structuredClone(stored);
  }

  // ---- webhook / usage idempotency --------------------------------------
  //
  // Callers must check isEventClaimed() before doing the work, then call
  // claimEvent() only once that work has actually succeeded. Claiming
  // before the work runs — and standing by that claim even when the work
  // throws — means a handler failure permanently burns the id: the retry
  // that would otherwise fix things instead reads as an already-handled
  // duplicate and is dropped. For a Stripe webhook that turns into a paid
  // licence, that failure mode is silent and unrecoverable, so it matters
  // that claim-then-work is never used here.

  /** True if this id has already been successfully processed. */
  isEventClaimed(id) {
    return Boolean(id && this.data.events[id]);
  }

  /** Record that an id's work has succeeded. Call only after that work returns without throwing. */
  claimEvent(id) {
    if (!id) return;
    this.data.events[id] = Date.now();
    try {
      this.save();
    } catch (err) {
      // Same reasoning as putLicense: an unpersisted claim must not linger
      // in memory, or a same-process retry would read it as already done.
      delete this.data.events[id];
      throw err;
    }
  }

}
