import crypto from 'node:crypto';

/**
 * Direct Stripe REST calls — no SDK, in keeping with the suite's
 * no-dependency rule. STRIPE_API_BASE is overridable so tests can point at
 * a local mock; production leaves it unset.
 */

const apiBase = () => (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');

/** Stripe takes form-encoded bodies with bracket notation for nesting. */
export function formEncode(params, prefix = '') {
  const pairs = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') pairs.push(formEncode(value, name));
    else pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  return pairs.filter(Boolean).join('&');
}

async function stripeRequest(method, endpoint, params = null) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const err = new Error('STRIPE_SECRET_KEY is not configured on the billing service.');
    err.code = 'stripe_not_configured';
    throw err;
  }
  let response;
  try {
    response = await fetch(`${apiBase()}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params ? formEncode(params) : undefined,
    });
  } catch (networkErr) {
    // fetch() failing means we never reached Stripe at all — DNS, TLS, a
    // proxy in between. That error's message can name internal hosts and
    // must never reach the public caller; only Stripe's own JSON error
    // (below) is written to be shown to a user.
    console.error('[billing] Stripe request failed before a response arrived', method, endpoint, networkErr);
    const err = new Error('Could not reach Stripe.');
    err.code = 'stripe_unreachable';
    throw err;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error?.message || `Stripe returned HTTP ${response.status}.`);
    err.code = data.error?.code || 'stripe_error';
    throw err;
  }
  return data;
}

export function createCheckoutSession({ priceId, pluginId, planId, email, publicUrl }) {
  return stripeRequest('POST', '/v1/checkout/sessions', {
    mode: 'subscription',
    line_items: { 0: { price: priceId, quantity: 1 } },
    success_url: `${publicUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${publicUrl}/cancelled`,
    customer_email: email,
    metadata: { plugin_id: pluginId, plan: planId },
    subscription_data: { metadata: { plugin_id: pluginId, plan: planId } },
  });
}

export function createPortalSession({ customerId, publicUrl }) {
  return stripeRequest('POST', '/v1/billing_portal/sessions', {
    customer: customerId,
    return_url: publicUrl,
  });
}

// ---- webhook signatures ---------------------------------------------------

const SIGNATURE_TOLERANCE_S = 300;

/**
 * Stripe's signing scheme: header `t=<unix>,v1=<hmac>,v1=<hmac>,...` — one
 * v1 per currently-active signing secret, since Stripe signs with all of
 * them during a rotation — where each hmac is HMAC-SHA256 of
 * `<t>.<raw body>` under that secret.
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret, now = Date.now()) {
  if (!signatureHeader || !secret) return false;

  let timestamp = null;
  const signatures = [];
  for (const part of signatureHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 't') timestamp = Number(value);
    else if (key === 'v1') signatures.push(value);
  }
  if (!timestamp || Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) return false;

  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'));
  return signatures.some((sig) => {
    // Byte length, not string length: a v1 value with multibyte characters
    // (malformed, or simply attacker-supplied garbage) can have a UTF-16
    // string length equal to expected's while its UTF-8 byte length differs
    // — and timingSafeEqual throws on unequal-length buffers rather than
    // returning false, turning a bad signature into a 500 instead of a 400.
    const given = Buffer.from(sig);
    return given.length === expected.length && crypto.timingSafeEqual(expected, given);
  });
}

/** Produce a valid header for tests. */
export function signWebhookPayload(rawBody, secret, now = Date.now()) {
  const t = Math.floor(now / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}
