#!/usr/bin/env node
/**
 * One-command Stripe provisioning. Idempotent — safe to re-run.
 *
 *   STRIPE_SECRET_KEY=sk_... BILLING_PUBLIC_URL=https://billing.example.com \
 *     node services/billing/scripts/setup-stripe.mjs
 *
 * For every paid plan in the catalog it ensures a Product (deterministic id,
 * so re-runs find it) and a recurring Price (found by lookup key; repriced
 * plans get a new Price that takes over the lookup key, since Stripe prices
 * are immutable). It then ensures the webhook endpoint exists and writes
 * everything the server needs into an env file.
 *
 * Flags:
 *   --recreate-webhook   delete and recreate the webhook endpoint (the
 *                        signing secret is only revealed at creation, so use
 *                        this if the stored secret has been lost)
 *
 * The env file path comes from BILLING_ENV_FILE (default: .env beside the
 * server). Start the server with:  node --env-file=.env server.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { CATALOG } from '../catalog.js';
import { formEncode } from '../lib/stripe.js';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PUBLIC_URL = (process.env.BILLING_PUBLIC_URL || '').replace(/\/$/, '');
const API_BASE = (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');
const ENV_FILE = process.env.BILLING_ENV_FILE
  || path.join(import.meta.dirname, '..', '.env');
const RECREATE_WEBHOOK = process.argv.includes('--recreate-webhook');

if (!SECRET_KEY) exit('STRIPE_SECRET_KEY is required (sk_test_... to provision test mode, sk_live_... for live).');
if (!PUBLIC_URL) exit('BILLING_PUBLIC_URL is required — the public https URL this service will be reachable at.');

function exit(message) {
  console.error(`setup-stripe: ${message}`);
  process.exit(1);
}

async function stripe(method, endpoint, params = null) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      authorization: `Bearer ${SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params ? formEncode(params) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 404) {
    exit(`Stripe ${method} ${endpoint} failed: ${data.error?.message ?? `HTTP ${response.status}`}`);
  }
  return { status: response.status, data };
}

// ---- env file handling -----------------------------------------------------

function readEnvFile() {
  const out = {};
  try {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
  } catch { /* no file yet */ }
  return out;
}

function writeEnvFile(vars) {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
  fs.writeFileSync(ENV_FILE, `${lines.join('\n')}\n`, { mode: 0o600 });
}

// ---- provisioning ----------------------------------------------------------

const env = readEnvFile();
env.BILLING_PUBLIC_URL = PUBLIC_URL;
env.STRIPE_SECRET_KEY = SECRET_KEY;

for (const [pluginId, entry] of Object.entries(CATALOG)) {
  const productId = `prod_pluginsuite_${entry.code.toLowerCase()}`;

  for (const [planId, plan] of Object.entries(entry.plans)) {
    if (!plan.price || !plan.stripe_price_env) continue;
    const lookupKey = `${entry.code.toLowerCase()}_${planId}`;

    // Product first: deterministic id makes re-runs find it.
    const existingProduct = await stripe('GET', `/v1/products/${productId}`);
    if (existingProduct.status === 404) {
      await stripe('POST', '/v1/products', {
        id: productId,
        name: entry.name,
        metadata: { plugin_id: pluginId, suite: 'plugin-suite' },
      });
      console.log(`created product ${productId} (${entry.name})`);
    }

    // Price by lookup key. Prices are immutable, so a changed amount means a
    // new Price that takes the lookup key over from the old one.
    const found = await stripe('GET', `/v1/prices?${formEncode({ lookup_keys: { 0: lookupKey }, active: true })}`);
    const current = found.data.data?.[0];
    if (current && current.unit_amount === plan.price && current.recurring?.interval === plan.interval) {
      env[plan.stripe_price_env] = current.id;
      console.log(`price ${lookupKey} already correct: ${current.id} ($${(plan.price / 100).toFixed(2)}/${plan.interval})`);
      continue;
    }
    const created = await stripe('POST', '/v1/prices', {
      product: productId,
      currency: 'usd',
      unit_amount: plan.price,
      recurring: { interval: plan.interval },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      metadata: { plugin_id: pluginId, plan: planId },
    });
    env[plan.stripe_price_env] = created.data.id;
    console.log(`${current ? 'repriced' : 'created price'} ${lookupKey}: ${created.data.id} ($${(plan.price / 100).toFixed(2)}/${plan.interval})`);
  }
}

// ---- webhook endpoint ------------------------------------------------------

const WEBHOOK_URL = `${PUBLIC_URL}/v1/stripe/webhook`;
const EVENTS = ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted'];

const endpoints = await stripe('GET', '/v1/webhook_endpoints?limit=100');
let existing = (endpoints.data.data ?? []).find((e) => e.url === WEBHOOK_URL);

if (existing && RECREATE_WEBHOOK) {
  await stripe('DELETE', `/v1/webhook_endpoints/${existing.id}`);
  console.log(`deleted webhook endpoint ${existing.id} (--recreate-webhook)`);
  existing = null;
}

if (!existing) {
  const created = await stripe('POST', '/v1/webhook_endpoints', {
    url: WEBHOOK_URL,
    enabled_events: Object.fromEntries(EVENTS.map((e, i) => [i, e])),
    description: 'plugin-suite billing',
  });
  env.STRIPE_WEBHOOK_SECRET = created.data.secret;
  console.log(`created webhook endpoint ${created.data.id} for ${WEBHOOK_URL}`);
} else if (env.STRIPE_WEBHOOK_SECRET) {
  console.log(`webhook endpoint already exists (${existing.id}); keeping the stored signing secret`);
} else {
  console.log(`webhook endpoint already exists (${existing.id}) but no signing secret is stored — ` +
    'Stripe only reveals it at creation. Re-run with --recreate-webhook to rotate it.');
}

writeEnvFile(env);
console.log(`\nwrote ${ENV_FILE}`);
console.log('start the service with:  node --env-file=.env server.js');
