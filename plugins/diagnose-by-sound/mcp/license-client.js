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

export class LicenseClient {
  /**
   * @param {{pluginId: string, defaultBillingUrl: string, envPrefix?: string}} options
   */
  constructor({ pluginId, defaultBillingUrl, envPrefix }) {
    this.pluginId = pluginId;
    this.envPrefix = envPrefix || pluginId.replace(/-/g, '_').toUpperCase();
    this.billingUrl = (process.env.PLUGIN_SUITE_BILLING_URL || defaultBillingUrl).replace(/\/$/, '');
    this.configPath = path.join(configDir(), `${pluginId}.json`);
    this.cache = null;
  }

  // ---- configuration -----------------------------------------------------

  get licenseKey() {
    return (
      process.env[`${this.envPrefix}_LICENSE_KEY`]?.trim() ||
      process.env.PLUGIN_SUITE_LICENSE_KEY?.trim() ||
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
    fs.writeFileSync(this.configPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
    return merged;
  }

  // ---- billing service ---------------------------------------------------

  async #request(method, endpoint, { body, auth = true } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new ToolError('billing_bad_response', 'The licensing service returned a response that was not JSON.', text.slice(0, 300));
    }
    return { status: response.status, ok: response.ok, data };
  }

  /** Cached entitlement lookup. Set force to bypass the cache after a change. */
  async entitlement({ force = false } = {}) {
    if (!force && this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    if (!this.licenseKey) {
      return { active: false, reason: 'missing_license' };
    }

    const query = new URLSearchParams({ plugin_id: this.pluginId, device_id: this.deviceId });
    const { data } = await this.#request('GET', `/v1/entitlement?${query}`);
    this.cache = { at: Date.now(), value: data };
    return data;
  }

  /**
   * Gate a paid capability. Throws a ToolError carrying everything the model
   * needs to explain the situation and offer the next step.
   */
  async requireFeature(feature) {
    const entitlement = await this.entitlement();
    if (!entitlement.active) {
      throw new ToolError('license_required', explainDenial(entitlement, this.pluginId), {
        reason: entitlement.reason,
        next_step: entitlement.reason === 'missing_license'
          ? 'Call license_activate with an existing key, or start_checkout to buy one.'
          : 'Call license_status for details, or start_checkout to change plan.',
      });
    }
    if (!entitlement.features?.includes(feature)) {
      throw new ToolError('upgrade_required', `The "${entitlement.plan}" plan does not include this capability.`, {
        plan: entitlement.plan,
        required_feature: feature,
        available_features: entitlement.features,
        next_step: 'Call start_checkout with a higher plan, or list_plans to compare.',
      });
    }
    return entitlement;
  }

  /** Record metered usage. Failures here never block work already done. */
  async recordUsage(meter, quantity = 1) {
    if (!this.licenseKey) return { recorded: false, reason: 'missing_license' };
    try {
      const { data } = await this.#request('POST', '/v1/usage', {
        body: {
          plugin_id: this.pluginId,
          meter,
          quantity,
          idempotency_key: crypto.randomUUID(),
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
    if (limit === undefined) return { allowed: true, limit: null };
    if (limit === -1) return { allowed: true, limit: -1 };
    const used = entitlement.usage?.[meter] ?? 0;
    return { allowed: used + requested <= limit, used, limit, remaining: Math.max(0, limit - used) };
  }

  async activate(licenseKey) {
    const key = licenseKey.trim().toUpperCase();
    const { ok, status, data } = await this.#request('POST', '/v1/license/activate', {
      auth: false,
      body: {
        license_key: key,
        plugin_id: this.pluginId,
        device_id: this.deviceId,
        device_label: this.deviceLabel,
      },
    });
    if (!ok) {
      throw new ToolError(data.error || 'activation_failed', data.message || `Activation failed (HTTP ${status}).`, data.detail);
    }
    this.saveLicenseKey(key);
    return data;
  }

  async startCheckout(plan, email) {
    const { ok, data } = await this.#request('POST', '/v1/checkout', {
      auth: false,
      body: { plugin_id: this.pluginId, plan, email: email || undefined },
    });
    if (!ok) throw new ToolError(data.error || 'checkout_failed', data.message || 'Could not start checkout.', data.detail);
    return data;
  }

  async startTrial(email) {
    const { ok, data } = await this.#request('POST', '/v1/trial', {
      auth: false,
      body: { plugin_id: this.pluginId, email },
    });
    if (!ok) throw new ToolError(data.error || 'trial_failed', data.message || 'Could not start a trial.', data.detail);
    this.saveLicenseKey(data.license_key);
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
    if (!ok) throw new ToolError(data.error || 'portal_failed', data.message || 'Could not open the billing portal.');
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

function explainDenial(entitlement, pluginId) {
  const messages = {
    missing_license: `No licence key is set up for ${pluginId} on this machine.`,
    malformed_license: 'The stored licence key is not in the right format — it may have been copied incompletely.',
    unknown_license: 'The licensing service does not recognise this key.',
    wrong_plugin: 'This key belongs to a different plugin in the suite.',
    inactive: 'This subscription is not currently active.',
    expired: 'This licence has expired.',
    seat_limit_reached: 'Every seat on this licence is already in use on other machines.',
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
      const entitlement = await client.entitlement({ force: true });
      if (!entitlement.active) {
        return {
          licensed: false,
          reason: entitlement.reason,
          explanation: explainDenial(entitlement, client.pluginId),
          billing_service: client.billingUrl,
          next_step: 'Use license_activate with an existing key, or start_checkout to buy or trial a plan.',
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
      `Begin a ${pluginName} purchase or free trial. Returns a Stripe Checkout link for paid plans, ` +
      'or issues a free trial key immediately. Call list_plans first if the user has not chosen a plan.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'string', description: 'Plan id, e.g. "trial", "pro". Use list_plans to see the options.' },
        email: { type: 'string', description: 'Email address for the receipt and licence. Required for a trial.' },
      },
      required: ['plan'],
    },
    handler: async ({ plan, email }) => {
      if (plan === 'trial') {
        if (!email?.trim()) throw new ToolError('invalid_request', 'An email address is required to issue a trial licence.');
        const result = await client.startTrial(email.trim());
        return {
          trial_started: true,
          license_key: result.license_key,
          plan: result.plan,
          capabilities: result.features,
          limits: result.limits,
          message: 'Trial licence issued and stored on this machine.',
        };
      }
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
