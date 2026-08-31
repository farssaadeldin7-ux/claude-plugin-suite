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
import {
  FAMILY_BANDS, BAND_CAVEAT, HARMONIC_RULE, ELIMINATION_TESTS,
  matchOrders, planElimination, checkCapture,
} from './lib/acoustics.js';

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
    'Acoustic diagnosis for vehicles. Isolation first: capture_check for the recording ' +
    'conditions, elimination_plan for the next subtraction tests over recorded results, ' +
    'order_match to tie a spectrogram line to a rotating part by arithmetic, frequency_bands for ' +
    'the family tables. Then diagnosis: call sound_vocabulary to learn the controlled terms, ' +
    'characterise the isolated noise with the user in those terms, and call diagnose. Never guess ' +
    'at vocabulary values — unrecognised terms are dropped and silently weaken the match.',
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

// ----------------------------------------------------------- signal isolation

server.tool('frequency_bands', {
  description:
    'The frequency-band families — where knocks, slaps, ticks, rattles, whines, bearings, belts, ' +
    'brakes, exhaust leaks and maskers sit in frequency and time, with their spectrogram ' +
    'signatures — plus the harmonic rule. Reference data only; order_match is what runs the ' +
    'arithmetic against a measurement. Every figure is a band, not a threshold.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    caveat: BAND_CAVEAT,
    families: FAMILY_BANDS,
    harmonic_rule: HARMONIC_RULE,
  }),
});

server.tool('capture_check', {
  description:
    'Mechanical check of the described recording conditions against the capture rules: HVAC, ' +
    'radio, windows, phone mounting, whether the noise was actually reproduced. Findings with ' +
    'fixes; it has not heard the recording and judges nothing about its content. Open — a bad ' +
    'capture should be caught before anyone pays for anything.',
  inputSchema: {
    type: 'object',
    properties: {
      windows_closed: { type: 'boolean', description: 'Were the windows closed during the capture?' },
      hvac_off: { type: 'boolean', description: 'Was the HVAC/blower off?' },
      radio_off: { type: 'boolean', description: 'Was the audio system off?' },
      phone_mounted: { type: 'boolean', description: 'Was the phone mounted or rested, rather than handheld?' },
      reproduced_live: { type: 'boolean', description: 'Was the noise actually happening during the recording?' },
    },
  },
  handler: async (args) => checkCapture(args),
});

server.tool('order_match', {
  description:
    'Order arithmetic: tie a measured spectrogram line (Hz) or stripe rate (events/second) to the ' +
    'rotating parts it could be — crank, camshaft, firing rate, accessory pulley, wheel — from ' +
    'RPM, cylinder count, road speed and tyre circumference, with harmonics to order 6 and the ' +
    'working shown for every candidate. Arithmetic only: when several rates match, the ' +
    'elimination tests decide, not this tool. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      measured_hz: { type: 'number', description: 'A spectrogram line, in Hz. Pass this or events_per_second.' },
      events_per_second: { type: 'number', description: 'A stripe/impact rate, per second.' },
      rpm: { type: 'number', description: 'Engine RPM when the measurement was taken.' },
      cylinders: { type: 'number', description: 'Cylinder count, to compute the firing rate.' },
      speed_kmh: { type: 'number', description: 'Road speed when the measurement was taken.' },
      tyre_circumference_m: { type: 'number', description: 'Rolling circumference in metres. Defaults to 2.0 with the assumption stated.' },
      pulley_ratio: { type: 'number', description: 'A specific accessory pulley ratio, if known. Otherwise the typical 2–3× alternator band is used.' },
      tolerance_pct: { type: 'number', description: 'Match tolerance. Default 10.' },
    },
  },
  handler: async (args) => {
    await client.requireFeature('diagnose');
    return matchOrders(args);
  },
});

server.tool('elimination_plan', {
  description:
    'The staged elimination protocol over recorded results: pass the tests already run with their ' +
    'outcomes (survives/gone) and get back what each result mechanically rules in, the derived ' +
    'side of the vehicle where the tables decide it, a conflict flag when results point both ' +
    'ways (usually two noises), and the ordered tests still worth running. Pass no results for ' +
    'the full protocol from the top. Table lookups only — the ear and the drive stay with the ' +
    'person. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      results: {
        type: 'object',
        description: `Test outcomes recorded so far, e.g. {"neutral_coast": "survives", "surface_change": "gone"}. Test ids: ${ELIMINATION_TESTS.map((t) => t.id).join(', ')}. Outcomes: survives, gone, unchanged.`,
      },
    },
  },
  handler: async (args) => {
    await client.requireFeature('diagnose');
    return planElimination(args);
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
