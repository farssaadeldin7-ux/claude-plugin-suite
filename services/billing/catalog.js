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
        price: 4000,
        interval: 'month',
        features: ['diagnose', 'repair_plan', 'history'],
        limits: { diagnoses_per_month: -1 },
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_DBS_PRO',
      },
      team: {
        price: 7000,
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
        price: 4000,
        interval: 'month',
        features: ['lint', 'history'],
        limits: { previews_per_month: -1 },
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_GPP_PRO',
      },
      team: {
        price: 7000,
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
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_PMR_PRO',
      },
      team: {
        price: 7000,
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
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_FMF_PRO',
      },
      team: {
        price: 7000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_FMF_TEAM',
      },
    },
  },
  'basecamp-split': {
    name: 'Basecamp Split',
    code: 'BCS',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_BCS_PRO',
      },
      team: {
        price: 7000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 10,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_BCS_TEAM',
      },
    },
  },
  'podcast-video-studio': {
    name: 'Podcast & Video Studio',
    code: 'PVS',
    // The plugin's MCP server gates its licensed tools on the 'tools' feature.
    plans: {
      pro: {
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_PVS_PRO',
      },
      team: {
        price: 7000,
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
        price: 50000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_CSS_PRO',
      },
      team: {
        price: 200000,
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
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_HFM_PRO',
      },
      team: {
        price: 7000,
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
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_MHC_PRO',
      },
      team: {
        price: 7000,
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
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_NLI_PRO',
      },
      team: {
        price: 7000,
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
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_GDT_PRO',
      },
      team: {
        price: 7000,
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
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_ERA_PRO',
      },
      team: {
        price: 7000,
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
        price: 4000,
        interval: 'month',
        features: ['tools'],
        limits: {},
        seats: 2,
        available: true,
        stripe_price_env: 'STRIPE_PRICE_CVI_PRO',
      },
      team: {
        price: 7000,
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
        price: 200000,
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
