#!/usr/bin/env node
/**
 * Read a customer's licence key(s) straight from the store, by email.
 *
 * docs/RUNBOOKS.md points here for the case a webhook retry cannot wait for:
 * a customer paid, the webhook delivery that would have issued their key
 * hasn't landed yet (or failed), and they need the key now. Reading the
 * store directly does not require the webhook to succeed first.
 *
 *   BILLING_STORE_FILE=/data/store.json \
 *     node services/billing/scripts/find-license.mjs --email jane@example.com
 *
 * Matching is case-insensitive and exact (no partial/substring match, to
 * avoid one support ticket returning every licence on a shared domain).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../lib/store.js';

const args = process.argv.slice(2);
const flagIndex = args.indexOf('--email');
const email = flagIndex !== -1 ? args[flagIndex + 1] : undefined;

if (!email) {
  console.error('Usage: node services/billing/scripts/find-license.mjs --email <address>');
  process.exit(1);
}

const storeFile = process.env.BILLING_STORE_FILE
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'store.json');

const store = new Store(storeFile);
const needle = email.trim().toLowerCase();
const matches = Object.values(store.data.licenses).filter(
  (license) => license.email && license.email.trim().toLowerCase() === needle
);

if (matches.length === 0) {
  console.error(`No licence found for ${email} in ${storeFile}.`);
  console.error('Stripe is the source of truth if a webhook is genuinely still stuck — check the dashboard before assuming the customer never paid.');
  process.exit(1);
}

for (const license of matches) {
  console.log(`${license.key}  ${license.plugin_id}/${license.plan}  ${license.status}  issued ${license.created_at}`);
}
