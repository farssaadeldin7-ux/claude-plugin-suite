#!/usr/bin/env node
/**
 * Generative Digital Twin — MCP server.
 *
 * The deterministic half of the method: the dimension taxonomy, the curation
 * rules with a mechanical corpus check, the scoring and re-audit arithmetic
 * against the stated thresholds, and the local style-profile store. The
 * judgement half — extracting values from real work, assigning a draft its
 * per-dimension scores, deciding what a correction implies — lives in the
 * skill, and nothing here scores a draft it has not been handed scores for.
 * There is no twin anywhere in this server: it counts, stores and compares.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import { DIMENSIONS, EXTRACTION_RULES, WEIGHTING, BRIEF_DRIVEN, mediumFor } from './lib/dimensions.js';
import {
  SIZE_BANDS, INCLUSION_RULES, EXCLUSION_RULES, BRAND_GUIDELINES_TEST,
  LABEL_SCHEMA, LABEL_NOTE, RIGHTS_CHECKLIST, WORKED_EXAMPLE, corpusCheck,
} from './lib/curation.js';
import {
  SCORE_SCALE, HARD_FAIL_RULE, MEAN_BANDS, FLAT_TWOS_NOTE, BASELINE_RULE,
  REAUDIT, DIAGNOSIS_TABLE, DISCLOSURE_CHECKLIST, GOVERNANCE_MINIMUMS,
  scoreIsValid, scoreDraft, driftAudit,
} from './lib/scoring.js';
import {
  NEVER_TARGET, ANCHOR_TARGET, PROFILE_SECTIONS, PREAMBLE_RULES,
  profileFacts, saveProfile, getProfile, listProfiles, PROFILES_FILE,
} from './lib/profiles.js';

const PLUGIN_ID = 'generative-digital-twin';
const PLUGIN_NAME = 'Generative Digital Twin';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the taxonomy, curation rules and governance reference stay
// open so the method can be evaluated before buying; the corpus check, the
// scoring arithmetic, the drift audit and the profile store are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for building and policing a style profile. Call style_dimensions for the ' +
    'taxonomy, curation_rules before assembling a corpus, corpus_check on the labelled list, score_draft ' +
    'to run the arithmetic on scores you have already assigned, drift_audit at re-audit time, and ' +
    'save_profile / get_profile for the local store. Nothing here reads work, extracts a style or judges ' +
    'a draft — extraction and scoring judgements are the skill\'s job, and there is no twin: the product ' +
    'is a document of checkable rules.',
});

// ----------------------------------------------------------------- open tools

server.tool('style_dimensions', {
  description:
    'The style dimension taxonomy: what to measure, how to extract it from a corpus, and what a checkable ' +
    'entry looks like, for visual, written and motion work — plus extraction order, weighting method and ' +
    'the dimensions that usually turn out to be brief-driven. Reference data only; it extracts nothing.',
  inputSchema: {
    type: 'object',
    properties: {
      medium: { type: 'string', description: 'Optional: "visual", "written" or "motion". Omit for all three.' },
    },
  },
  handler: async ({ medium }) => {
    if (medium) {
      const found = mediumFor(medium);
      if (!found) {
        throw new ToolError('unknown_medium', `No medium "${medium}".`, { available: Object.keys(DIMENSIONS) });
      }
      return { rules: EXTRACTION_RULES, [medium]: found, weighting: WEIGHTING, brief_driven: BRIEF_DRIVEN };
    }
    return { rules: EXTRACTION_RULES, media: DIMENSIONS, weighting: WEIGHTING, brief_driven: BRIEF_DRIVEN };
  },
});

server.tool('curation_rules', {
  description:
    'The corpus curation rules: size bands and what happens outside them, inclusion and exclusion rules, ' +
    'the brand-guidelines test, the labelling schema, the rights checklist, and a worked 20-piece curation ' +
    'with what was excluded and why. Reference data only.',
  inputSchema: {
    type: 'object',
    properties: {
      include_worked_example: { type: 'boolean', description: 'Include the full worked 20-piece example. Default false.' },
    },
  },
  handler: async ({ include_worked_example }) => ({
    size_bands: SIZE_BANDS.map(({ range, reading }) => ({ range, reading })),
    inclusion_rules: INCLUSION_RULES,
    exclusion_rules: EXCLUSION_RULES,
    brand_guidelines_test: BRAND_GUIDELINES_TEST,
    labelling_schema: LABEL_SCHEMA,
    labelling_note: LABEL_NOTE,
    rights_checklist: RIGHTS_CHECKLIST,
    ...(include_worked_example ? { worked_example: WORKED_EXAMPLE } : {
      worked_example: 'Call again with include_worked_example: true for the full 20-piece curation.',
    }),
  }),
});

server.tool('governance_reference', {
  description:
    'The scoring and governance reference: the 0-4 scale, the hard-fail rule, how to read the weighted ' +
    'mean, the baseline rule, the re-audit protocol with its flag thresholds, the drift diagnosis table, ' +
    'the profile document structure, the never-list and preamble targets, and the disclosure and ' +
    'governance checklists. Reference data only; score_draft and drift_audit apply the arithmetic.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    score_scale: SCORE_SCALE,
    hard_fail_rule: HARD_FAIL_RULE,
    mean_bands: MEAN_BANDS.map(({ band, read_as }) => ({ band, read_as })),
    flat_twos: FLAT_TWOS_NOTE,
    baseline_rule: BASELINE_RULE,
    reaudit: {
      cadence: REAUDIT.cadence,
      sample_rule: REAUDIT.sample_rule,
      blind_rule: REAUDIT.blind_rule,
      flag_rules: REAUDIT.flag_rules,
    },
    diagnosis_table: DIAGNOSIS_TABLE,
    profile_structure: PROFILE_SECTIONS,
    never_list: NEVER_TARGET.rule,
    anchors: ANCHOR_TARGET.rule,
    preamble: PREAMBLE_RULES,
    disclosure_checklist: DISCLOSURE_CHECKLIST,
    governance_minimums: GOVERNANCE_MINIMUMS,
  }),
});

// ------------------------------------------------------------- licensed tools

server.tool('corpus_check', {
  description:
    'Mechanical checks on a labelled corpus list: size band, schema violations, missing near-miss notes, ' +
    'heavy-constraint pieces without a "contributes" list, date spread, duplicates. Facts with the rule ' +
    'each is counted against — it does not read the work, and it cannot verify ownership. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      pieces: {
        type: 'array',
        description: 'The labelled corpus, one object per piece using the labelling schema from curation_rules.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            brief: { type: 'string' },
            medium: { type: 'string' },
            year: { type: 'number' },
            landed: { type: 'string', description: 'landed, mixed or near-miss.' },
            constraints: { type: 'string', description: 'none, light or heavy.' },
            contributes: { type: 'array', items: { type: 'string' }, description: 'Required when constraints is heavy.' },
            note: { type: 'string', description: 'Required for near-misses: one sentence on what is wrong.' },
          },
        },
      },
    },
    required: ['pieces'],
  },
  handler: async ({ pieces }) => {
    await client.requireFeature('tools');
    if (!Array.isArray(pieces) || !pieces.length) {
      throw new ToolError('invalid_request', 'Supply the corpus as a non-empty array of labelled pieces.');
    }
    return corpusCheck(pieces);
  },
});

server.tool('score_draft', {
  description:
    'The arithmetic of the scoring pass, on per-dimension scores already assigned by the reviewer: weighted ' +
    'mean, the reading band, the two weakest dimensions, and the hard-fail rule — any 0 is a reject reported ' +
    'before the mean, never averaged away. It does not look at the draft and assigns no scores itself. ' +
    'Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      scores: {
        type: 'array',
        description: 'One entry per profile dimension.',
        items: {
          type: 'object',
          properties: {
            dimension: { type: 'string' },
            score: { type: 'number', description: 'Integer 0-4 from the scale in governance_reference.' },
            weight: { type: 'number', description: 'Optional weight from the profile. Default 1.' },
            breached_never_entry: { type: 'string', description: 'Required when score is 0: the never-list entry breached, verbatim.' },
          },
          required: ['dimension', 'score'],
        },
      },
    },
    required: ['scores'],
  },
  handler: async ({ scores }) => {
    await client.requireFeature('tools');
    if (!Array.isArray(scores) || !scores.length) {
      throw new ToolError('invalid_request', 'Supply at least one per-dimension score.');
    }
    for (const s of scores) {
      if (!s?.dimension || !scoreIsValid(s.score)) {
        throw new ToolError('invalid_score', 'Each entry needs a dimension name and an integer score from 0 to 4.');
      }
      if (s.score === 0 && !s.breached_never_entry) {
        throw new ToolError('breach_not_named',
          `"${s.dimension}" scores 0, and a 0 means a never-list breach — name the entry breached in breached_never_entry.`);
      }
      if (s.weight !== undefined && !(typeof s.weight === 'number' && s.weight > 0)) {
        throw new ToolError('invalid_weight', `"${s.dimension}" has a weight that is not a positive number.`);
      }
    }
    return scoreDraft(scores);
  },
});

server.tool('drift_audit', {
  description:
    'The re-audit comparison: per-dimension sample means against the recorded baseline, flagged by the two ' +
    'stated thresholds (mean fallen 1.0 or more; 40% or more of samples at 2 or below), plus never-breach ' +
    'counting and the diagnosis table. Scoring the samples is the reviewer\'s job first — this only compares. ' +
    'Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      profile_id: { type: 'string', description: 'Optional: a stored profile whose baseline supplies baseline_mean where not given inline.' },
      dimensions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            dimension: { type: 'string' },
            baseline_mean: { type: 'number', description: 'The mean recorded when the profile was built. Optional if the stored profile has a baseline for this dimension.' },
            sample_scores: { type: 'array', items: { type: 'number' }, description: 'The 0-4 scores of the recent samples on this dimension — at least eight samples per the protocol.' },
          },
          required: ['dimension', 'sample_scores'],
        },
      },
      never_breaches: {
        type: 'array',
        description: 'Optional: never-list breaches found in the sample.',
        items: {
          type: 'object',
          properties: {
            entry: { type: 'string', description: 'The never-list entry breached.' },
            occurrences: { type: 'number', description: 'How many samples breached it.' },
          },
          required: ['entry', 'occurrences'],
        },
      },
    },
    required: ['dimensions'],
  },
  handler: async ({ profile_id, dimensions, never_breaches }) => {
    await client.requireFeature('tools');
    if (!Array.isArray(dimensions) || !dimensions.length) {
      throw new ToolError('invalid_request', 'Supply at least one dimension with its sample scores.');
    }
    const profile = profile_id ? getProfile(profile_id) : null;
    if (profile_id && !profile) throw new ToolError('unknown_profile', `No profile "${profile_id}".`);

    const resolved = dimensions.map((d) => {
      if (!d?.dimension || !Array.isArray(d.sample_scores) || !d.sample_scores.length) {
        throw new ToolError('invalid_request', 'Each dimension needs a name and a non-empty sample_scores array.');
      }
      if (!d.sample_scores.every(scoreIsValid)) {
        throw new ToolError('invalid_score', `"${d.dimension}" has a sample score outside the integer 0-4 scale.`);
      }
      const baseline = d.baseline_mean ?? profile?.baseline?.[d.dimension];
      if (typeof baseline !== 'number' || baseline < 0 || baseline > 4) {
        throw new ToolError('missing_baseline',
          `No baseline mean for "${d.dimension}" — supply baseline_mean, or store a baseline on the profile with save_profile.`);
      }
      return { ...d, baseline_mean: baseline };
    });

    return driftAudit(resolved, never_breaches ?? []);
  },
});

server.tool('save_profile', {
  description:
    'Create or update a style profile in the local store: scope, never list, dimensions, anchors, boundary, ' +
    'provenance, baseline means and preamble, with a version and an automatic dated changelog. Returns the ' +
    'countable facts about it — never-list and anchor counts against target, entries with no number or ' +
    'prohibition, preamble word budget and any never entries missing verbatim from it. Facts, not verdicts. ' +
    'Nothing leaves this machine. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      profile_id: { type: 'string', description: 'Omit to create; supply to update. Fields not supplied are kept.' },
      name: { type: 'string', description: 'Whose profile this is, e.g. a studio or director name.' },
      version: { type: 'string', description: 'Required — a profile without a version cannot be audited for drift.' },
      scope: { type: 'string', description: 'Which media and which briefs the profile covers, and the agreed disclosure position.' },
      never_list: { type: 'array', items: { type: 'string' }, description: 'Imperative prohibitions with observable triggers. Target 12-20.' },
      dimensions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            entry: { type: 'string', description: 'The extracted, checkable value.' },
            example: { type: 'string', description: 'One corpus piece cited by name.' },
            weight: { type: 'number', description: 'Higher for the dimensions the director would notice first.' },
          },
          required: ['name', 'entry'],
        },
      },
      anchors: { type: 'array', items: { type: 'string' }, description: 'The three to five pieces that best represent the profile.' },
      boundary: { type: 'array', items: { type: 'string' }, description: 'The near-misses, each with a sentence on what is wrong.' },
      provenance: {
        type: 'object',
        description: 'Corpus size, date range, ownership confirmed, date built.',
        properties: {
          corpus_size: { type: 'number' },
          date_range: { type: 'string' },
          ownership_confirmed: { type: 'boolean' },
          date_built: { type: 'string' },
        },
      },
      baseline: { type: 'object', description: 'Per-dimension baseline means from scoring three corpus pieces, e.g. {"palette_discipline": 3.7}.' },
      preamble: { type: 'string', description: 'The derived prompt preamble, 300-600 words, never list first and verbatim.' },
      change_note: { type: 'string', description: 'One line for the changelog on what changed and why.' },
    },
    required: ['version'],
  },
  handler: async ({ change_note, ...input }) => {
    await client.requireFeature('tools');
    if (!input.version?.trim()) throw new ToolError('invalid_request', 'A version is required — a profile without one cannot be audited for drift.');
    if (input.profile_id && !getProfile(input.profile_id)) {
      throw new ToolError('unknown_profile', `No profile "${input.profile_id}" — omit profile_id to create a new one.`);
    }
    const profile = saveProfile(input, change_note);
    return {
      saved: true,
      profile_id: profile.profile_id,
      version: profile.version,
      stored_at: PROFILES_FILE,
      ...profileFacts(profile),
    };
  },
});

server.tool('get_profile', {
  description:
    'Read a stored style profile and the countable facts about it, or list the profiles in the local store ' +
    'when no id is given. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      profile_id: { type: 'string', description: 'Omit to list all stored profiles.' },
    },
  },
  handler: async ({ profile_id }) => {
    await client.requireFeature('tools');
    if (!profile_id) {
      const profiles = listProfiles();
      return {
        profiles,
        stored_at: PROFILES_FILE,
        ...(profiles.length ? {} : { note: 'No profiles stored yet — create one with save_profile.' }),
      };
    }
    const profile = getProfile(profile_id);
    if (!profile) throw new ToolError('unknown_profile', `No profile "${profile_id}".`);
    return { profile, ...profileFacts(profile), stored_at: PROFILES_FILE };
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
