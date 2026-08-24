import { ToolError } from '../mcp-lite.js';

/**
 * Farm and cloud dispatch arithmetic, ported from the farm-and-cloud section
 * of references/domain-profiles.md: the 10x-overhead dispatch rule, the
 * batching bands, what distributes and what does not, and the Young–Daly
 * checkpoint interval for preemptible instances. Arithmetic and table lookups
 * only — no cost model, no provider recommendation.
 */

const round1 = (n) => Math.round(n * 10) / 10;

export const WORK_TYPES = ['rendering', 'batch_comp', 'simulation', 'training'];

const SCALING = {
  rendering: 'Frame-parallel: scales near-linearly across nodes.',
  batch_comp: 'Frame-parallel: scales near-linearly across nodes.',
  simulation: 'Does not distribute across frames — frame N depends on frame N-1. Distribute across shots or wedges instead.',
  training: 'Roughly 0.85x efficiency per added GPU on a good interconnect, far worse across nodes without one.',
};

/**
 * The dispatch rule: send per-frame only when render time per frame exceeds
 * roughly 10x the measured per-frame fixed overhead, keeping overhead under
 * 10% of the total. Below that line, batch frames so the overhead is paid
 * once. The bands are the reference's table, applied verbatim.
 */
export function dispatchPlan({ frame_time_seconds, overhead_seconds, work_type = 'rendering' }) {
  if (!(frame_time_seconds > 0)) throw new ToolError('invalid_input', 'frame_time_seconds must be a positive number — one measured frame, not a guess.');
  if (!(overhead_seconds > 0)) throw new ToolError('invalid_input', 'overhead_seconds must be a positive number. Typical per-frame fixed overhead (scene load, texture load, BVH build, licence checkout, container pull) is 30–120 seconds — measure yours.');
  if (!WORK_TYPES.includes(work_type)) {
    throw new ToolError('invalid_work_type', `"${work_type}" is not a work type.`, { available: WORK_TYPES });
  }

  const threshold = 10 * overhead_seconds;
  const overheadFraction = overhead_seconds / (frame_time_seconds + overhead_seconds);
  const minutes = frame_time_seconds / 60;

  let verdict;
  if (work_type === 'simulation') {
    verdict = {
      dispatch: 'not_frame_parallel',
      detail: SCALING.simulation,
    };
  } else if (minutes < 1) {
    verdict = { dispatch: 'batch', frames_per_task: '20–50', detail: 'Under 1 minute per frame: batch 20–50 frames per task.' };
  } else if (minutes <= 5) {
    verdict = { dispatch: 'batch', frames_per_task: '5–10', detail: '1–5 minutes per frame: batch 5–10 frames per task.' };
  } else if (minutes <= 30) {
    verdict = frame_time_seconds >= threshold
      ? { dispatch: 'per_frame', detail: `Frame time (${round1(minutes)} min) exceeds 10x your measured overhead (${round1(threshold / 60)} min), so per-frame dispatch keeps overhead under 10% of the total.` }
      : { dispatch: 'batch', frames_per_task: '2–5', detail: `Frame time (${round1(minutes)} min) is under 10x your measured overhead (${round1(threshold / 60)} min): batch 2–5 frames per task so the overhead is paid once.` };
  } else {
    verdict = { dispatch: 'per_frame', detail: 'Over 30 minutes per frame: dispatch per frame, and consider splitting by tile or sample seed.' };
  }

  return {
    inputs: { frame_time_seconds, overhead_seconds, work_type },
    per_frame_threshold_seconds: threshold,
    overhead_fraction_if_dispatched_per_frame: `${round1(overheadFraction * 100)}%`,
    verdict,
    scaling: SCALING[work_type],
    reminder: 'Never move a job to the cloud before the single-machine constraint is known. A dataloader-starved run rented at scale is the same run, starved, at higher cost — distributing a job multiplies whatever is inefficient about it.',
  };
}

/**
 * Young–Daly checkpoint interval for spot and preemptible instances:
 * optimal_interval ~ sqrt(2 x checkpoint_cost x mean_time_between_interruptions).
 * With a 60-second checkpoint and a 4-hour mean time to preemption that is
 * about 22 minutes.
 */
export function checkpointInterval({ checkpoint_cost_seconds, mean_time_between_interruptions_hours }) {
  if (!(checkpoint_cost_seconds > 0)) throw new ToolError('invalid_input', 'checkpoint_cost_seconds must be a positive number.');
  if (!(mean_time_between_interruptions_hours > 0)) throw new ToolError('invalid_input', 'mean_time_between_interruptions_hours must be a positive number.');

  const mtbiSeconds = mean_time_between_interruptions_hours * 3600;
  const intervalSeconds = Math.sqrt(2 * checkpoint_cost_seconds * mtbiSeconds);

  return {
    inputs: { checkpoint_cost_seconds, mean_time_between_interruptions_hours },
    formula: 'optimal_interval ~ sqrt(2 x checkpoint_cost x mean_time_between_interruptions)',
    optimal_interval_seconds: Math.round(intervalSeconds),
    optimal_interval_minutes: round1(intervalSeconds / 60),
    why_the_interval_matters: 'Checkpointing every 5 minutes wastes throughput; every 2 hours risks an hour lost per reclaim.',
    spot_notes: [
      'Spot and preemptible instances are 60–90% cheaper and can be reclaimed on about two minutes of notice.',
      'They suit frame-parallel rendering, where losing a frame costs one frame, and are dangerous for long training runs without checkpointing.',
    ],
  };
}
