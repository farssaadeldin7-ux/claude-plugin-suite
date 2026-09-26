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

import fs from 'node:fs';
import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import { registerSkillPrompts } from './skill-prompts.js';
import { ARCHETYPES, COMBINATIONS_NOTE, archetypeFor, scanCandidates } from './lib/archetypes.js';
import {
  AXES, DISQUALIFIERS, DISQUALIFIER_NOTE, THRESHOLDS, VOLUME_NOTE, WORKED_EXAMPLES,
  disqualifierFor, scoreIsValid, scoreClip,
} from './lib/rubric.js';
import {
  DESTINATIONS, GROUP_DETAIL, CROSS_POSTING, SPEC_CAVEAT, FLOOR_NOTE, CAPTION_RULES,
  destinationFor, destinationFit,
} from './lib/destinations.js';
import { logClip, recordFootagePass, reviewClips, footageResultIsValid, FOOTAGE_RESULTS, CLIPS_FILE } from './lib/clips.js';
import { planCuts, probeFfmpeg, runFfmpeg, shellCommand, KEYFRAME_NOTE } from './lib/cutting.js';
import { captionPack } from './lib/captions.js';

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
    'scores yourself and call score_clip for the threshold arithmetic. cut_clips cuts the actual ' +
    'media file with ffmpeg (or returns the exact commands when ffmpeg is absent), and caption_pack ' +
    'applies the destination caption spec to a clip\'s own words. moment_archetypes, ' +
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
      const key = String(destination).trim().toLowerCase();
      return {
        caveat: SPEC_CAVEAT, ...spec, caption: CAPTION_RULES[key],
        detail: GROUP_DETAIL[group], cross_posting: CROSS_POSTING,
      };
    }
    return {
      caveat: SPEC_CAVEAT,
      destinations: Object.fromEntries(
        Object.entries(DESTINATIONS).map(([id, { group, ...spec }]) => [id, { ...spec, caption: CAPTION_RULES[id] }])
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
    'replaces the assumption with your own count. Requires a paid plan; the licence check is the only thing this tool sends anywhere.',
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

// ------------------------------------------------------------ cut the media

server.tool('cut_clips', {
  description:
    'Cut clips out of a local media file with ffmpeg. Each clip gets a lossless stream-copy cut ' +
    '(no re-encode), and, where a destination is named, also a destination-formatted variant — ' +
    'scaled and centre-cropped to the frame in destination_specs (9:16 1080×1920 for TikTok, Reels ' +
    'and Shorts). A clip longer than its destination\'s length band is refused, citing the spec. ' +
    'If ffmpeg is not installed, nothing is cut and the exact per-clip commands are returned ready ' +
    'to run. Reports per clip what ran, what file it produced, and any failure with ffmpeg\'s own ' +
    'stderr. Requires a paid plan; nothing but the licence check leaves the machine.',
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Path to the local media file (the episode video or audio).' },
      clips: {
        type: 'array',
        description: 'The clips to cut, from the cut list.',
        items: {
          type: 'object',
          properties: {
            start: { description: 'In-point: "hh:mm:ss", "mm:ss" or seconds.' },
            end: { description: 'Out-point, same forms. Must be after start.' },
            label: { type: 'string', description: 'Optional label, used in the output filename.' },
            destination: {
              type: 'string',
              description: 'Optional destination id (youtube_shorts, instagram_reels, tiktok, linkedin, x, youtube_chapter) — also produces that destination\'s formatted variant.',
            },
          },
          required: ['start', 'end'],
        },
      },
      out_dir: { type: 'string', description: 'Where the files go. Default: a "clips" directory next to the source.' },
    },
    required: ['source', 'clips'],
  },
  handler: async ({ source, clips, out_dir }) => {
    await client.requireFeature('tools');
    const plan = planCuts({ source, clips, out_dir });
    const ffmpeg = probeFfmpeg();

    if (!ffmpeg.found) {
      return {
        ffmpeg_found: false,
        cut: false,
        note:
          'ffmpeg was not found on this machine, so nothing was cut. The commands below are exact ' +
          'and ready to paste once ffmpeg is installed (ffmpeg.org, or the OS package manager). ' +
          'Create the output directory first: mkdir -p ' + plan.out_dir,
        source: plan.source,
        out_dir: plan.out_dir,
        keyframe_note: KEYFRAME_NOTE,
        clips: plan.clips.map(({ outputs, ...clip }) => ({
          ...clip,
          commands: outputs.map(({ kind, destination, file, args }) => ({
            kind, ...(destination ? { destination } : {}), file, command: shellCommand(args),
          })),
        })),
      };
    }

    fs.mkdirSync(plan.out_dir, { recursive: true });
    let cutCount = 0;
    let failCount = 0;
    const results = plan.clips.map(({ outputs, ...clip }) => ({
      ...clip,
      outputs: outputs.map(({ kind, destination, frame, file, args }) => {
        const run = runFfmpeg(args, file);
        if (run.ok) cutCount++; else failCount++;
        return {
          kind,
          ...(destination ? { destination, frame } : {}),
          command: shellCommand(args),
          file,
          cut: run.ok,
          ...(run.ok ? {} : { stderr_tail: run.stderr_tail, ...(run.note ? { note: run.note } : {}) }),
        };
      }),
    }));

    return {
      ffmpeg_found: true,
      ffmpeg: ffmpeg.version,
      source: plan.source,
      out_dir: plan.out_dir,
      summary: {
        files_cut: cutCount,
        failed: failCount,
        ...(failCount ? { note: 'Failed outputs were not produced — the per-clip stderr says why. Do not treat them as cut.' } : {}),
      },
      keyframe_note: KEYFRAME_NOTE,
      clips: results,
    };
  },
});

server.tool('caption_pack', {
  description:
    'Apply a destination\'s caption spec to a clip\'s own transcript: the hook line (the clip\'s ' +
    'first sentence, verbatim), actual character counts against the field\'s hard limit and feed ' +
    'truncation point, and the destination\'s hashtag rule — with any supplied hashtags checked ' +
    'against it. Formatting only: it structures what it is given and never invents copy; the ' +
    'context-or-position line and the tags come back as named slots to fill. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      transcript: { type: 'string', description: 'The clip\'s transcript text — just the clip, not the episode.' },
      destination: {
        type: 'string',
        description: 'youtube_shorts, instagram_reels, tiktok, linkedin, x or youtube_chapter.',
      },
      hashtags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional hashtags you intend to use, checked against the destination\'s rule.',
      },
    },
    required: ['transcript', 'destination'],
  },
  handler: async ({ transcript, destination, hashtags }) => {
    await client.requireFeature('tools');
    return captionPack({ transcript, destination, hashtags });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

// The skills, as licensed MCP prompts — how editors without a skill concept
// (VS Code, Cursor) get the same material as a Claude Code install.
registerSkillPrompts(server, client);

server.start();
