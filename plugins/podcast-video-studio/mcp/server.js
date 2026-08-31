#!/usr/bin/env node
/**
 * Podcast & Video Studio — MCP server.
 *
 * The deterministic half of the method: the archetype tell scan over a
 * transcript, the rubric arithmetic — disqualifiers, thresholds, the terminal
 * premise rule — the destination length bands, and the local clip log that
 * closes the footage-pass loop. The judgement half — assigning the four axis
 * scores, setting in-points, writing titles and cold opens — lives in the
 * skill, and nothing here scores a moment on its own, watches footage, or
 * predicts views.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import { ARCHETYPES, COMBINATIONS_NOTE, archetypeFor, scanCandidates } from './lib/archetypes.js';
import {
  AXES, DISQUALIFIERS, DISQUALIFIER_NOTE, THRESHOLDS, VOLUME_NOTE, WORKED_EXAMPLES,
  disqualifierFor, scoreIsValid, scoreClip,
} from './lib/rubric.js';
import {
  DESTINATIONS, GROUP_DETAIL, CROSS_POSTING, SPEC_CAVEAT, FLOOR_NOTE,
  destinationFor, destinationFit,
} from './lib/destinations.js';
import { logClip, recordFootagePass, reviewClips, footageResultIsValid, FOOTAGE_RESULTS, CLIPS_FILE } from './lib/clips.js';

const PLUGIN_ID = 'podcast-video-studio';
const PLUGIN_NAME = 'Podcast & Video Studio';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the archetypes, the rubric and the destination specs stay
// open so the method can be inspected before buying; the transcript scan, the
// threshold arithmetic and the clip log are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for cutting clips from a long recording. Call scan_candidates to find ' +
    'archetype tells in a timecoded transcript with the evidence quoted, then assign the four axis ' +
    'scores yourself and call score_clip for the threshold arithmetic. moment_archetypes, ' +
    'scoring_rubric and destination_specs serve the reference tables. None of these judge a moment ' +
    'or watch footage — that is the skill\'s and the editor\'s job — and nothing here predicts views.',
});

// --------------------------------------------------------------- the tables

server.tool('moment_archetypes', {
  description:
    'The seven moment archetypes that travel out of a long recording, each with the transcript-level ' +
    'tells for spotting it, typical length, best-fit destinations and what to watch for. Omit ' +
    'archetype to list all seven. Descriptive only — it reads nothing.',
  inputSchema: {
    type: 'object',
    properties: {
      archetype: { type: 'string', description: 'Optional single archetype id, e.g. "contrarian_claim".' },
    },
  },
  handler: async ({ archetype }) => {
    if (archetype) {
      const found = archetypeFor(archetype);
      if (!found) {
        throw new ToolError('unknown_archetype', `No archetype "${archetype}".`, {
          available: ARCHETYPES.map((a) => a.id),
        });
      }
      return found;
    }
    return { archetypes: ARCHETYPES, combinations: COMBINATIONS_NOTE };
  },
});

server.tool('scoring_rubric', {
  description:
    'The clip-scoring rubric: four axes with 0–3 band descriptors, the hard disqualifiers applied ' +
    'before scoring, and the threshold table that turns a total into an action. Set ' +
    'include_examples for the four worked scored examples. This returns the rubric — score_clip ' +
    'applies it.',
  inputSchema: {
    type: 'object',
    properties: {
      include_examples: { type: 'boolean', description: 'Also return the four worked scored examples.' },
    },
  },
  handler: async ({ include_examples }) => ({
    disqualifiers: DISQUALIFIERS,
    disqualifier_note: DISQUALIFIER_NOTE,
    axes: AXES,
    thresholds: THRESHOLDS,
    volume_note: VOLUME_NOTE,
    ...(include_examples ? { worked_examples: WORKED_EXAMPLES } : {}),
  }),
});

server.tool('destination_specs', {
  description:
    'Length, aspect, frame, safe areas, captions and pacing per destination, plus the cross-posting ' +
    'rules. Omit destination for the at-a-glance table. The numbers are current-generation defaults, ' +
    'not guarantees — platforms change without announcement.',
  inputSchema: {
    type: 'object',
    properties: {
      destination: {
        type: 'string',
        description: 'youtube_shorts, instagram_reels, tiktok, linkedin, x or youtube_chapter.',
      },
    },
  },
  handler: async ({ destination }) => {
    if (destination) {
      const found = destinationFor(destination);
      if (!found) {
        throw new ToolError('unknown_destination', `No destination "${destination}".`, {
          available: Object.keys(DESTINATIONS),
        });
      }
      const { group, ...spec } = found;
      return { caveat: SPEC_CAVEAT, ...spec, detail: GROUP_DETAIL[group], cross_posting: CROSS_POSTING };
    }
    return {
      caveat: SPEC_CAVEAT,
      destinations: Object.fromEntries(
        Object.entries(DESTINATIONS).map(([id, { group, ...spec }]) => [id, spec])
      ),
      short_form_floor: FLOOR_NOTE,
      cross_posting: CROSS_POSTING,
    };
  },
});

// ------------------------------------------------------------ scan and score

server.tool('scan_candidates', {
  description:
    'Scan a transcript for the literal archetype tells — "everyone thinks", "say that again", "we ' +
    'went from", and the rest — and return each matched turn with the tells named, the evidence ' +
    'quoted, and the nearest timecode. Matches are candidates for the rubric, not clips, and the ' +
    'scan does not rank or score them. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      transcript: {
        type: 'string',
        description: 'The transcript text, ideally timecoded and speaker-labelled, verbatim rather than tidied.',
      },
    },
    required: ['transcript'],
  },
  handler: async ({ transcript }) => {
    await client.requireFeature('tools');
    if (!String(transcript ?? '').trim()) {
      throw new ToolError('empty_transcript', 'The transcript is empty — there is nothing to scan.');
    }
    // One scan = one episode processed; the plan's included episodes meter this.
    const quota = await client.checkQuota('episodes_per_month');
    if (!quota.allowed) {
      throw new ToolError('quota_exceeded',
        `This plan includes ${quota.limit} episodes per month and ${quota.used} have been used.`,
        { ...quota, next_step: 'Call list_plans, then start_checkout to move to the team plan, or wait for the period to reset.' });
    }
    await client.recordUsage('episodes_per_month', 1);
    return scanCandidates(transcript);
  },
});

server.tool('score_clip', {
  description:
    'Apply the rubric mechanically to a candidate: disqualifiers first (they remove, they do not ' +
    'deduct), then the four axis scores you have already assigned — self-contained premise, tension, ' +
    'payoff, boundaries, 0–3 each — through the threshold table, including the terminal premise-0 ' +
    'rule and the no-axis-below-2 condition at 9. Pass duration_seconds to also get which ' +
    'destination length bands the clip fits. Arithmetic only — it does not read the segment or ' +
    'assign the scores. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      premise: { type: 'number', description: 'Self-contained premise, 0–3.' },
      tension: { type: 'number', description: 'Tension, 0–3.' },
      payoff: { type: 'number', description: 'Payoff inside the clip, 0–3.' },
      boundaries: { type: 'number', description: 'Clean boundaries, 0–3.' },
      disqualifiers: {
        type: 'array',
        items: { type: 'string' },
        description: `Disqualifier ids that apply, from: ${DISQUALIFIERS.map((d) => d.id).join(', ')}. If any apply, the axis scores are not needed.`,
      },
      duration_seconds: { type: 'number', description: 'Optional natural length of the segment, for the destination fit.' },
    },
  },
  handler: async ({ premise, tension, payoff, boundaries, disqualifiers = [], duration_seconds }) => {
    await client.requireFeature('tools');

    const unknown = disqualifiers.filter((id) => !disqualifierFor(id));
    if (unknown.length) {
      throw new ToolError('unknown_disqualifier', `Not in the disqualifier table: ${unknown.join(', ')}.`, {
        available: DISQUALIFIERS.map((d) => d.id),
      });
    }
    if (!disqualifiers.length) {
      const missing = Object.entries({ premise, tension, payoff, boundaries })
        .filter(([, v]) => !scoreIsValid(v)).map(([k]) => k);
      if (missing.length) {
        throw new ToolError('invalid_scores',
          `Each axis needs an integer score from 0 to 3; missing or out of range: ${missing.join(', ')}.`,
          { note: 'Assign the scores from the band descriptors in scoring_rubric — this tool only does the arithmetic.' });
      }
    }
    if (duration_seconds !== undefined && !(Number.isFinite(duration_seconds) && duration_seconds > 0)) {
      throw new ToolError('invalid_duration', 'duration_seconds must be a positive number of seconds.');
    }

    const result = scoreClip({ premise, tension, payoff, boundaries, disqualifiers });
    return {
      ...result,
      ...(duration_seconds !== undefined && !result.disqualified
        ? { destination_fit: destinationFit(duration_seconds) }
        : {}),
    };
  },
});

// ------------------------------------------------------------ close the loop

server.tool('log_clip', {
  description:
    'Record a threshold-clearing clip in the local log so the footage-pass result can be recorded ' +
    'against it later. The skill budgets for around a third of clips failing that pass; the log ' +
    'replaces the assumption with your own count. Requires a paid plan. Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      episode: { type: 'string', description: 'Episode name or identifier.' },
      in_point: { type: 'string', description: 'Timecode of the in-point, e.g. "00:14:22.4".' },
      out_point: { type: 'string', description: 'Timecode of the out-point.' },
      duration_seconds: { type: 'number' },
      scores: { type: 'object', description: 'The four axis scores, e.g. {"premise":3,"tension":3,"payoff":2,"boundaries":3}.' },
      total: { type: 'number', description: 'The rubric total out of 12.' },
      destinations: { type: 'array', items: { type: 'string' }, description: 'Where it is going, e.g. ["instagram_reels","linkedin"].' },
      cold_open: { type: 'string', description: 'The cold-open line, quoted from the clip.' },
      archetypes: { type: 'array', items: { type: 'string' }, description: 'Archetype ids the clip carries.' },
      flagged_claims: { type: 'array', items: { type: 'string' }, description: 'Factual claims in the clip that need sourcing before publish.' },
      notes: { type: 'string' },
    },
    required: ['in_point', 'out_point'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    const record = logClip(args);
    return { logged: true, clip_id: record.id, stored_at: CLIPS_FILE };
  },
});

server.tool('record_footage_pass', {
  description:
    'Record how a logged clip fared in the human footage pass — passed, or failed with the reason ' +
    'the text could not show (framing, audio, expression, crosstalk, an unsafe claim). Requires a ' +
    'paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      clip_id: { type: 'string' },
      result: { type: 'string', description: `One of: ${FOOTAGE_RESULTS.join(', ')}.` },
      reason: { type: 'string', description: 'For a failure, what the footage showed that the transcript could not.' },
    },
    required: ['clip_id', 'result'],
  },
  handler: async ({ clip_id, result, reason }) => {
    await client.requireFeature('tools');
    if (!footageResultIsValid(result)) {
      throw new ToolError('invalid_result', `"${result}" is not a footage-pass result.`, { valid: FOOTAGE_RESULTS });
    }
    const updated = recordFootagePass(clip_id, { result, reason });
    if (!updated) throw new ToolError('unknown_clip', `No clip "${clip_id}".`);
    return { updated: true, clip: updated };
  },
});

server.tool('review_clips', {
  description:
    'The record of logged clips and a plain tally of the footage pass — how many cleared the ' +
    'threshold, how many passed on footage, how many failed and why. Counting only; it makes no new ' +
    'claim. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'Default 20.' } },
  },
  handler: async ({ limit }) => {
    await client.requireFeature('tools');
    return reviewClips({ limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
