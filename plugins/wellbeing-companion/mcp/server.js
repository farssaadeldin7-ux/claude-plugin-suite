#!/usr/bin/env node
/**
 * Wellbeing Companion — MCP server.
 *
 * The deterministic half of the design protocol: the escalation trigger list
 * and response rules served verbatim, mechanical validation of a regional
 * crisis-resource block, the scope statement in publishable wording, the
 * red-team specification, and the binary change-control gate with its local
 * run record. The judgement half — writing a scope for a specific deployment,
 * reviewing a design, deciding what a finding means — lives in the skill, and
 * nothing here estimates severity, scores a transcript, or decides whether a
 * trigger applies.
 *
 * The escalation and resource tools are open on purpose: a safety protocol is
 * not paywalled. The licence gates the builder's workflow tools only.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  ONE_RULE, TRIGGER_CATEGORIES, INDIRECT_PHRASINGS_NOTE, DETECTOR_DESIGN,
  RESPONSE_CONSTRAINTS, RESPONSE_SHAPES, OUT_OF_HOURS, HANDOVER_PACKET,
  HANDOVER_NOTE, WHAT_NEVER_HAPPENS, triggerCategory,
} from './lib/escalation.js';
import { RESOURCE_RULES, NO_GENERATED_NUMBERS, checkResourceConfig } from './lib/resources.js';
import {
  IN_SCOPE, OUT_OF_SCOPE, HARD_STOP, DECLINING_PATTERN, LANGUAGE_RULES,
  ENGAGEMENT_NOTE, POPULATIONS_NEEDING_SEPARATE_DESIGN, SCOPE_CHANGE_RULE,
} from './lib/scope.js';
import {
  REDTEAM_MINIMUM, REDTEAM_SLICES, REDTEAM_CONSTRUCTION, METRICS,
  CHANGE_CONTROL, INCIDENT_DEFINITION, INCIDENT_REVIEW, ROLES, ROLES_RULE,
  evaluationGate,
} from './lib/evaluation.js';
import { recordRun, reviewRuns, RUNS_FILE } from './lib/runs.js';

const PLUGIN_ID = 'wellbeing-companion';
const PLUGIN_NAME = 'Wellbeing Companion';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier, but the split is not the usual one: everything escalation- or
// safety-related is open regardless of licence, because a safety protocol must
// not sit behind a paywall. The licence gates the builder's workflow tools —
// scope wording, red-team specification, the gate arithmetic and the run record.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Design-protocol lookups for a boundaried wellbeing support conversation. This is a builder\'s ' +
    'tool: it serves the escalation trigger list, response rules and resource-block checks (open), ' +
    'and the scope wording, red-team specification and change-control gate (licensed). It does not ' +
    'assess anyone, score transcripts, judge severity, or generate crisis phone numbers. If a ' +
    'person in distress is present, do not run this protocol at them — follow the skill\'s ' +
    'guidance and help them find support where they are.',
});

// --------------------------------------------------------- escalation (open)

server.tool('escalation_triggers', {
  description:
    'The nine mechanical escalation trigger categories, verbatim from the protocol, including the ' +
    'indirect phrasings and the conversational thresholds. Open to everyone — this list is never ' +
    'behind the licence. It is a lookup, not a detector: it does not classify text or judge severity.',
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'number', description: 'Optional single category number, 1 to 9.' },
    },
  },
  handler: async ({ category }) => {
    if (category !== undefined) {
      const match = triggerCategory(category);
      if (!match) {
        throw new ToolError('unknown_category', `No trigger category ${category}.`, {
          available: TRIGGER_CATEGORIES.map((c) => c.category),
        });
      }
      return { one_rule: ONE_RULE, trigger: match };
    }
    return {
      one_rule: ONE_RULE,
      triggers: TRIGGER_CATEGORIES,
      indirect_phrasings: INDIRECT_PHRASINGS_NOTE,
      detector_design: DETECTOR_DESIGN,
    };
  },
});

server.tool('escalation_response', {
  description:
    'What happens when a trigger fires, verbatim from the protocol: the four response constraints, ' +
    'the response shapes (standard and medical emergency), the out-of-hours rule, the handover ' +
    'packet fields and the list of things that never happen. Open to everyone — never behind the ' +
    'licence. All bracketed values in the shapes come from the deployment\'s own configuration; ' +
    'nothing here supplies a phone number.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    one_rule: ONE_RULE,
    response_constraints: RESPONSE_CONSTRAINTS,
    response_shapes: RESPONSE_SHAPES,
    out_of_hours: OUT_OF_HOURS,
    handover_packet: HANDOVER_PACKET,
    handover_note: HANDOVER_NOTE,
    what_never_happens: WHAT_NEVER_HAPPENS,
  }),
});

server.tool('resource_config_check', {
  description:
    'Mechanically validate a regional crisis-resource configuration block: required fields, date ' +
    'format, the quarterly re-verification cadence, and staleness — a stale block fails. Open to ' +
    'everyone — never behind the licence. It checks shape and dates only; it cannot verify that a ' +
    'number is right, and it will not generate resources or numbers itself.',
  inputSchema: {
    type: 'object',
    properties: {
      config: {
        type: 'object',
        description:
          'The resource block: { region, verified_on, verified_by, review_due, services: ' +
          '[{ name, contact, hours, notes? }] }. Dates in YYYY-MM-DD.',
      },
    },
    required: ['config'],
  },
  handler: async ({ config }) => ({
    ...checkResourceConfig(config),
    rules: RESOURCE_RULES,
    never_generated: NO_GENERATED_NUMBERS,
  }),
});

// ----------------------------------------------------- scope wording (licensed)

server.tool('scope_statement', {
  description:
    'The three scope lists in publishable wording — in scope, out of scope with what to say ' +
    'instead, hard stop — plus the declining pattern, the language rules, the engagement warning ' +
    'and the populations needing separate design. Wording lookup only; it does not tailor the ' +
    'scope to a deployment. Requires a paid plan (the trigger list itself stays open).',
  inputSchema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description:
          'Optional single section: in_scope, out_of_scope, hard_stop, declining, language, ' +
          'engagement, populations.',
      },
    },
  },
  handler: async ({ section }) => {
    await client.requireFeature('tools');
    const sections = {
      in_scope: { in_scope: IN_SCOPE },
      out_of_scope: { out_of_scope: OUT_OF_SCOPE, scope_change_rule: SCOPE_CHANGE_RULE },
      hard_stop: { hard_stop: HARD_STOP },
      declining: { declining_without_rejecting: DECLINING_PATTERN },
      language: { language_rules: LANGUAGE_RULES },
      engagement: { engagement_is_not_a_goal: ENGAGEMENT_NOTE },
      populations: { populations_needing_separate_design: POPULATIONS_NEEDING_SEPARATE_DESIGN },
    };
    if (section) {
      if (!sections[section]) {
        throw new ToolError('unknown_section', `No section "${section}".`, {
          available: Object.keys(sections),
        });
      }
      return sections[section];
    }
    return Object.assign({}, ...Object.values(sections));
  },
});

// ------------------------------------------------------ evaluation (licensed)

server.tool('redteam_spec', {
  description:
    'The red-team set specification — minimum size, the six slices with counts, construction ' +
    'rules — plus the metric definitions, the incident definition and review rules, and the ' +
    'governance roles that must exist before launch. A specification lookup; it does not write ' +
    'transcripts or run anything. Requires a paid plan.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    await client.requireFeature('tools');
    return {
      minimum_transcripts: REDTEAM_MINIMUM,
      slices: REDTEAM_SLICES,
      construction: REDTEAM_CONSTRUCTION,
      metrics: METRICS,
      change_control: CHANGE_CONTROL,
      incident_is_any_of: INCIDENT_DEFINITION,
      incident_review: INCIDENT_REVIEW,
      roles_before_launch: ROLES,
      roles_rule: ROLES_RULE,
    };
  },
});

server.tool('evaluation_gate', {
  description:
    'Compute missed_escalation_rate and over_escalation_rate from a red-team run\'s counts and ' +
    'apply the binary change-control gate: zero missed escalations ships, anything else does not, ' +
    'regardless of what else improved. Arithmetic on counts you supply — it does not measure the ' +
    'run itself. Requires a paid plan; the rules it applies are also stated openly in the skill.',
  inputSchema: {
    type: 'object',
    properties: {
      sessions_with_trigger: { type: 'number', description: 'Sessions in the run containing a trigger.' },
      missed_escalations: { type: 'number', description: 'Sessions with a trigger where no escalation fired.' },
      total_escalations: { type: 'number', description: 'All escalations fired in the run. Optional.' },
      escalations_with_no_trigger: { type: 'number', description: 'Escalations with no trigger present. Optional.' },
    },
    required: ['sessions_with_trigger', 'missed_escalations'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return evaluationGate(args);
  },
});

// ---------------------------------------------------- change control (licensed)

server.tool('record_redteam_run', {
  description:
    'Record a red-team run in the local change-control record — version, what changed, counts, and ' +
    'who approved it — with the gate computed here, not taken on trust. Requires a paid plan. ' +
    'Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      version: { type: 'string', description: 'The model, prompt or configuration version the run tested.' },
      change: { type: 'string', description: 'What changed: model, prompt, retrieval or resource block.' },
      sessions_with_trigger: { type: 'number' },
      missed_escalations: { type: 'number' },
      total_escalations: { type: 'number' },
      escalations_with_no_trigger: { type: 'number' },
      approved_by: { type: 'string', description: 'Who approved the result.' },
      notes: { type: 'string' },
    },
    required: ['version', 'sessions_with_trigger', 'missed_escalations'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    if (!args.version?.trim()) throw new ToolError('invalid_request', 'A version is required.');
    const gate = evaluationGate(args);
    const record = recordRun({
      version: args.version.trim(),
      change: args.change,
      counts: {
        sessions_with_trigger: args.sessions_with_trigger,
        missed_escalations: args.missed_escalations,
        total_escalations: args.total_escalations ?? null,
        escalations_with_no_trigger: args.escalations_with_no_trigger ?? null,
      },
      gate: gate.gate,
      approved_by: args.approved_by,
      notes: args.notes,
    });
    return { recorded: true, run_id: record.id, gate, stored_at: RUNS_FILE };
  },
});

server.tool('review_runs', {
  description:
    'The local record of past red-team runs and a plain tally of gate outcomes. Counting only; it ' +
    'makes no claim about whether the runs were adequate for your population. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'Default 20.' } },
  },
  handler: async ({ limit }) => {
    await client.requireFeature('tools');
    return reviewRuns({ limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
