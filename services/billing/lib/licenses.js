import crypto from 'node:crypto';
import { plan as planFor, plugin as pluginFor, outwardLimits } from '../catalog.js';

/** Charset avoids 0/O and 1/I so keys survive being read out over the phone. */
const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const group = (length) => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += KEY_CHARS[bytes[i] % KEY_CHARS.length];
  return out;
};

export function generateKey(pluginCode) {
  return `PS-${pluginCode}-${group(5)}-${group(5)}-${group(5)}-${group(4)}`;
}

export function looksLikeKey(key) {
  return /^PS(-[A-Z0-9]{2,6})?(-[A-Z0-9]{4,6}){3,4}$/.test(key);
}

export function currentPeriod(now = Date.now()) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Issue a licence for a plan. `stripe` carries customer/subscription ids for
 * paid plans, which carry the subscription's customer and id.
 *
 * `eventId`, when given, is claimed in the same write as the licence (see
 * Store.putLicenseAndClaim) so the issuance and the claim can never come
 * apart on a failed save.
 */
export function issueLicense(store, { pluginId, planId, email, stripe = null, checkoutSessionId = null, eventId = null, now = Date.now() }) {
  const entry = pluginFor(pluginId);
  const planDef = planFor(pluginId, planId);
  if (!entry || !planDef) return null;

  const license = {
    key: generateKey(entry.code),
    plugin_id: pluginId,
    plan: planId,
    status: 'active',
    email: email ?? null,
    features: planDef.features,
    limits: planDef.limits,
    seats: { limit: planDef.seats, devices: [] },
    usage: {},
    period_end: null,
    cancel_at_period_end: false,
    stripe: stripe,
    checkout_session_id: checkoutSessionId,
    created_at: new Date(now).toISOString(),
  };
  return eventId ? store.putLicenseAndClaim(license, eventId) : store.putLicense(license);
}

/** Usage for the current period only, flattened to {meter: used}. */
export function usageFor(license, now = Date.now()) {
  const period = currentPeriod(now);
  const out = {};
  for (const [meter, byPeriod] of Object.entries(license.usage ?? {})) {
    out[meter] = byPeriod[period] ?? 0;
  }
  return out;
}

/**
 * `eventId`, when given, is claimed in the same write as the usage
 * increment (see Store.putLicenseAndClaim). Unlike issueLicense, this
 * function has no secondary guard against reapplying the same increment —
 * a caller-supplied idempotency key is the only thing that can ever
 * dedupe a retry, so its claim must never be separated from this write.
 */
export function recordUsage(store, license, meter, quantity, eventId = null, now = Date.now()) {
  const period = currentPeriod(now);
  license.usage[meter] ??= {};
  license.usage[meter][period] = (license.usage[meter][period] ?? 0) + quantity;
  if (eventId) store.putLicenseAndClaim(license, eventId);
  else store.putLicense(license);
  return license.usage[meter][period];
}

/**
 * The entitlement decision, in the shape the suite's license-client expects.
 * Registers the calling device against a seat when one is free and `register`
 * is true (the default) — set it false for a check that must never itself be
 * the thing that spends a seat, e.g. `license_status`, which promises to only
 * report, or a caller probing before it has decided to actually proceed.
 */
export function entitlementFor(store, { key, pluginId, deviceId, deviceLabel = null, now = Date.now(), register = true }) {
  if (!key || !looksLikeKey(key)) return { active: false, reason: 'malformed_license' };

  const license = store.getLicense(key);
  if (!license) return { active: false, reason: 'unknown_license' };
  if (pluginId && license.plugin_id !== pluginId) return { active: false, reason: 'wrong_plugin' };

  // Allow-list, deliberately: 'active' is the one status a subscription
  // normalises to on success (see customer.subscription.updated in
  // server.js). Everything else — past_due, unpaid, incomplete,
  // incomplete_expired, paused, canceled, or a Stripe status this service
  // has never seen yet — must fall through to denied by default, not the
  // other way round.
  if (license.status !== 'active') {
    return { active: false, reason: 'inactive' };
  }
  // The seat ceiling used to live entirely inside `if (deviceId)`, so a
  // caller that simply omitted device_id was never measured against it and
  // got a fully active entitlement on a licence whose seats were all taken.
  // Seats are the paid differentiator between pro and team across the whole
  // catalog, so an unidentified caller is checked against the ceiling too:
  // it cannot be shown to occupy one of the seats already spoken for.
  const registered = deviceId !== undefined && deviceId !== null
    && license.seats.devices.some((d) => d.id === deviceId);
  if (!registered) {
    if (license.seats.devices.length >= license.seats.limit) {
      return { active: false, reason: 'seat_limit_reached' };
    }
    if (deviceId && register) {
      license.seats.devices.push({ id: deviceId, label: deviceLabel, activated_at: new Date(now).toISOString() });
      store.putLicense(license);
    }
  }

  return {
    active: true,
    plan: license.plan,
    status: license.status,
    features: license.features,
    limits: outwardLimits(license.limits),
    usage: usageFor(license, now),
    seats: { limit: license.seats.limit, used: license.seats.devices.length },
    periodEnd: license.period_end,
    cancelAtPeriodEnd: license.cancel_at_period_end,
  };
}
