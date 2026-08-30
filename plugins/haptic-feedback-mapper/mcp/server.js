#!/usr/bin/env node
/**
 * Haptic Feedback Mapper — MCP server.
 *
 * The deterministic half of the method: the event classes and vocabulary
 * rules as data, the refocus-cost figures with their bases stated, the
 * load arithmetic at both bounds with every assumption echoed, the
 * mechanical mapping audit and vocabulary check with evidence quoted, and
 * the local session log that turns "the load dropped" into a computed delta
 * and carries the trust metric. The judgement half — which class an event
 * belongs in, whether two patterns feel different through a drawing glove,
 * whether two sessions are comparable — lives in the skill and with the
 * user, and nothing here measures a session or promises a billable-hour
 * gain.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  THE_ONE_RULE, EVENT_CLASSES, ACT_NOW_CEILING, DISTRIBUTION_NOTE,
  NO_DECISION_RULE, classById, auditMapping,
} from './lib/classes.js';
import {
  VOCABULARY_RULES, DISTINGUISHABILITY, BLIND_TEST, PATTERN_LIMITS,
  INTENSITIES, checkVocabulary,
} from './lib/vocabulary.js';
import { REFOCUS_FIGURES, FORMULA, DEFAULTS, computeLoad } from './lib/load.js';
import { PHASES, logSession, reviewSessions } from './lib/sessions.js';

const PLUGIN_ID = 'haptic-feedback-mapper';
const PLUGIN_NAME = 'Haptic Feedback Mapper';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the classes, the vocabulary rules and the refocus figures
// stay open so the method can be evaluated before buying; the audit, the
// check, the arithmetic and the session log are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for mapping screen checks to haptics and pricing the recovered ' +
    'attention. Call event_classes for the four classes and their channels, vocabulary_rules for ' +
    'the pattern-design constraints, refocus_figures for the cost figures and their bases, ' +
    'load_math for the checks x refocus x rate arithmetic at both bounds, mapping_audit and ' +
    'vocabulary_check for the mechanical rule checks with evidence quoted, and log_session / ' +
    'review_sessions for the local before/after log and the trust metric. None of these decide ' +
    'what class an event is, measure a session, or promise a billable-hour gain — that is the ' +
    'skill\'s and the user\'s job.',
});

// ------------------------------------------------------------------- browse

server.tool('event_classes', {
  description:
    'The four event classes — act_now, done, ambient, noise — each with its criterion, its ' +
    'channel, and examples, plus the one rule, the no-decision rule and the distribution note. ' +
    'Reference data only; mapping_audit is what checks a recorded mapping against it. Omit class ' +
    'for all four.',
  inputSchema: {
    type: 'object',
    properties: {
      class: { type: 'string', description: 'One class id — act_now, done, ambient or noise — for that class in full.' },
    },
  },
  handler: async ({ class: classId }) => {
    if (classId !== undefined) {
      const found = classById(classId);
      if (!found) {
        throw new ToolError('unknown_class', `No class "${classId}".`, { available: EVENT_CLASSES.map((c) => c.id) });
      }
      return found;
    }
    return {
      the_one_rule: THE_ONE_RULE,
      classes: EVENT_CLASSES,
      no_decision_rule: NO_DECISION_RULE,
      act_now_ceiling: ACT_NOW_CEILING,
      distribution_note: DISTRIBUTION_NOTE,
    };
  },
});

server.tool('vocabulary_rules', {
  description:
    'The vocabulary design constraints: 3-5 patterns, one meaning each, the three axes untrained ' +
    'users can actually distinguish (count, intensity, rhythm), the failure-distinctiveness rule, ' +
    'the fallback requirement, and the blind test. Reference data only; vocabulary_check is what ' +
    'measures a proposed set against it.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    rules: VOCABULARY_RULES,
    limits: PATTERN_LIMITS,
    distinguishability: DISTINGUISHABILITY,
    intensities: INTENSITIES,
    blind_test: BLIND_TEST,
  }),
});

server.tool('refocus_figures', {
  description:
    'The refocus-cost figures the load arithmetic runs at: the conservative glance-level floor and ' +
    'the interruption-recovery literature range, each with its basis and its limits stated, plus ' +
    'the rule that every shown number names its figure. Reference data only — the figures are ' +
    'borrowed from office task-switching research, not measured in studios, which is why the ' +
    'method computes with both bounds.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    figures: REFOCUS_FIGURES,
    formula: FORMULA,
    defaults: DEFAULTS,
  }),
});

// -------------------------------------------------------------- the checks

server.tool('load_math', {
  description:
    'The load arithmetic: checks/day x refocus minutes x working days, at the conservative floor ' +
    'and the literature figure (and a caller-supplied figure if given), as minutes/day, hours/week ' +
    'and hours/year — priced at the buyer\'s hourly rate when one is passed. Every assumption is ' +
    'echoed back for showing next to the numbers. Arithmetic only: it does not measure anything, ' +
    'and the result is labelled a projection, not a gain. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      checks_per_day: { type: 'number', description: 'Screen checks per working day, from observed or logged real sessions.' },
      refocus_minutes: { type: 'number', description: 'Optional extra figure to compute alongside the two stated bounds. Name its source wherever it is shown.' },
      working_days_per_week: { type: 'number', description: `Default ${DEFAULTS.working_days_per_week}.` },
      working_weeks_per_year: { type: 'number', description: `Default ${DEFAULTS.working_weeks_per_year}.` },
      hourly_rate: { type: 'number', description: 'The buyer\'s own billable rate, to price the hours. Omit for time-only output.' },
      currency: { type: 'string', description: 'Label for the rate, e.g. "USD". Cosmetic only.' },
    },
    required: ['checks_per_day'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return computeLoad(args);
  },
});

server.tool('mapping_audit', {
  description:
    'A recorded event->class mapping checked mechanically against the stated rules, with the ' +
    'entries quoted: ambient or noise events carrying a haptic, act_now/done events without one, ' +
    'events feeding no decision, the act_now ceiling, and the class distribution with its quiet ' +
    'share. Facts only — it never decides which class an event belongs in. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        description: 'The mapping, one entry per event.',
        items: {
          type: 'object',
          properties: {
            event: { type: 'string', description: 'What happens, e.g. "render failed".' },
            class: { type: 'string', description: 'act_now, done, ambient or noise.' },
            decision_fed: { type: 'string', description: 'The decision this check feeds. Pass an empty string to record that it feeds none.' },
            haptic: { type: ['string', 'boolean'], description: 'The assigned pattern id, true if assigned but unnamed, or omit for none.' },
          },
          required: ['event', 'class'],
        },
      },
    },
    required: ['events'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return auditMapping(args);
  },
});

server.tool('vocabulary_check', {
  description:
    'A proposed pattern set checked mechanically against the vocabulary rules, with the evidence ' +
    'quoted: the 3-5 limit, duplicate meanings, collisions on the count/intensity/rhythm axes, ' +
    'pairs that differ only in intensity, and the failure-distinctiveness rule. Facts only — ' +
    'whether the patterns feel different on real hardware is what the blind test decides. ' +
    'Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        description: 'The proposed vocabulary, one entry per pattern.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'A short pattern id, e.g. "double_tap".' },
            meaning: { type: 'string', description: 'The one meaning, as it would be taught in a sentence.' },
            count: { type: 'number', description: 'Taps or pulses.' },
            intensity: { type: 'string', description: 'low, medium or high.' },
            rhythm: { type: 'string', description: 'A short label, e.g. "even", "long-short", "rising".' },
            is_failure: { type: 'boolean', description: 'Mark the failure pattern so the distinctiveness rule can be checked.' },
          },
          required: ['id'],
        },
      },
    },
    required: ['patterns'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return checkVocabulary(args);
  },
});

// ------------------------------------------------------------ close the loop

server.tool('log_session', {
  description:
    'Record one working session\'s counts in the local measurement log: phase (baseline before ' +
    'the mapping ships, after once it has), duration, screen checks, and — after only — haptics ' +
    'delivered and acted on, which feed the trust metric. Requires a paid plan. Nothing leaves ' +
    'this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      phase: { type: 'string', description: `${PHASES.join(' or ')}.` },
      session_date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
      duration_minutes: { type: 'number', description: 'Length of the working session.' },
      checks: { type: 'number', description: 'Screen checks during the session.' },
      haptics_delivered: { type: 'number', description: 'After phase only: haptics delivered during the session.' },
      haptics_acted_on: { type: 'number', description: 'After phase only: how many of those the user acted on.' },
      notes: { type: 'string', description: 'What kind of work the session was, so comparability can be defended later.' },
    },
    required: ['phase', 'duration_minutes', 'checks'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return logSession(args);
  },
});

server.tool('review_sessions', {
  description:
    'The measurement log with its computed position: per-phase checks-per-hour averages with ' +
    'small-sample notes, the baseline-to-after drop share, the trust metric (share of delivered ' +
    'haptics acted on) with the crying-wolf flag, and the stated usual causes when checks did not ' +
    'drop. Counting and division only; whether the sessions were comparable is the user\'s claim ' +
    'to defend. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Sessions to list. Default 20.' },
    },
  },
  handler: async ({ limit }) => {
    await client.requireFeature('tools');
    return reviewSessions({ limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
