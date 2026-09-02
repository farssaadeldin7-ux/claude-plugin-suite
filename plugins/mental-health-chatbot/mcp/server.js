#!/usr/bin/env node
/**
 * Mental-Health Chatbot — MCP server.
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
import {
  SUMMARY_TEMPLATE, SESSION_ENDINGS, recordSession, reviewAudit, AUDIT_FILE,
} from './lib/audit.js';
import {
  DETECTION_PHRASES, SCREEN_LIMITS, screenMessage, checkDeployment, draftSummary,
} from './lib/checkin.js';

const PLUGIN_ID = 'mental-health-chatbot';
const PLUGIN_NAME = 'Mental-Health Chatbot';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier, but the split is not the usual one: everything a deployment
// needs to be configured safely — the scope wording, the trigger list, the
// response rules, the resource-block check — is open regardless of licence,
// because neither safety nor setup sits behind a paywall. The licence gates
// the operator's measurement workflow: the red-team specification, the gate
// arithmetic, the run record, the summary template and the session audit log.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Protocol lookups and operator records for a boundaried, non-clinical check-in service. It ' +
    'serves the escalation trigger list, response rules, resource-block checks, scope wording, ' +
    'the deployment gate (deployment_check), the literal-phrase message screen (screen_message — ' +
    'a non-match is never clearance) and the phrase floor (open), and the red-team ' +
    'specification, change-control gate, run record, supervisor-summary template, summary ' +
    'drafter and session audit log (licensed). It does not assess anyone, score transcripts, ' +
    'judge severity, or generate crisis phone numbers, and the audit log holds only categorical ' +
    'fields — never anything a user typed. If a person in distress is present, do not run this ' +
    'protocol at them — follow the skill\'s guidance and help them find support where they are.',
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
    'scope to a deployment. Open, no licence needed: a deployment cannot be configured safely ' +
    'without it, and setup is not paywalled.',
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

// ------------------------------------------------- check-in automation (open)

server.tool('deployment_check', {
  description:
    'The step-1 gate, mechanical: checks that a deployment carries the four artefacts — scope ' +
    'statement (published, hard stops adopted unedited), escalation route (team, hours, a ' +
    'fallback the operator attests is staffed), resource block (validated via the same rules as ' +
    'resource_config_check), confidentiality notice (shown before the first message). ' +
    'ready:false means no check-ins run. Shape checks only — whether the claims are true is the ' +
    'operator\'s attestation, now on record. Open: setup is not paywalled.',
  inputSchema: {
    type: 'object',
    properties: {
      scope_statement: { type: 'object', description: '{ in_scope[], out_of_scope[], hard_stop_confirmed: true, published: true }' },
      escalation_route: { type: 'object', description: '{ team, hours, out_of_hours_fallback, fallback_staffed: true }' },
      resource_block: { type: 'object', description: 'The regional crisis-resource block, same shape as resource_config_check.' },
      confidentiality_notice: { type: 'object', description: '{ who_reads, retention, employer_sees, disclosure_triggers, shown_before_first_message: true }' },
    },
  },
  handler: async (args) => checkDeployment(args),
});

server.tool('screen_message', {
  description:
    'Literal-phrase trigger screen over one user message: matches the detection-phrase floor for ' +
    'all nine categories, evidence quoted, designed to over-trigger. A match means escalate now. ' +
    'A NON-MATCH IS NOT CLEARANCE — paraphrase, misspelling and context escape literal matching, ' +
    'and the model escalates on its own read regardless; session-level triggers (sustained ' +
    'distress, declining twice) are outside a single-message screen. No scores, no severity. ' +
    'Open: the safety surface is never paywalled.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The user message text, verbatim.' },
    },
    required: ['message'],
  },
  handler: async (args) => screenMessage(args),
});

server.tool('detection_phrases', {
  description:
    'The literal detection-phrase floor per trigger category, as data — for building the ' +
    'deployment\'s own detector and its red-team set. A floor, not the detector: the lists ' +
    'deliberately over-trigger and still miss paraphrase. Open.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({ phrases: DETECTION_PHRASES, limits: SCREEN_LIMITS }),
});

// -------------------------------------------- summaries and the audit log

server.tool('draft_summary', {
  description:
    'Draft the supervisor summary\'s quantitative sections mechanically from the audit log for a ' +
    'stated window: participation and endings, escalations by category with case ids only, the ' +
    'operator\'s themes with denominators enforced (below the minimum session count they are ' +
    'withheld, not rounded up), missed escalations surfaced rather than hidden, and the standing ' +
    'caveat verbatim. Numbers only — the prose around them is the skill\'s, inside the same ' +
    'resolution rules. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      since: { type: 'string', description: 'Reporting window start, YYYY-MM-DD.' },
      until: { type: 'string', description: 'Reporting window end, YYYY-MM-DD. Defaults to now.' },
      themes: {
        type: 'array',
        description: 'The themes the operator observed, each with its denominator.',
        items: {
          type: 'object',
          properties: {
            theme: { type: 'string', description: 'The theme, in the deployment\'s own vocabulary.' },
            sessions_behind: { type: 'number', description: 'How many sessions in the window carry it.' },
          },
          required: ['theme', 'sessions_behind'],
        },
      },
      config_version: { type: 'string', description: 'The configuration version in force during the window.' },
    },
    required: ['since'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return draftSummary(args);
  },
});

server.tool('summary_template', {
  description:
    'The supervisor-summary template: sections, the resolution rules (aggregate-only unless the ' +
    'confidentiality notice says otherwise, every claim with its denominator, the minimum session ' +
    'count behind a theme), and the standing caveat that themes are conversational patterns, not ' +
    'clinical findings. Template only — writing the summary against a real period is the skill\'s ' +
    'job, from the deployment\'s own records. Requires a paid plan.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    await client.requireFeature('tools');
    return SUMMARY_TEMPLATE;
  },
});

server.tool('record_session', {
  description:
    'Append one check-in session to the local audit log — categorical fields only: date, ' +
    'configuration version, messages screened, trigger category if one fired, whether it ' +
    'escalated and whether the handover packet was delivered, resources shown, how it ended. ' +
    'There is no free-text field, so nothing a user typed can enter the log. A trigger recorded ' +
    'without an escalation is accepted and flagged — the log captures misses, it does not hide ' +
    'them. Requires a paid plan. Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      session_date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
      config_version: { type: 'string', description: 'The scope statement, trigger list and resource block in force.' },
      messages: { type: 'number', description: 'Messages in the session — each one screened.' },
      trigger_category: { type: 'number', description: 'The trigger category (1-9) that fired, if any. Omit for none.' },
      escalated: { type: 'boolean', description: 'Whether the session escalated to a human.' },
      handover_packet_delivered: { type: 'boolean', description: 'Required when escalated: whether the receiving human got the packet.' },
      resources_shown: { type: 'number', description: 'Resources from the verified block shown this session. Default 0.' },
      ended: { type: 'string', description: `${SESSION_ENDINGS.join(', ')}.` },
    },
    required: ['config_version', 'messages', 'ended'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return recordSession(args);
  },
});

server.tool('review_audit', {
  description:
    'The audit log\'s computed position: session and ending tallies, escalations by category, and ' +
    'the one number the weekly review exists for — sessions containing a trigger where no ' +
    'escalation fired, target zero, each one listed as an incident. Counting only, over what was ' +
    'recorded; it cannot see sessions that were never logged. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      since: { type: 'string', description: 'Only sessions on or after this date, YYYY-MM-DD — e.g. the current reporting window.' },
      limit: { type: 'number', description: 'Sessions to list. Default 20.' },
    },
  },
  handler: async ({ since, limit }) => {
    await client.requireFeature('tools');
    return reviewAudit({ since, limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
