#!/usr/bin/env node
/**
 * Emotional Resonance Analyzer — MCP server.
 *
 * The deterministic half of the method: the form-convention tables, the
 * scoring anchors and ledger format, the five drop-off causes, threshold
 * checks over a scored scene table, pacing arithmetic on the valence and
 * intensity series, curve reconciliation and the local analysis log. The
 * judgement half — scoring the scenes, reading the flags, choosing the three
 * cuts — lives in the skill. Nothing here measures emotion, outputs a
 * resonance score, or predicts a retention percentage, and where a real
 * retention curve exists it outranks everything this server computes.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import { FORMS, BASELINES, CONVENTION_NOTE, UNLISTED_FORM_NOTE, formFor } from './lib/forms.js';
import { CAUSES, OVERLAP_PRIORITY, OVERLAP_NOTE, CORRELATE_NOTE, causeFor } from './lib/causes.js';
import {
  SCORING_NOTE, SCENE_BOUNDARIES, VALENCE_ANCHORS, VALENCE_NOTE,
  INTENSITY_ANCHORS, INTENSITY_NOTE, SERIES_PATTERNS, DERIVED_FIGURE_NOTE,
  LEDGER_FORMAT, EFFORT_SCALE, EXPOSED_RUNTIME_NOTE,
} from './lib/scoring.js';
import { normaliseScenes } from './lib/scenes.js';
import { plotArc } from './lib/arc.js';
import { normaliseQuestions, checkTells } from './lib/tells.js';
import { reconcileDrops } from './lib/reconcile.js';
import { logAnalysis, getAnalysis, reviewAnalyses, ANALYSES_FILE } from './lib/analyses.js';

const PLUGIN_ID = 'emotional-resonance-analyzer';
const PLUGIN_NAME = 'Emotional Resonance Analyzer';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the reference tables stay open so the method can be judged
// before buying; the threshold checks, the pacing arithmetic, curve
// reconciliation and the analysis log sit behind the single 'tools' feature.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for reading the structure of a cut. form_conventions, scoring_anchors ' +
    'and dropoff_causes carry the reference tables; check_tells and plot_arc run threshold checks ' +
    'and pacing arithmetic on scene scores the editor supplies; reconcile_curve classifies real ' +
    'retention drops against the tripped tells. Nothing here measures emotion, judges the material ' +
    'or predicts retention — scoring the scenes and reading the flags is the skill\'s job, and a ' +
    'real retention curve outranks every output of this server.',
});

const namedForm = (formId) => {
  if (formId == null) return null;
  const form = formFor(formId);
  if (!form) {
    throw new ToolError('unknown_form', `No conventions encoded for form "${formId}".`, {
      available: Object.keys(FORMS),
      note: UNLISTED_FORM_NOTE,
    });
  }
  return form;
};

const sceneInputSchema = {
  type: 'array',
  description:
    'The scored scene table, in timeline order. Each scene: timecode (start, "MM:SS"), valence ' +
    '(-3..+3 integer), intensity (0..5 integer); optionally duration, description, opens/closes ' +
    '(question ids), information_only, person_with_want, longest_talking_head_seconds.',
  items: {
    type: 'object',
    properties: {
      timecode: { type: 'string', description: 'Scene start, e.g. "03:05". Seconds or "H:MM:SS" also accepted.' },
      duration: { type: 'string', description: 'Optional; derived from the next scene\'s start when omitted.' },
      description: { type: 'string' },
      valence: { type: 'number', description: 'Integer -3 to +3, scored by the editor against the anchors.' },
      intensity: { type: 'number', description: 'Integer 0 to 5, scored by the editor against the anchors.' },
      opens: { type: 'array', items: { type: 'string' }, description: 'Question ids this scene opens.' },
      closes: { type: 'array', items: { type: 'string' }, description: 'Question ids this scene closes.' },
      information_only: { type: 'boolean', description: 'True where the scene only delivers information — no question opened, no stake raised.' },
      person_with_want: { type: 'boolean', description: 'True where a named individual with a want is on screen or in voice.' },
      longest_talking_head_seconds: { type: 'number', description: 'Longest unbroken talking-head run in the scene; a static wide of the same room does not reset the clock.' },
    },
    required: ['timecode', 'valence', 'intensity'],
  },
};

const questionInputSchema = {
  type: 'array',
  description: 'The Q&A ledger. Each question: id, opens (timecode), closes (timecode or omitted), how (on_screen, implied, off_screen, never), weight (central, major, minor). Exactly one should be central.',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'e.g. "Q1".' },
      question: { type: 'string' },
      opens: { type: 'string', description: 'Timecode where the question opens.' },
      closes: { type: 'string', description: 'Timecode where it closes. Omit if never closed.' },
      how: { type: 'string', description: 'on_screen, implied, off_screen or never.' },
      weight: { type: 'string', description: 'central, major or minor.' },
    },
    required: ['opens'],
  },
};

// --------------------------------------------------------------- references

server.tool('form_conventions', {
  description:
    'The attention conventions of each encoded form — short_doc, feature_doc, branded, ' +
    'youtube_longform, broadcast: when the first question must open, typical departure points, the ' +
    'central-close window and the talking-head limit. Conventions as practitioners describe them, ' +
    'not audience measurements. Omit form to list all of them.',
  inputSchema: {
    type: 'object',
    properties: {
      form: { type: 'string', description: 'short_doc, feature_doc, branded, youtube_longform or broadcast.' },
    },
  },
  handler: async ({ form }) => {
    if (form) return { note: CONVENTION_NOTE, ...namedForm(form) };
    return {
      note: CONVENTION_NOTE,
      unlisted_forms: UNLISTED_FORM_NOTE,
      baselines_when_no_form_is_named: BASELINES,
      forms: Object.fromEntries(
        Object.entries(FORMS).map(([id, f]) => [id, {
          label: f.label,
          question_must_open_by_seconds: f.question_must_open_by_seconds,
          central_close_window: f.central_close_window ?? f.central_close_note,
          talking_head_limit_seconds: f.talking_head_limit_seconds,
          sag_risk_window: f.sag_risk_window,
        }])
      ),
    };
  },
});

server.tool('scoring_anchors', {
  description:
    'The scoring vocabulary the skill scores with: valence anchors (-3..+3), intensity anchors ' +
    '(0..5), the scene-boundary definition, the series-pattern readings, the Q&A ledger format and ' +
    'the edit effort scale. Scoring itself is a reading the editor or the skill makes — this only ' +
    'returns the anchors.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    note: SCORING_NOTE,
    scene_boundaries: SCENE_BOUNDARIES,
    valence: { anchors: VALENCE_ANCHORS, note: VALENCE_NOTE },
    intensity: { anchors: INTENSITY_ANCHORS, note: INTENSITY_NOTE },
    series_patterns: SERIES_PATTERNS,
    derived_figure: DERIVED_FIGURE_NOTE,
    ledger_format: LEDGER_FORMAT,
    effort_scale: EFFORT_SCALE,
    exposed_runtime: EXPOSED_RUNTIME_NOTE,
  }),
});

server.tool('dropoff_causes', {
  description:
    'The five diagnosable drop-off causes — no question open, stakes not personalised, tonal ' +
    'monotony, premature resolution, texture starvation — each with its mechanical tell, threshold, ' +
    'standard fix and a worked example, plus the priority order when tells overlap. Omit cause to ' +
    'list all five.',
  inputSchema: {
    type: 'object',
    properties: {
      cause: { type: 'string', description: 'no_question_open, stakes_not_personalised, tonal_monotony, premature_resolution or texture_starvation.' },
    },
  },
  handler: async ({ cause }) => {
    if (cause) {
      const entry = causeFor(cause);
      if (!entry) {
        throw new ToolError('unknown_cause', `No cause "${cause}".`, { available: Object.keys(CAUSES) });
      }
      return { note: CORRELATE_NOTE, ...entry };
    }
    return {
      note: CORRELATE_NOTE,
      causes: Object.fromEntries(
        Object.entries(CAUSES).map(([id, c]) => [id, { label: c.label, tell: c.tell, threshold: c.threshold }])
      ),
      overlap_priority: OVERLAP_PRIORITY,
      overlap_note: OVERLAP_NOTE,
    };
  },
});

// ------------------------------------------------------------------- checks

server.tool('check_tells', {
  description:
    'Run the five drop-off tells mechanically against a scored scene table and Q&A ledger: tripped ' +
    'stretches by timecode and cause, ledger findings, overlaps with priority, and total exposed ' +
    'run-time. Threshold arithmetic on scores the editor supplies — it does not read the film, and ' +
    'a tripped tell is a stretch to watch again, not a proven defect. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      form: { type: 'string', description: 'Optional form id; its talking-head limit and central-close window replace the generic baselines.' },
      total_runtime: { type: 'string', description: 'Total run-time, e.g. "11:40". Defaults to the end of the last scene.' },
      scenes: sceneInputSchema,
      questions: questionInputSchema,
    },
    required: ['scenes', 'questions'],
  },
  handler: async ({ form, total_runtime, scenes: rawScenes, questions: rawQuestions }) => {
    await client.requireFeature('tools');
    const formEntry = namedForm(form);
    const { scenes, runtime, sceneCountNote } = normaliseScenes(rawScenes, { totalRuntime: total_runtime });
    const questions = normaliseQuestions(rawQuestions, runtime);
    const { result } = checkTells({ scenes, questions, runtime, form: formEntry });
    return {
      judged_against: formEntry ? formEntry.label : 'No form named — generic baselines from the tell table. Name a form; there is no form-neutral pacing judgement.',
      ...(sceneCountNote ? { scene_count_note: sceneCountNote } : {}),
      ...result,
    };
  },
});

server.tool('plot_arc', {
  description:
    'The valence and intensity series read as a derivative: per-scene changes, flat stretches with ' +
    'the end scores quoted, the largest gap between valence changes of two or more points, ' +
    'intensity peaks and whether each one lands, and the last-quarter trend. Arithmetic on the ' +
    'editor\'s scores — flat stretches are the problem, not low stretches, and nothing here is a ' +
    'score of the film. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      total_runtime: { type: 'string', description: 'Total run-time. Defaults to the end of the last scene.' },
      scenes: sceneInputSchema,
    },
    required: ['scenes'],
  },
  handler: async ({ total_runtime, scenes: rawScenes }) => {
    await client.requireFeature('tools');
    const { scenes, runtime, sceneCountNote } = normaliseScenes(rawScenes, { totalRuntime: total_runtime });
    return {
      ...(sceneCountNote ? { scene_count_note: sceneCountNote } : {}),
      ...plotArc(scenes, runtime),
    };
  },
});

server.tool('reconcile_curve', {
  description:
    'Classify each drop in a real retention curve against the tripped tells: explained (lands on ' +
    'or just after a tell — with the cause), unexplained (usually performance, music or grade, ' +
    'which this cannot see), or model-only (a tell the audience never minded — the model was wrong ' +
    'there). The curve wins; no flag is adjusted to fit it. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      form: { type: 'string', description: 'Optional form id.' },
      total_runtime: { type: 'string', description: 'Total run-time. Defaults to the end of the last scene.' },
      scenes: sceneInputSchema,
      questions: questionInputSchema,
      drops: {
        type: 'array',
        description: 'The measured drops, read off the platform\'s retention curve by the editor.',
        items: {
          type: 'object',
          properties: {
            timecode: { type: 'string', description: 'Where the drop starts.' },
            note: { type: 'string', description: 'Optional, e.g. "loses 18% here" as read from the curve.' },
          },
          required: ['timecode'],
        },
      },
      after_window_seconds: { type: 'number', description: 'How far after a tripped stretch a drop still counts as "just after". Default 15.' },
    },
    required: ['scenes', 'questions', 'drops'],
  },
  handler: async ({ form, total_runtime, scenes: rawScenes, questions: rawQuestions, drops, after_window_seconds }) => {
    await client.requireFeature('tools');
    if (!Array.isArray(drops) || !drops.length) {
      throw new ToolError('invalid_drops', 'Supply at least one measured drop. With no retention data there is nothing to reconcile — use check_tells alone.');
    }
    const formEntry = namedForm(form);
    const { scenes, runtime } = normaliseScenes(rawScenes, { totalRuntime: total_runtime });
    const questions = normaliseQuestions(rawQuestions, runtime);
    const { stretches } = checkTells({ scenes, questions, runtime, form: formEntry });
    return reconcileDrops({ drops, stretches, afterWindowSeconds: after_window_seconds });
  },
});

// ------------------------------------------------------------- analysis log

server.tool('log_analysis', {
  description:
    'Record an analysis in the local log — film, cut version, form, what was flagged, the three ' +
    'chosen cuts with effort ratings, and whether real retention data was supplied. Logging two ' +
    'versions of the same film is how a recut gets compared honestly. Requires a paid plan. ' +
    'Nothing leaves this machine.',
  inputSchema: {
    type: 'object',
    properties: {
      film: { type: 'string', description: 'Working title, for later recognition.' },
      version: { type: 'string', description: 'Cut version, e.g. "assembly", "fine cut 2".' },
      form: { type: 'string', description: 'The form judged against.' },
      total_runtime: { type: 'string' },
      retention_data_supplied: { type: 'boolean', description: 'Whether a real retention curve was in the room. If true, the curve\'s reading outranks the log\'s flags.' },
      findings_summary: { type: 'string', description: 'The tripped tells in one or two lines.' },
      cuts: {
        type: 'array',
        description: 'The three highest-leverage cuts, ranked. Give exactly three — a ranked list of eleven changes is a way of not having an opinion.',
        items: {
          type: 'object',
          properties: {
            rank: { type: 'number' },
            change: { type: 'string' },
            effort: { type: 'number', description: 'The edit effort scale: 1 inside one scene, 2 reorder or lift a scene, 3 needs new material.' },
            exposed_runtime: { type: 'string', description: 'Run-time currently sitting under a flag — not a predicted watch-time gain.' },
          },
          required: ['change', 'effort'],
        },
      },
      notes: { type: 'string' },
    },
    required: ['film'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    for (const cut of args.cuts ?? []) {
      if (![1, 2, 3].includes(cut.effort)) {
        throw new ToolError('invalid_effort', `Effort ${cut.effort} is not on the scale.`, { scale: EFFORT_SCALE });
      }
    }
    if ((args.cuts ?? []).length > 3) {
      throw new ToolError('too_many_cuts', 'Give exactly three highest-leverage cuts. A ranked list of eleven changes is a way of not having an opinion.');
    }
    const record = logAnalysis(args);
    return { logged: true, analysis_id: record.id, stored_at: ANALYSES_FILE };
  },
});

server.tool('review_analyses', {
  description:
    'The local record of past analyses — list them, filter by film to set two versions of a cut ' +
    'side by side, or fetch one in full. Reading only; it makes no new claim. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      analysis_id: { type: 'string', description: 'Fetch one analysis in full.' },
      film: { type: 'string', description: 'Filter by film title.' },
      limit: { type: 'number', description: 'Default 20.' },
    },
  },
  handler: async ({ analysis_id, film, limit }) => {
    await client.requireFeature('tools');
    if (analysis_id) {
      const record = getAnalysis(analysis_id);
      if (!record) throw new ToolError('unknown_analysis', `No analysis "${analysis_id}".`);
      return record;
    }
    return reviewAnalyses({ film, limit: limit ?? 20 });
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
