#!/usr/bin/env node
/**
 * Basecamp Split — MCP server.
 *
 * The deterministic half of the method: the gear taxonomy and seven-system
 * tables, consumables arithmetic from the planning figures, the weight ledger
 * against the carry bands, the exact zero-sum cost settlement, and the
 * four-check reconciliation. The judgement half — what to cut when the trip
 * does not fit, whether a backup is good enough, whether the route is wise —
 * lives in the skill, and nothing here assesses risk, invents a weight or
 * softens a blank in the plan.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  CLASSIFICATION_TEST, TAGS, TAG_NOTE, TYPICAL_CLASSIFICATION,
  SPOF_SYSTEMS, SPOF_RULES, SPLITTABLE_ITEMS, DUPLICATION_AUDIT,
} from './lib/gear.js';
import {
  ENERGY_BANDS, COLD_NOTE, FOOD_WEIGHT, RESERVE, WATER, WATER_CARRY_RULE,
  TREATMENT, TREATMENT_BACKUP_NOTE, FUEL, FUEL_NOTES, sizeConsumables,
} from './lib/consumables.js';
import { CARRY_BANDS, BANDS_CAVEAT, REBALANCE_ORDER, weightLedger } from './lib/weight.js';
import { SPLIT_MODELS, MODEL_RULES, settleCosts } from './lib/costs.js';
import { reconcilePlan } from './lib/reconcile.js';

const PLUGIN_ID = 'basecamp-split';
const PLUGIN_NAME = 'Basecamp Split';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the taxonomy, the seven-system table and the planning figures
// stay open so a plan can be inspected before buying; the four ledger
// computations are licensed under the single 'tools' feature.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for splitting a group trip across three ledgers: gear, weight and cost. ' +
    'Call gear_taxonomy and spof_systems for the classification and backup tables, planning_figures ' +
    'for the consumables and carry-band conventions, then size_consumables, weight_ledger, ' +
    'settle_costs and reconcile_plan to do the arithmetic. Every figure is a stated planning ' +
    'convention or the user\'s own number — nothing here assesses risk, forecasts conditions or ' +
    'invents a weight. The judgement of what to cut when the trip does not fit is the skill\'s job.',
});

// ---------------------------------------------------------------- open tables

server.tool('gear_taxonomy', {
  description:
    'The shared-versus-personal classification test, the three tags (SHARED, REDUNDANT-SHARED, ' +
    'PERSONAL) and their rules, the typical classification of common kit, which items split across ' +
    'carriers, and the duplication audit. Reference tables only — it does not classify your list ' +
    'for you. Omit section to get everything.',
  inputSchema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Optional: classification_test, tags, typical_classification, splittable_items or duplication_audit.',
      },
    },
  },
  handler: async ({ section }) => {
    const sections = {
      classification_test: CLASSIFICATION_TEST,
      tags: { tags: TAGS, note: TAG_NOTE },
      typical_classification: TYPICAL_CLASSIFICATION,
      splittable_items: SPLITTABLE_ITEMS,
      duplication_audit: DUPLICATION_AUDIT,
    };
    if (section) {
      if (!sections[section]) {
        throw new ToolError('unknown_section', `No section "${section}".`, { available: Object.keys(sections) });
      }
      return { [section]: sections[section] };
    }
    return sections;
  },
});

server.tool('spof_systems', {
  description:
    'The seven-system single-point-of-failure table — shelter, water treatment, fire/stove, ' +
    'navigation, first aid, communications, repair — with what counts as an acceptable backup for ' +
    'each, what does not, and the rules that go with the table. Every system needs a named owner ' +
    'and a backup in a different pack, or the plan is not finished. Omit system to get all seven.',
  inputSchema: {
    type: 'object',
    properties: {
      system: { type: 'string', description: 'Optional single system id, e.g. "water_treatment".' },
    },
  },
  handler: async ({ system }) => {
    if (system) {
      if (!SPOF_SYSTEMS[system]) {
        throw new ToolError('unknown_system', `No system "${system}".`, { available: Object.keys(SPOF_SYSTEMS) });
      }
      return { system: { id: system, ...SPOF_SYSTEMS[system] }, rules: SPOF_RULES };
    }
    return { systems: SPOF_SYSTEMS, rules: SPOF_RULES };
  },
});

server.tool('planning_figures', {
  description:
    'The planning tables: kcal/person/day by exertion band, food dry weight and ration density, ' +
    'the rationing reserve, water by conditions, treatment throughput by method, fuel by conditions, ' +
    'the per-person carry bands, and the three cost split models. All stated convention with ranges ' +
    '— not physiology, not a forecast, and not a substitute for weighing real kit. Omit section to ' +
    'get everything.',
  inputSchema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Optional: energy, food, reserve, water, treatment, fuel, carry_bands or split_models.',
      },
    },
  },
  handler: async ({ section }) => {
    const sections = {
      energy: { bands: ENERGY_BANDS, note: COLD_NOTE },
      food: FOOD_WEIGHT,
      reserve: RESERVE,
      water: { conditions: WATER, carry_rule: WATER_CARRY_RULE },
      treatment: { methods: TREATMENT, backup_note: TREATMENT_BACKUP_NOTE },
      fuel: { conditions: FUEL, notes: FUEL_NOTES },
      carry_bands: { bands: CARRY_BANDS, caveat: BANDS_CAVEAT, rebalance_order: REBALANCE_ORDER },
      split_models: { models: SPLIT_MODELS, rules: MODEL_RULES },
    };
    if (section) {
      if (!sections[section]) {
        throw new ToolError('unknown_section', `No section "${section}".`, { available: Object.keys(sections) });
      }
      return { [section]: sections[section] };
    }
    return sections;
  },
});

// ------------------------------------------------------------------- ledgers

server.tool('size_consumables', {
  description:
    'Compute food, reserve, water and fuel for a party from the planning figures: dry grams per ' +
    'person per day from kcal and ration density, the mandatory one-day reserve at roughly 60% ' +
    'ration, daily water by conditions, and net canister gas by conditions. Where a figure is a ' +
    'range in the reference and no point is chosen, the result is a range — never an invented ' +
    'midpoint. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      people: { type: 'number', description: 'Number of people.' },
      days: { type: 'number', description: 'Days on the trip.' },
      person_days: { type: 'number', description: 'Optional override where people join or leave mid-trip. Defaults to people × days.' },
      exertion: { type: 'string', description: 'sedentary, moderate (default) or cold_or_heavy.' },
      kcal_per_day: { type: 'number', description: 'Optional chosen figure inside the exertion band, e.g. 3200.' },
      ration_density_kcal_per_g: { type: 'number', description: 'Calorie density of the menu. 4.0 (default) is ordinary mixed hill food, 4.5 is deliberately fat-forward.' },
      water_conditions: { type: 'string', description: 'Optional: temperate, hot_arid, cold_dry or snow_melt.' },
      fuel_conditions: { type: 'string', description: 'Optional: temperate, freezing or snow_melt.' },
      gas_grams_per_person_day: { type: 'number', description: 'Optional chosen figure inside the fuel range for the conditions.' },
    },
    required: ['people', 'days'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return sizeConsumables(args);
  },
});

server.tool('weight_ledger', {
  description:
    'Total each person\'s load — personal kit, water, consumables and assigned group mass — against ' +
    'their carry band, and name what binds: who is over, whether the trip fits in aggregate but not ' +
    'as split, whose limit is exceeded before any group mass is added, and who starts with too ' +
    'little headroom. Bands are load convention, not physiology, and a person without a body weight ' +
    'is handled as a self-declared target load, never an assumed 70 kg. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      roster: {
        type: 'array',
        description: 'One entry per person.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            body_weight_kg: { type: 'number', description: 'Body weight. Omit only with target_load_kg.' },
            band: { type: 'string', description: 'conditioned (25–30%), typical (20%) or unconditioned (15% or less).' },
            band_percent: { type: 'number', description: 'Optional chosen percentage — at or below the band ceiling, never above.' },
            target_load_kg: { type: 'number', description: 'Self-declared load limit when body weight is unavailable or refused.' },
            personal_kg: { type: 'number', description: 'Personal kit mass.' },
            water_kg: { type: 'number', description: 'Carried water at the heaviest point.' },
            consumables_kg: { type: 'number', description: 'This person\'s food and fuel at the heaviest point, if not counted in group_kg.' },
            group_kg: { type: 'number', description: 'Group mass assigned to this person.' },
          },
          required: ['name'],
        },
      },
    },
    required: ['roster'],
  },
  handler: async ({ roster }) => {
    await client.requireFeature('tools');
    return weightLedger(roster);
  },
});

server.tool('settle_costs', {
  description:
    'Build the cost ledger and settle it: per-expense shares under each expense\'s own model (even, ' +
    'weighted by nights or person-days, itemised), balances as paid minus owed with an exact ' +
    'zero-sum check, then the greedy settle-up with zero-sum subgroups split out first. Works in ' +
    'whole pennies, gives rounding leftovers to the largest creditor, and reports "settles in N ' +
    'transfers" — never "the minimum", which it cannot prove. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      people: { type: 'array', items: { type: 'string' }, description: 'Everyone in the ledger, by name.' },
      expenses: {
        type: 'array',
        description: 'One entry per expense.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            amount: { type: 'number', description: 'In major currency units, e.g. 132.00.' },
            payer: { type: 'string' },
            model: { type: 'string', description: 'even, weighted or itemised.' },
            applies_to: { type: 'array', items: { type: 'string' }, description: 'Even model: who shares it. Defaults to everyone.' },
            weights: { type: 'object', description: 'Weighted model: units per person, e.g. nights {"A": 3, "C": 1}.' },
            shares: { type: 'object', description: 'Itemised model: amount per person. Must sum to the expense amount.' },
            disputed: { type: 'boolean', description: 'Leave this expense out of the settlement and flag it separately.' },
          },
          required: ['amount', 'payer', 'model'],
        },
      },
    },
    required: ['people', 'expenses'],
  },
  handler: async ({ people, expenses }) => {
    await client.requireFeature('tools');
    return settleCosts(people, expenses);
  },
});

server.tool('reconcile_plan', {
  description:
    'Run the four finishing checks: every SHARED instance has exactly one named carrier and every ' +
    'REDUNDANT-SHARED item at least two in different packs; all seven systems have an owner and a ' +
    'backup with a different person; nobody exceeds their band; balances sum to zero and every ' +
    'expense has a payer and a model. Also records the two always-required items — emergency ' +
    'communications and a route plan left with someone off the trip — as recorded, declined or ' +
    'missing. Mechanical checks on names, tags, packs and sums: it cannot judge whether a backup ' +
    'or a first aid kit is any good. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      gear: {
        type: 'array',
        description: 'One entry per instance of each shared item.',
        items: {
          type: 'object',
          properties: {
            item: { type: 'string' },
            tag: { type: 'string', description: 'SHARED, REDUNDANT-SHARED or PERSONAL.' },
            carrier: { type: 'string', description: 'The one named person packing this instance.' },
          },
          required: ['item', 'tag'],
        },
      },
      systems: {
        type: 'object',
        description: 'The seven systems, keyed shelter, water_treatment, fire_stove, navigation, first_aid, communications, repair — each {owner, backup, backup_owner}.',
      },
      loads: {
        type: 'array',
        description: 'Per person: {name, load_kg, limit_kg} at the heaviest point, e.g. from weight_ledger.',
        items: { type: 'object' },
      },
      costs: {
        type: 'object',
        description: '{balances: {name: balance}, expenses: [{label, payer, model}]}, e.g. from settle_costs.',
      },
      emergency_communications: { type: 'string', description: 'Who carries what and who the named contact is — or "declined".' },
      route_plan_left_with: { type: 'string', description: 'Who holds the route plan and when they raise the alarm — or "declined".' },
    },
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return reconcilePlan(args);
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
