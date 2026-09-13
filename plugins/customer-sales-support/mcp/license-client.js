/**
 * Talks to the shared billing service. Vendored into every plugin in the suite
 * so a plugin has no npm dependencies of its own.
 *
 * Configuration, in order of precedence:
 *   1. <PLUGIN_ENV_PREFIX>_LICENSE_KEY   e.g. DIAGNOSE_BY_SOUND_LICENSE_KEY
 *   2. PLUGIN_SUITE_LICENSE_KEY          shared across the suite
 *   3. ~/.config/plugin-suite/<plugin-id>.json   written by license_activate
 *
 * The billing host comes from PLUGIN_SUITE_BILLING_URL, falling back to the
 * default baked in at build time.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ToolError } from './mcp-lite.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
// The placeholder every plugin ships with until scripts/bake-billing-url.mjs
// (or PLUGIN_SUITE_BILLING_URL) points it at a real, deployed billing host.
// A build that was never pointed anywhere real should say so plainly, not
// surface as an ordinary network failure that looks like a transient outage.
const PLACEHOLDER_BILLING_URL = 'https://billing.example.com';

// The finite, known vocabulary of error codes the billing service itself
// ever emits (services/billing/server.js's own fail() calls, plus the
// stripe_* codes it relays from lib/stripe.js). A server response outside
// this set — a proxy's own error page, a future server bug, anything not
// written by this codebase — must never be forwarded as-is: its code would
// be branched on as if this client understood it, and its message shown to
// a user as if it were meant to be read by one.
const KNOWN_SERVER_ERROR_CODES = new Set([
  'activation_failed', 'internal_error', 'invalid_request', 'no_billing_account',
  'not_found', 'plan_not_configured', 'unknown_license', 'unknown_plan', 'unknown_plugin',
  'wrong_plugin', 'stripe_error', 'stripe_not_configured', 'stripe_unreachable', 'invalid_json',
]);

/** A server error, only if it's shaped like one this codebase actually wrote. */
function safeServerError(data, fallbackCode, fallbackMessage) {
  if (data && KNOWN_SERVER_ERROR_CODES.has(data.error)) {
    return { code: data.error, message: typeof data.message === 'string' ? data.message : fallbackMessage, detail: data.detail };
  }
  return { code: fallbackCode, message: fallbackMessage, detail: undefined };
}

/** Hosts pass .mcp.json env through verbatim, so an unset variable can arrive as
 *  an empty string or a literal "${VAR}" — both count as absent. */
const envValue = (name) => {
  const value = process.env[name]?.trim();
  return value && !/^\$\{[^}]*\}$/.test(value) ? value : null;
};

export class LicenseClient {
  /**
   * @param {{pluginId: string, defaultBillingUrl: string, envPrefix?: string,
   *          freeTier?: {plan?: string, features?: string[], limits?: object}}} options
   */
  constructor({ pluginId, defaultBillingUrl, envPrefix, freeTier }) {
    this.pluginId = pluginId;
    this.envPrefix = envPrefix || pluginId.replace(/-/g, '_').toUpperCase();
    this.billingUrl = (envValue('PLUGIN_SUITE_BILLING_URL') || defaultBillingUrl).replace(/\/$/, '');
    this.configPath = path.join(configDir(), `${pluginId}.json`);
    this.freeTier = { plan: 'free', features: [], limits: {}, ...freeTier };
    this.cache = null;
  }

  // ---- configuration -----------------------------------------------------

  get licenseKey() {
    return (
      envValue(`${this.envPrefix}_LICENSE_KEY`) ||
      envValue('PLUGIN_SUITE_LICENSE_KEY') ||
      this.#readConfig().license_key ||
      null
    );
  }

  /** Stable per-machine identifier. Derived, not random, so it survives reinstalls. */
  get deviceId() {
    const stored = this.#readConfig().device_id;
    if (stored) return stored;
    const seed = `${os.hostname()}|${os.userInfo().username}|${os.platform()}|${os.arch()}`;
    const deviceId = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
    this.#writeConfig({ device_id: deviceId });
    return deviceId;
  }

  get deviceLabel() {
    return `${os.hostname()} (${os.platform()})`;
  }

  saveLicenseKey(key) {
    this.#writeConfig({ license_key: key.trim().toUpperCase() });
    this.cache = null;
  }

  #readConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  #writeConfig(patch) {
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const merged = { ...this.#readConfig(), ...patch };
    // Write-then-rename so a crash mid-write can never truncate the stored
    // licence: the old file stays intact until the new one is complete.
    const tmp = `${this.configPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.configPath);
    return merged;
  }

  // ---- billing service ---------------------------------------------------

  async #request(method, endpoint, { body, auth = true } = {}) {
    if (this.billingUrl === PLACEHOLDER_BILLING_URL) {
      throw new ToolError(
        'billing_not_configured',
        'This plugin was never pointed at a real billing service — it still has the placeholder URL baked in.',
        'Set PLUGIN_SUITE_BILLING_URL, or rebuild the archive with scripts/bake-billing-url.mjs after deploying services/billing.'
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      let response;
      try {
        response = await fetch(`${this.billingUrl}${endpoint}`, {
          method,
          headers: {
            'content-type': 'application/json',
            ...(auth && this.licenseKey ? { authorization: `Bearer ${this.licenseKey}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        throw new ToolError(
          'billing_unreachable',
          err.name === 'AbortError'
            ? `The licensing service did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`
            : `Could not reach the licensing service at ${this.billingUrl}.`,
          err.message
        );
      }

      // The abort signal must still cover this: fetch() resolves once
      // headers arrive, not once the body does, so a connection that stalls
      // mid-body would otherwise hang past the budget above with nothing
      // left watching it.
      let text;
      try {
        text = await response.text();
      } catch (err) {
        throw new ToolError(
          'billing_unreachable',
          err.name === 'AbortError'
            ? `The licensing service did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`
            : `Could not reach the licensing service at ${this.billingUrl}.`,
          err.message
        );
      }
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new ToolError('billing_bad_response', 'The licensing service returned a response that was not JSON.', text.slice(0, 300));
      }
      return { status: response.status, ok: response.ok, data };
    } finally {
      clearTimeout(timer);
    }
  }

  /** The entitlement a user has with no key, or when the service cannot say. */
  #freeEntitlement(reason) {
    return {
      active: true,
      free: true,
      plan: this.freeTier.plan,
      features: this.freeTier.features,
      limits: this.freeTier.limits,
      usage: {},
      reason,
    };
  }

  /**
   * Cached entitlement lookup. Set force to bypass the cache after a change.
   * Set peek to check status without it being the thing that registers this
   * device against a seat — license_status uses this, since a tool that
   * promises to only report must never itself spend a seat.
   */
  async entitlement({ force = false, peek = false } = {}) {
    if (!force && this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    if (!this.licenseKey) {
      return this.#freeEntitlement('missing_license');
    }

    const query = new URLSearchParams({ plugin_id: this.pluginId, device_id: this.deviceId });
    if (peek) query.set('peek', 'true');
    let data;
    try {
      const response = await this.#request('GET', `/v1/entitlement?${query}`);
      if (!response.ok) {
        // A 429 or 5xx still carries a JSON body — but treating that body as
        // a real entitlement (active/free/features left undefined) reads as
        // "not entitled" to every caller downstream, telling a paying
        // customer their licence had failed because the service hiccuped.
        // This is the same "could not get a real answer" case as a network
        // failure below, not a real entitlement.
        throw new ToolError('billing_error', `The licensing service returned HTTP ${response.status}.`, response.data);
      }
      data = response.data;
    } catch (err) {
      // Documented failure behaviour: a previously valid entitlement keeps
      // working even past its cache TTL, and an unknown state degrades to the
      // free tier with a clear message — never to an error. The reason
      // carries the actual failure (billing_not_configured, billing_error,
      // billing_unreachable, ...) instead of a single hardcoded guess, so a
      // caller two layers up isn't stuck inferring what kind of "down" this
      // was from a free-text note.
      if (this.cache) return { ...this.cache.value, stale: true, stale_reason: err.code };
      return { ...this.#freeEntitlement(err.code ?? 'billing_unreachable'), degraded: true, note: err.message };
    }
    // A peek result must never satisfy a later real (registering) lookup —
    // caching it here would let a status check that ran first silently skip
    // this device ever actually being registered against a seat.
    if (!peek) this.cache = { at: Date.now(), value: data };
    return data;
  }

  /**
   * Gate a paid capability. Throws a ToolError carrying everything the model
   * needs to explain the situation and offer the next step.
   */
  async requireFeature(feature) {
    const entitlement = await this.entitlement();
    // A plugin with no free features has no free tier: with no key, every
    // gated tool is a licensing miss, not an upgrade prompt. entitlement
    // itself is passed here (not a synthesised { reason: 'missing_license' })
    // so the real reason — which during an outage is billing_unreachable or
    // billing_not_configured, not a missing key — reaches the explanation. A
    // paying customer whose key is fine but whose check failed to complete
    // must never be told their licence was never set up.
    if (entitlement.free && !entitlement.features.length) {
      throw new ToolError('license_required', explainDenial(entitlement, this.pluginId), {
        reason: entitlement.reason,
        next_step: 'Call license_activate with an existing key, or start_checkout to buy a plan.',
      });
    }
    if (!entitlement.active) {
      throw new ToolError('license_required', explainDenial(entitlement, this.pluginId), {
        reason: entitlement.reason,
        next_step: entitlement.reason === 'missing_license'
          ? 'Call license_activate with an existing key, or start_checkout to buy one.'
          : 'Call license_status for details, or start_checkout to change plan.',
      });
    }
    if (!entitlement.features?.includes(feature)) {
      throw new ToolError('upgrade_required',
        entitlement.free
          ? 'This capability is not included in the free tier.'
          : `The "${entitlement.plan}" plan does not include this capability.`, {
        plan: entitlement.plan,
        required_feature: feature,
        available_features: entitlement.features,
        next_step: entitlement.free
          ? 'Call license_activate with an existing key, or start_checkout to buy a plan.'
          : 'Call start_checkout with a higher plan, or list_plans to compare.',
      });
    }
    return entitlement;
  }

  /**
   * Record metered usage. Failures here never block work already done.
   *
   * idempotencyKey defaults to a fresh one per call, which is only safe for
   * a genuine one-shot recording. A caller that might retry the *same*
   * logical usage event (the work already happened; only reporting it
   * failed) must generate its own key once and pass it on every attempt —
   * otherwise each retry mints a new key, the server's deduplication has
   * nothing to match against, and a retried report double-counts.
   */
  async recordUsage(meter, quantity = 1, idempotencyKey = crypto.randomUUID()) {
    if (!this.licenseKey) return { recorded: false, reason: 'missing_license' };
    try {
      const { data } = await this.#request('POST', '/v1/usage', {
        body: {
          plugin_id: this.pluginId,
          meter,
          quantity,
          idempotency_key: idempotencyKey,
        },
      });
      this.cache = null;
      return data;
    } catch (err) {
      return { recorded: false, reason: err.code, message: err.message };
    }
  }

  /** Check a quota without consuming it. */
  async checkQuota(meter, requested = 1) {
    const entitlement = await this.entitlement();
    const limit = entitlement.limits?.[meter];
    // No ceiling reads the same whether the meter was never declared or was
    // declared uncapped — a caller has no reason to tell those apart, and
    // the server itself no longer emits -1 (see outwardLimits in catalog.js).
    if (limit === undefined || limit === null || limit === -1) return { allowed: true, limit: null };
    const used = entitlement.usage?.[meter] ?? 0;
    return { allowed: used + requested <= limit, used, limit, remaining: Math.max(0, limit - used) };
  }

  async activate(licenseKey) {
    const key = licenseKey.trim().toUpperCase();
    const { ok, data } = await this.#request('POST', '/v1/license/activate', {
      auth: false,
      body: {
        license_key: key,
        plugin_id: this.pluginId,
        device_id: this.deviceId,
        device_label: this.deviceLabel,
      },
    });
    if (!ok) {
      // Only a code and message this codebase's own server actually writes
      // are forwarded as-is — see safeServerError. Anything else (a proxy's
      // own error page, a future server bug) falls back to a fixed,
      // generic one instead of being relayed to whatever reads this error.
      const { code, message, detail } = safeServerError(data, 'activation_failed', 'Activation failed.');
      throw new ToolError(code, message, detail);
    }
    this.saveLicenseKey(key);
    return data;
  }

  async startCheckout(plan, email) {
    const { ok, data } = await this.#request('POST', '/v1/checkout', {
      auth: false,
      body: { plugin_id: this.pluginId, plan, email: email || undefined },
    });
    if (!ok) {
      const { code, message, detail } = safeServerError(data, 'checkout_failed', 'Could not start checkout.');
      throw new ToolError(code, message, detail);
    }
    return data;
  }

  async plans() {
    const { ok, data } = await this.#request('GET', `/v1/catalog/${this.pluginId}`, { auth: false });
    if (!ok) throw new ToolError('catalog_unavailable', 'Could not load plan information.');
    return data;
  }

  async billingPortal() {
    if (!this.licenseKey) throw new ToolError('missing_license', 'No licence key is configured on this machine.');
    const { ok, data } = await this.#request('POST', '/v1/portal', {
      auth: false,
      body: { license_key: this.licenseKey },
    });
    if (!ok) {
      const { code, message, detail } = safeServerError(data, 'portal_failed', 'Could not open the billing portal.');
      throw new ToolError(code, message, detail);
    }
    return data;
  }
}

function configDir() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite');
}

/**
 * The one place service-failure and denial explanations are written. A
 * second, independently-worded copy of the same idea living inline in
 * license_status's degraded-entitlement branch used to say something
 * similar but not identical — the two could drift, and did.
 */
function explainDenial(entitlement, pluginId) {
  const messages = {
    missing_license: `No licence key is set up for ${pluginId} on this machine.`,
    malformed_license: 'The stored licence key is not in the right format — it may have been copied incompletely.',
    unknown_license: 'The licensing service does not recognise this key.',
    wrong_plugin: 'This key belongs to a different plugin in the suite.',
    inactive: 'This subscription is not currently active.',
    expired: 'This licence has expired.',
    seat_limit_reached: 'Every seat on this licence is already in use on other machines.',
    billing_unreachable: 'The licensing service could not be reached — this could not be checked. A previously working licence keeps working until it can be.',
    billing_not_configured: 'This plugin was never pointed at a real billing service — that is a setup problem, not a licence problem.',
    billing_bad_response: 'The licensing service returned a response that could not be understood — this could not be checked.',
    billing_error: 'The licensing service returned an error while checking this — this could not be confirmed.',
  };
  return messages[entitlement.reason] || 'The licence check did not pass.';
}

/**
 * The three licensing tools every plugin in the suite exposes. Registering
 * them from one place keeps the wording and behaviour identical across all 14.
 */
export function registerLicenseTools(server, client, { pluginName }) {
  server.tool('license_status', {
    description:
      `Check the ${pluginName} licence on this machine: plan, included capabilities, remaining quota and seat usage. ` +
      'Call this when a paid tool reports a licence problem, or when the user asks what their plan includes.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const entitlement = await client.entitlement({ force: true, peek: true });
      if (entitlement.free) {
        return {
          licensed: false,
          // entitlement.reason here, not a hardcoded 'missing_license': this
          // branch is also reached when the licensing service is down and
          // there's no cache to fall back on, and a paying customer must
          // never be told their key was never set up when the real story
          // is that the check couldn't complete.
          ...(entitlement.features.length
            ? { plan: entitlement.plan, free_tier_includes: entitlement.features }
            : { reason: entitlement.reason, explanation: explainDenial(entitlement, client.pluginId) }),
          // Reuses explainDenial rather than its own wording: a second,
          // independently-maintained copy of the same explanation is how
          // the two used to drift apart.
          ...(entitlement.degraded ? { note: explainDenial(entitlement, client.pluginId) } : {}),
          billing_service: client.billingUrl,
          next_step: 'Use license_activate with an existing key, or start_checkout to buy a plan.',
        };
      }
      if (!entitlement.active) {
        return {
          licensed: false,
          reason: entitlement.reason,
          explanation: explainDenial(entitlement, client.pluginId),
          billing_service: client.billingUrl,
          next_step: 'Use license_activate with an existing key, or start_checkout to buy a plan.',
        };
      }
      return {
        licensed: true,
        plan: entitlement.plan,
        status: entitlement.status,
        capabilities: entitlement.features,
        quota: entitlement.usage,
        limits: entitlement.limits,
        seats: entitlement.seats,
        renews_or_expires: entitlement.periodEnd,
        cancels_at_period_end: entitlement.cancelAtPeriodEnd,
      };
    },
  });

  server.tool('license_activate', {
    description:
      `Store and activate a ${pluginName} licence key on this machine. ` +
      'Use when the user pastes a licence key, or after a purchase completes.',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The licence key, e.g. PS-XXX-00000-00000-00000-0000' },
      },
      required: ['license_key'],
    },
    handler: async ({ license_key }) => {
      if (!license_key?.trim()) throw new ToolError('invalid_request', 'A licence key is required.');
      const result = await client.activate(license_key);
      return {
        activated: true,
        plan: result.plan,
        capabilities: result.features,
        seats: result.seats,
        stored_at: client.configPath,
        message: 'Licence stored on this machine. Paid tools are now available.',
      };
    },
  });

  server.tool('start_checkout', {
    description:
      `Begin a ${pluginName} purchase. Returns a Stripe Checkout link. ` +
      'Call list_plans first if the user has not chosen a plan.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'string', description: 'Plan id: "pro" or "team". Use list_plans to see the options.' },
        email: { type: 'string', description: 'Email address for the receipt and licence.' },
      },
      required: ['plan'],
    },
    handler: async ({ plan, email }) => {
      const result = await client.startCheckout(plan, email);
      return {
        checkout_url: result.checkout_url,
        message:
          'Open this link to complete payment. The licence key appears on the success page and is shown only once — ' +
          'paste it back here and it will be activated with license_activate.',
      };
    },
  });

  server.tool('list_plans', {
    description: `List the available ${pluginName} plans, prices and what each one includes.`,
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const catalog = await client.plans();
      return {
        plugin: catalog.name,
        plans: catalog.plans.map((plan) => ({
          id: plan.id,
          price: plan.price === 0 ? 'free' : `$${(plan.price / 100).toFixed(2)}/${plan.interval}`,
          includes: plan.features,
          limits: plan.limits,
          available: plan.available,
        })),
      };
    },
  });

  server.tool('billing_portal', {
    description:
      `Open the Stripe billing portal to change plan, update the card, or cancel the ${pluginName} subscription.`,
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const result = await client.billingPortal();
      return { portal_url: result.portal_url, message: 'Open this link to manage the subscription.' };
    },
  });
}
