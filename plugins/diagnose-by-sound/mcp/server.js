#!/usr/bin/env node
/**
 * Diagnose by Sound — MCP server.
 *
 * Provides the deterministic half of the diagnosis: a controlled vocabulary for
 * describing a noise, a weighted matcher against 42 acoustic signatures, and
 * the licensing gate. The judgement half lives in the skill, where Claude
 * conducts the interview and interprets the results.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  TAXONOMY, SIGNATURES, matchSignatures, discriminatingQuestions,
  safetyVerdict, normaliseObservation, rejectedTerms,
} from './lib/match.js';
import { saveCase, listCases, getCase, updateCase, priorOutcomes, CASES_FILE } from './lib/cases.js';

const PLUGIN_ID = 'diagnose-by-sound';
const PLUGIN_NAME = 'Diagnose by Sound';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier for this plugin: diagnose, repair_plan and history all
// require a paid licence. The vocabulary and signature-browsing tools stay
// open so a noise can be described before buying.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Acoustic diagnosis for vehicles. Call sound_vocabulary first to learn the controlled terms, ' +
    'characterise the noise with the user in those terms, then call diagnose. Never guess at ' +
    'vocabulary values — unrecognised terms are dropped and silently weaken the match.',
});

// ---------------------------------------------------------------- vocabulary

server.tool('sound_vocabulary', {
  description:
    'Return the controlled vocabulary for describing a vehicle noise: sound characters, pitch bands, ' +
    'rhythms, the conditions a noise occurs under, locations, and what it changes with. ' +
    'Call this before diagnose so the observation uses terms the matcher recognises.',
  inputSchema: {
    type: 'object',
    properties: {
      dimension: {
        type: 'string',
        description: 'Optional single dimension to return: character, pitch, rhythm, occurs_when, location, changes_with, severity.',
      },
    },
  },
  handler: async ({ dimension }) => {
    if (dimension) {
      if (!TAXONOMY[dimension]) {
        throw new ToolError('unknown_dimension', `No dimension "${dimension}".`, { available: Object.keys(TAXONOMY) });
      }
      return { dimension, terms: TAXONOMY[dimension] };
    }
    return {
      note: 'Use these exact terms in diagnose. Anything else is discarded.',
      ...TAXONOMY,
      most_diagnostic: [
        'changes_with — whether the noise tracks road speed, engine RPM or load separates whole systems',
        'occurs_when — the conditions that reproduce it',
        'character — what it actually sounds like',
      ],
    };
  },
});

server.tool('describe_signature', {
  description:
    'Look up one acoustic signature in full: why it happens, how to confirm it, the parts usually involved ' +
    'and the questions that separate it from lookalikes. Use after diagnose to go deeper on a candidate.',
  inputSchema: {
    type: 'object',
    properties: {
      signature_id: { type: 'string', description: 'Signature id from a diagnose result, e.g. "wheel-bearing".' },
    },
    required: ['signature_id'],
  },
  handler: async ({ signature_id }) => {
    const signature = SIGNATURES.find((s) => s.id === signature_id);
    if (!signature) {
      throw new ToolError('unknown_signature', `No signature "${signature_id}".`, {
        available: SIGNATURES.map((s) => s.id),
      });
    }
    return { ...signature, severity_advice: TAXONOMY.severity[signature.severity] };
  },
});

server.tool('list_signatures', {
  description:
    'List the acoustic signatures this plugin knows about, optionally filtered by vehicle system ' +
    '(brakes, wheels, driveline, suspension, steering, engine, transmission, exhaust, cooling, fuel, hvac, accessories).',
  inputSchema: {
    type: 'object',
    properties: { system: { type: 'string', description: 'Optional system filter.' } },
  },
  handler: async ({ system }) => {
    const filtered = system ? SIGNATURES.filter((s) => s.system === system) : SIGNATURES;
    if (system && !filtered.length) {
      throw new ToolError('unknown_system', `No signatures for system "${system}".`, {
        available: [...new Set(SIGNATURES.map((s) => s.system))],
      });
    }
    return {
      count: filtered.length,
      signatures: filtered.map((s) => ({ id: s.id, label: s.label, system: s.system, severity: s.severity })),
    };
  },
});

// ----------------------------------------------------------------- diagnosis

server.tool('diagnose', {
  description:
    'Rank likely causes for a vehicle noise from a structured description of it. Returns candidates with ' +
    'calibrated confidence, the questions that would most narrow the field, and a safety verdict. ' +
    'Use sound_vocabulary first. Counts against the monthly diagnosis quota.',
  inputSchema: {
    type: 'object',
    properties: {
      character: { type: 'array', items: { type: 'string' }, description: 'What it sounds like, e.g. ["grind","squeal"].' },
      pitch: { type: 'array', items: { type: 'string' }, description: 'low, medium or high.' },
      rhythm: { type: 'array', items: { type: 'string' }, description: 'continuous, speed_linked, rpm_linked, intermittent, once_per_event, random.' },
      occurs_when: { type: 'array', items: { type: 'string' }, description: 'Conditions that reproduce it, e.g. ["braking","turning_left"].' },
      location: { type: 'array', items: { type: 'string' }, description: 'Where it seems to come from.' },
      changes_with: { type: 'array', items: { type: 'string' }, description: 'speed, rpm, load, brake, steering, temperature or none. The most diagnostic field.' },
      vehicle: {
        type: 'object',
        description: 'Optional vehicle context.',
        properties: {
          make: { type: 'string' }, model: { type: 'string' }, year: { type: 'number' },
          mileage: { type: 'number' }, drivetrain: { type: 'string' }, transmission: { type: 'string' },
        },
      },
      system: { type: 'string', description: 'Optional: restrict to one vehicle system.' },
      limit: { type: 'number', description: 'How many candidates to return. Default 5.' },
    },
  },
  handler: async (args) => {
    const entitlement = await client.requireFeature('diagnose');

    const quota = await client.checkQuota('diagnoses_per_month');
    if (!quota.allowed) {
      throw new ToolError('quota_exceeded',
        `This plan allows ${quota.limit} diagnoses per month and ${quota.used} have been used.`,
        { ...quota, next_step: 'Call list_plans, then start_checkout to move to a higher plan.' });
    }

    const rejected = rejectedTerms(args);
    const observation = normaliseObservation(args);
    const answered = Object.values(observation).filter((v) => v.length).length;

    if (!answered) {
      throw new ToolError('insufficient_observation',
        'None of the supplied terms were recognised, so there is nothing to match against.',
        { rejected, next_step: 'Call sound_vocabulary and re-describe the noise using those exact terms.' });
    }

    const result = matchSignatures(observation, {
      limit: args.limit ?? 5,
      systemFilter: args.system ?? null,
    });

    await client.recordUsage('diagnoses_per_month', 1);

    const questions = discriminatingQuestions(result.ranked);
    const safety = safetyVerdict(result.ranked);

    return {
      observation_used: observation,
      ...(Object.keys(rejected).length ? { rejected_terms: rejected, rejected_note: 'These were not in the vocabulary and were ignored.' } : {}),
      evidence: {
        dimensions_answered: result.answered,
        dimensions_missing: result.unanswered,
        evidence_weight_percent: result.evidence_weight,
        note: result.evidence_weight < 60
          ? 'Confidence is capped by how little was described. Answering the missing dimensions will move these numbers more than anything else.'
          : null,
      },
      candidates: result.ranked,
      separation: result.spread === null ? null : {
        top_two_gap: result.spread,
        verdict: result.spread < 15
          ? 'The leaders are too close to call — the discriminating questions below are the fastest way to split them.'
          : 'There is a clear leader, but confirm it before selling the repair.',
      },
      next_questions: questions,
      safety,
      plan: entitlement.plan,
      quota_remaining: quota.limit == null || quota.limit === -1
        ? 'unlimited'
        : Math.max(0, quota.limit - quota.used - 1),
    };
  },
});

// --------------------------------------------------------------- repair plan

server.tool('repair_plan', {
  description:
    'Build an ordered confirmation-and-repair plan for a chosen candidate: the tests to run in order, ' +
    'what each result rules in or out, parts typically involved, and book labour hours. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      signature_id: { type: 'string', description: 'The candidate to plan for, from a diagnose result.' },
      labour_rate: { type: 'number', description: 'Optional shop rate per hour, used to cost the labour line.' },
      currency: { type: 'string', description: 'Currency code for the labour line, e.g. "NOK", "USD". Default USD.' },
      also_consider: { type: 'array', items: { type: 'string' }, description: 'Other candidate ids to keep on the table.' },
    },
    required: ['signature_id'],
  },
  handler: async ({ signature_id, labour_rate, currency = 'USD', also_consider = [] }) => {
    await client.requireFeature('repair_plan');

    const signature = SIGNATURES.find((s) => s.id === signature_id);
    if (!signature) {
      throw new ToolError('unknown_signature', `No signature "${signature_id}".`);
    }

    const alternates = also_consider
      .map((id) => SIGNATURES.find((s) => s.id === id))
      .filter(Boolean);

    const steps = signature.confirm.map((step, index) => ({
      order: index + 1,
      action: step,
      rules_out: alternates.length
        ? `If this comes back clean, revisit: ${alternates.map((a) => a.label).join('; ')}`
        : null,
    }));

    return {
      diagnosis: signature.label,
      system: signature.system,
      severity: signature.severity,
      safety_first: TAXONOMY.severity[signature.severity],
      why_it_happens: signature.why,
      confirmation_sequence: steps,
      stop_condition:
        'If the confirmation sequence does not produce a definite result, do not proceed to parts. ' +
        'Re-run diagnose with the new observations instead.',
      parts_typically_required: signature.typical_parts,
      labour: {
        book_hours: signature.labor_hours,
        rate: labour_rate ?? null,
        estimated_labour_cost: labour_rate ? Number((labour_rate * signature.labor_hours).toFixed(2)) : null,
        currency: labour_rate ? currency : null,
        note: 'Book hours are a general guide, not a manufacturer time. Parts prices are deliberately not estimated — quote them from your own supplier.',
      },
      still_on_the_table: alternates.map((a) => ({ id: a.id, label: a.label, severity: a.severity })),
    };
  },
});

// ------------------------------------------------------------- case history

server.tool('save_case', {
  description:
    'Save this diagnosis to the local case history on this machine, optionally with the confirmed outcome. ' +
    'Requires a paid plan. Nothing is sent to any server — the history stays on this computer.',
  inputSchema: {
    type: 'object',
    properties: {
      vehicle: { type: 'object', description: 'make, model, year, mileage.' },
      observation: { type: 'object', description: 'The observation used for the diagnosis.' },
      candidates: { type: 'array', description: 'The ranked candidates returned by diagnose.' },
      chosen: { type: 'string', description: 'Signature id the technician acted on.' },
      outcome: { type: 'string', description: 'What it actually turned out to be, once known.' },
      notes: { type: 'string' },
    },
  },
  handler: async (args) => {
    await client.requireFeature('history');
    const record = saveCase({
      vehicle: args.vehicle, observation: args.observation,
      ranked: args.candidates, chosen: args.chosen,
      outcome: args.outcome, notes: args.notes,
    });
    return { saved: true, case_id: record.id, stored_at: CASES_FILE };
  },
});

server.tool('review_cases', {
  description:
    'Search the local case history, or check what this shop has previously found for a given signature or vehicle. ' +
    'The best evidence available is what the same noise turned out to be last time. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free-text search across saved cases.' },
      case_id: { type: 'string', description: 'Fetch one case in full.' },
      signature_id: { type: 'string', description: 'Summarise prior outcomes for this signature.' },
      make: { type: 'string' },
      model: { type: 'string' },
      limit: { type: 'number', description: 'Default 20.' },
    },
  },
  handler: async ({ query, case_id, signature_id, make, model, limit }) => {
    await client.requireFeature('history');

    if (case_id) {
      const record = getCase(case_id);
      if (!record) throw new ToolError('unknown_case', `No case "${case_id}".`);
      return record;
    }
    if (signature_id || make || model) {
      return priorOutcomes({ signatureId: signature_id, make, model });
    }
    const cases = listCases({ limit: limit ?? 20, query });
    return { count: cases.length, cases, stored_at: CASES_FILE };
  },
});

server.tool('record_outcome', {
  description:
    'Record what a saved case actually turned out to be, once the repair is confirmed. ' +
    'This is what makes review_cases useful over time. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      case_id: { type: 'string' },
      chosen: { type: 'string', description: 'Signature id that proved correct.' },
      outcome: { type: 'string', description: 'What was actually wrong and what fixed it.' },
      notes: { type: 'string' },
    },
    required: ['case_id', 'outcome'],
  },
  handler: async ({ case_id, chosen, outcome, notes }) => {
    await client.requireFeature('history');
    const updated = updateCase(case_id, { chosen, outcome, notes });
    if (!updated) throw new ToolError('unknown_case', `No case "${case_id}".`);
    return { updated: true, case: updated };
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
