#!/usr/bin/env node
/**
 * Neural-Link Intention Layer — MCP server.
 *
 * The deterministic half of the method: log normalisation and the sequence
 * audit (counting bigrams, trigrams and recurring sequences), the n-gram
 * predictor with its honest held-out evaluation, the payback arithmetic, the
 * instrumentation and automation reference data, and the local build log that
 * closes the loop. The judgement half — what to eliminate, what to batch,
 * whether a habit is worth keeping — lives in the skill. There is no neural
 * link and nothing here reads minds: every number is a count over a command
 * history the user recorded themselves.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  TIERS, TIER_C_WARNING, APPLICATIONS, OS_HOTKEY_LOGGING, CAPTURE_RULES,
  SELF_REPORT, LOG_FORMAT, applicationFor,
} from './lib/instrumentation.js';
import { STANDING_RULES, MECHANISMS, BREAK_EVEN, CHOOSING, catalogueFor } from './lib/catalogue.js';
import {
  FRAMING, CEILING, NORMALISATION_RULES, MIN_LOG_SIZES, SESSION_REQUIREMENT,
  EVALUATION_RULES, EXPECTED_ACCURACY, UNDO_SHARE_BANDS, PER_ACTION_UNDO,
  NAVIGATION_NOTE, SCORING, CONFIDENCE_FLOOR, REFIT_RULE, REMEASURE_RULE,
} from './lib/method.js';
import { parseLog, normalise, audit } from './lib/analyse.js';
import { fitPredictor, confidentContexts } from './lib/predictor.js';
import { scoreCandidate } from './lib/score.js';
import { recordBuild, recordFollowup, reviewBuilds, BUILDS_FILE } from './lib/builds.js';

const PLUGIN_ID = 'neural-link-intention-layer';
const PLUGIN_NAME = 'Neural-Link Intention Layer';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the instrumentation guide, the automation catalogue and the
// method's numbers stay open so the approach can be evaluated before buying;
// the analysis, scoring and build-log tools are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for auditing a creative-workflow command history. There is no ' +
    'neural link and nothing here reads minds — the name is a product name, and every number ' +
    'is n-gram counting over a log the user recorded themselves. Call instrumentation_guide to ' +
    'get a log out of an application, analyse_log for the sequence audit, fit_predictor for ' +
    'the model and its honest accuracy, score_candidate for the payback arithmetic. None of ' +
    'these decide what to automate — that is the skill\'s job — and nothing numeric exists ' +
    'without a recorded log.',
});

/**
 * Parse and normalise a supplied log, refusing anything that is not a log.
 * The path-like check is a privacy tripwire, not a validator: action names
 * must never carry document names, layer names or file paths.
 */
function normalisedLog(log) {
  if (typeof log !== 'string' || !log.trim()) {
    throw new ToolError('missing_log', 'No log supplied. No log, no numbers — a workflow described from memory is a source of hypotheses, not counts.', {
      expected_format: LOG_FORMAT,
    });
  }
  const events = parseLog(log);
  if (!events.length) {
    throw new ToolError('empty_log', 'No parseable lines found.', { expected_format: LOG_FORMAT });
  }
  const pathLike = events.filter((e) => /[\\/]/.test(e.action)).length;
  const result = normalise(events);
  return {
    result,
    ...(pathLike
      ? {
          privacy_warning:
            `${pathLike} action name(s) contain path separators and may be file paths. Logs must carry ` +
            'action names, counts and timestamps only — strip document names, layer names and file paths, ' +
            'and delete the raw log after analysis.',
        }
      : {}),
  };
}

// ---------------------------------------------------------------- open: reference

server.tool('instrumentation_guide', {
  description:
    'How to get a command history out of an application: the three tiers of source with their ' +
    'coverage and blind spots, per-application methods (Photoshop, Blender, Figma, After ' +
    'Effects, Illustrator), OS-level hotkey logging, the capture rules that keep a log private, ' +
    'and the exact log format the analysis tools expect. Reference data only — it measures nothing itself.',
  inputSchema: {
    type: 'object',
    properties: {
      application: {
        type: 'string',
        description: 'Optional: photoshop, blender, figma, after_effects, illustrator or other. Omit for the full guide.',
      },
    },
  },
  handler: async ({ application }) => {
    if (application) {
      const app = applicationFor(application);
      if (!app) {
        throw new ToolError('unknown_application', `No entry for "${application}".`, {
          available: Object.keys(APPLICATIONS),
        });
      }
      return { ...app, capture_rules: CAPTURE_RULES, log_format: LOG_FORMAT };
    }
    return {
      tiers: TIERS,
      tier_c_warning: TIER_C_WARNING,
      applications: Object.fromEntries(
        Object.entries(APPLICATIONS).map(([id, a]) => [id, { label: a.label, tier: a.tier }])
      ),
      os_hotkey_logging: OS_HOTKEY_LOGGING,
      capture_rules: CAPTURE_RULES,
      self_report_walkthrough: SELF_REPORT,
      log_format: LOG_FORMAT,
    };
  },
});

server.tool('automation_catalogue', {
  description:
    'What each automation mechanism can and cannot do — Photoshop and Illustrator Actions, ' +
    'Figma components and the plugin API, Blender keymaps, After Effects expressions and ' +
    'scripting, OS-level macro tools, hardware — with setup costs and break-even frequencies. ' +
    'Reference data only — choosing between them is the skill\'s job.',
  inputSchema: {
    type: 'object',
    properties: {
      application: {
        type: 'string',
        description: 'Optional: photoshop, illustrator, figma, blender, after_effects, os_level or hardware. Omit to list everything.',
      },
    },
  },
  handler: async ({ application }) => {
    if (application) {
      const entry = catalogueFor(application);
      if (!entry) {
        throw new ToolError('unknown_application', `No catalogue entry for "${application}".`, {
          available: Object.keys(MECHANISMS),
        });
      }
      return { standing_rules: STANDING_RULES, ...entry, break_even: BREAK_EVEN };
    }
    return {
      standing_rules: STANDING_RULES,
      catalogue: MECHANISMS,
      break_even: BREAK_EVEN,
      choosing_quickly: CHOOSING,
    };
  },
});

server.tool('method_reference', {
  description:
    'The method\'s fixed numbers: normalisation rules, minimum log sizes, the evaluation ' +
    'protocol and expected accuracy ranges, the undo and navigation reading bands, the payback ' +
    'formula with its constants, and the confidence-floor table. Everything the licensed tools ' +
    'compute with, stated openly so the approach can be judged before buying.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    framing: FRAMING,
    honest_ceiling: CEILING,
    normalisation_rules: NORMALISATION_RULES,
    minimum_log_sizes: MIN_LOG_SIZES,
    session_requirement: SESSION_REQUIREMENT,
    evaluation_rules: EVALUATION_RULES,
    expected_accuracy: EXPECTED_ACCURACY,
    undo_share_bands: UNDO_SHARE_BANDS,
    per_action_undo: PER_ACTION_UNDO,
    navigation_share: NAVIGATION_NOTE,
    scoring: SCORING,
    confidence_floor: CONFIDENCE_FLOOR,
    refit_rule: REFIT_RULE,
    remeasure_rule: REMEASURE_RULE,
    order_of_moves: 'Eliminate, then batch, then automate — in that order.',
  }),
});

// ---------------------------------------------------------------- licensed: analysis

server.tool('analyse_log', {
  description:
    'The sequence audit over a supplied command log: normalisation (runs collapsed, sequences ' +
    'cut at 3-minute idle gaps), top actions, top bigrams and trigrams, recurring sequences of ' +
    'length 4 or more, the undo diagnostic and the navigation share, with the reading bands ' +
    'attached. Counting only — it does not decide what to automate, and it refuses logs under ' +
    '500 actions rather than reporting numbers they cannot support. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      log: {
        type: 'string',
        description:
          'One action per line: "timestamp application action", timestamp and application ' +
          'optional. Action names, counts and timestamps only — never document names, layer ' +
          'names or file paths.',
      },
      navigation_actions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional exact action names to count as navigation, on top of the default ' +
          'zoom/pan/navigate/visibility name patterns (tool toggles, for instance).',
      },
    },
    required: ['log'],
  },
  handler: async ({ log, navigation_actions }) => {
    await client.requireFeature('tools');
    const { result, privacy_warning } = normalisedLog(log);
    return {
      ...(privacy_warning ? { privacy_warning } : {}),
      ...audit(result, { navigationActions: navigation_actions ?? [] }),
      session_requirement: SESSION_REQUIREMENT,
    };
  },
});

server.tool('fit_predictor', {
  description:
    'Fit the n-gram predictor on a supplied log and report its accuracy honestly: chronological ' +
    'split with the last 20% held out, baseline top-1, model top-1 with self-transitions ' +
    'excluded, top-3, and the log\'s date range and size — plus the contexts that clear the ' +
    'confidence floor (default 0.80), with destructive continuations suppressed. Requires at ' +
    'least 2,000 normalised actions; under 5,000 the trigram figures are provisional. It ' +
    'predicts the user\'s own recorded habits, not intention, and nothing is auto-executed. ' +
    'Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      log: {
        type: 'string',
        description:
          'One action per line: "timestamp application action", timestamp and application optional.',
      },
      k: {
        type: 'number',
        description:
          'Optional cost asymmetry: how many times worse a wrong suggestion is than a right one ' +
          'is good. Floor is k / (1 + k). Default 4, giving 0.80.',
      },
    },
    required: ['log'],
  },
  handler: async ({ log, k }) => {
    await client.requireFeature('tools');
    const { result, privacy_warning } = normalisedLog(log);
    return {
      ...(privacy_warning ? { privacy_warning } : {}),
      ...fitPredictor(result),
      confident_contexts: confidentContexts(result, { k }),
      refit_rule: REFIT_RULE,
    };
  },
});

server.tool('score_candidate', {
  description:
    'The payback arithmetic for one automation candidate: value = F x (K + C) / (S + R) and ' +
    'payback_weeks = S x 1.3 / (F x (K + C)), against the 8-week build threshold. Arithmetic ' +
    'over supplied terms only — F is only meaningful if it was read from a log, and the result ' +
    'says so. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      f_per_week: { type: 'number', description: 'Occurrences per week, from the log.' },
      k_seconds: { type: 'number', description: 'Seconds saved per occurrence: keystroke 0.3, menu trip 1.5, modal dialogue 4.' },
      c_seconds: { type: 'number', description: 'Context-switch cost in seconds: 0 hand stays put, 1.5 mouse-to-menu, 4 dialogue, 15 leaving the app. Default 0.' },
      setup_seconds: { type: 'number', description: 'Setup seconds: ~180 keymap, ~300 action, ~900 component set, ~1200 OS macro, ~5000 plugin. Maintenance (30% annualised) is added by the formula.' },
      wrong_fire_p: { type: 'number', description: 'Optional probability the automation fires correctly, 0-1. Supply with wrong_fire_severity_seconds to include R.' },
      wrong_fire_severity_seconds: { type: 'number', description: 'Optional severity of a wrong fire: 2 if easily undone, 30 if silently wrong. If destructive, do not build — R is unbounded.' },
      stable_across_log: { type: 'boolean', description: 'Whether the sequence is stable across the whole log. Without it the verdict stays unconfirmed.' },
    },
    required: ['f_per_week', 'k_seconds', 'setup_seconds'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return scoreCandidate(args);
  },
});

// ---------------------------------------------------------------- licensed: close the loop

server.tool('record_build', {
  description:
    'Record an automation that was actually built — mechanism, sequence, predicted weekly ' +
    'firing rate, payback — in the local build log, so the two-week re-measure has something ' +
    'to check against. Given a build_id and observed_f_per_week instead, records the follow-up ' +
    'measurement on an existing build. Requires a paid plan. Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      build_id: { type: 'string', description: 'Existing build to record a follow-up on. Omit when recording a new build.' },
      observed_f_per_week: { type: 'number', description: 'Observed firing rate at the re-measure, from a fresh log. Only with build_id.' },
      mechanism: { type: 'string', description: 'E.g. "Photoshop Action", "Blender keymap entry", "Stream Deck button".' },
      application: { type: 'string' },
      sequence: { type: 'string', description: 'The action sequence automated, e.g. "new_layer -> fill_50_grey -> blend_mode:soft_light".' },
      predicted_f_per_week: { type: 'number', description: 'Predicted weekly firing rate, from the log.' },
      payback_weeks: { type: 'number', description: 'The scored payback, from score_candidate.' },
      notes: { type: 'string' },
    },
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    if (args.build_id) {
      if (typeof args.observed_f_per_week !== 'number' || !Number.isFinite(args.observed_f_per_week) || args.observed_f_per_week < 0) {
        throw new ToolError('invalid_request', 'A follow-up needs observed_f_per_week as a non-negative number, read from a fresh log.');
      }
      const updated = recordFollowup(args.build_id, args);
      if (!updated) throw new ToolError('unknown_build', `No build "${args.build_id}".`);
      return { updated: true, build: updated, remeasure_rule: REMEASURE_RULE };
    }
    if (!args.mechanism && !args.sequence) {
      throw new ToolError('invalid_request', 'Recording a build needs at least a mechanism or a sequence.');
    }
    const record = recordBuild(args);
    return { logged: true, build_id: record.id, stored_at: BUILDS_FILE, remeasure_rule: REMEASURE_RULE };
  },
});

server.tool('review_builds', {
  description:
    'The record of past builds with predicted against observed firing rates. Counting only — ' +
    'it flags nothing and removes nothing; whether an underfiring macro comes out is the ' +
    'user\'s call. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'Default 20.' } },
  },
  handler: async ({ limit }) => {
    await client.requireFeature('tools');
    return { ...reviewBuilds({ limit: limit ?? 20 }), remeasure_rule: REMEASURE_RULE };
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
