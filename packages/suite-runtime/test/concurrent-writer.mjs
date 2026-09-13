#!/usr/bin/env node
/**
 * Helper process for local-store.test.mjs: appends `count` records to the
 * given store, one per update() call, then exits. Run as a real child
 * process (not simulated in-process) because the race this guards against —
 * two separate OS processes both reading the same file before either writes
 * back — cannot happen between two synchronous calls in one process at all.
 *
 *   node concurrent-writer.mjs <fileName> <key> <count> <label>
 */
import { createJsonArrayStore } from '../local-store.js';

const [, , fileName, key, countArg, label] = process.argv;
const store = createJsonArrayStore(fileName, key);

for (let i = 0; i < Number(countArg); i++) {
  store.update((items) => {
    items.push({ from: label, i });
    return { items, result: null };
  });
}
