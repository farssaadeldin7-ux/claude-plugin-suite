#!/usr/bin/env node
/**
 * Ghost Post Preview — MCP server.
 *
 * The deterministic half of the method: exact fold reconstruction from the
 * truncation tables, mechanical draft lint (facts with evidence, never
 * judgements), the platform mechanics data, and the local prediction log that
 * closes the loop. The judgement half — hook audit, persona read, the one
 * named failure, the band — lives in the skill, and nothing here outputs a
 * score, a verdict or an engagement number.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import { PLATFORMS, APPROXIMATION_NOTE, platformFor, foldTest } from './lib/fold.js';
import { lintDraft } from './lib/lint.js';
import { logCall, recordResult, reviewCalls, bandIsValid, BANDS, CALLS_FILE } from './lib/calls.js';

const PLUGIN_ID = 'ghost-post-preview';
const PLUGIN_NAME = 'Ghost Post Preview';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the fold test and platform data stay open so a draft can be
// inspected before a trial; the lint pass and the prediction log are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for reviewing a draft social post. Call fold_test to see exactly what ' +
    'survives truncation, draft_lint for the mechanical failures with evidence, platform_mechanics ' +
    'for what a ranking system rewards. None of these judge the draft — that is the skill\'s job — ' +
    'and nothing here predicts engagement.',
});

const requirePlatform = (platformId) => {
  const platform = platformFor(platformId);
  if (!platform) {
    throw new ToolError('unknown_platform', `No platform "${platformId}".`, {
      available: Object.keys(PLATFORMS),
    });
  }
  return platform;
};

// ---------------------------------------------------------------- mechanics

server.tool('platform_mechanics', {
  description:
    'What each platform\'s ranking system rewards and suppresses, its fold limits, and its format ' +
    'rules. All approximate and directional — platforms change without announcement. Omit platform ' +
    'to list all of them.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'linkedin, x, instagram, tiktok, reddit, youtube, facebook or threads.' },
    },
  },
  handler: async ({ platform }) => {
    if (platform) return { note: APPROXIMATION_NOTE, ...requirePlatform(platform) };
    return {
      note: APPROXIMATION_NOTE,
      platforms: Object.fromEntries(
        Object.entries(PLATFORMS).map(([id, p]) => [id, { label: p.label, fold: p.fold, governing_signal: p.governing_signal }])
      ),
    };
  },
});

server.tool('fold_test', {
  description:
    'Reconstruct exactly what a reader sees before "see more" truncates the post on a given ' +
    'platform: the visible fragment, what got cut, and the first hidden line. Deterministic ' +
    'mechanics from the truncation table — it does not judge the fragment.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Platform id, e.g. "linkedin".' },
      text: { type: 'string', description: 'The exact draft, including line breaks.' },
      part: {
        type: 'string',
        description: 'On Reddit and YouTube the title truncates separately from the body: "title" or "body" (default). Ignored elsewhere.',
      },
    },
    required: ['platform', 'text'],
  },
  handler: async ({ platform, text, part }) => {
    requirePlatform(platform);
    if (part && !['title', 'body'].includes(part)) {
      throw new ToolError('invalid_part', `"${part}" is not a part — use "title" or "body".`);
    }
    return foldTest(platform, text, part ?? 'body');
  },
});

server.tool('draft_lint', {
  description:
    'Mechanical checks on a draft with the evidence quoted: links in the body where the platform ' +
    'punishes them, hashtags on X, throat-clearing openers, yes/no question openers, engagement ' +
    'bait, wall-of-text shape, plus counts (characters, first-line words, position of the first ' +
    'number). Facts only — no scores, no verdicts. Counts against the monthly preview quota.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Platform id, e.g. "linkedin".' },
      text: { type: 'string', description: 'The exact draft, including line breaks.' },
    },
    required: ['platform', 'text'],
  },
  handler: async ({ platform, text }) => {
    requirePlatform(platform);
    const entitlement = await client.requireFeature('lint');

    const quota = await client.checkQuota('previews_per_month');
    if (!quota.allowed) {
      throw new ToolError('quota_exceeded',
        `This plan allows ${quota.limit} lint passes per month and ${quota.used} have been used.`,
        { ...quota, next_step: 'Call list_plans, then start_checkout to move to a higher plan.' });
    }

    const result = lintDraft(platform, text);
    await client.recordUsage('previews_per_month', 1);

    return {
      ...result,
      plan: entitlement.plan,
      quota_remaining: quota.limit == null || quota.limit === -1
        ? 'unlimited'
        : Math.max(0, quota.limit - quota.used - 1),
    };
  },
});

// ------------------------------------------------------------ close the loop

server.tool('log_call', {
  description:
    'Record the review\'s call — verdict, band, confidence — in the local prediction log so the ' +
    'actual result can be checked against it later. A prediction that is never checked has no ' +
    'error bar. Requires a paid plan. Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string' },
      verdict: { type: 'string', description: 'ship, rewrite or kill.' },
      band: { type: 'string', description: `One of: ${BANDS.join(', ')}. Omit if no baseline was supplied.` },
      confidence: { type: 'string', description: 'low, medium or high.' },
      hook_summary: { type: 'string', description: 'The first line as reviewed, for later recognition.' },
      notes: { type: 'string' },
    },
    required: ['verdict'],
  },
  handler: async (args) => {
    await client.requireFeature('history');
    if (args.band && !bandIsValid(args.band)) {
      throw new ToolError('invalid_band', `"${args.band}" is not a band.`, { valid: BANDS });
    }
    const record = logCall(args);
    return { logged: true, call_id: record.id, stored_at: CALLS_FILE };
  },
});

server.tool('record_result', {
  description:
    'Record how a logged call actually landed, as a band against the same baseline. This is what ' +
    'gives the review record an error bar. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      call_id: { type: 'string' },
      actual_band: { type: 'string', description: `One of: ${BANDS.join(', ')}.` },
      notes: { type: 'string' },
    },
    required: ['call_id', 'actual_band'],
  },
  handler: async ({ call_id, actual_band, notes }) => {
    await client.requireFeature('history');
    if (!bandIsValid(actual_band)) {
      throw new ToolError('invalid_band', `"${actual_band}" is not a band.`, { valid: BANDS });
    }
    const updated = recordResult(call_id, { actual_band, notes });
    if (!updated) throw new ToolError('unknown_call', `No call "${call_id}".`);
    return { updated: true, call: updated };
  },
});

server.tool('review_calls', {
  description:
    'The record of past calls and a plain tally of how they landed — exact band, one band off, ' +
    'further out. Counting only; it makes no new claim. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'Default 20.' } },
  },
  handler: async ({ limit }) => {
    await client.requireFeature('history');
    return reviewCalls({ limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
