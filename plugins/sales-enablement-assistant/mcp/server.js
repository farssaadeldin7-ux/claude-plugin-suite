#!/usr/bin/env node
/**
 * Sales Enablement Assistant — MCP server.
 *
 * The deterministic half of the method: the ranked trigger hierarchy with its
 * freshness arithmetic, the anatomy thresholds and the mechanical draft lint
 * (facts with evidence, never judgements), the working-day sequence
 * arithmetic, and the local outreach log that enforces three-touches-then-stop.
 * The judgement half — whether an opening survives find-and-replace, whether
 * the body carries one idea, whether an account is worth a touch at all —
 * lives in the skill, and nothing here outputs a reply-rate, a score or a
 * verdict on a draft.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  TRIGGERS, OTHER_EVENTS, NOT_TRIGGERS, NOT_TRIGGERS_RULE, STALENESS_RULE,
  MULTIPLE_TRIGGERS_RULE, REQUIRED_FIELDS_NOTE, triggerByRank, checkTrigger,
} from './lib/triggers.js';
import {
  ANATOMY, HARD_CONSTRAINTS, SUBJECT_RULES, SUBJECT_EXAMPLES, FIND_AND_REPLACE_TEST,
  FIND_AND_REPLACE_EXAMPLES, ASK_EXAMPLES, ASK_RULE, FORMATTING_RULES, FINISHED_WHEN,
  NEVER_ADD, COMPLIANCE_CHECKLIST, COMPLIANCE_NOTE,
} from './lib/anatomy.js';
import {
  TELLS_PREAMBLE, TELLS, LOW_FREQUENCY_TELLS, SELF_AUDIT, HUMAN_TELLS, tellById,
} from './lib/tells.js';
import { lintMessage } from './lib/lint.js';
import { planSequence } from './lib/sequence.js';
import { logOutreach, reviewOutreach, OUTCOMES } from './lib/outreach.js';

const PLUGIN_ID = 'sales-enablement-assistant';
const PLUGIN_NAME = 'Sales Enablement Assistant';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the hierarchy, the anatomy and the tell list stay open so the
// method can be evaluated before buying; the checks, the arithmetic and the
// outreach log are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for B2B outreach. Call trigger_hierarchy for the ranked triggers and ' +
    'what is not one, trigger_check for the freshness arithmetic on a dated event, message_lint for ' +
    'the mechanical failures in a draft with the evidence quoted, sequence_plan for the three-touch ' +
    'dates, and log_outreach / review_outreach for the local log that enforces the breakup rule. ' +
    'None of these judge a draft or verify an event — that is the skill\'s and the user\'s job — ' +
    'and nothing here predicts a reply rate.',
});

// ------------------------------------------------------------------- browse

server.tool('trigger_hierarchy', {
  description:
    'The ranked trigger hierarchy: seven trigger types from funding rounds down to public ' +
    'commentary, each with where to verify it, its freshness window, what to do with it and its ' +
    'failure mode — plus the list of things that are not triggers and the staleness rule. Reference ' +
    'data only; it does not look anything up about a real account. Omit rank to list all of them.',
  inputSchema: {
    type: 'object',
    properties: {
      rank: { type: 'number', description: '1 to 7 for one trigger in full. Omit for the whole hierarchy.' },
    },
  },
  handler: async ({ rank }) => {
    if (rank !== undefined) {
      const trigger = triggerByRank(rank);
      if (!trigger) throw new ToolError('unknown_rank', `"${rank}" is not a rank — use 1 to 7.`);
      return { ...trigger, required_in_brief: REQUIRED_FIELDS_NOTE, staleness: STALENESS_RULE };
    }
    return {
      rule: 'No trigger, no email. Work down the hierarchy and take the strongest trigger you can verify, not the first you find.',
      required_in_brief: REQUIRED_FIELDS_NOTE,
      triggers: TRIGGERS.map(({ rank: r, name, freshness }) => ({ rank: r, name, freshness })),
      other_dated_events: OTHER_EVENTS.rule,
      not_triggers: NOT_TRIGGERS,
      not_triggers_rule: NOT_TRIGGERS_RULE,
      staleness: STALENESS_RULE,
      multiple_triggers: MULTIPLE_TRIGGERS_RULE,
    };
  },
});

server.tool('message_anatomy', {
  description:
    'The structural constraints a first-touch message is measured against: the four-part anatomy ' +
    'with word budgets, the hard thresholds (under 120 words, one question, one link at most), ' +
    'subject-line rules with good and bad examples, the find-and-replace test with worked passes ' +
    'and failures, the 15-second ask, the formatting rules, the compliance checklist by ' +
    'jurisdiction, and the list of things this plugin will never write into a message. Reference ' +
    'data only — message_lint is what measures a draft against it.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    anatomy: ANATOMY,
    hard_constraints: HARD_CONSTRAINTS,
    subject_lines: { rules: SUBJECT_RULES, examples: SUBJECT_EXAMPLES },
    find_and_replace_test: { rule: FIND_AND_REPLACE_TEST, examples: FIND_AND_REPLACE_EXAMPLES },
    the_ask: { rule: ASK_RULE, examples: ASK_EXAMPLES },
    formatting: FORMATTING_RULES,
    finished_when: FINISHED_WHEN,
    never_add: {
      rule: 'This plugin will not write, and the sender should not add:',
      items: NEVER_ADD,
      why: 'Fabrication is the fastest way to lose the account permanently. Decline the item and offer the honest version.',
    },
    compliance: { note: COMPLIANCE_NOTE, checklist: COMPLIANCE_CHECKLIST },
  }),
});

server.tool('ai_tells', {
  description:
    'The markers that make a message read as AI-written, in roughly the order readers notice them, ' +
    'each with a before and after rewrite — plus the lower-frequency tells, the ten-point pre-send ' +
    'self-audit, and what a human tell looks like. Reference data only; message_lint is what scans ' +
    'a draft for them. Omit tell to list all of them.',
  inputSchema: {
    type: 'object',
    properties: {
      tell: { type: 'string', description: 'A tell id from the list, e.g. "em_dash_cadence", for one tell in full.' },
    },
  },
  handler: async ({ tell }) => {
    if (tell !== undefined) {
      const found = tellById(tell);
      if (!found) {
        throw new ToolError('unknown_tell', `No tell "${tell}".`, { available: TELLS.map((t) => t.id) });
      }
      return found;
    }
    return {
      preamble: TELLS_PREAMBLE,
      tells: TELLS,
      lower_frequency: LOW_FREQUENCY_TELLS,
      self_audit: SELF_AUDIT,
      what_a_human_tell_looks_like: HUMAN_TELLS,
    };
  },
});

// -------------------------------------------------------------- the checks

server.tool('trigger_check', {
  description:
    'Date arithmetic on a claimed trigger against the freshness table: days since the event, ' +
    'whether it is inside its window, and what the table says about that rank — including the ' +
    'inversion rule when it is stale. It does not verify that the event happened or that a source ' +
    'exists; that research is the user\'s. Firmographics have no rank and cannot be checked here — ' +
    'they are a stop condition. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      rank: { type: ['number', 'string'], description: '1 to 7, or "other" for an unlisted dated event (treated at rank-6-equivalent strength).' },
      event_date: { type: 'string', description: 'When the event happened, YYYY-MM-DD.' },
      deadline: { type: 'string', description: 'Rank 5 only: the regulatory deadline, YYYY-MM-DD.' },
      posting_closed: { type: 'boolean', description: 'Rank 3 only: whether the posting has closed.' },
      as_of: { type: 'string', description: 'Check as of this date, YYYY-MM-DD. Defaults to today.' },
    },
    required: ['rank', 'event_date'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return checkTrigger(args);
  },
});

server.tool('message_lint', {
  description:
    'Mechanical checks on a draft with the evidence quoted: word count against the 120 threshold, ' +
    'question and link and em-dash counts, calendar asks, tell phrases from the scan list, ' +
    'sentence-length balance, subject-line rules, and a pattern scan for opt-out and postal-address ' +
    'lines with the compliance checklist. Facts only — no scores, no verdicts, no reply-rate. The ' +
    'find-and-replace test and the one-idea check are judgements it does not make. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      body: { type: 'string', description: 'The draft body, exactly as it would send, greeting and sign-off included.' },
      subject: { type: 'string', description: 'The subject line, to check against the subject rules.' },
      company_name: { type: 'string', description: 'The recipient company, so the subject can be checked for it.' },
      first_name: { type: 'string', description: 'The recipient\'s first name, so the subject can be checked for it.' },
      jurisdiction: { type: 'string', description: 'EU, UK, US or Canada, to narrow the compliance checklist. Omit if unknown.' },
    },
    required: ['body'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    if (!args.body?.trim()) throw new ToolError('empty_draft', 'There is nothing to lint — pass the draft body.');
    return lintMessage(args);
  },
});

server.tool('sequence_plan', {
  description:
    'The three-touch sequence as dates: touch 2 at +4 working days, touch 3 at +7 working days ' +
    'after it, and the 90-day quiet date after the breakup — plus what each touch must add and the ' +
    'rules that end a sequence early. Working-day arithmetic skips weekends only, not public ' +
    'holidays. It does not write the touches. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      first_touch_date: { type: 'string', description: 'The day touch 1 sends, YYYY-MM-DD.' },
    },
    required: ['first_touch_date'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return planSequence(args);
  },
});

// ------------------------------------------------------------ close the loop

server.tool('log_outreach', {
  description:
    'Record a touch or an outcome against an account in the local outreach log. The sequence rules ' +
    'are enforced mechanically: touches go 1, 2, 3 in order; there is no touch 4; an opted-out ' +
    'account is never reopened; and reopening a previously worked account needs a rank 1-3 ' +
    'trigger. Requires a paid plan. Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      account: { type: 'string', description: 'The account name.' },
      buyer: { type: 'string', description: 'The named person the sequence is aimed at.' },
      touch: { type: 'number', description: '1, 2 or 3.' },
      sent_on: { type: 'string', description: 'When it sent, YYYY-MM-DD. Defaults to today.' },
      trigger_rank: { type: 'number', description: 'The trigger\'s rank, 1 to 7. Required as 1-3 when reopening a previously worked account.' },
      trigger_summary: { type: 'string', description: 'One line: what happened, the source, the date.' },
      outcome: { type: 'string', description: `How the sequence ended: ${OUTCOMES.join(', ')}.` },
      notes: { type: 'string' },
    },
    required: ['account'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return logOutreach(args);
  },
});

server.tool('review_outreach', {
  description:
    'The outreach log with each account\'s computed position: which touch is due and when, which ' +
    'sequences are complete and quiet until what date, who replied and who opted out, and a plain ' +
    'tally. Date arithmetic and counting only; it makes no new claim about any account. Requires a ' +
    'paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Accounts to list. Default 20.' },
      as_of: { type: 'string', description: 'Compute due dates as of this date, YYYY-MM-DD. Defaults to today.' },
    },
  },
  handler: async ({ limit, as_of }) => {
    await client.requireFeature('tools');
    return reviewOutreach({ limit: limit ?? 20, as_of });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
