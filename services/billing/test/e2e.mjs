#!/usr/bin/env node
/**
 * End-to-end test of the billing service against a mock Stripe.
 *
 *   node services/billing/test/e2e.mjs
 *
 * Boots the real server on a random port with a throwaway store, points
 * STRIPE_API_BASE at a local mock, and walks every flow the license-client
 * uses: key issuance through signed webhooks, entitlement, seats, usage
 * metering, checkout, webhook signature rejection and replay, portal, and
 * cancellation.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { signWebhookPayload } from '../lib/stripe.js';

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.js');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billing-test-'));

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// ---- mock Stripe -----------------------------------------------------------

const stripeCalls = [];
const stripeState = { products: {}, prices: [], webhooks: [] };
const mockStripe = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    stripeCalls.push({ method: req.method, path: req.url, body });
    const url = new URL(req.url, 'http://mock');
    const route = `${req.method} ${url.pathname}`;
    const form = Object.fromEntries(new URLSearchParams(body));
    const reply = (status, payload) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
    };

    if (route === 'POST /v1/checkout/sessions') {
      return reply(200, { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    }
    if (route === 'POST /v1/billing_portal/sessions') {
      return reply(200, { id: 'bps_test_1', url: 'https://billing.stripe.com/p/session/bps_test_1' });
    }
    if (/^GET \/v1\/products\/[\w-]+$/.test(route)) {
      const id = url.pathname.split('/').pop();
      return stripeState.products[id]
        ? reply(200, stripeState.products[id])
        : reply(404, { error: { message: 'No such product' } });
    }
    if (route === 'POST /v1/products') {
      stripeState.products[form.id] = { id: form.id, name: form.name };
      return reply(200, stripeState.products[form.id]);
    }
    if (route === 'GET /v1/prices') {
      const lookup = url.searchParams.get('lookup_keys[0]');
      return reply(200, { data: stripeState.prices.filter((p) => p.active && p.lookup_key === lookup) });
    }
    if (route === 'POST /v1/prices') {
      const price = {
        id: `price_mock_${stripeState.prices.length + 1}`,
        product: form.product,
        unit_amount: Number(form.unit_amount),
        recurring: { interval: form['recurring[interval]'] },
        lookup_key: form.lookup_key,
        active: true,
      };
      // transfer_lookup_key moves the key off any older price, like Stripe does.
      for (const p of stripeState.prices) if (p.lookup_key === price.lookup_key) p.lookup_key = null;
      stripeState.prices.push(price);
      return reply(200, price);
    }
    if (route === 'GET /v1/webhook_endpoints') {
      return reply(200, { data: stripeState.webhooks });
    }
    if (route === 'POST /v1/webhook_endpoints') {
      const endpoint = { id: `we_mock_${stripeState.webhooks.length + 1}`, url: form.url, secret: 'whsec_mock_created' };
      stripeState.webhooks.push(endpoint);
      return reply(200, endpoint);
    }
    return reply(404, { error: { message: `mock has no ${route}` } });
  });
});
await new Promise((resolve) => mockStripe.listen(0, resolve));
const stripePort = mockStripe.address().port;

// ---- billing service under test -------------------------------------------

const PORT = 18787 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const WEBHOOK_SECRET = 'whsec_test_secret';

const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    PORT: String(PORT),
    BILLING_PUBLIC_URL: BASE,
    BILLING_STORE_FILE: path.join(tmpDir, 'store.json'),
    STRIPE_API_BASE: `http://127.0.0.1:${stripePort}`,
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_DBS_PRO: 'price_pro_mock',
    STRIPE_PRICE_DBS_TEAM: 'price_team_mock',
    STRIPE_PRICE_GPP_PRO: 'price_gpp_pro_mock',
    STRIPE_PRICE_GPP_TEAM: 'price_gpp_team_mock',
    BILLING_ALLOWED_ORIGINS: 'https://www.codestudioplugin.com, https://codestudioplugin.com',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let serverLog = '';
child.stderr.on('data', (d) => { serverLog += d; });

const until = async (fn, ms = 5000) => {
  const deadline = Date.now() + ms;
  for (;;) {
    try { return await fn(); } catch (err) { if (Date.now() > deadline) throw err; }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
  }
};

const api = async (method, endpoint, { body, key, raw, headers = {} } = {}) => {
  const response = await fetch(`${BASE}${endpoint}`, {
    method,
    headers: {
      ...(raw === undefined ? { 'content-type': 'application/json' } : {}),
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
};

// A signed checkout.session.completed delivery — the only way a key is born.
const completeCheckout = (eventId, session) => {
  const payload = JSON.stringify({ id: eventId, type: 'checkout.session.completed', data: { object: session } });
  return { payload, headers: { 'stripe-signature': signWebhookPayload(payload, WEBHOOK_SECRET) } };
};

try {
  await until(async () => {
    const { data } = await api('GET', '/health');
    assert.equal(data.ok, true);
  });
  ok('health');

  // ---- catalog ------------------------------------------------------------
  const catalog = (await api('GET', '/v1/catalog/diagnose-by-sound')).data;
  assert.equal(catalog.name, 'Diagnose by Sound');
  assert.deepEqual(catalog.plans.map((p) => p.id).sort(), ['pro', 'team']);
  const pro = catalog.plans.find((p) => p.id === 'pro');
  assert.equal(pro.price, 4000);
  assert.equal(pro.seats, 2);
  const team = catalog.plans.find((p) => p.id === 'team');
  assert.equal(team.price, 7000);
  assert.equal(team.seats, 10);
  ok('catalog lists exactly pro and team with correct prices and seats');

  const hfmCatalog = (await api('GET', '/v1/catalog/haptic-feedback-mapper')).data;
  assert.equal(hfmCatalog.plans.find((p) => p.id === 'pro').price, 50000);
  assert.equal(hfmCatalog.plans.find((p) => p.id === 'team').price, 200000);
  ok('premium plugins price at $500/$2,000');

  assert.equal((await api('GET', '/v1/catalog/nonsense')).status, 404);
  ok('unknown plugin catalog is a 404');

  assert.equal((await api('POST', '/v1/trial', { body: { plugin_id: 'diagnose-by-sound', email: 'shop@example.com' } })).status, 404);
  ok('there is no trial endpoint');

  // ---- webhook issues the key --------------------------------------------
  const dbsCheckout = completeCheckout('evt_dbs_1', {
    id: 'cs_dbs_1', customer: 'cus_dbs_1', subscription: 'sub_dbs_1',
    customer_details: { email: 'owner@example.com' },
    metadata: { plugin_id: 'diagnose-by-sound', plan: 'pro' },
  });

  const badSig = await api('POST', '/v1/stripe/webhook', { raw: dbsCheckout.payload, headers: { 'stripe-signature': 't=1,v1=deadbeef' } });
  assert.equal(badSig.status, 400);
  ok('a bad webhook signature is rejected');

  assert.equal((await api('POST', '/v1/stripe/webhook', { raw: dbsCheckout.payload, headers: dbsCheckout.headers })).status, 200);
  const replayed = (await api('POST', '/v1/stripe/webhook', { raw: dbsCheckout.payload, headers: dbsCheckout.headers })).data;
  assert.equal(replayed.deduplicated, true);
  ok('a signed checkout.session.completed lands once and replays are ignored');

  const success = await api('GET', '/success?session_id=cs_dbs_1');
  const key = /PS-DBS(?:-[A-Z2-9]+){4}/.exec(success.data)?.[0];
  assert.ok(key, 'success page shows the issued key');
  ok('the success page shows the new pro licence key');

  // ---- entitlement + seats ------------------------------------------------
  const ent = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a', { key })).data;
  assert.equal(ent.active, true);
  assert.equal(ent.status, 'active');
  assert.equal(ent.plan, 'pro');
  assert.deepEqual(ent.features, ['diagnose', 'repair_plan', 'history']);
  assert.equal(ent.limits.diagnoses_per_month, -1);
  assert.equal(ent.seats.limit, 2);
  assert.equal(ent.seats.used, 1);
  ok('the pro entitlement is active and registers the first device');

  const secondSeat = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-b', { key })).data;
  assert.equal(secondSeat.active, true);
  const thirdSeat = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-c', { key })).data;
  assert.deepEqual(thirdSeat, { active: false, reason: 'seat_limit_reached' });
  ok('a third device on a 2-seat pro plan is refused');

  const wrongPlugin = (await api('GET', '/v1/entitlement?plugin_id=ghost-post-preview&device_id=device-a', { key })).data;
  assert.deepEqual(wrongPlugin, { active: false, reason: 'wrong_plugin' });
  ok('the key is scoped to its plugin');

  assert.equal((await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound', { key: 'PS-DBS-AAAAA-BBBBB-CCCCC-DDDD' })).data.reason, 'unknown_license');
  assert.equal((await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound', { key: 'garbage' })).data.reason, 'malformed_license');
  ok('unknown and malformed keys are told apart');

  // ---- usage metering -----------------------------------------------------
  const use = (idem) => api('POST', '/v1/usage', { key, body: { plugin_id: 'diagnose-by-sound', meter: 'diagnoses_per_month', quantity: 1, idempotency_key: idem } });
  assert.equal((await use('u-1')).data.used, 1);
  assert.equal((await use('u-2')).data.used, 2);
  const replay = (await use('u-2')).data;
  assert.equal(replay.deduplicated, true);
  const after = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a', { key })).data;
  assert.equal(after.usage.diagnoses_per_month, 2);
  ok('usage is metered, idempotent on replay, and visible in the entitlement');

  // ---- activation ---------------------------------------------------------
  const activate = (await api('POST', '/v1/license/activate', { body: {
    license_key: key.toLowerCase(), plugin_id: 'diagnose-by-sound', device_id: 'device-a', device_label: 'shop pc',
  } })).data;
  assert.equal(activate.activated, true);
  assert.equal(activate.plan, 'pro');
  ok('activate accepts the key case-insensitively and reports the plan');

  // ---- checkout -----------------------------------------------------------
  const checkout = (await api('POST', '/v1/checkout', { body: { plugin_id: 'diagnose-by-sound', plan: 'pro', email: 'owner@example.com' } })).data;
  assert.equal(checkout.checkout_url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  const stripeCall = stripeCalls.find((c) => c.path === '/v1/checkout/sessions');
  assert.match(stripeCall.body, /line_items%5B0%5D%5Bprice%5D=price_pro_mock/);
  assert.match(stripeCall.body, /metadata%5Bplugin_id%5D=diagnose-by-sound/);
  ok('checkout creates a Stripe session with the pro price and metadata');

  assert.equal((await api('POST', '/v1/checkout', { body: { plugin_id: 'diagnose-by-sound', plan: 'enterprise' } })).status, 404);
  ok('unknown plan is refused');

  // ---- second plugin: ghost-post-preview ---------------------------------
  const gppCatalog = (await api('GET', '/v1/catalog/ghost-post-preview')).data;
  assert.equal(gppCatalog.name, 'Ghost Post Preview');
  assert.equal(gppCatalog.plans.find((p) => p.id === 'pro').price, 4000);
  assert.equal(gppCatalog.plans.find((p) => p.id === 'team').price, 7000);
  const gppCheckout = completeCheckout('evt_gpp_1', {
    id: 'cs_gpp_1', customer: 'cus_gpp_1', subscription: 'sub_gpp_1',
    customer_details: { email: 'shop@example.com' },
    metadata: { plugin_id: 'ghost-post-preview', plan: 'pro' },
  });
  assert.equal((await api('POST', '/v1/stripe/webhook', { raw: gppCheckout.payload, headers: gppCheckout.headers })).status, 200);
  const gppSuccess = await api('GET', '/success?session_id=cs_gpp_1');
  const gppKey = /PS-GPP(?:-[A-Z2-9]+){4}/.exec(gppSuccess.data)?.[0];
  assert.ok(gppKey, 'success page shows the issued GPP key');
  const gppEnt = (await api('GET', '/v1/entitlement?plugin_id=ghost-post-preview&device_id=device-a', { key: gppKey })).data;
  assert.equal(gppEnt.active, true);
  assert.deepEqual(gppEnt.features, ['lint', 'history']);
  const crossPlugin = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a', { key: gppKey })).data;
  assert.deepEqual(crossPlugin, { active: false, reason: 'wrong_plugin' });
  ok('ghost-post-preview has its own catalog, webhook-issued keys, and plugin-scoped licences');

  // ---- portal -------------------------------------------------------------
  const portal = (await api('POST', '/v1/portal', { body: { license_key: key } })).data;
  assert.equal(portal.portal_url, 'https://billing.stripe.com/p/session/bps_test_1');
  ok('portal opens a Stripe billing portal session for a licence');

  // ---- cancellation -------------------------------------------------------
  const deleted = JSON.stringify({ id: 'evt_dbs_2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_dbs_1' } } });
  await api('POST', '/v1/stripe/webhook', { raw: deleted, headers: { 'stripe-signature': signWebhookPayload(deleted, WEBHOOK_SECRET) } });
  const cancelled = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a', { key })).data;
  assert.deepEqual(cancelled, { active: false, reason: 'inactive' });
  ok('subscription.deleted deactivates the licence');

  // ---- CORS for the storefront -------------------------------------------
  const SITE = 'https://www.codestudioplugin.com';
  const preflight = await fetch(`${BASE}/v1/checkout`, {
    method: 'OPTIONS',
    headers: { origin: SITE, 'access-control-request-method': 'POST' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), SITE);
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);

  const corsGet = await fetch(`${BASE}/v1/catalog/diagnose-by-sound`, { headers: { origin: SITE } });
  assert.equal(corsGet.headers.get('access-control-allow-origin'), SITE);

  const strangerGet = await fetch(`${BASE}/v1/catalog/diagnose-by-sound`, { headers: { origin: 'https://evil.example' } });
  assert.equal(strangerGet.headers.get('access-control-allow-origin'), null);
  ok('CORS allows the storefront origins and nobody else');

  // ---- stripe provisioning script ----------------------------------------
  const setupScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'setup-stripe.mjs');
  const envFile = path.join(tmpDir, 'provision.env');
  const runSetup = () => new Promise((resolve) => {
    const proc = spawn(process.execPath, [setupScript], {
      env: {
        ...process.env,
        STRIPE_API_BASE: `http://127.0.0.1:${stripePort}`,
        STRIPE_SECRET_KEY: 'sk_test_mock',
        BILLING_PUBLIC_URL: 'https://billing.example.test',
        BILLING_ENV_FILE: envFile,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { out += d; });
    proc.on('close', (code) => resolve({ code, out }));
  });

  const first = await runSetup();
  assert.equal(first.code, 0, first.out);
  const provisioned = fs.readFileSync(envFile, 'utf8');
  assert.match(provisioned, /STRIPE_PRICE_DBS_PRO=price_mock_\d+/);
  assert.match(provisioned, /STRIPE_PRICE_DBS_TEAM=price_mock_\d+/);
  assert.match(provisioned, /STRIPE_PRICE_GPP_PRO=price_mock_\d+/);
  assert.match(provisioned, /STRIPE_PRICE_GPP_TEAM=price_mock_\d+/);
  assert.match(provisioned, /STRIPE_WEBHOOK_SECRET=whsec_mock_created/);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'dbs_pro')?.unit_amount, 4000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'dbs_team')?.unit_amount, 7000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'gpp_pro')?.unit_amount, 4000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'gpp_team')?.unit_amount, 7000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'hfm_pro')?.unit_amount, 50000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'css_team')?.unit_amount, 200000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'pra_team')?.unit_amount, 200000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'pmr_pro')?.unit_amount, 4000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'wbc_team')?.unit_amount, 7000);
  assert.equal(stripeState.prices.length, 28);
  assert.equal(stripeState.webhooks[0].url, 'https://billing.example.test/v1/stripe/webhook');
  ok('setup-stripe provisions both plugins’ products, $40/$70 prices, webhook, and the env file');

  const pricesBefore = stripeState.prices.length;
  const webhooksBefore = stripeState.webhooks.length;
  const second = await runSetup();
  assert.equal(second.code, 0, second.out);
  assert.equal(stripeState.prices.length, pricesBefore);
  assert.equal(stripeState.webhooks.length, webhooksBefore);
  assert.match(second.out, /already correct/);
  ok('re-running setup-stripe creates nothing new');

  console.log(`\n${passed} billing checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  console.error(serverLog);
  process.exitCode = 1;
} finally {
  child.kill();
  mockStripe.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
