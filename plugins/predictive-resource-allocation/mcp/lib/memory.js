import { ToolError } from '../mcp-lite.js';

/**
 * Capacity arithmetic, ported from references/memory-arithmetic.md. Checked
 * first because VRAM capacity is a cliff, not a slope: a job that exceeds the
 * card does not run a little slower, it fails or falls back across PCIe and
 * collapses by roughly an order of magnitude.
 *
 * The formulas are deliberately coarse — they answer "does this fit, with
 * margin", not "how many megabytes" — and every result carries the reference's
 * stated error band of plus or minus 20%.
 */

const round2 = (n) => Math.round(n * 100) / 100;

export const ERROR_BAND = 'Treat every figure as plus or minus 20%. These are estimates over stated assumptions, not measurements — one measured run beats any of them.';

export const CLIFF_NOTE =
  'VRAM capacity is a cliff, not a slope. A job that exceeds the card by five percent does not run five percent ' +
  'slower — it fails outright or falls back to host memory across PCIe, and throughput collapses by roughly an ' +
  'order of magnitude (PCIe 4.0 x16 gives about 32 GB/s against 700–1500 GB/s of on-card bandwidth).';

/**
 * Reserve 10–15% of nominal VRAM before counting anything: driver and display
 * reserve, allocator fragmentation under a long job, and framework scratch no
 * formula captures. A 24 GB card gives about 21 GB of usable budget.
 */
export function usableBudget(vramGb) {
  if (!(vramGb > 0)) throw new ToolError('invalid_input', 'vram_gb must be a positive number.');
  return {
    nominal_gb: vramGb,
    reserve: '10–15% for driver and display reserve, allocator fragmentation and framework scratch',
    usable_low_gb: round2(vramGb * 0.85),
    usable_high_gb: round2(vramGb * 0.9),
    usable_working_gb: round2(vramGb * 0.875),
  };
}

/** Fit verdict against the usable budget, honouring the ±20% coarseness:
 *  over the high end of the budget is a plain no; within 20% of the line is
 *  reported as thin rather than pretended safe. */
function fitVerdict(totalGb, budget) {
  if (totalGb > budget.usable_high_gb) {
    return {
      verdict: 'does_not_fit',
      detail: `The estimate (${round2(totalGb)} GB) exceeds the usable budget (${budget.usable_low_gb}–${budget.usable_high_gb} GB of ${budget.nominal_gb} GB nominal).`,
      cliff: CLIFF_NOTE,
    };
  }
  if (totalGb * 1.2 >= budget.usable_low_gb) {
    return {
      verdict: 'thin',
      detail: `The estimate (${round2(totalGb)} GB) fits the usable budget (${budget.usable_low_gb}–${budget.usable_high_gb} GB) with under 20% margin. A plan that fits in 23.8 GB of 24 GB does not fit — treat this as one texture set or one AOV away from the cliff.`,
    };
  }
  return {
    verdict: 'fits',
    detail: `The estimate (${round2(totalGb)} GB) fits the usable budget (${budget.usable_low_gb}–${budget.usable_high_gb} GB) with margin.`,
  };
}

// -------------------------------------------------------------- rendering

/**
 * VRAM = geometry + BVH + textures + framebuffer + engine overhead.
 * Triangles cost roughly 50–100 bytes each; 64 is the working figure. The BVH
 * is budgeted at 1.3–2.0x the raw geometry payload. Textures carry a 1.33 mip
 * factor. The framebuffer is RGBA fp32 accumulation doubled for the sample
 * buffer and denoiser input.
 */
export function renderVramEstimate({
  vram_gb,
  triangles,
  bytes_per_triangle = 64,
  subdivision_level = 0,
  textures = [],
  resolution,
  aov_count,
  engine_overhead_gb = 1.5,
}) {
  const budget = usableBudget(vram_gb);
  if (!(triangles >= 0)) throw new ToolError('invalid_input', 'triangles must be a non-negative number (unique triangles — instanced copies are close to free).');
  if (bytes_per_triangle < 50 || bytes_per_triangle > 100) {
    throw new ToolError('invalid_input', 'bytes_per_triangle must be in the reference range 50–100 (64 is the working figure).');
  }
  if (!Number.isInteger(subdivision_level) || subdivision_level < 0 || subdivision_level > 6) {
    throw new ToolError('invalid_input', 'subdivision_level must be an integer 0–6.');
  }

  // Subdivision is evaluated at render time and is the classic hidden cost:
  // each level multiplies the triangle count by 4.
  const effectiveTriangles = triangles * 4 ** subdivision_level;
  const geometryGb = (effectiveTriangles * bytes_per_triangle) / 1e9;

  const bvh = {
    low_gb: round2(geometryGb * 1.3),
    working_gb: round2(geometryGb * 1.6),
    high_gb: round2(geometryGb * 2.0),
  };

  let texturesGb = 0;
  const textureRows = textures.map((t, i) => {
    const { width_px, height_px, channels, bytes_per_channel, count = 1 } = t;
    if (!(width_px > 0) || !(height_px > 0) || !(channels > 0) || !(bytes_per_channel > 0) || !(count > 0)) {
      throw new ToolError('invalid_input', `textures[${i}] needs positive width_px, height_px, channels and bytes_per_channel (count defaults to 1).`);
    }
    // The 1.33 factor is the mip chain.
    const gb = (width_px * height_px * channels * bytes_per_channel * 1.33 * count) / 1e9;
    texturesGb += gb;
    return { ...t, count, estimated_gb: round2(gb) };
  });

  let framebufferGb = 0;
  if (resolution) {
    const { width_px, height_px } = resolution;
    if (!(width_px > 0) || !(height_px > 0) || !(aov_count > 0)) {
      throw new ToolError('invalid_input', 'resolution needs width_px and height_px, and aov_count must be positive.');
    }
    // 16 bytes is RGBA at fp32 accumulation; the factor of 2 covers the
    // sample buffer and denoiser input.
    framebufferGb = (width_px * height_px * aov_count * 16 * 2) / 1e9;
  }

  const fixed = geometryGb + texturesGb + framebufferGb + engine_overhead_gb;
  const totalWorking = fixed + geometryGb * 1.6;

  return {
    components_gb: {
      geometry: round2(geometryGb),
      ...(subdivision_level > 0 ? {
        subdivision_note: `Subdivision level ${subdivision_level} multiplies the base count by 4^${subdivision_level} = ${4 ** subdivision_level}x — ${effectiveTriangles.toLocaleString('en-GB')} effective triangles.`,
      } : {}),
      bvh,
      textures: round2(texturesGb),
      framebuffer: round2(framebufferGb),
      engine_overhead: engine_overhead_gb,
    },
    ...(textureRows.length ? { texture_breakdown: textureRows } : {}),
    total_gb: {
      low: round2(fixed + geometryGb * 1.3),
      working: round2(totalWorking),
      high: round2(fixed + geometryGb * 2.0),
    },
    budget,
    ...fitVerdict(totalWorking, budget),
    assumptions: [
      `${bytes_per_triangle} bytes per triangle (reference range 50–100) over ${triangles.toLocaleString('en-GB')} unique triangles.`,
      'Instances are close to free — one master mesh plus a transform per copy. If copies are not instanced, converting them is often the whole fix.',
      'BVH budgeted at 1.3–2.0x the raw geometry payload (1.6x as the working figure).',
      'Textures counted uncompressed with a 1.33x mip chain.',
      resolution ? 'Framebuffer at RGBA fp32 accumulation, doubled for the sample buffer and denoiser input.' : 'No framebuffer counted — supply resolution and aov_count for the full picture. A 4K frame with 12 AOVs is about 3.2 GB, often the difference between fitting and not.',
      `Engine and driver overhead taken as ${engine_overhead_gb} GB.`,
    ],
    error_band: ERROR_BAND,
  };
}

// --------------------------------------------------------------- training

/** Static-state cost per parameter, from the reference table. */
export const BYTES_PER_PARAMETER = {
  fp32_or_mixed_adam: { bytes: 16, label: 'Full fp32 or mixed precision, Adam', breakdown: 'fp16/bf16 weight 2 + fp16/bf16 gradient 2 + fp32 master weight 4 + Adam first moment 4 + Adam second moment 4' },
  mixed_sgd_or_8bit_adam: { bytes: 10, label: 'Mixed precision, SGD with momentum, or 8-bit Adam' },
  lora: { bytes: null, label: 'LoRA, base frozen', breakdown: '2 bytes per base parameter + 16 per trainable adapter parameter' },
  inference_fp16: { bytes: 2, label: 'Inference only, fp16' },
};

/** The reference points worth quoting; the 7B row is why full fine-tuning a
 *  7B model does not happen on a single 80 GB card. */
export const MODEL_REFERENCE_POINTS = [
  { model: '1.3B', mixed_precision_adam: '20.8 GB', inference_fp16: '2.6 GB' },
  { model: '7B', mixed_precision_adam: '112 GB', inference_fp16: '14 GB' },
  { model: '70B', mixed_precision_adam: '1120 GB', inference_fp16: '140 GB' },
];

/** The activation levers, cheapest first: gradient accumulation, then
 *  activation checkpointing, then batch reduction. */
export const ACTIVATION_LEVERS = [
  { lever: 'Halve batch size', memory_effect: 'Halves activations', time_cost: 'Throughput drops unless you accumulate' },
  { lever: 'Gradient accumulation', memory_effect: 'Keeps effective batch at a smaller footprint', time_cost: 'Near zero' },
  { lever: 'Activation checkpointing', memory_effect: 'Cuts activations by roughly 60–80%', time_cost: 'Adds ~30% step time' },
  { lever: 'Shorter sequence length', memory_effect: 'Linear, or quadratic without fused attention', time_cost: 'Changes what the model learns' },
  { lever: 'bf16 from fp32', memory_effect: 'Halves activations', time_cost: 'Usually faster too' },
];

/**
 * VRAM = static_state + activations + framework overhead. The rule to carry:
 * 16 bytes per parameter for mixed precision with Adam. Activations are
 * linear in batch size and are the only term that trades cheaply.
 */
export function trainingVramEstimate({
  vram_gb,
  parameters_billion,
  configuration = 'fp32_or_mixed_adam',
  trainable_adapter_parameters_million,
  activations,
}) {
  const budget = usableBudget(vram_gb);
  if (!(parameters_billion > 0)) throw new ToolError('invalid_input', 'parameters_billion must be a positive number.');
  const config = BYTES_PER_PARAMETER[configuration];
  if (!config) {
    throw new ToolError('invalid_configuration', `"${configuration}" is not a configuration.`, { available: Object.keys(BYTES_PER_PARAMETER) });
  }

  let staticGb;
  let staticDetail;
  if (configuration === 'lora') {
    if (!(trainable_adapter_parameters_million >= 0)) {
      throw new ToolError('invalid_input', 'LoRA needs trainable_adapter_parameters_million (adapter parameters, in millions).');
    }
    staticGb = parameters_billion * 2 + (trainable_adapter_parameters_million / 1000) * 16;
    staticDetail = `${round2(parameters_billion * 2)} GB frozen base at 2 bytes per parameter + ${round2((trainable_adapter_parameters_million / 1000) * 16)} GB adapters at 16 bytes per trainable parameter`;
  } else {
    staticGb = parameters_billion * config.bytes;
    staticDetail = `${parameters_billion}B parameters at ${config.bytes} bytes each (${config.label})`;
  }

  let activationsGb = null;
  let activationNotes = [
    'Activations are linear in batch size — the only term you can trade cheaply. Cheapest first: gradient accumulation, then activation checkpointing, then batch reduction.',
  ];
  if (activations) {
    const { layers, batch_size, seq_len, hidden_size, fused_attention = false } = activations;
    if (!(layers > 0) || !(batch_size > 0) || !(seq_len > 0) || !(hidden_size > 0)) {
      throw new ToolError('invalid_input', 'activations needs positive layers, batch_size, seq_len and hidden_size.');
    }
    // Transformer in fp16: layers x batch x seq_len x hidden x 34 bytes.
    activationsGb = (layers * batch_size * seq_len * hidden_size * 34) / 1e9;
    if (!fused_attention) {
      activationNotes.push(
        'Attention adds a term scaling with seq_len squared that is NOT counted here, because no fused kernel was declared. ' +
        'With FlashAttention-style kernels that term largely disappears — kernel choice matters more than almost any other setting at long context.'
      );
    }
  }

  const totalGb = staticGb + (activationsGb ?? 0);
  let fit = fitVerdict(totalGb, budget);

  // The cliff case: when static state alone consumes the usable budget on a
  // training configuration, no batch size fixes it and the remedies are all
  // algorithmic. The reference's worked example — 1.3B under mixed precision
  // with Adam is 20.8 GB of static state against about 21 GB usable on a
  // 24 GB card — is exactly this: it does not fit, because training needs
  // room for activations at any batch size. Telling this user to lower the
  // batch size is the wrong answer and would waste their afternoon.
  const training = configuration !== 'inference_fp16';
  const staticConsumesCard = training && staticGb >= budget.usable_low_gb;
  if (staticConsumesCard && fit.verdict !== 'does_not_fit') {
    fit = {
      verdict: 'does_not_fit',
      detail: `Static state (${round2(staticGb)} GB) consumes the usable budget (${budget.usable_low_gb}–${budget.usable_high_gb} GB), leaving nothing for activations at any batch size.`,
      cliff: CLIFF_NOTE,
    };
  }
  const cliffRemedies = staticConsumesCard || staticGb > budget.usable_high_gb ? {
    static_state_consumes_the_card: true,
    what_this_means: 'No batch size fixes it, because the static state alone consumes the card. The remedies are all algorithmic.',
    algorithmic_remedies: [
      ...(configuration === 'fp32_or_mixed_adam'
        ? [`8-bit Adam — static state falls to ${round2(parameters_billion * 10)} GB at 10 bytes per parameter`]
        : []),
      `LoRA with the base frozen — static state falls to about ${round2(parameters_billion * 2)} GB plus adapters`,
      'ZeRO stage 2 or 3 — shards the static state across devices',
      'A smaller model',
    ],
  } : null;

  return {
    static_state_gb: round2(staticGb),
    static_state_detail: staticDetail,
    activations_gb: activationsGb === null ? null : round2(activationsGb),
    ...(activationsGb === null ? { activations_note: 'No activation inputs supplied — the total below is static state only, before a single activation.' } : {}),
    total_gb: round2(totalGb),
    budget,
    ...fit,
    ...(cliffRemedies ? { cliff: cliffRemedies } : {}),
    activation_levers: ACTIVATION_LEVERS,
    notes: activationNotes,
    reference_points: MODEL_REFERENCE_POINTS,
    error_band: ERROR_BAND,
  };
}

// ------------------------------------------------------------- system RAM

/** Host RAM figures people forget, from the reference — returned as data. */
export const SYSTEM_RAM_NOTES = [
  'Sim caches stream through RAM before disk. A FLIP sim at 40M particles with velocity, ID and age is roughly 2.5 GB per frame in memory.',
  'Comp holds a frame plus every upstream cached node. Nuke on a 4K 15-layer EXR holds 1.5–2 GB per cached node.',
  'After Effects RAM preview stores decoded frames at width x height x 4 bytes for 8-bit, doubled for 16-bit. 4K 8-bit is 33 MB per frame, so 10 seconds at 24 fps is about 8 GB, before the composition\'s own working memory.',
  'A safe host rule for GPU work: system RAM at least 2x total VRAM, more if the renderer supports out-of-core texture paging, because that paging lands in host RAM.',
];
