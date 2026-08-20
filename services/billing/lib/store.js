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
    this.data = { version: 1, licenses: {}, events: {}, trials: {} };
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

  /** Returns true the first time an id is seen, false on replays. */
  claimEvent(id) {
    if (!id || this.data.events[id]) return false;
    this.data.events[id] = Date.now();
    this.save();
    return true;
  }

  // ---- trials ------------------------------------------------------------

  trialUsed(pluginId, email) {
    return Boolean(this.data.trials[`${pluginId}:${email.toLowerCase()}`]);
  }

  markTrial(pluginId, email, key) {
    this.data.trials[`${pluginId}:${email.toLowerCase()}`] = { key, at: Date.now() };
    this.save();
  }
}
