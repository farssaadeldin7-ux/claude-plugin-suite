#!/usr/bin/env node
/**
 * Predictive Resource Allocation — MCP server.
 *
 * The deterministic half of the method: the four-class triage reference and
 * its threshold checks, the capacity arithmetic for rendering and training
 * (a cliff, so it is checked first), the farm dispatch and checkpoint
 * arithmetic, and the local estimate log that closes the loop. The judgement
 * half — the intake interview, choosing which remedy to apply today, reading
 * a borderline result — lives in the skill. Nothing here forecasts: every
 * output is allocation arithmetic over stated inputs, a table lookup, or a
 * threshold check, and every estimate carries the method's factor-of-two
 * error band.
 *
 * No npm dependencies — plugins are installed without an npm install step.
 */

import { McpServer, ToolError } from './mcp-lite.js';
import { LicenseClient, registerLicenseTools } from './license-client.js';
import {
  CLASSES, DISCRIMINATING_TESTS, SYMPTOM_INDEX, BANDWIDTH_LADDER,
  MINIMUM_INTAKE, RULES_OF_THUMB, classifyBottleneck,
} from './lib/triage.js';
import {
  renderVramEstimate, trainingVramEstimate, BYTES_PER_PARAMETER, SYSTEM_RAM_NOTES,
} from './lib/memory.js';
import { DOMAINS, REMEDY_LADDER, domainFor } from './lib/domains.js';
import { dispatchPlan, checkpointInterval, WORK_TYPES } from './lib/dispatch.js';
import { logEstimate, recordActual, reviewEstimates, ESTIMATES_FILE } from './lib/estimates.js';

const PLUGIN_ID = 'predictive-resource-allocation';
const PLUGIN_NAME = 'Predictive Resource Allocation';
const DEFAULT_BILLING_URL = 'https://billing.example.com';

// No free tier: the triage reference, domain profiles and remedy ladder stay
// open so the method can be evaluated before buying; the arithmetic, the
// classifier and the estimate log are licensed.
const client = new LicenseClient({ pluginId: PLUGIN_ID, defaultBillingUrl: DEFAULT_BILLING_URL });

const server = new McpServer({
  name: PLUGIN_ID,
  version: '0.1.0',
  instructions:
    'Deterministic mechanics for finding where a render, simulation or training job bottlenecks. ' +
    'Call triage_reference for the four constraint classes and their tests, domain_profile for what ' +
    'usually binds in each application, then the licensed arithmetic: vram_estimate and ' +
    'training_memory_estimate for the capacity cliff, classify_bottleneck to turn measured test ' +
    'readings into a named class, dispatch_plan for farm batching and checkpoint intervals. ' +
    'Everything is arithmetic over reported inputs with a stated factor-of-two error band — nothing ' +
    'here measures the machine, and one measured run beats any estimate it produces.',
});

// ---------------------------------------------------------------- reference

server.tool('triage_reference', {
  description:
    'The four constraint classes (plus the two non-resource patterns), the four discriminating ' +
    'tests with their readings, the symptom index, the bandwidth ladder and the minimum intake the ' +
    'method demands before predicting. Reference data only — it names no class for your job; ' +
    'classify_bottleneck does that from measured readings. Omit section to get everything.',
  inputSchema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Optional single section: classes, tests, symptom_index, bandwidth_ladder, minimum_intake, rules_of_thumb.',
      },
    },
  },
  handler: async ({ section }) => {
    const sections = {
      classes: CLASSES,
      tests: DISCRIMINATING_TESTS,
      symptom_index: SYMPTOM_INDEX,
      bandwidth_ladder: BANDWIDTH_LADDER,
      minimum_intake: MINIMUM_INTAKE,
      rules_of_thumb: RULES_OF_THUMB,
    };
    if (section) {
      if (!sections[section]) {
        throw new ToolError('unknown_section', `No section "${section}".`, { available: Object.keys(sections) });
      }
      return { section, content: sections[section] };
    }
    return {
      note: 'Two agreeing tests are enough to name a class. Do not move to remedies on fewer than two pieces of evidence.',
      ...sections,
    };
  },
});

server.tool('domain_profile', {
  description:
    'Per-application bottleneck profile: what usually binds, the governing scaling law, and the ' +
    'settings that move it most — for GPU path tracing (Cycles, Redshift, Octane), Houdini FLIP ' +
    'and Pyro, Nuke, After Effects and model training. Table data from the references, not advice ' +
    'about your scene. Omit domain to list all of them.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'path_tracing, houdini_flip, houdini_pyro, nuke, after_effects or training.',
      },
    },
  },
  handler: async ({ domain }) => {
    if (domain) {
      const profile = domainFor(domain);
      if (!profile) {
        throw new ToolError('unknown_domain', `No domain "${domain}".`, { available: Object.keys(DOMAINS) });
      }
      return profile;
    }
    return {
      domains: Object.fromEntries(
        Object.entries(DOMAINS).map(([id, d]) => [id, { label: d.label, usually_binds_on: d.usually_binds_on }])
      ),
      system_ram_notes: SYSTEM_RAM_NOTES,
    };
  },
});

server.tool('remedy_ladder', {
  description:
    'The fixed remedy order — change a setting, change the data layout, change the algorithm, buy ' +
    'hardware — with typical cost and gain per rank, the four reasons hardware is last, and the one ' +
    'honest exception (the capacity cliff). Static reference; it does not rank remedies for a ' +
    'specific job.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => REMEDY_LADDER,
});

// --------------------------------------------------------------- arithmetic

server.tool('vram_estimate', {
  description:
    'GPU rendering capacity arithmetic against a card\'s usable budget (nominal minus the 10–15% ' +
    'reserve): geometry at 50–100 bytes per triangle, BVH at 1.3–2x geometry, textures with the ' +
    '1.33x mip chain, framebuffer with AOVs, engine overhead. Returns the breakdown and a ' +
    'fits / thin / does_not_fit verdict with a plus-or-minus 20% band. Arithmetic over your ' +
    'reported scene only — it does not read the scene file and does not predict render time. ' +
    'Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      vram_gb: { type: 'number', description: 'Nominal VRAM of the card, in GB.' },
      triangles: { type: 'number', description: 'Unique (non-instanced) triangle count. Instanced copies are close to free.' },
      bytes_per_triangle: { type: 'number', description: 'Reference range 50–100; default 64.' },
      subdivision_level: { type: 'number', description: 'Render-time subdivision level (each level is 4x the triangles). Default 0.' },
      textures: {
        type: 'array',
        description: 'Texture sets: [{width_px, height_px, channels, bytes_per_channel, count}]. E.g. a 4K 8-bit RGB set is {width_px: 4096, height_px: 4096, channels: 3, bytes_per_channel: 1}.',
        items: {
          type: 'object',
          properties: {
            width_px: { type: 'number' },
            height_px: { type: 'number' },
            channels: { type: 'number' },
            bytes_per_channel: { type: 'number', description: '1 for 8-bit, 2 for 16-bit half.' },
            count: { type: 'number', description: 'How many sets of this size. Default 1.' },
          },
          required: ['width_px', 'height_px', 'channels', 'bytes_per_channel'],
        },
      },
      resolution: {
        type: 'object',
        description: 'Output resolution, for the framebuffer term.',
        properties: { width_px: { type: 'number' }, height_px: { type: 'number' } },
      },
      aov_count: { type: 'number', description: 'AOV / render pass count, for the framebuffer term.' },
      engine_overhead_gb: { type: 'number', description: 'Renderer and driver overhead in GB; default 1.5.' },
    },
    required: ['vram_gb', 'triangles'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return renderVramEstimate(args);
  },
});

server.tool('training_memory_estimate', {
  description:
    'Training capacity arithmetic: static state from the bytes-per-parameter table (16 for mixed ' +
    'precision with Adam, 10 for 8-bit Adam or SGD, LoRA and inference variants), transformer ' +
    'activations at layers x batch x seq x hidden x 34 bytes, against the card\'s usable budget. ' +
    'When static state alone exceeds the card it says so and lists the algorithmic remedies — ' +
    'lowering the batch size cannot fix that case. Arithmetic only; it does not predict step time ' +
    'or convergence. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      vram_gb: { type: 'number', description: 'Nominal VRAM of the card, in GB.' },
      parameters_billion: { type: 'number', description: 'Model size in billions of parameters, e.g. 7 for a 7B model.' },
      configuration: {
        type: 'string',
        description: `One of: ${Object.keys(BYTES_PER_PARAMETER).join(', ')}. Default fp32_or_mixed_adam (16 bytes per parameter).`,
      },
      trainable_adapter_parameters_million: { type: 'number', description: 'LoRA only: trainable adapter parameters, in millions.' },
      activations: {
        type: 'object',
        description: 'Optional transformer activation inputs. Without them the total is static state only.',
        properties: {
          layers: { type: 'number' },
          batch_size: { type: 'number' },
          seq_len: { type: 'number' },
          hidden_size: { type: 'number' },
          fused_attention: { type: 'boolean', description: 'True if a FlashAttention-style kernel is in use; without one an uncounted seq_len-squared term applies.' },
        },
        required: ['layers', 'batch_size', 'seq_len', 'hidden_size'],
      },
    },
    required: ['vram_gb', 'parameters_billion'],
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return trainingVramEstimate(args);
  },
});

server.tool('classify_bottleneck', {
  description:
    'Apply the discriminating tests\' thresholds to measured readings you supply — halve-the-work ' +
    'timings, VRAM occupancy against GPU utilisation, cold against warm cache, clock-scaling ' +
    'sensitivity — and count the agreement. Names a class only when two findings agree; otherwise ' +
    'it says insufficient or conflicting and which test would settle it. Threshold checks over your ' +
    'numbers, not a profiler — it measures nothing itself. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      halve_work: {
        type: 'object',
        description: 'Test 1: time one unit before and after halving batch size, tile size, resolution or samples.',
        properties: {
          time_before_seconds: { type: 'number' },
          time_after_seconds: { type: 'number' },
        },
        required: ['time_before_seconds', 'time_after_seconds'],
      },
      occupancy_utilisation: {
        type: 'object',
        description: 'Test 2: VRAM occupancy and GPU utilisation read together, or a sawtoothing flag.',
        properties: {
          vram_occupancy_percent: { type: 'number' },
          gpu_utilisation_percent: { type: 'number' },
          utilisation_sawtooths: { type: 'boolean', description: 'True if utilisation swings near-zero to near-100 with a period matching one batch or frame.' },
        },
      },
      cold_warm: {
        type: 'object',
        description: 'Test 3: the same job timed twice, unchanged.',
        properties: {
          cold_seconds: { type: 'number' },
          warm_seconds: { type: 'number' },
          caches_dropped: { type: 'boolean', description: 'True if caches were explicitly dropped before the cold run.' },
        },
        required: ['cold_seconds', 'warm_seconds'],
      },
      clock_scaling: {
        type: 'object',
        description: 'Test 4: throughput loss (percent) from a 10% memory clock cut and/or a 10% core clock cut.',
        properties: {
          memory_clock_cut_throughput_loss_percent: { type: 'number' },
          core_clock_cut_throughput_loss_percent: { type: 'number' },
        },
      },
    },
  },
  handler: async (args) => {
    await client.requireFeature('tools');
    return classifyBottleneck(args);
  },
});

server.tool('dispatch_plan', {
  description:
    'Farm and cloud arithmetic from one measured frame time and one measured per-frame overhead: ' +
    'the 10x-overhead dispatch rule, the batching band, how the work type scales across nodes, and ' +
    'optionally the Young–Daly checkpoint interval for spot instances. It does not estimate cost ' +
    'or pick a provider. Requires a paid plan.',
  inputSchema: {
    type: 'object',
    properties: {
      frame_time_seconds: { type: 'number', description: 'Measured time per frame (or per task unit), in seconds.' },
      overhead_seconds: { type: 'number', description: 'Measured per-frame fixed overhead — scene load, texture load, BVH build, licence checkout. Typically 30–120s.' },
      work_type: { type: 'string', description: `One of: ${WORK_TYPES.join(', ')}. Default rendering.` },
      spot: {
        type: 'object',
        description: 'Optional: include the Young–Daly checkpoint interval for spot / preemptible instances.',
        properties: {
          checkpoint_cost_seconds: { type: 'number' },
          mean_time_between_interruptions_hours: { type: 'number' },
        },
        required: ['checkpoint_cost_seconds', 'mean_time_between_interruptions_hours'],
      },
    },
    required: ['frame_time_seconds', 'overhead_seconds'],
  },
  handler: async ({ spot, ...rest }) => {
    await client.requireFeature('tools');
    const plan = dispatchPlan(rest);
    return spot ? { ...plan, checkpointing: checkpointInterval(spot) } : plan;
  },
});

// ------------------------------------------------------------ close the loop

server.tool('estimate_log', {
  description:
    'The local estimate log that closes the loop: log a prediction (action "log"), record the ' +
    'measured actual against it once the job has run (action "record_actual"), or review the tally ' +
    'of how past estimates landed against the stated factor-of-two band (action "review"). ' +
    'Counting only — the review makes no new claim. Requires a paid plan. Nothing leaves this ' +
    'machine.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'log, record_actual or review.' },
      job: { type: 'string', description: 'log: what the estimate is for, e.g. "shot 040 4K render".' },
      quantity: { type: 'string', description: 'log: what is being estimated, e.g. vram_gb, frame_time_seconds, sim_time_hours.' },
      unit: { type: 'string', description: 'log: the unit of predicted_value, e.g. "GB", "seconds".' },
      predicted_value: { type: 'number', description: 'log: the estimate, as a positive number.' },
      assumptions: { type: 'string', description: 'log: the assumptions behind the estimate, so a miss can be traced to one.' },
      estimate_id: { type: 'string', description: 'record_actual: the id returned by a previous log.' },
      actual_value: { type: 'number', description: 'record_actual: the measured value, same unit as predicted.' },
      notes: { type: 'string' },
      limit: { type: 'number', description: 'review: how many recent estimates to list. Default 20.' },
    },
    required: ['action'],
  },
  handler: async ({ action, ...args }) => {
    await client.requireFeature('tools');
    switch (action) {
      case 'log': {
        if (!(args.predicted_value > 0)) {
          throw new ToolError('invalid_request', 'log needs predicted_value as a positive number.');
        }
        const record = logEstimate(args);
        return { logged: true, estimate_id: record.id, stored_at: ESTIMATES_FILE };
      }
      case 'record_actual': {
        if (!args.estimate_id) throw new ToolError('invalid_request', 'record_actual needs estimate_id.');
        if (!(args.actual_value > 0)) {
          throw new ToolError('invalid_request', 'record_actual needs actual_value as a positive number.');
        }
        const updated = recordActual(args.estimate_id, args);
        if (!updated) throw new ToolError('unknown_estimate', `No estimate "${args.estimate_id}".`);
        return { updated: true, estimate: updated };
      }
      case 'review':
        return reviewEstimates({ limit: args.limit ?? 20 });
      default:
        throw new ToolError('invalid_action', `"${action}" is not an action — use log, record_actual or review.`);
    }
  },
});

// ------------------------------------------------------------------ billing

registerLicenseTools(server, client, { pluginName: PLUGIN_NAME });

server.start();
