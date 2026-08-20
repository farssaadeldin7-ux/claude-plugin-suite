#!/usr/bin/env node
/**
 * The suite's billing service: one deployment covers all fourteen plugins.
 *
 * Implements exactly the API the vendored license-client speaks —
 *
 *   GET  /v1/entitlement?plugin_id&device_id     Bearer <license key>
 *   POST /v1/usage                               Bearer <license key>
 *   POST /v1/license/activate
 *   POST /v1/checkout
 *   POST /v1/trial
 *   GET  /v1/catalog/:plugin_id
 *   POST /v1/portal
 *
 * — plus the Stripe webhook that turns a completed Checkout into a licence
 * key, a success page that shows the key once, and /health.
 *
 * No npm dependencies: node:http and fetch, same rule as the plugins.
 */

import http from 'node:http';
import path from 'node:path';
import { Store } from './lib/store.js';
import { plan as planFor, publicCatalog } from './catalog.js';
import {
  issueLicense, entitlementFor, recordUsage, usageFor, looksLikeKey, currentPeriod,
} from './lib/licenses.js';
import { createCheckoutSession, createPortalSession, verifyWebhookSignature } from './lib/stripe.js';

const PORT = Number(process.env.PORT || 8787);
const PUBLIC_URL = (process.env.BILLING_PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const STORE_FILE = process.env.BILLING_STORE_FILE
  || path.join(import.meta.dirname, 'data', 'store.json');

const store = new Store(STORE_FILE);

// ---- helpers ---------------------------------------------------------------

const json = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
};

const html = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
};

const fail = (res, status, error, message) => json(res, status, { error, message });

const bearerKey = (req) => {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
  return match ? match[1].trim().toUpperCase() : null;
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 64 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ---- routes ----------------------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, PUBLIC_URL);
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /health') {
    return json(res, 200, { ok: true, service: 'plugin-suite-billing' });
  }

  if (route === 'GET /v1/entitlement') {
    const entitlement = entitlementFor(store, {
      key: bearerKey(req),
      pluginId: url.searchParams.get('plugin_id'),
      deviceId: url.searchParams.get('device_id'),
    });
    return json(res, 200, entitlement);
  }

  if (route === 'POST /v1/usage') {
    const key = bearerKey(req);
    const body = JSON.parse(await readBody(req) || '{}');
    const license = key && looksLikeKey(key) ? store.getLicense(key) : null;
    if (!license) return fail(res, 401, 'unknown_license', 'No licence matches this key.');
    if (!body.meter) return fail(res, 400, 'invalid_request', 'A meter name is required.');
    if (!store.claimEvent(`usage:${body.idempotency_key}`)) {
      return json(res, 200, { recorded: true, deduplicated: true, used: usageFor(license)[body.meter] ?? 0 });
    }
    const used = recordUsage(store, license, body.meter, Number(body.quantity) || 1);
    return json(res, 200, { recorded: true, meter: body.meter, period: currentPeriod(), used });
  }

  if (route === 'POST /v1/license/activate') {
    const body = JSON.parse(await readBody(req) || '{}');
    const key = String(body.license_key ?? '').trim().toUpperCase();
    const entitlement = entitlementFor(store, {
      key,
      pluginId: body.plugin_id,
      deviceId: body.device_id,
      deviceLabel: body.device_label,
    });
    if (!entitlement.active) {
      return fail(res, 403, entitlement.reason, 'This key could not be activated on this device.');
    }
    return json(res, 200, { activated: true, plan: entitlement.plan, features: entitlement.features, seats: entitlement.seats });
  }

  if (route === 'GET /v1/catalog' || /^GET \/v1\/catalog\/[\w-]+$/.test(route)) {
    const pluginId = url.pathname.split('/').pop();
    const catalog = publicCatalog(pluginId);
    if (!catalog) return fail(res, 404, 'unknown_plugin', `No catalog for "${pluginId}".`);
    return json(res, 200, catalog);
  }

  if (route === 'POST /v1/trial') {
    const body = JSON.parse(await readBody(req) || '{}');
    const { plugin_id: pluginId, email } = body;
    const planDef = planFor(pluginId, 'trial');
    if (!planDef) return fail(res, 404, 'unknown_plugin', `No trial plan for "${pluginId}".`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) {
      return fail(res, 400, 'invalid_request', 'A valid email address is required for a trial.');
    }
    if (store.trialUsed(pluginId, email)) {
      return fail(res, 409, 'trial_already_used', 'A trial for this plugin has already been issued to this email address.');
    }
    const license = issueLicense(store, { pluginId, planId: 'trial', email });
    store.markTrial(pluginId, email, license.key);
    return json(res, 200, {
      license_key: license.key,
      plan: license.plan,
      features: license.features,
      limits: license.limits,
      expires: license.period_end,
    });
  }

  if (route === 'POST /v1/checkout') {
    const body = JSON.parse(await readBody(req) || '{}');
    const { plugin_id: pluginId, plan: planId, email } = body;
    const planDef = planFor(pluginId, planId);
    if (!planDef) return fail(res, 404, 'unknown_plan', `No plan "${planId}" for "${pluginId}".`);
    if (!planDef.price) return fail(res, 400, 'invalid_request', 'This plan is not bought through checkout — use the trial endpoint.');
    const priceId = process.env[planDef.stripe_price_env];
    if (!priceId) return fail(res, 503, 'plan_not_configured', `The Stripe price for "${planId}" is not configured yet.`);
    try {
      const session = await createCheckoutSession({ priceId, pluginId, planId, email, publicUrl: PUBLIC_URL });
      return json(res, 200, { checkout_url: session.url });
    } catch (err) {
      return fail(res, 502, err.code ?? 'stripe_error', err.message);
    }
  }

  if (route === 'POST /v1/portal') {
    const body = JSON.parse(await readBody(req) || '{}');
    const key = String(body.license_key ?? '').trim().toUpperCase();
    const license = looksLikeKey(key) ? store.getLicense(key) : null;
    if (!license) return fail(res, 404, 'unknown_license', 'No licence matches this key.');
    if (!license.stripe?.customer_id) {
      return fail(res, 400, 'no_billing_account', 'This licence has no Stripe subscription behind it (trials do not).');
    }
    try {
      const session = await createPortalSession({ customerId: license.stripe.customer_id, publicUrl: PUBLIC_URL });
      return json(res, 200, { portal_url: session.url });
    } catch (err) {
      return fail(res, 502, err.code ?? 'stripe_error', err.message);
    }
  }

  if (route === 'POST /v1/stripe/webhook') {
    const raw = await readBody(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!verifyWebhookSignature(raw, req.headers['stripe-signature'], secret)) {
      return fail(res, 400, 'bad_signature', 'Webhook signature verification failed.');
    }
    const event = JSON.parse(raw);
    if (!store.claimEvent(event.id)) {
      return json(res, 200, { received: true, deduplicated: true });
    }
    handleStripeEvent(event);
    return json(res, 200, { received: true });
  }

  if (route === 'GET /success') {
    const sessionId = url.searchParams.get('session_id');
    const license = sessionId && store.findLicense((l) => l.checkout_session_id === sessionId);
    if (!license) {
      return html(res, 404, '<h1>Almost there</h1><p>Payment received but the licence is still being issued — refresh in a few seconds.</p>');
    }
    return html(res, 200,
      '<h1>Your licence key</h1>' +
      `<p><code style="font-size:1.4em">${escapeHtml(license.key)}</code></p>` +
      '<p>This key is shown only here. Paste it into the plugin with the <code>license_activate</code> tool.</p>');
  }

  if (route === 'GET /cancelled') {
    return html(res, 200, '<h1>Checkout cancelled</h1><p>No charge was made. Close this tab and start again whenever you like.</p>');
  }

  return fail(res, 404, 'not_found', `No route for ${route}.`);
}

function handleStripeEvent(event) {
  const object = event.data?.object ?? {};
  switch (event.type) {
    case 'checkout.session.completed': {
      const { plugin_id: pluginId, plan: planId } = object.metadata ?? {};
      if (!planFor(pluginId, planId)) return;
      issueLicense(store, {
        pluginId,
        planId,
        email: object.customer_details?.email ?? object.customer_email ?? null,
        stripe: { customer_id: object.customer, subscription_id: object.subscription },
        checkoutSessionId: object.id,
      });
      return;
    }
    case 'customer.subscription.updated': {
      const license = store.findLicense((l) => l.stripe?.subscription_id === object.id);
      if (!license) return;
      license.status = object.status === 'active' || object.status === 'trialing' ? 'active' : object.status;
      license.period_end = object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : license.period_end;
      license.cancel_at_period_end = Boolean(object.cancel_at_period_end);
      store.putLicense(license);
      return;
    }
    case 'customer.subscription.deleted': {
      const license = store.findLicense((l) => l.stripe?.subscription_id === object.id);
      if (!license) return;
      license.status = 'canceled';
      store.putLicense(license);
      return;
    }
    default:
      // Other events are acknowledged and ignored.
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    // Never leak internals to a caller; the detail goes to the service log.
    console.error('[billing]', err);
    fail(res, 500, 'internal_error', 'The billing service hit an unexpected error.');
  });
});

server.listen(PORT, () => {
  console.error(`[billing] listening on ${PORT}, store at ${STORE_FILE}`);
});
