import { ToolError } from '../mcp-lite.js';
import {
  renderVramEstimate, trainingVramEstimate, usableBudget, fitVerdict, CLIFF_NOTE,
} from './memory.js';
import { allocatableRamGb } from './telemetry.js';

/**
 * Headroom: the plugin's own capacity arithmetic checked against the machine
 * it is actually running on. The estimate side reuses renderVramEstimate and
 * trainingVramEstimate — the exact functions vram_estimate and
 * training_memory_estimate run, never a second copy of the maths. The
 * measured side comes from a systemSnapshot taken by the caller. Every
 * number in the output is either measured (and labelled measured) or
 * estimated (and labelled estimated); nothing is both, and nothing is
 * neither.
 */

const round2 = (n) => Math.round(n * 100) / 100;

export const JOBS = ['render', 'training'];
export const RESOURCES = ['gpu_vram', 'system_ram'];

/**
 * @param {{job: string, resource: string, gpu_index?: number,
 *          render?: object, training?: object}} args
 * @param {object} snapshot  a systemSnapshot() result
 */
export function headroomCheck({ job, resource, gpu_index = 0, render, training }, snapshot) {
  if (!JOBS.includes(job)) {
    throw new ToolError('invalid_job', `job must be one of: ${JOBS.join(', ')}.`);
  }
  if (!RESOURCES.includes(resource)) {
    throw new ToolError('invalid_resource', `resource must be one of: ${RESOURCES.join(', ')}.`);
  }
  const inputs = job === 'render' ? render : training;
  const estimatorName = job === 'render' ? 'vram_estimate' : 'training_memory_estimate';
  if (!inputs) {
    throw new ToolError('invalid_input', `job "${job}" needs a "${job}" block carrying the same inputs ${estimatorName} takes (vram_gb may be omitted when an NVIDIA card is measurable on this machine).`);
  }

  const gpus = snapshot.gpu?.available ? snapshot.gpu.gpus : [];
  if (gpu_index !== 0 && !gpus[gpu_index]) {
    throw new ToolError('invalid_gpu_index', `gpu_index ${gpu_index} does not exist — ${gpus.length ? `this machine measured ${gpus.length} GPU(s)` : 'no GPU could be measured on this machine'}.`);
  }
  const gpu = gpus[gpu_index] ?? null;

  // The nominal card figure the estimator arithmetic runs against: the
  // caller's, or the measured card when the caller gave none.
  let vramGb = inputs.vram_gb;
  let vramSource;
  let vramNote = null;
  if (vramGb > 0) {
    vramSource = 'reported by the caller';
    if (gpu && Math.abs(gpu.memory_total_gb - vramGb) > vramGb * 0.1) {
      vramNote = `The reported vram_gb (${vramGb}) differs from the measured card (${gpu.name}, ${gpu.memory_total_gb} GB by nvidia-smi) by more than 10% — check which machine this plan is for.`;
    }
  } else if (gpu) {
    vramGb = gpu.memory_total_gb;
    vramSource = `measured — nvidia-smi memory.total on ${gpu.name}`;
  } else {
    throw new ToolError(
      'no_vram_figure',
      `No vram_gb was supplied and no card could be measured — gpu: unavailable ("${snapshot.gpu?.reason ?? 'nvidia-smi not found or no NVIDIA GPU'}"). Supply vram_gb (the card's nominal figure) in the ${job} block.`
    );
  }

  // The shared estimators — identical arithmetic to the estimate tools.
  const estimate = job === 'render'
    ? renderVramEstimate({ ...inputs, vram_gb: vramGb })
    : trainingVramEstimate({ ...inputs, vram_gb: vramGb });
  const estimateTotalGb = round2(job === 'render' ? estimate.total_gb.working : estimate.total_gb);

  // The measured free figure the estimate is checked against.
  let freeGb;
  let freeSource;
  let against;
  if (resource === 'gpu_vram') {
    if (!gpu) {
      throw new ToolError(
        'gpu_unavailable',
        `gpu: unavailable ("${snapshot.gpu?.reason ?? 'nvidia-smi not found or no NVIDIA GPU'}") — a GPU headroom check needs a measurable NVIDIA card. Check resource "system_ram" instead, or use ${estimatorName} against the card's nominal figure.`
      );
    }
    freeGb = gpu.memory_free_gb;
    freeSource = `measured — nvidia-smi memory.total minus memory.used on ${gpu.name}`;
    against = `free VRAM on ${gpu.name} right now`;
  } else {
    freeGb = allocatableRamGb(snapshot.ram);
    freeSource = snapshot.ram.available_gb != null
      ? 'measured — MemAvailable from /proc/meminfo'
      : 'measured — os.freemem()';
    against = 'allocatable system RAM right now';
  }

  // The references' reserve rule, applied to the real number: reserve 10–15%
  // of what is measurably free before planning into it. Driver and display
  // reserve already sit inside the measured "used"; fragmentation and
  // framework scratch still apply to whatever gets planned into the rest.
  let budget = null;
  let verdict;
  if (freeGb > 0) {
    budget = usableBudget(freeGb);
    verdict = fitVerdict(estimateTotalGb, budget);
  } else {
    verdict = {
      verdict: 'does_not_fit',
      detail: `The measured free figure is ${freeGb} GB — nothing is free right now, so no estimate fits.`,
      cliff: CLIFF_NOTE,
    };
  }
  const headroomGb = budget ? round2(budget.usable_working_gb - estimateTotalGb) : round2(freeGb - estimateTotalGb);

  let background_tasks_to_close;
  if (verdict.verdict === 'does_not_fit') {
    const top = snapshot.top_memory_processes;
    background_tasks_to_close = top?.available
      ? {
        label: 'measured',
        basis: `Largest resident-memory processes on this machine right now (${top.source}). These hold host RAM, not attributed VRAM — this probe cannot say which of them holds GPU memory, though anything with a GPU context (a browser, a DCC viewport, another training run) holds both. ${top.unit_note ?? ''}`.trim(),
        processes: top.processes,
      }
      : { omitted: true, reason: top?.reason ?? 'No process listing was taken in the snapshot.' };
  }

  return {
    job,
    resource,
    estimate: {
      label: 'estimated',
      arithmetic: `${job === 'render' ? 'renderVramEstimate' : 'trainingVramEstimate'} — the same function ${estimatorName} runs, not a copy`,
      total_gb: estimateTotalGb,
      vram_gb_fed_to_estimator: { value: vramGb, source: vramSource },
      ...(vramNote ? { note: vramNote } : {}),
      full_estimate: estimate,
    },
    measured: {
      label: 'measured',
      taken_at: snapshot.taken_at,
      free_gb: freeGb,
      free_source: freeSource,
      ...(resource === 'gpu_vram' ? { gpu } : { ram: snapshot.ram }),
    },
    headroom: {
      against,
      reserve_rule: 'The references\' 10–15% reserve, applied to the measured free figure rather than the card\'s nominal one: driver and display reserve already sits inside the measured "used", but allocator fragmentation and framework scratch still apply to whatever is planned into the remainder.',
      ...(budget ? { budget_gb: { ...budget, basis: 'derived from the measured free figure — nominal_gb here is what was measured free, not the card\'s nominal capacity' } } : {}),
      verdict: verdict.verdict,
      detail: verdict.detail,
      ...(verdict.cliff ? { cliff: verdict.cliff } : {}),
      headroom_gb: {
        value: headroomGb,
        basis: 'measured usable budget minus the estimated total — an estimated-against-measured difference; negative means the estimate exceeds what is measurably free',
      },
    },
    ...(background_tasks_to_close ? { background_tasks_to_close } : {}),
    honesty: 'The estimate side carries the plugin\'s stated error bands (±20% on the arithmetic, roughly a factor of two end to end); the measured side is a point-in-time reading that moves as other work starts and stops. One measured run of the actual job beats both.',
  };
}
