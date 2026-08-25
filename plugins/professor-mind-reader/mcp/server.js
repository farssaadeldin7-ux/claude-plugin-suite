#!/usr/bin/env node
/**
 * Professor Mind-Reader — MCP server.
 *
 * The deterministic half of the rubric audit: the verb ladder and its lookup,
 * the band tables and descriptor-phrase translations, the hidden-rubric
 * checklist, the weight-to-effort arithmetic, the marks-at-stake scorecard and
 * the local audit log that closes the loop. The judgement half — reading the
 * draft, quoting the strongest sentence per criterion, calling met or unmet,
 * positioning against the bands — lives in the skill, and nothing here reads a
 * draft, predicts a mark, or outputs a number the formulas do not define.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  VERB_LADDER, DEMOTION_TEST, DEMOTION_SIGNALS, PROMOTION_MOVES, levelForVerb,
} from './lib/ladder.js';
import {
  NAMING_MAP, NAMING_CAUTIONS, POSTGRADUATE_NOTE, BAND_SEPARATION, PIVOT,
  DESCRIPTOR_PHRASES, CRITICAL_SIGNAL, HONESTY_RULES, BAND_ORDER, BAND_LABELS, bandIsValid,
} from './lib/bands.js';
import { HIDDEN_RUBRIC_FRAMING, HIDDEN_CHECKLIST, HIDDEN_REPORTING_RULES, hiddenItem } from './lib/hidden.js';
import { effortMap, RATIO_TABLE } from './lib/effort.js';
import { scorecard, verdictIsValid, VERDICT_GAPS } from './lib/scorecard.js';
import { logAudit, recordResult, reviewAudits, AUDITS_FILE } from './lib/audits.js';

const PLUGIN_ID = 'professor-mind-reader';
const PLUGIN_NAME = 'Professor Mind-Reader';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the ladder, band tables and hidden-rubric checklist stay open
// so a rubric can be decomposed before buying; the effort map, the scorecard
// and the audit log are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for auditing a draft against a marking rubric. Call verb_ladder to fix ' +
    'the level a criterion verb demands, effort_map to compute the word budget against the weights, ' +
    'audit_scorecard to turn the audit\'s verdicts into marks at stake and a ranked fix list. None of ' +
    'these read the draft or judge it — quoting evidence and calling met or unmet is the skill\'s job — ' +
    'and nothing here predicts a mark or a band.',
});

const requireNumber = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ToolError('invalid_request', `"${name}" must be a number.`);
  }
  return value;
};

const requireCriteria = (criteria) => {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new ToolError('invalid_request', 'Supply "criteria" as a non-empty array.');
  }
  for (const criterion of criteria) {
    if (!criterion?.name || typeof criterion.name !== 'string') {
      throw new ToolError('invalid_request', 'Every criterion needs a "name".');
    }
    requireNumber(criterion.weight, `weight of "${criterion.name}"`);
    if (criterion.weight <= 0) {
      throw new ToolError('invalid_request', `The weight of "${criterion.name}" must be above zero.`);
    }
  }
  return criteria;
};

const requireBand = (band, name) => {
  if (!bandIsValid(band)) {
    throw new ToolError('invalid_band', `"${band}" is not a band id for "${name}".`, {
      valid: BAND_ORDER, labels: BAND_LABELS,
    });
  }
  return band;
};

// ------------------------------------------------------------ knowledge base

server.tool('verb_ladder', {
  description:
    'The seven-rung verb ladder that fixes the cognitive level a rubric criterion demands: the verbs ' +
    'on each rung, what the marker must be able to underline, the one-level-down failure, the demotion ' +
    'signals and the promotion moves. Pass a verb for an exact table lookup of its rung — an ' +
    'unrecognised verb is reported as such, never guessed at. It does not judge whether a draft ' +
    'reaches a rung.',
  inputSchema: {
    type: 'object',
    properties: {
      verb: { type: 'string', description: 'A rubric verb to look up, e.g. "critique" or "account for".' },
    },
  },
  handler: async ({ verb }) => {
    if (verb) {
      const rung = levelForVerb(verb);
      if (!rung) {
        return {
          verb,
          recognised: false,
          note: 'This verb is not on the ladder. Do not guess a rung — decompose the criterion into ' +
            'what the marker must be able to underline and match that against the ladder instead.',
          ladder: VERB_LADDER.map(({ level, name, verbs }) => ({ level, name, verbs })),
        };
      }
      const promotion = PROMOTION_MOVES.find((m) => m.to === rung.name) ?? null;
      return { verb, recognised: true, ...rung, ...(promotion ? { promotion_move_to_reach_it: promotion } : {}) };
    }
    return {
      ladder: VERB_LADDER,
      demotion_test: DEMOTION_TEST,
      demotion_signals: DEMOTION_SIGNALS,
      promotion_moves: PROMOTION_MOVES,
    };
  },
});

server.tool('band_descriptors', {
  description:
    'The band tables: naming mapped across UK, US and ECTS systems, what actually separates each ' +
    'band, the 2:1 to 1st pivot, the descriptor-phrase translations and the honesty rules for ' +
    'positioning. Pass a phrase to translate wording from a published descriptor. Reference data ' +
    'only — it does not position a draft, and nothing in it yields a percentage.',
  inputSchema: {
    type: 'object',
    properties: {
      phrase: { type: 'string', description: 'A phrase from a published descriptor, e.g. "sophisticated" or "some evidence of".' },
    },
  },
  handler: async ({ phrase }) => {
    if (phrase) {
      const needle = phrase.trim().toLowerCase();
      const hit = DESCRIPTOR_PHRASES.find((entry) => needle.includes(entry.phrase) || entry.phrase.includes(needle));
      if (!hit) {
        return {
          phrase,
          recognised: false,
          note: 'Not in the translation table. Map it onto the verb ladder by asking what the marker ' +
            'must be able to underline, and treat institutional descriptors as overriding these tables.',
          known_phrases: DESCRIPTOR_PHRASES.map((entry) => entry.phrase),
        };
      }
      return { phrase, recognised: true, demands: hit.demands, critical_signal: CRITICAL_SIGNAL };
    }
    return {
      naming_map: NAMING_MAP,
      naming_cautions: NAMING_CAUTIONS,
      postgraduate_note: POSTGRADUATE_NOTE,
      what_separates_the_bands: BAND_SEPARATION,
      two_one_to_first_pivot: PIVOT,
      descriptor_phrases: DESCRIPTOR_PHRASES,
      critical_signal: CRITICAL_SIGNAL,
      honesty_rules: HONESTY_RULES,
    };
  },
});

server.tool('hidden_rubric', {
  description:
    'The standing checklist of conventions markers reward that printed rubrics usually omit — each ' +
    'with its test, why it is rewarded and its failure signature — plus the rules for reporting them. ' +
    'All of it is inferred convention, not guarantee, and the data says so. Running the tests against ' +
    'a draft is the skill\'s job. Pass an item id to fetch one item.',
  inputSchema: {
    type: 'object',
    properties: {
      item: { type: 'string', description: `Optional single item: ${HIDDEN_CHECKLIST.map((i) => i.id).join(', ')}.` },
    },
  },
  handler: async ({ item }) => {
    if (item) {
      const found = hiddenItem(item);
      if (!found) {
        throw new ToolError('unknown_item', `No checklist item "${item}".`, {
          available: HIDDEN_CHECKLIST.map((i) => i.id),
        });
      }
      return { framing: HIDDEN_RUBRIC_FRAMING, item: found };
    }
    return {
      framing: HIDDEN_RUBRIC_FRAMING,
      checklist: HIDDEN_CHECKLIST,
      reporting_rules: HIDDEN_REPORTING_RULES,
    };
  },
});

// ----------------------------------------------------------------- computing

server.tool('effort_map', {
  description:
    'Compute the word budget from the rubric weights: target words and marks per 100 words per ' +
    'criterion, and — where actual section word counts are supplied — the investment ratio with its ' +
    'verdict from the threshold table (over-invested above 1.5, under-invested below 0.5). Arithmetic ' +
    'only; whether a heavy section is justified by a high-verb criterion is the audit\'s call. ' +
    'Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      total_words: { type: 'number', description: 'The assignment word count, e.g. 2500.' },
      criteria: {
        type: 'array',
        description: 'One entry per criterion: {name, weight (percent, e.g. 40), actual_words (optional)}.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            weight: { type: 'number' },
            actual_words: { type: 'number' },
          },
          required: ['name', 'weight'],
        },
      },
    },
    required: ['total_words', 'criteria'],
  },
  handler: async ({ total_words, criteria }) => {
    await client.requireFeature('tools');
    requireNumber(total_words, 'total_words');
    if (total_words <= 0) throw new ToolError('invalid_request', '"total_words" must be above zero.');
    requireCriteria(criteria);
    return { ...effortMap(total_words, criteria), ratio_table: RATIO_TABLE };
  },
});

server.tool('audit_scorecard', {
  description:
    'Turn the audit\'s per-criterion verdicts into marks at stake (weight times the gap: unmet 1.0, ' +
    'partially met 0.5, met 0) and a ranked fix list — standing-rule overrides first, then marks at ' +
    'stake divided by effort, capped at five items. The verdicts are the audit\'s judgement, supplied ' +
    'as input with a verbatim quote behind each; this tool only counts and orders them. Requires a ' +
    'paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      criteria: {
        type: 'array',
        description: 'One entry per criterion: {name, weight (percent), verdict, fix (optional), effort (optional)}.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            weight: { type: 'number' },
            verdict: { type: 'string', description: `One of: ${Object.keys(VERDICT_GAPS).join(', ')}.` },
            fix: { type: 'string', description: 'The specific move, e.g. the sentence to add and where.' },
            effort: { type: 'number', description: '1 (a quick edit) to 5 (a rewrite). Defaults to 1.' },
          },
          required: ['name', 'weight', 'verdict'],
        },
      },
    },
    required: ['criteria'],
  },
  handler: async ({ criteria }) => {
    await client.requireFeature('tools');
    requireCriteria(criteria);
    for (const criterion of criteria) {
      if (!verdictIsValid(criterion.verdict)) {
        throw new ToolError('invalid_verdict', `"${criterion.verdict}" is not a verdict.`, {
          valid: Object.keys(VERDICT_GAPS),
        });
      }
      if (criterion.effort !== undefined) {
        requireNumber(criterion.effort, `effort of "${criterion.name}"`);
        if (criterion.effort < 1 || criterion.effort > 5) {
          throw new ToolError('invalid_request', `The effort of "${criterion.name}" must be between 1 and 5.`);
        }
      }
    }
    return scorecard(criteria);
  },
});

// ------------------------------------------------------------ close the loop

server.tool('log_audit', {
  description:
    'Record an audit\'s band-range call and top fix in the local audit log so the actual result can ' +
    'be checked against it later. A positioning that is never checked has no error bar. Requires a ' +
    'paid plan. Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      assignment: { type: 'string', description: 'A short label for later recognition, e.g. "Org behaviour essay, Q2".' },
      band_floor: { type: 'string', description: `Lower end of the range: ${BAND_ORDER.join(', ')}.` },
      band_ceiling: { type: 'string', description: 'Upper end of the range, same ids.' },
      total_marks_at_stake: { type: 'number', description: 'From audit_scorecard.' },
      top_fix: { type: 'string', description: 'The first item on the ranked fix list.' },
      notes: { type: 'string' },
    },
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    if (args.band_floor !== undefined) requireBand(args.band_floor, 'band_floor');
    if (args.band_ceiling !== undefined) requireBand(args.band_ceiling, 'band_ceiling');
    if ((args.band_floor === undefined) !== (args.band_ceiling === undefined)) {
      throw new ToolError('invalid_request', 'Supply both band_floor and band_ceiling, or neither — a range, never a point.');
    }
    const record = logAudit(args);
    return { logged: true, audit_id: record.id, stored_at: AUDITS_FILE };
  },
});

server.tool('record_result', {
  description:
    'Record the band the marked work actually came back in, against a logged audit. This is what ' +
    'gives the positioning record an error bar. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      audit_id: { type: 'string' },
      actual_band: { type: 'string', description: `One of: ${BAND_ORDER.join(', ')}.` },
      notes: { type: 'string' },
    },
    required: ['audit_id', 'actual_band'],
  },
  handler: async ({ audit_id, actual_band, notes }) => {
    await client.requireFeature('tools');
    requireBand(actual_band, 'actual_band');
    const updated = recordResult(audit_id, { actual_band, notes });
    if (!updated) throw new ToolError('unknown_audit', `No audit "${audit_id}".`);
    return { updated: true, audit: updated };
  },
});

server.tool('review_audits', {
  description:
    'The record of past audits and a plain tally of how the band-range calls landed — within the ' +
    'range, one band outside, further out. Counting only; it makes no new claim. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'Default 20.' } },
  },
  handler: async ({ limit }) => {
    await client.requireFeature('tools');
    return reviewAudits({ limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
