/**
 * Plan catalog for every plugin the billing service sells.
 *
 * Feature strings must match what each plugin's MCP server gates with
 * requireFeature(); meter names must match what it passes to checkQuota()
 * and recordUsage(). There is no trial plan — every licence is bought
 * through Stripe Checkout. Paid plans name the env var that holds their
 * Stripe Price id so no live id is committed.
 */

export const CATALOG = {
  'diagnose-by-sound': {
    name: 'Diagnose by Sound',
    code: 'DBS',
    plans: {
      pro: {
        price: 5000,
        interval: 'month',
        features: ['diagnose', 'repair_plan', 'history'],
        limits: { diagnoses_per_month: -1 },
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_DBS_PRO',
      },
      team: {
        price: 15000,
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
      pro: {
        price: 50000,
        interval: 'month',
        features: ['lint', 'history'],
        limits: { previews_per_month: -1 },
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_GPP_PRO',
      },
      team: {
        price: 200000,
        interval: 'month',
        features: ['lint', 'history'],
        limits: { previews_per_month: -1 },
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_GPP_TEAM',
      },
    },
  },
  'professor-mind-reader': {
    name: 'Professor Mind-Reader',
    code: 'PMR',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 1900,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_PMR_PRO',
      },
      team: {
        price: 2500,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_PMR_TEAM',
      },
    },
  },
  'five-minute-fluency': {
    name: '5-Minute Fluency',
    code: 'FMF',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 1000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_FMF_PRO',
      },
      team: {
        price: 3000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_FMF_TEAM',
      },
    },
  },
  'trail-split': {
    name: 'Trail Split',
    code: 'TSP',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 500,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_TSP_PRO',
      },
      team: {
        price: 1500,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_TSP_TEAM',
      },
    },
  },
  'podcast-video-studio': {
    name: 'Podcast & Video Studio',
    code: 'PVS',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 10000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_PVS_PRO',
      },
      team: {
        price: 30000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_PVS_TEAM',
      },
    },
  },
  'customer-sales-support': {
    name: 'Customer Sales Support',
    code: 'CSS',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 100000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_CSS_PRO',
      },
      team: {
        price: 500000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_CSS_TEAM',
      },
    },
  },
  'haptic-feedback-mapper': {
    name: 'Haptic Feedback Mapper',
    code: 'HFM',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 10000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_HFM_PRO',
      },
      team: {
        price: 30000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_HFM_TEAM',
      },
    },
  },
  'mental-health-chatbot': {
    name: 'Mental-Health Chatbot',
    code: 'MHC',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 10000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_MHC_PRO',
      },
      team: {
        price: 25000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_MHC_TEAM',
      },
    },
  },
  'neural-link-intention-layer': {
    name: 'Neural-Link Intention Layer',
    code: 'NLI',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 10000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_NLI_PRO',
      },
      team: {
        price: 30000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_NLI_TEAM',
      },
    },
  },
  'generative-digital-twin': {
    name: 'Generative Digital Twin',
    code: 'GDT',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 20000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_GDT_PRO',
      },
      team: {
        price: 50000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_GDT_TEAM',
      },
    },
  },
  'emotional-resonance-analyzer': {
    name: 'Emotional Resonance Analyzer',
    code: 'ERA',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 50000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_ERA_PRO',
      },
      team: {
        price: 150000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_ERA_TEAM',
      },
    },
  },
  'code-to-visual-interpreter': {
    name: 'Code-to-Visual Interpreter',
    code: 'CVI',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 15000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_CVI_PRO',
      },
      team: {
        price: 40000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_CVI_TEAM',
      },
    },
  },
  'predictive-resource-allocation': {
    name: 'Predictive Resource Allocation',
    code: 'PRA',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 50000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_PRA_PRO',
      },
      team: {
        price: 250000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_PRA_TEAM',
      },
    },
  },
};

export function plugin(pluginId) {
  return Object.hasOwn(CATALOG, pluginId) ? CATALOG[pluginId] : null;
}

export function plan(pluginId, planId) {
  const entry = plugin(pluginId);
  if (!entry || !Object.hasOwn(entry.plans, planId)) return null;
  return entry.plans[planId];
}

/**
 * -1 is how a plan declares "no ceiling" internally; every outward-facing
 * response says so as `null` instead; `-1 per month` on a public pricing
 * page is a rendering bug waiting to happen, not a number worth exposing.
 */
export function outwardLimits(limits) {
  return Object.fromEntries(Object.entries(limits).map(([meter, limit]) => [meter, limit === -1 ? null : limit]));
}

/**
 * Whether a plan can actually be bought right now.
 *
 * `available` in the table above is the editorial half of the answer — "we
 * intend to sell this". The other half is operational: POST /v1/checkout
 * answers 503 plan_not_configured when process.env[stripe_price_env] is
 * unset, so a plan whose price id was never provisioned is not purchasable
 * no matter what the table says. Reporting the table's flag alone let the
 * storefront and the plugins' own list_plans advertise a Buy button that
 * could only ever 503, which is how a whole plugin's launch went unnoticed.
 * Both halves must hold.
 */
export function isPurchasable(planDef, env = process.env) {
  if (!planDef || planDef.available !== true) return false;
  if (!planDef.price) return false;
  return Boolean(env[planDef.stripe_price_env]);
}

/** The shape GET /v1/catalog/:pluginId returns, matching the client's list_plans. */
export function publicCatalog(pluginId, env = process.env) {
  const entry = plugin(pluginId);
  if (!entry) return null;
  return {
    name: entry.name,
    plans: Object.entries(entry.plans).map(([id, p]) => ({
      id,
      price: p.price,
      interval: p.interval,
      features: p.features,
      limits: outwardLimits(p.limits),
      seats: p.seats,
      available: isPurchasable(p, env),
    })),
  };
}

/**
 * The shape GET /v1/catalog (no plugin id) returns: one row per plugin, so a
 * storefront can render the whole suite without fourteen round trips. Plan
 * detail stays on the per-plugin route; this is an index, not a dump.
 */
export function catalogIndex(env = process.env) {
  return {
    plugins: Object.entries(CATALOG).map(([id, entry]) => ({
      id,
      name: entry.name,
      plans: Object.keys(entry.plans),
      available: Object.values(entry.plans).some((p) => isPurchasable(p, env)),
    })),
  };
}
