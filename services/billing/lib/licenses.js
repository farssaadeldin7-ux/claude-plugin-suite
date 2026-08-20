import crypto from 'node:crypto';
import { plan as planFor, plugin as pluginFor } from '../catalog.js';

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
 * paid plans; trials have none and expire on period_end instead.
 */
export function issueLicense(store, { pluginId, planId, email, stripe = null, checkoutSessionId = null, now = Date.now() }) {
  const entry = pluginFor(pluginId);
  const planDef = planFor(pluginId, planId);
  if (!entry || !planDef) return null;

  const license = {
    key: generateKey(entry.code),
    plugin_id: pluginId,
    plan: planId,
    status: planDef.trial_days ? 'trialing' : 'active',
    email: email ?? null,
    features: planDef.features,
    limits: planDef.limits,
    seats: { limit: planDef.seats, devices: [] },
    usage: {},
    period_end: planDef.trial_days ? new Date(now + planDef.trial_days * 86400000).toISOString() : null,
    cancel_at_period_end: false,
    stripe: stripe,
    checkout_session_id: checkoutSessionId,
    created_at: new Date(now).toISOString(),
  };
  return store.putLicense(license);
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

export function recordUsage(store, license, meter, quantity, now = Date.now()) {
  const period = currentPeriod(now);
  license.usage[meter] ??= {};
  license.usage[meter][period] = (license.usage[meter][period] ?? 0) + quantity;
  store.putLicense(license);
  return license.usage[meter][period];
}

/**
 * The entitlement decision, in the shape the suite's license-client expects.
 * Registers the calling device against a seat when one is free.
 */
export function entitlementFor(store, { key, pluginId, deviceId, deviceLabel = null, now = Date.now() }) {
  if (!key || !looksLikeKey(key)) return { active: false, reason: 'malformed_license' };

  const license = store.getLicense(key);
  if (!license) return { active: false, reason: 'unknown_license' };
  if (pluginId && license.plugin_id !== pluginId) return { active: false, reason: 'wrong_plugin' };

  if (['canceled', 'inactive', 'past_due'].includes(license.status)) {
    return { active: false, reason: 'inactive' };
  }
  if (license.status === 'trialing' && license.period_end && now > Date.parse(license.period_end)) {
    return { active: false, reason: 'expired' };
  }

  if (deviceId) {
    const registered = license.seats.devices.some((d) => d.id === deviceId);
    if (!registered) {
      if (license.seats.devices.length >= license.seats.limit) {
        return { active: false, reason: 'seat_limit_reached' };
      }
      license.seats.devices.push({ id: deviceId, label: deviceLabel, activated_at: new Date(now).toISOString() });
      store.putLicense(license);
    }
  }

  return {
    active: true,
    plan: license.plan,
    status: license.status,
    features: license.features,
    limits: license.limits,
    usage: usageFor(license, now),
    seats: { limit: license.seats.limit, used: license.seats.devices.length },
    periodEnd: license.period_end,
    cancelAtPeriodEnd: license.cancel_at_period_end,
  };
}
