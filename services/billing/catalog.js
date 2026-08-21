/**
 * Plan catalog for every plugin the billing service sells.
 *
 * Feature strings must match what each plugin's MCP server gates with
 * requireFeature(); meter names must match what it passes to checkQuota()
 * and recordUsage(). A price of 0 marks a plan that is issued directly
 * (trials) rather than sold through Stripe Checkout; paid plans name the
 * env var that holds their Stripe Price id so no live id is committed.
 */

export const CATALOG = {
  'diagnose-by-sound': {
    name: 'Diagnose by Sound',
    code: 'DBS',
    plans: {
      trial: {
        price: 0,
        interval: 'month',
        trial_days: 14,
        features: ['diagnose', 'repair_plan', 'history'],
        limits: { diagnoses_per_month: 25 },
        seats: 1,
        available: true,
      },
      pro: {
        price: 4000,
        interval: 'month',
        features: ['diagnose', 'repair_plan', 'history'],
        limits: { diagnoses_per_month: -1 },
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_DBS_PRO',
      },
      team: {
        price: 7900,
        interval: 'month',
        features: ['diagnose', 'repair_plan', 'history'],
        limits: { diagnoses_per_month: -1 },
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_DBS_TEAM',
      },
    },
  },
  'ghost-post-preview': {
    name: 'Ghost Post Preview',
    code: 'GPP',
    plans: {
      trial: {
        price: 0,
        interval: 'month',
        trial_days: 14,
        features: ['lint', 'history'],
        limits: { previews_per_month: 25 },
        seats: 1,
        available: true,
      },
      pro: {
        price: 4000,
        interval: 'month',
        features: ['lint', 'history'],
        limits: { previews_per_month: -1 },
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_GPP_PRO',
      },
      team: {
        price: 7900,
        interval: 'month',
        features: ['lint', 'history'],
        limits: { previews_per_month: -1 },
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_GPP_TEAM',
      },
    },
  },
};

export function plugin(pluginId) {
  return CATALOG[pluginId] ?? null;
}

export function plan(pluginId, planId) {
  return CATALOG[pluginId]?.plans[planId] ?? null;
}

/** The shape GET /v1/catalog/:pluginId returns, matching the client's list_plans. */
export function publicCatalog(pluginId) {
  const entry = plugin(pluginId);
  if (!entry) return null;
  return {
    name: entry.name,
    plans: Object.entries(entry.plans).map(([id, p]) => ({
      id,
      price: p.price,
      interval: p.interval,
      features: p.features,
      limits: p.limits,
      seats: p.seats,
      available: p.available,
    })),
  };
}
