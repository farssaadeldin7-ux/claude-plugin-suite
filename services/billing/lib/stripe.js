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
  const response = await fetch(`${apiBase()}${endpoint}`, {
    method,
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params ? formEncode(params) : undefined,
  });
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
 * Stripe's signing scheme: header `t=<unix>,v1=<hmac>` where the hmac is
 * HMAC-SHA256 of `<t>.<raw body>` under the endpoint secret.
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret, now = Date.now()) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=', 2)).filter((p) => p.length === 2)
  );
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const given = parts.v1 ?? '';
  return given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/** Produce a valid header for tests. */
export function signWebhookPayload(rawBody, secret, now = Date.now()) {
  const t = Math.floor(now / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}
