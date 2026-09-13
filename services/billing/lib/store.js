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
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...this.data, ...parsed };
    } catch {
      // First run — start empty.
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
    this.data.licenses[license.key] = license;
    this.save();
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
    this.save();
  }

}
