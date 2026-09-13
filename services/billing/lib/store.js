import fs from 'node:fs';
import path from 'node:path';

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
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  // ---- licenses ----------------------------------------------------------

  getLicense(key) {
    return this.data.licenses[key] ?? null;
  }

  putLicense(license) {
    const previous = this.data.licenses[license.key];
    this.data.licenses[license.key] = license;
    try {
      this.save();
    } catch (err) {
      // Keep memory consistent with disk: an unpersisted write must not
      // linger in-memory, or findLicense (the /success page lookup) could
      // hand out a licence that vanishes the moment the process restarts.
      if (previous === undefined) delete this.data.licenses[license.key];
      else this.data.licenses[license.key] = previous;
      throw err;
    }
    return license;
  }

  findLicense(predicate) {
    return Object.values(this.data.licenses).find(predicate) ?? null;
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
