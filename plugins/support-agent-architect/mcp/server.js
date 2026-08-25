#!/usr/bin/env node
/**
 * Support Agent Architect — MCP server.
 *
 * The deterministic half of the method: the classification tables, trigger
 * lists and thresholds from the references, a mechanical taxonomy audit, an
 * article lint with the evidence quoted, a literal-phrase escalation screen,
 * the regression-set arithmetic, and the local run history that makes
 * re-running on every change mean something. The judgement half — whether an
 * intent really is static for this business, whether an article's first two
 * sentences answer it, what a wrong answer costs — lives in the skill, and
 * nothing here classifies a ticket, scores an answer or predicts containment.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  THRESHOLDS, KINDS, THREE_WAY_TEST, EDGE_CASES, CLUSTERING_METHOD,
  VOLUME_FLOOR_NOTE, RECORDING_FORMAT, TAXONOMY_SYMPTOMS, WORKED_TAXONOMIES,
  CEILING_NOTE, normaliseKind, auditTaxonomy,
} from './lib/taxonomy.js';
import {
  ARTICLE_TEMPLATE, TEMPLATE_NOTE, STYLE_RULES, POLICY_VERSUS_PROCEDURE,
  ANTI_PATTERNS, MAINTENANCE, RETRIEVAL_FAILURE_MODES, RETRIEVAL_TEST_NOTE,
  lintArticle,
} from './lib/articles.js';
import {
  TRIGGERS, REFUND_THRESHOLD_NOTE, EXPLICIT_REQUEST_NOTE, HANDOVER_FORMAT,
  HANDOVER_RULES, GROUNDING_CONTRACT, screenMessage,
} from './lib/escalation.js';
import {
  OUTCOMES, COMPOSITION, SCORING_NOTE, METRICS, DEFLECTION_NOTE,
  ROLLOUT_GATES, ROLLBACK_RULE, UNCERTAINTY_NOTES, outcomeIsValid,
  scoreRegression,
} from './lib/evaluation.js';
import { logRun, listRuns, RUNS_FILE } from './lib/runs.js';

const PLUGIN_ID = 'support-agent-architect';
const PLUGIN_NAME = 'Support Agent Architect';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the reference tables stay open so the method can be evaluated
// before buying; the audit, lint, screen, scorer and run history are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for designing the knowledge base and escalation rules behind an AI ' +
    'support agent. The reference tools carry the tables — kinds, triggers, templates, metrics. ' +
    'The audit, lint, screen and scorer apply only the checks those tables state mechanically, ' +
    'with evidence quoted. None of them classify a ticket, judge an answer or predict a ' +
    'containment figure — that is the skill\'s job, done with the user\'s own ticket data.',
});

const pickSection = (sections, section, toolName) => {
  if (!section) return sections;
  if (!(section in sections)) {
    throw new ToolError('unknown_section', `No section "${section}" in ${toolName}.`, {
      available: Object.keys(sections),
    });
  }
  return { [section]: sections[section] };
};

// --------------------------------------------------------------- references

server.tool('taxonomy_reference', {
  description:
    'The intent-classification tables: the three kinds and their agent behaviour, the three-way ' +
    'test with its edge cases, the clustering method and thresholds, the two worked taxonomies ' +
    '(e-commerce and B2B SaaS, illustrative volumes), the recording format and the symptoms of a ' +
    'wrong taxonomy. Reference data only — it does not classify your intents. Omit section to ' +
    'get everything.',
  inputSchema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Optional: kinds, three_way_test, edge_cases, clustering, thresholds, worked_ecommerce, worked_saas, recording_format, symptoms.',
      },
    },
  },
  handler: async ({ section }) => {
    const sections = {
      kinds: { ...KINDS, note: 'No intent gets auto-answered until it has been classified as static, and no article gets written until its intent exists in the taxonomy.' },
      three_way_test: THREE_WAY_TEST,
      edge_cases: EDGE_CASES,
      clustering: { method: CLUSTERING_METHOD, volume_floor: VOLUME_FLOOR_NOTE },
      thresholds: THRESHOLDS,
      worked_ecommerce: WORKED_TAXONOMIES.ecommerce,
      worked_saas: WORKED_TAXONOMIES.saas,
      recording_format: RECORDING_FORMAT,
      symptoms: TAXONOMY_SYMPTOMS,
    };
    return pickSection(sections, section, 'taxonomy_reference');
  },
});

server.tool('article_rules', {
  description:
    'The article architecture: the template, the style rules with their reasons, the ' +
    'policy-versus-procedure split and its one-question test, the five anti-patterns with their ' +
    'rewrites, the maintenance rules, and the four retrieval failure modes. Reference data only — ' +
    'use article_lint to check a draft against the mechanical subset. Omit section to get everything.',
  inputSchema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Optional: template, style_rules, policy_versus_procedure, anti_patterns, maintenance, retrieval_failure_modes.',
      },
    },
  },
  handler: async ({ section }) => {
    const sections = {
      template: { template: ARTICLE_TEMPLATE, note: TEMPLATE_NOTE },
      style_rules: STYLE_RULES,
      policy_versus_procedure: POLICY_VERSUS_PROCEDURE,
      anti_patterns: ANTI_PATTERNS,
      maintenance: MAINTENANCE,
      retrieval_failure_modes: { modes: RETRIEVAL_FAILURE_MODES, test: RETRIEVAL_TEST_NOTE },
    };
    return pickSection(sections, section, 'article_rules');
  },
});

server.tool('escalation_reference', {
  description:
    'The escalation and evaluation rules: the hard-trigger table with its detection cues, the ' +
    'refund-threshold guidance, the handover format and its rules, the grounding contract, the ' +
    'regression-set composition, the four outcomes, the metric definitions with formulas and ' +
    'targets, and the rollout gates. Reference data only. Omit section to get everything.',
  inputSchema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Optional: triggers, refund_threshold, handover, grounding_contract, regression_set, outcomes, metrics, rollout_gates, limits.',
      },
    },
  },
  handler: async ({ section }) => {
    const sections = {
      triggers: {
        note: 'Evaluated before retrieval, on the incoming message and on conversation state. If any fires, the agent hands over — it does not attempt an answer first.',
        triggers: TRIGGERS.map(({ id, label, detection, why, additional }) => ({
          id, label, detection, why, ...(additional ? { additional: 'worth adding for most businesses' } : {}),
        })),
        explicit_request: EXPLICIT_REQUEST_NOTE,
      },
      refund_threshold: REFUND_THRESHOLD_NOTE,
      handover: { format: HANDOVER_FORMAT, rules: HANDOVER_RULES },
      grounding_contract: GROUNDING_CONTRACT,
      regression_set: { composition: COMPOSITION, scoring: SCORING_NOTE },
      outcomes: OUTCOMES,
      metrics: { definitions: METRICS, deflection: DEFLECTION_NOTE },
      rollout_gates: { gates: ROLLOUT_GATES, rollback: ROLLBACK_RULE },
      limits: UNCERTAINTY_NOTES,
    };
    return pickSection(sections, section, 'escalation_reference');
  },
});

// -------------------------------------------------------------------- audit

server.tool('taxonomy_audit', {
  description:
    'Audit a recorded ticket taxonomy against the method\'s stated thresholds: the 500-ticket ' +
    'volume floor, top-20 coverage of 70%, shares summing to 100%, the 0.5% article threshold, ' +
    'the policy-change rule, missing resolution paths, unclassified intents and the 15% ' +
    'multi-intent limit. Computes the containment ceiling by the step-2 arithmetic — static share ' +
    'plus automatable account-specific share — and the ordered article backlog. It does not ' +
    're-classify intents and names no realistic containment figure, only the ceiling. Requires a ' +
    'paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      intents: {
        type: 'array',
        description: 'The taxonomy rows.',
        items: {
          type: 'object',
          properties: {
            intent: { type: 'string', description: 'The intent, in the customer\'s words.' },
            volume_percent: { type: 'number', description: 'Share of ticket volume, as a percentage.' },
            kind: { type: 'string', description: 'static, account (account-specific) or judgement. Omit if genuinely unknown — it will be treated as unclassified, which defaults to escalation.' },
            resolution_path: { type: 'string', description: 'What the human currently does, step by step.' },
            lookup_available: { type: 'boolean', description: 'For account-specific intents: whether a live lookup exists. Absent counts as no lookup.' },
            safety_adjacent: { type: 'boolean', description: 'Safety-, legal- or accessibility-adjacent — exempt from the 0.5% article threshold.' },
            plan_or_region_dependent: { type: 'boolean', description: 'For static intents: whether the answer varies by plan, region or currency.' },
            answer_changes_last_quarter: { type: 'number', description: 'How many times the answer changed last quarter.' },
          },
          required: ['intent'],
        },
      },
      total_tickets: { type: 'number', description: 'Tickets in the export window. Needed for the 500-ticket volume floor check.' },
      window_days: { type: 'number', description: 'Days the export covers.' },
      tail_percent: { type: 'number', description: 'Combined share of everything below the listed intents.' },
      multi_intent_percent: { type: 'number', description: 'Share of tickets carrying more than one intent.' },
    },
    required: ['intents'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    if (!Array.isArray(args.intents) || !args.intents.length) {
      throw new ToolError('invalid_request', 'At least one intent row is required.');
    }
    for (const row of args.intents) {
      if (row.kind != null && !normaliseKind(row.kind)) {
        throw new ToolError('unknown_kind', `"${row.kind}" is not a kind.`, {
          valid: ['static', 'account', 'judgement'],
          note: 'Omit kind if it is genuinely unknown — unclassified defaults to escalation.',
        });
      }
    }
    return auditTaxonomy(args);
  },
});

// --------------------------------------------------------------------- lint

server.tool('article_lint', {
  description:
    'Mechanical checks on one drafted article with the evidence quoted: length over 400 words, a ' +
    'title without a question, missing "Applies to", owner or review date, preamble phrases before ' +
    'the answer, failure talk with no literal error string, policy-looking values in a procedure ' +
    'article, region words under an "all customers" scope, plus the template sections present and ' +
    'the extracted first two sentences. Facts only — whether the first two sentences answer the ' +
    'intent is a judgement it does not make, and set-level failures (near-duplicates, stale ' +
    'outranking) are outside a single-article lint. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The article title.' },
      body: { type: 'string', description: 'The full article text, including the metadata lines.' },
      kind: { type: 'string', description: 'policy or procedure, if not declared in a "Kind:" line in the body.' },
    },
    required: ['body'],
  },
  handler: async ({ title, body, kind }) => {
    await client.requireFeature('tools');
    if (kind && !['policy', 'procedure'].includes(String(kind).toLowerCase())) {
      throw new ToolError('invalid_kind', `"${kind}" is not an article kind — use "policy" or "procedure".`);
    }
    return lintArticle({ title, body, kind });
  },
});

// ------------------------------------------------------------------- screen

server.tool('escalation_screen', {
  description:
    'Screen one customer message, plus any supplied conversation state, against the hard-trigger ' +
    'table\'s literal detection phrases, quoting every match. Literal matching only: it misses ' +
    'paraphrase, reads no sentiment, and a message can require escalation without matching ' +
    'anything here — no match is not clearance. For exercising the trigger list against real ' +
    'ticket text, not a replacement for the agent\'s own trigger implementation. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The customer message, verbatim.' },
      turns_without_resolution: { type: 'number', description: 'Agent responses so far without resolution in this conversation.' },
      refund_amount: { type: 'number', description: 'Requested or implied refund amount, if any.' },
      refund_threshold: { type: 'number', description: 'Your refund limit, in the same currency.' },
      vip_account: { type: 'boolean', description: 'Whether the account is above your VIP or enterprise revenue threshold.' },
    },
    required: ['message'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    if (!String(args.message ?? '').trim()) {
      throw new ToolError('invalid_request', 'A message is required.');
    }
    return screenMessage(args);
  },
});

// ------------------------------------------------------------ regression set

server.tool('regression_score', {
  description:
    'Compute the metrics for one scored regression run by the stated formulas — containment, ' +
    'accuracy on contained, false-containment, over-escalation — check the set\'s composition ' +
    'minimums, flag internally inconsistent cases, and read the two rollout gates a regression ' +
    'run can assess. Arithmetic over outcomes a person has already assigned: it does not judge ' +
    'whether any answer was correct. Set record to true to add the run to the local history. ' +
    'Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      cases: {
        type: 'array',
        description: 'One entry per scored case.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Your case id, for the inconsistency report.' },
            outcome: { type: 'string', description: 'correct_contained, correct_escalated, over_escalated or false_contained.' },
            must_escalate: { type: 'boolean', description: 'This case must escalate — one of the composition\'s 10.' },
            near_miss: { type: 'boolean', description: 'Wording resembles a static intent but requires a lookup or a judgement.' },
            no_answer_in_kb: { type: 'boolean', description: 'No correct answer exists in the knowledge base — "I don\'t know" is the only pass.' },
          },
          required: ['outcome'],
        },
      },
      record: { type: 'boolean', description: 'Also record this run in the local history on this machine. Nothing leaves this computer.' },
      label: { type: 'string', description: 'Short name for the recorded run, e.g. "v3 articles".' },
      change_note: { type: 'string', description: 'What changed since the previous run — article edit, prompt change, retriever change.' },
    },
    required: ['cases'],
  },
  handler: async ({ cases, record, label, change_note }) => {
    await client.requireFeature('tools');
    if (!Array.isArray(cases) || !cases.length) {
      throw new ToolError('invalid_request', 'At least one scored case is required.');
    }
    const invalid = cases.find((c) => !outcomeIsValid(c.outcome));
    if (invalid) {
      throw new ToolError('unknown_outcome', `"${invalid.outcome}" is not an outcome.`, {
        valid: Object.keys(OUTCOMES),
      });
    }

    const result = scoreRegression(cases);
    if (record) {
      const saved = logRun({ label, change_note, cases: result.cases, counts: result.counts, metrics: result.metrics });
      return { ...result, recorded: true, run_id: saved.id, stored_at: RUNS_FILE };
    }
    return result;
  },
});

server.tool('regression_history', {
  description:
    'The recorded regression runs on this machine, newest first, each with the arithmetic ' +
    'difference from the previous run in percentage points. Counting and subtraction only — it ' +
    'does not say whether a movement is significant, and nothing leaves this computer. Requires a ' +
    'paid plan.',
  inputSchema: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'Default 20.' } },
  },
  handler: async ({ limit }) => {
    await client.requireFeature('tools');
    return listRuns({ limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
