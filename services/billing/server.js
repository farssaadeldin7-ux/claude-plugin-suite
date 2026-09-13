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
import { CATALOG, plan as planFor, publicCatalog } from './catalog.js';
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

/** A page carrying a licence key gets the headers that page deserves. */
const html = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
  });
  res.end(`<!doctype html>\n${body}`);
};

const fail = (res, status, error, message) => json(res, status, { error, message });

const bearerKey = (req) => {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
  return match ? match[1].trim().toUpperCase() : null;
};

const readBody = (req, maxBytes = 64 * 1024) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  req.on('data', (chunk) => {
    if (tooLarge) return;
    size += chunk.length;
    if (size > maxBytes) {
      // Stop buffering, but never destroy the socket here: req and res share
      // one connection, and a destroyed req can't carry a 413 back on res.
      tooLarge = true;
      const err = new Error('Request body too large.');
      err.status = 413;
      reject(err);
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => { if (!tooLarge) resolve(Buffer.concat(chunks).toString('utf8')); });
  req.on('error', reject);
});

// A real Stripe invoice-heavy event can run well past a small control-plane
// request; the webhook route gets its own, larger budget (see its handler).
const WEBHOOK_BODY_LIMIT = 1024 * 1024;

/** JSON.parse that fails as a clean 400 instead of an uncaught 500. */
const readJsonBody = async (req) => {
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Request body is not valid JSON.');
    err.status = 400;
    err.code = 'invalid_json';
    throw err;
  }
};

// __proto__ already fails the pattern (leading underscore); constructor and
// prototype would not, and are exactly as able to reach a shared object's
// internals as __proto__ is, so they're excluded explicitly.
const SAFE_METER_PATTERN = /^[a-z][a-z0-9_]*$/;
const UNSAFE_METER_NAMES = new Set(['constructor', 'prototype', '__proto__']);
const isSafeMeter = (meter) => typeof meter === 'string' && SAFE_METER_PATTERN.test(meter) && !UNSAFE_METER_NAMES.has(meter);

// Loose on purpose (an exact RFC 5322 check rejects real addresses); this is
// only to stop garbage and oversized values from reaching Stripe unchecked.
const looksLikeEmail = (email) => typeof email === 'string' && email.length <= 254 && /^\S+@\S+\.\S+$/.test(email);
// The client derives this as a 32-char hex hash; a bound, safe-charset check
// stops a caller from storing arbitrary blobs against a licence's seat list.
const isSafeDeviceId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(id);
const MAX_USAGE_QUANTITY = 100_000;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ---- CORS ------------------------------------------------------------------

/**
 * Browser storefronts (the pricing page on the marketing site) call
 * /v1/checkout and /v1/catalog directly, so their origins must be
 * allowed explicitly. Comma-separated in BILLING_ALLOWED_ORIGINS, e.g.
 * "https://www.codestudioplugin.com,https://codestudioplugin.com".
 */
const ALLOWED_ORIGINS = (process.env.BILLING_ALLOWED_ORIGINS ?? '')
  .split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return;
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-max-age', '86400');
}

// ---- routes ----------------------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, PUBLIC_URL);
  const route = `${req.method} ${url.pathname}`;

  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (route === 'GET /health') {
    return json(res, 200, { ok: true, service: 'plugin-suite-billing' });
  }

  if (route === 'GET /v1/entitlement') {
    const deviceId = url.searchParams.get('device_id');
    if (deviceId !== null && !isSafeDeviceId(deviceId)) {
      return fail(res, 400, 'invalid_request', 'device_id is malformed.');
    }
    const entitlement = entitlementFor(store, {
      key: bearerKey(req),
      pluginId: url.searchParams.get('plugin_id'),
      deviceId,
      // license_status calls this with peek=true: a status check must never
      // itself be the thing that spends a seat on an unregistered device.
      register: url.searchParams.get('peek') !== 'true',
    });
    return json(res, 200, entitlement);
  }

  if (route === 'POST /v1/usage') {
    const key = bearerKey(req);
    const body = await readJsonBody(req);
    const license = key && looksLikeKey(key) ? store.getLicense(key) : null;
    if (!license) return fail(res, 401, 'unknown_license', 'No licence matches this key.');
    if (!isSafeMeter(body.meter)) {
      return fail(res, 400, 'invalid_request', 'A valid meter name is required.');
    }
    if (body.plugin_id && body.plugin_id !== license.plugin_id) {
      return fail(res, 403, 'wrong_plugin', 'This licence is not for the plugin named in the request.');
    }
    if (typeof body.idempotency_key !== 'string' || !body.idempotency_key) {
      return fail(res, 400, 'invalid_request', 'An idempotency_key is required.');
    }
    const quantity = body.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_USAGE_QUANTITY) {
      return fail(res, 400, 'invalid_request', `quantity must be an integer between 1 and ${MAX_USAGE_QUANTITY}.`);
    }
    // Scoped by licence key: two different customers omitting or colliding
    // on the same idempotency_key must never dedupe against each other.
    const usageEventId = `usage:${license.key}:${body.idempotency_key}`;
    if (store.isEventClaimed(usageEventId)) {
      return json(res, 200, {
        recorded: true, deduplicated: true, meter: body.meter, period: currentPeriod(), used: usageFor(license)[body.meter] ?? 0,
      });
    }
    const used = recordUsage(store, license, body.meter, quantity);
    store.claimEvent(usageEventId);
    return json(res, 200, { recorded: true, meter: body.meter, period: currentPeriod(), used });
  }

  if (route === 'POST /v1/license/activate') {
    const body = await readJsonBody(req);
    const key = String(body.license_key ?? '').trim().toUpperCase();
    if (body.device_id !== undefined && !isSafeDeviceId(body.device_id)) {
      return fail(res, 400, 'invalid_request', 'device_id is malformed.');
    }
    const entitlement = entitlementFor(store, {
      key,
      pluginId: body.plugin_id,
      deviceId: body.device_id,
      deviceLabel: body.device_label,
    });
    if (!entitlement.active) {
      // One generic code for every failure reason: echoing entitlement.reason
      // here would let a caller distinguish "no such key" from "right key,
      // wrong plugin" from "seats full" — an oracle for enumerating which
      // keys actually exist. The reason is still there in the log.
      console.error('[billing] activation denied', key.slice(0, 6), entitlement.reason);
      return fail(res, 403, 'activation_failed', 'This key could not be activated on this device.');
    }
    return json(res, 200, { activated: true, plan: entitlement.plan, features: entitlement.features, seats: entitlement.seats });
  }

  if (route === 'GET /v1/catalog' || /^GET \/v1\/catalog\/[\w-]+$/.test(route)) {
    const pluginId = url.pathname.split('/').pop();
    const catalog = publicCatalog(pluginId);
    if (!catalog) return fail(res, 404, 'unknown_plugin', `No catalog for "${pluginId}".`);
    return json(res, 200, catalog);
  }

  if (route === 'POST /v1/checkout') {
    const body = await readJsonBody(req);
    const { plugin_id: pluginId, plan: planId, email } = body;
    const planDef = planFor(pluginId, planId);
    if (!planDef) return fail(res, 404, 'unknown_plan', `No plan "${planId}" for "${pluginId}".`);
    if (!planDef.price) return fail(res, 400, 'invalid_request', 'This plan is not purchasable.');
    if (email !== undefined && !looksLikeEmail(email)) {
      return fail(res, 400, 'invalid_request', 'email is not a valid email address.');
    }
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
    const body = await readJsonBody(req);
    const key = String(body.license_key ?? '').trim().toUpperCase();
    const license = looksLikeKey(key) ? store.getLicense(key) : null;
    if (!license) return fail(res, 404, 'unknown_license', 'No licence matches this key.');
    if (!license.stripe?.customer_id) {
      return fail(res, 400, 'no_billing_account', 'This licence has no Stripe subscription behind it.');
    }
    try {
      const session = await createPortalSession({ customerId: license.stripe.customer_id, publicUrl: PUBLIC_URL });
      return json(res, 200, { portal_url: session.url });
    } catch (err) {
      return fail(res, 502, err.code ?? 'stripe_error', err.message);
    }
  }

  if (route === 'POST /v1/stripe/webhook') {
    const raw = await readBody(req, WEBHOOK_BODY_LIMIT);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!verifyWebhookSignature(raw, req.headers['stripe-signature'], secret)) {
      return fail(res, 400, 'bad_signature', 'Webhook signature verification failed.');
    }
    const event = JSON.parse(raw);
    if (store.isEventClaimed(event.id)) {
      return json(res, 200, { received: true, deduplicated: true });
    }
    try {
      handleStripeEvent(event);
    } catch (err) {
      // Do NOT claim the event: it must look unhandled so Stripe's retry
      // gets a real second attempt instead of being deduplicated away.
      console.error('[billing] webhook handler failed, Stripe will retry', event.id, event.type, err);
      return fail(res, 500, 'webhook_handler_error', 'The webhook handler failed; Stripe will retry this event.');
    }
    store.claimEvent(event.id);
    return json(res, 200, { received: true });
  }

  if (route === 'GET /success') {
    // Never cached: this page holds a live licence key, and a proxy or
    // browser cache holding onto it would keep re-serving that key to
    // whoever's device asks next, long after this checkout is history.
    res.setHeader('cache-control', 'no-store');
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
      if (!planFor(pluginId, planId)) {
        console.error('[billing] checkout.session.completed named no sellable plan', event.id, object.id, { pluginId, planId });
        return;
      }
      // Event-id idempotency (above, in the caller) only catches Stripe
      // resending the identical delivery. A dashboard resend, or this event
      // being reprocessed after the process died between here and the claim
      // being recorded, arrives as a genuinely different event id for the
      // same session — so the session id, not the event id, is the thing
      // that must never issue a licence twice.
      if (store.findLicense((l) => l.checkout_session_id === object.id)) return;
      // For delayed-notification payment methods a session can complete
      // before payment actually lands; issuing here would hand out a
      // licence for money that was never received. checkout.session.async_
      // payment_succeeded (unhandled below, acknowledged and ignored) is
      // where that licence would need to be issued instead.
      if (object.payment_status && object.payment_status !== 'paid') return;
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
      if (!license) {
        console.error('[billing] customer.subscription.updated matches no licence', event.id, object.id);
        return;
      }
      license.status = object.status === 'active' || object.status === 'trialing' ? 'active' : object.status;
      license.period_end = object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : license.period_end;
      license.cancel_at_period_end = Boolean(object.cancel_at_period_end);
      store.putLicense(license);
      return;
    }
    case 'customer.subscription.deleted': {
      const license = store.findLicense((l) => l.stripe?.subscription_id === object.id);
      if (!license) {
        console.error('[billing] customer.subscription.deleted matches no licence', event.id, object.id);
        return;
      }
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
    // A request-shaped failure (oversized or malformed body) is the
    // caller's mistake, not ours, and safe to describe; anything else stays
    // generic, with the detail going to the service log instead.
    if (err.status) return fail(res, err.status, err.code ?? 'bad_request', err.message);
    console.error('[billing]', err);
    fail(res, 500, 'internal_error', 'The billing service hit an unexpected error.');
  });
});

server.listen(PORT, () => {
  console.error(`[billing] listening on ${PORT}, store at ${STORE_FILE}`);
  // Every plan whose STRIPE_PRICE_* env var is unset returns 503
  // plan_not_configured at checkout — say so at boot instead of at the sale.
  const missing = Object.values(CATALOG)
    .flatMap((plugin) => Object.values(plugin.plans).map((p) => p.stripe_price_env))
    .filter((env) => !process.env[env]);
  if (missing.length > 0) {
    console.error(`[billing] ${missing.length} plan(s) not purchasable — missing env: ${missing.join(', ')}`);
    console.error('[billing] run scripts/setup-stripe.mjs to provision them (see .env.example).');
  }
});

// Without this, a redeploy's SIGTERM cuts every in-flight request off mid-
// response — including a webhook whose handler had already run and was
// about to claim its event, which would otherwise look identical to the
// handler-failure case this service goes out of its way to protect against
// elsewhere. server.close() stops accepting new connections and lets
// in-flight ones finish naturally; the host's own kill timeout is the
// backstop if one never does.
process.on('SIGTERM', () => {
  console.error('[billing] SIGTERM received, finishing in-flight requests');
  server.close(() => process.exit(0));
});
