import { createJsonArrayStore } from '../local-store.js';

/**
 * Persistence for the fitted predictor, so fitting and predicting no longer
 * have to happen in one call with the model thrown away in between. One
 * record only — workflows are non-stationary, so a refit replaces the saved
 * model rather than accumulating a history of stale ones. Stored on the
 * user's machine only, under the same atomic write-then-rename store as the
 * build log: a reader only ever sees a complete old model or a complete new
 * one, and two servers saving at once cannot lose an update.
 */

const store = createJsonArrayStore('neural-link-intention-layer-model.json', 'models');

export const MODEL_FILE = store.file;

/** Persist a fitted model record, replacing any previous one. */
export function saveModel(record) {
  return store.update(() => ({ items: [record], result: record }));
}

/** The saved model record, or null when none has been saved yet. */
export function loadModel() {
  return store.readAll()[0] ?? null;
}
