#!/usr/bin/env node
/**
 * 5-Minute Fluency — MCP server.
 *
 * The deterministic half of the method: the symptom-to-cause table with its
 * discriminating questions, the genre-axis data, the fixed sheet format, the
 * yield arithmetic with its thresholds and hard constraints, the mechanical
 * sheet lint, and the local sheet log that scores the success checks. The
 * judgement half — reading the player's answers, naming the root cause,
 * scoring Impact, Transfer and Cost, writing the three changes — lives in the
 * skill, and nothing here diagnoses a player or invents a score.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import { SYMPTOMS, USAGE_RULES, symptomFor } from './lib/symptoms.js';
import { GENRES, UNLISTED_GAMES, AXIS_CHECK, genreFor } from './lib/genres.js';
import {
  SECTIONS, TEMPLATE, CUT_LIST_FORMAT, LENGTH_RULE,
  TRIGGER_RULES, TRIGGER_EXAMPLES, SUCCESS_CHECK_RULE, SUCCESS_CHECK_EXAMPLES,
  FORMAT_FAILURES,
} from './lib/template.js';
import { FACTORS, THRESHOLDS, CONSTRAINTS, candidateProblems, scoreChanges } from './lib/yield.js';
import { lintSheet } from './lib/lint.js';
import { logSheet, recordSession, reviewSheets, SHEETS_FILE } from './lib/sheets.js';

const PLUGIN_ID = 'five-minute-fluency';
const PLUGIN_NAME = '5-Minute Fluency';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the symptom map, genre axes and sheet format stay open so the
// method can be evaluated before buying; the scoring, lint and sheet log are
// licensed behind the single 'tools' feature.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for building a one-page cheat sheet: three changes maximum, ranked ' +
    'by yield. Call symptom_map for the discriminating questions, genre_axes for the axis the ' +
    'advice must sit on, score_changes to rank candidates, and sheet_lint to check the draft ' +
    'against the fixed format. None of these diagnose the player or write the sheet — that is ' +
    'the skill\'s job — and nothing here knows the current patch, tier list or any balance number.',
});

// ------------------------------------------------------------ knowledge base

server.tool('symptom_map', {
  description:
    'The symptom-to-root-cause table: for each common complaint ("I keep dying", "I plateau"), ' +
    'the candidate causes, what each looks like, and the one discriminating question that ' +
    'eliminates the most candidates. Genre-general lookup data — it does not diagnose anyone; ' +
    'reading the answers is the skill\'s job. Omit symptom to list all of them.',
  inputSchema: {
    type: 'object',
    properties: {
      symptom: {
        type: 'string',
        description: `One of: ${Object.keys(SYMPTOMS).join(', ')}.`,
      },
    },
  },
  handler: async ({ symptom }) => {
    if (symptom) {
      const entry = symptomFor(symptom);
      if (!entry) {
        throw new ToolError('unknown_symptom', `No symptom "${symptom}".`, {
          available: Object.keys(SYMPTOMS),
        });
      }
      return { ...entry, usage_rules: USAGE_RULES };
    }
    return {
      symptoms: Object.fromEntries(
        Object.entries(SYMPTOMS).map(([id, s]) => [id, { complaint: s.complaint, causes: s.causes.length }])
      ),
      usage_rules: USAGE_RULES,
    };
  },
});

server.tool('genre_axes', {
  description:
    'Per genre — MOBA, hero shooter, tactical FPS, fighting game, RTS/auto-battler, racing — the ' +
    'primary skill axis, the common plateau, the highest-yield drill under ten minutes, what is ' +
    'patch-sensitive (ask or mark [verify]) and what is structural and safe. Includes the ' +
    'mappings for unlisted games. Static reference data — no live meta, no tier lists.',
  inputSchema: {
    type: 'object',
    properties: {
      genre: { type: 'string', description: `One of: ${Object.keys(GENRES).join(', ')}.` },
    },
  },
  handler: async ({ genre }) => {
    if (genre) {
      const entry = genreFor(genre);
      if (!entry) {
        throw new ToolError('unknown_genre', `No genre "${genre}".`, {
          available: Object.keys(GENRES),
          if_the_game_is_not_listed: UNLISTED_GAMES,
        });
      }
      return { ...entry, axis_check: AXIS_CHECK };
    }
    return {
      genres: Object.fromEntries(
        Object.entries(GENRES).map(([id, g]) => [id, { label: g.label, axis: g.axis, plateau: g.plateau }])
      ),
      if_the_game_is_not_listed: UNLISTED_GAMES,
      axis_check: AXIS_CHECK,
    };
  },
});

server.tool('sheet_format', {
  description:
    'The fixed one-page format: section order, the template, the trigger-phrase rules with weak ' +
    'and strong examples, the success-check rule, the cut-list format, and the table of common ' +
    'format failures. The format itself — it contains no advice and writes nothing.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    sections_in_order: SECTIONS,
    template: TEMPLATE,
    cut_list: CUT_LIST_FORMAT,
    length_rule: LENGTH_RULE,
    trigger_rules: TRIGGER_RULES,
    trigger_examples: TRIGGER_EXAMPLES,
    success_check_rule: SUCCESS_CHECK_RULE,
    success_check_examples: SUCCESS_CHECK_EXAMPLES,
    common_failures: FORMAT_FAILURES,
  }),
});

// ------------------------------------------------------------ the mechanics

server.tool('score_changes', {
  description:
    'Rank candidate changes by Yield = (Impact x Transfer) / Cost, apply the thresholds (3.0 and ' +
    'above: sheet candidate; 1.5 to under 3.0: fill only; below 1.5: cut), select the top three, ' +
    'and report violations of the two hard constraints — at most one Cost 4-5 change, at least ' +
    'one Cost 1-2. Arithmetic only: the Impact, Transfer and Cost scores are judgements the ' +
    'caller supplies, and a violated constraint is reported, not resolved. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        description: 'Six to ten is normal — every change that would be recommended, before cutting.',
        items: {
          type: 'object',
          properties: {
            change: { type: 'string', description: 'The change, one sentence, an action not a principle.' },
            impact: { type: 'number', description: `Integer ${FACTORS.impact.scale}: ${FACTORS.impact.meaning.toLowerCase()}.` },
            transfer: { type: 'number', description: `Integer ${FACTORS.transfer.scale}: ${FACTORS.transfer.meaning}.` },
            cost: { type: 'number', description: `Integer ${FACTORS.cost.scale}: ${FACTORS.cost.meaning}.` },
          },
          required: ['change', 'impact', 'transfer', 'cost'],
        },
      },
    },
    required: ['candidates'],
  },
  handler: async ({ candidates }) => {
    await client.requireFeature('tools');
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new ToolError('invalid_request', 'Provide at least one candidate change.', {
        factors: FACTORS, thresholds: THRESHOLDS,
      });
    }
    const problems = candidates.flatMap((c, i) => candidateProblems(c, i));
    if (problems.length) {
      throw new ToolError('invalid_candidate', 'Some candidates are not scoreable.', { problems, factors: FACTORS });
    }
    return { ...scoreChanges(candidates), thresholds: THRESHOLDS, constraints: CONSTRAINTS };
  },
});

server.tool('sheet_lint', {
  description:
    'Mechanical checks on a drafted sheet with the evidence quoted: sections present and in ' +
    'order, exactly three changes, trigger phrases at five words or fewer, drill at ten minutes ' +
    'or under, a number in the success check, cut list at three lines, [verify] markers, and ' +
    'every numbered line listed for the patch-sensitivity review. Facts only — it does not judge ' +
    'whether a change is good or a check is honest. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The drafted sheet, markdown, including the cut list.' },
    },
    required: ['sheet'],
  },
  handler: async ({ sheet }) => {
    await client.requireFeature('tools');
    if (!String(sheet ?? '').trim()) {
      throw new ToolError('invalid_request', 'Provide the drafted sheet text.');
    }
    return lintSheet(sheet);
  },
});

// ------------------------------------------------------------ close the loop

server.tool('log_sheet', {
  description:
    'Record a delivered sheet — diagnosis, the three changes, the success check and its bar — in ' +
    'the local sheet log, so next session\'s result can be scored against it. A check that is ' +
    'never scored taught nothing. Requires a paid plan. Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      game: { type: 'string' },
      genre: { type: 'string', description: `One of: ${Object.keys(GENRES).join(', ')}, if it fits.` },
      diagnosis: { type: 'string', description: 'The root cause, one sentence, as stated on the sheet.' },
      changes: { type: 'array', items: { type: 'string' }, description: 'The three changes, one line each.' },
      stop_doing: { type: 'string' },
      success_check: { type: 'string', description: 'The countable check, with its bar, as written.' },
      next_session: { type: 'string', description: 'The strongest cut item, from the cut list.' },
      notes: { type: 'string' },
    },
    required: ['diagnosis', 'changes', 'success_check'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    if (!Array.isArray(args.changes) || args.changes.length === 0 || args.changes.length > 3) {
      throw new ToolError('invalid_changes', 'A sheet carries one to three changes — never four.');
    }
    const record = logSheet(args);
    return { logged: true, sheet_id: record.id, stored_at: SHEETS_FILE };
  },
});

server.tool('record_session', {
  description:
    'Score a logged sheet\'s success check after the session: pass or fail, and the number the ' +
    'player counted. This is what turns the sheet into evidence about the diagnosis. Requires a ' +
    'paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      sheet_id: { type: 'string' },
      passed: { type: 'boolean', description: 'Whether the success check\'s bar was met.' },
      reported_count: { type: 'number', description: 'The number the player counted, if they have it.' },
      notes: { type: 'string' },
    },
    required: ['sheet_id', 'passed'],
  },
  handler: async ({ sheet_id, passed, reported_count, notes }) => {
    await client.requireFeature('tools');
    if (typeof passed !== 'boolean') {
      throw new ToolError('invalid_request', '"passed" must be true or false.');
    }
    const updated = recordSession(sheet_id, { passed, reported_count, notes });
    if (!updated) throw new ToolError('unknown_sheet', `No sheet "${sheet_id}".`);
    return { updated: true, sheet: updated };
  },
});

server.tool('review_sheets', {
  description:
    'The record of past sheets and a plain tally of the success checks — passed, failed, never ' +
    'scored — plus each sheet\'s named next-session item. Counting only; it makes no new claim ' +
    'about the player. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'Default 20.' } },
  },
  handler: async ({ limit }) => {
    await client.requireFeature('tools');
    return reviewSheets({ limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
