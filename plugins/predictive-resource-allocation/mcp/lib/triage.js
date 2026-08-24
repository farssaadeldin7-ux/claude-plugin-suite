import { ToolError } from '../mcp-lite.js';

/**
 * The four constraint classes, the discriminating tests and the symptom index,
 * ported from references/bottleneck-triage.md, plus the threshold checks that
 * turn measured test results into a named class.
 *
 * The reference speaks in words — "roughly half", "much faster", "a quarter or
 * less". The numeric band edges here operationalise those words, and every
 * finding quotes the reading and the band it fell in so the user can see where
 * a borderline case landed. Nothing here measures the machine: every number is
 * what the user reported.
 */

export const CLASSES = {
  compute: {
    label: 'Compute-bound',
    saturated: 'ALU / SM / CPU core throughput',
    signature: 'Utilisation pinned near 100%, wall time scales linearly with work',
  },
  capacity: {
    label: 'Memory-capacity-bound',
    saturated: 'VRAM or system RAM footprint',
    signature: 'Out-of-memory, or a sudden order-of-magnitude collapse when a threshold is crossed',
  },
  bandwidth: {
    label: 'Memory-bandwidth-bound',
    saturated: 'GB/s to and from device memory',
    signature: 'Utilisation looks high but scales poorly with clock; large batches barely beat small ones',
  },
  io: {
    label: 'I/O-bound',
    saturated: 'Disk or network read/write',
    signature: 'Low utilisation on everything, spiky progress, cold and warm runs differ a lot',
  },
  fixed_overhead: {
    label: 'Fixed per-unit overhead',
    saturated: 'Not a resource — scene load, BVH build, kernel compile, licence checkout, process spawn',
    signature: 'Everything looks slow, and wall time barely moves when the work per unit is halved. The most commonly misdiagnosed pattern.',
  },
  starvation: {
    label: 'Input starvation',
    saturated: 'Not the device — the pipeline feeding it (dataloader, single-threaded upstream stage)',
    signature: 'Utilisation sawtooths between near zero and near 100 with a period matching one batch or one frame. The device is waiting for data, not computing slowly. No GPU purchase fixes it.',
  },
};

export const DISCRIMINATING_TESTS = [
  {
    id: 'halve_work',
    name: 'Test 1 — halve the work per unit',
    procedure: 'Halve batch size, tile size, resolution, or sample count. Time one unit before and after.',
    readings: [
      { result: 'Time falls by roughly half', class: 'compute', rules_out: 'Fixed overhead and I/O as dominant' },
      { result: 'Time falls by far more than half (3x or better)', class: 'capacity', rules_out: 'Compute — you were not doing the work, you were moving it' },
      { result: 'Time falls by a quarter or less', class: 'fixed overhead or I/O', rules_out: 'Compute; the work was not the cost' },
      { result: 'Time does not change', class: 'fixed_overhead', rules_out: 'All three resources' },
    ],
    note: 'This single test separates more cases than everything below it.',
  },
  {
    id: 'occupancy_utilisation',
    name: 'Test 2 — occupancy against utilisation',
    procedure: 'Read VRAM occupancy and GPU utilisation together. Neither means anything alone.',
    readings: [
      { occupancy: 'High (>90%)', utilisation: 'High (>90%)', reading: 'Genuinely compute or bandwidth-bound. Healthy.' },
      { occupancy: 'High (>90%)', utilisation: 'Low or sawtoothing', reading: 'Capacity pressure, host-memory fallback, or input starvation' },
      { occupancy: 'Low (<50%)', utilisation: 'High', reading: 'Compute-bound with room to raise batch or tile size' },
      { occupancy: 'Low', utilisation: 'Low', reading: 'I/O-bound, starved, or serialised on the CPU' },
    ],
    note: 'Sawtoothing utilisation — swinging between near zero and near 100 with a period matching one batch or one frame — is the diagnostic signature of starvation.',
  },
  {
    id: 'cold_warm',
    name: 'Test 3 — cold cache against warm cache',
    procedure: 'Run the job twice without changing anything and time both.',
    readings: [
      { result: 'Second run much faster', reading: 'The working set fits in page cache and the first run was I/O-bound. Fix the storage path or the data layout, not the compute.' },
      { result: 'Second run the same', reading: 'The data does not fit in cache, or it was never I/O. If utilisation is also low, you are read-bandwidth-bound and it will not improve with repetition.' },
    ],
    note: 'On Linux, `sync; echo 3 > /proc/sys/vm/drop_caches` makes the cold run genuinely cold. Without that, the "cold" run is often already warm and the test lies.',
  },
  {
    id: 'clock_scaling',
    name: 'Test 4 — scale one clock at a time',
    procedure: 'Where the tooling allows it, drop the memory clock 10% and re-time, then restore and drop the core clock 10% and re-time. Whichever change hurts more is the binding resource.',
    readings: [
      { result: 'A 10% memory clock cut costs more than 6% of throughput', reading: 'The job is bandwidth-bound' },
      { result: 'The core clock cut hurts more', reading: 'The job is compute-bound' },
    ],
    note: 'This distinguishes compute-bound from bandwidth-bound, which Tests 1 to 3 cannot do reliably.',
  },
];

export const SYMPTOM_INDEX = [
  { symptom: 'Out of memory error at a specific batch or resolution', most_likely: 'Capacity', rules_out: 'Everything else, until it fits' },
  { symptom: 'Render fine at 1080p, unusably slow at 4K, non-linear jump', most_likely: 'Capacity — framebuffer and tile buffers crossed the line', rules_out: 'A linear compute story' },
  { symptom: 'GPU at 20–40%, CPU one core at 100%', most_likely: 'Serialised CPU stage — BVH build, dataloader, single-threaded node', rules_out: 'GPU capability' },
  { symptom: 'GPU util sawtooths 0–100 each step', most_likely: 'Input starvation', rules_out: 'Compute, capacity, bandwidth' },
  { symptom: 'First frame 4 minutes, later frames 20 seconds', most_likely: 'Fixed overhead — scene load, BVH, kernel compile', rules_out: 'A per-frame compute problem' },
  { symptom: 'Progress bar stalls at the same percentage every run', most_likely: 'I/O or a single pathological asset', rules_out: 'Random contention' },
  { symptom: 'Doubling batch size barely improves throughput', most_likely: 'Bandwidth-bound, or already saturated', rules_out: 'Compute headroom' },
  { symptom: 'Wall time 10x worse than a machine with the same GPU', most_likely: 'Capacity spill to host memory, or network storage', rules_out: 'Anything gradual' },
  { symptom: 'Everything is slow and nothing is above 40%', most_likely: 'I/O, thermal throttling, or a virtualised host', rules_out: 'Compute' },
];

// Rough current-generation figures, useful for order-of-magnitude reasoning only.
export const BANDWIDTH_LADDER = [
  { path: 'GPU on-card memory (HBM or GDDR7)', bandwidth: '700 – 1500 GB/s', relative: '1x' },
  { path: 'PCIe 5.0 x16', bandwidth: '~64 GB/s', relative: '~1/20' },
  { path: 'PCIe 4.0 x16', bandwidth: '~32 GB/s', relative: '~1/40' },
  { path: 'DDR5 system memory, dual channel', bandwidth: '60 – 90 GB/s', relative: '~1/15' },
  { path: 'NVMe Gen4 SSD, sequential', bandwidth: '5 – 7 GB/s', relative: '~1/150' },
  { path: 'SATA SSD', bandwidth: '~0.55 GB/s', relative: '~1/1500' },
  { path: '10 GbE network storage', bandwidth: '~1.1 GB/s', relative: '~1/800' },
  { path: '1 GbE network storage', bandwidth: '~0.11 GB/s', relative: '~1/8000' },
  { path: 'Spinning disk, random reads', bandwidth: '0.001 – 0.01 GB/s', relative: 'catastrophic' },
];

// The minimum intake the skill demands before predicting anything.
export const MINIMUM_INTAKE = [
  { need: 'GPU model and VRAM', why: 'Capacity is a cliff, and bandwidth varies 5x across current cards' },
  { need: 'System RAM', why: 'Decides whether spilling is survivable or fatal' },
  { need: 'CPU core count', why: 'Decides BVH build, sim solve and dataloader headroom' },
  { need: 'Storage: NVMe, SATA SSD, spinning disk, or network', why: '10x to 100x spread on I/O-bound work' },
  { need: 'One timed run, however small', why: 'Anchors everything; one measured frame beats any estimate here' },
];

export const RULES_OF_THUMB = [
  'Utilisation is not efficiency. A kernel that is bandwidth-starved still reports high utilisation on most tools. Utilisation says the SMs are busy, not that they are doing useful arithmetic.',
  'Cache your evidence, not your conclusion. Write down the numbers from each test. When the first remedy fails, the numbers tell you which class you got wrong.',
  'Two constraints often sit close together. Relieve the first and the second binds within 20% of the old time. That is normal and is not a failed diagnosis — say up front what the likely second constraint is.',
  'Nothing on this page is a substitute for a profiler. Nsight Systems, py-spy, a renderer\'s own stats panel and Houdini\'s performance monitor all give the answer directly.',
];

const round2 = (n) => Math.round(n * 100) / 100;

// ------------------------------------------------- individual test readings

/** Test 1. Band edges operationalise the reference wording:
 *  "far more than half (3x or better)" → ratio ≤ 1/3; "roughly half" →
 *  0.40–0.60; "a quarter or less" → ≥ 0.75; "does not change" → ≥ 0.95. */
function readHalveWork({ time_before_seconds, time_after_seconds }) {
  if (!(time_before_seconds > 0) || !(time_after_seconds > 0)) {
    throw new ToolError('invalid_reading', 'halve_work needs positive time_before_seconds and time_after_seconds.');
  }
  const ratio = time_after_seconds / time_before_seconds;
  const base = { test: 'halve_work', ratio: round2(ratio), reading: `Halving the work took time from ${time_before_seconds}s to ${time_after_seconds}s (ratio ${round2(ratio)})` };
  if (ratio <= 1 / 3) {
    return { ...base, supports: ['capacity'], band: 'fell by far more than half (3x or better)', rules_out: 'compute — you were not doing the work, you were moving it' };
  }
  if (ratio >= 0.95) {
    return { ...base, supports: ['fixed_overhead'], band: 'time did not change', rules_out: 'all three resources' };
  }
  if (ratio >= 0.75) {
    return { ...base, supports: ['fixed_overhead', 'io'], band: 'fell by a quarter or less', rules_out: 'compute; the work was not the cost' };
  }
  if (ratio >= 0.4 && ratio <= 0.6) {
    return { ...base, supports: ['compute'], band: 'fell by roughly half', rules_out: 'fixed overhead and I/O as dominant' };
  }
  return { ...base, supports: [], band: 'between the reference bands', rules_out: null, note: 'The reading sits between "roughly half" and a neighbouring band — run a second test rather than leaning on this one.' };
}

/** Test 2. High is >90, low is <50, per the reference table; readings in the
 *  50–90 middle zone are reported as inconclusive rather than forced. */
function readOccupancyUtilisation({ vram_occupancy_percent, gpu_utilisation_percent, utilisation_sawtooths }) {
  const occ = vram_occupancy_percent;
  const util = gpu_utilisation_percent;
  if (utilisation_sawtooths) {
    return {
      test: 'occupancy_utilisation',
      reading: 'Utilisation sawtooths between near zero and near 100',
      supports: ['starvation'],
      band: 'sawtoothing — the diagnostic signature of starvation',
      rules_out: 'compute, capacity, bandwidth',
    };
  }
  if (typeof occ !== 'number' || typeof util !== 'number') {
    throw new ToolError('invalid_reading', 'occupancy_utilisation needs vram_occupancy_percent and gpu_utilisation_percent (or utilisation_sawtooths: true).');
  }
  const base = { test: 'occupancy_utilisation', reading: `VRAM occupancy ${occ}%, GPU utilisation ${util}%` };
  const occHigh = occ > 90, occLow = occ < 50;
  const utilHigh = util > 90, utilLow = util < 50;
  if (occHigh && utilHigh) return { ...base, supports: ['compute', 'bandwidth'], band: 'high occupancy, high utilisation — genuinely compute or bandwidth-bound. Healthy.', rules_out: 'capacity pressure and starvation' };
  if (occHigh && utilLow) return { ...base, supports: ['capacity', 'starvation'], band: 'high occupancy, low utilisation — capacity pressure, host-memory fallback, or input starvation', rules_out: 'a slow GPU' };
  if (occLow && utilHigh) return { ...base, supports: ['compute'], band: 'low occupancy, high utilisation — compute-bound with room to raise batch or tile size', rules_out: 'capacity' };
  if (occLow && utilLow) return { ...base, supports: ['io', 'starvation'], band: 'low occupancy, low utilisation — I/O-bound, starved, or serialised on the CPU', rules_out: 'compute' };
  return { ...base, supports: [], band: 'in the middle zone (50–90%) on at least one axis', rules_out: null, note: 'The reference table reads only clear highs (>90) and lows (<50); a middle reading does not name a class.' };
}

/** Test 3. "Much faster" → warm/cold ≤ 0.7; "the same" → ≥ 0.9. */
function readColdWarm({ cold_seconds, warm_seconds, caches_dropped }) {
  if (!(cold_seconds > 0) || !(warm_seconds > 0)) {
    throw new ToolError('invalid_reading', 'cold_warm needs positive cold_seconds and warm_seconds.');
  }
  const ratio = warm_seconds / cold_seconds;
  const base = {
    test: 'cold_warm',
    ratio: round2(ratio),
    reading: `Cold run ${cold_seconds}s, warm run ${warm_seconds}s (ratio ${round2(ratio)})`,
    ...(caches_dropped ? {} : { caveat: 'Caches were not explicitly dropped, so the "cold" run may already have been warm and the test can lie.' }),
  };
  if (ratio <= 0.7) {
    return { ...base, supports: ['io'], band: 'second run much faster — the working set fits in page cache and the first run was I/O-bound', rules_out: 'compute as the first run\'s cost' };
  }
  if (ratio >= 0.9) {
    return { ...base, supports: [], band: 'second run the same', rules_out: 'a working set that fits in page cache', note: 'The data does not fit in cache, or it was never I/O. If utilisation is also low, this reads as read-bandwidth-bound I/O that repetition will not improve.' };
  }
  return { ...base, supports: [], band: 'between the reference bands', rules_out: null, note: 'A modest gap neither confirms nor rules out I/O — drop caches and repeat.' };
}

/** Test 4. The reference's one hard number: a 10% memory clock cut costing
 *  more than 6% of throughput means bandwidth-bound. */
function readClockScaling({ memory_clock_cut_throughput_loss_percent, core_clock_cut_throughput_loss_percent }) {
  const mem = memory_clock_cut_throughput_loss_percent;
  const core = core_clock_cut_throughput_loss_percent;
  if (typeof mem !== 'number' && typeof core !== 'number') {
    throw new ToolError('invalid_reading', 'clock_scaling needs the throughput loss (percent) from a 10% memory clock cut, a 10% core clock cut, or both.');
  }
  const base = {
    test: 'clock_scaling',
    reading: `10% memory clock cut cost ${mem ?? 'n/a'}% throughput; 10% core clock cut cost ${core ?? 'n/a'}%`,
  };
  if (typeof mem === 'number' && typeof core === 'number') {
    if (mem > core) return { ...base, supports: ['bandwidth'], band: 'the memory clock cut hurt more', rules_out: 'compute as the binding resource' };
    if (core > mem) return { ...base, supports: ['compute'], band: 'the core clock cut hurt more', rules_out: 'bandwidth as the binding resource' };
    return { ...base, supports: [], band: 'both cuts hurt equally', rules_out: null, note: 'Equal sensitivity does not separate compute from bandwidth.' };
  }
  if (typeof mem === 'number') {
    return mem > 6
      ? { ...base, supports: ['bandwidth'], band: 'a 10% memory clock cut cost more than 6% of throughput', rules_out: 'compute headroom as the story' }
      : { ...base, supports: [], band: 'memory clock sensitivity under the 6% line', rules_out: 'bandwidth as the binding resource', note: 'Low memory-clock sensitivity argues against bandwidth; re-run with the core clock to confirm compute.' };
  }
  return { ...base, supports: [], band: 'core clock reading only', rules_out: null, note: 'A core-clock reading alone does not separate compute from bandwidth — run the memory clock cut as well.' };
}

// ------------------------------------------------------------- the verdict

const NEXT_TEST_FOR = {
  'fixed_overhead|io': 'Test 3 (cold cache against warm cache) separates fixed overhead from I/O.',
  'bandwidth|compute': 'Test 4 (scale one clock at a time) separates compute from bandwidth — Tests 1 to 3 cannot do it reliably.',
  'capacity|starvation': 'Test 1 (halve the work per unit): a 3x-or-better fall means capacity spill; watching whether the sawtooth period matches one batch confirms starvation.',
  'io|starvation': 'Test 3 (cold against warm) implicates storage; a sawtooth with a per-batch period implicates the input pipeline.',
};

/**
 * Apply the reference's discriminating tests to reported readings and count
 * the agreement. Two agreeing tests are enough to name the class; fewer than
 * two findings, or a tie, is reported as exactly that, with the test that
 * would settle it. Threshold checks only — no reading is guessed at.
 */
export function classifyBottleneck(evidence = {}) {
  const findings = [];
  if (evidence.halve_work) findings.push(readHalveWork(evidence.halve_work));
  if (evidence.occupancy_utilisation) findings.push(readOccupancyUtilisation(evidence.occupancy_utilisation));
  if (evidence.cold_warm) findings.push(readColdWarm(evidence.cold_warm));
  if (evidence.clock_scaling) findings.push(readClockScaling(evidence.clock_scaling));

  if (findings.length === 0) {
    throw new ToolError('no_evidence', 'No test readings were supplied. Provide at least one of: halve_work, occupancy_utilisation, cold_warm, clock_scaling.', {
      tests: DISCRIMINATING_TESTS.map((t) => ({ id: t.id, procedure: t.procedure })),
    });
  }

  const votes = {};
  for (const f of findings) {
    for (const cls of f.supports) votes[cls] = (votes[cls] || 0) + 1;
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const top = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;

  let verdict;
  if (findings.length < 2) {
    verdict = {
      status: 'insufficient_evidence',
      class: null,
      explanation: 'Do not move to remedies on fewer than two pieces of evidence. One test reading is a lead, not a diagnosis.',
    };
  } else if (top && top[1] >= 2 && (!runnerUp || runnerUp[1] < top[1])) {
    verdict = {
      status: 'named',
      class: top[0],
      class_detail: CLASSES[top[0]],
      agreeing_findings: top[1],
      explanation: `${top[1]} findings agree on ${CLASSES[top[0]].label}. Two agreeing tests are enough to name the class.`,
      ...(runnerUp ? { also_supported: { class: runnerUp[0], findings: runnerUp[1] } } : {}),
    };
  } else if (top && runnerUp && top[1] === runnerUp[1] && top[1] >= 2) {
    const pairKey = [top[0], runnerUp[0]].sort().join('|');
    verdict = {
      status: 'conflicting',
      class: null,
      candidates: [top[0], runnerUp[0]],
      explanation: `The evidence splits evenly between ${CLASSES[top[0]].label} and ${CLASSES[runnerUp[0]].label}.`,
      next_test: NEXT_TEST_FOR[pairKey] ?? 'Run one more discriminating test from triage_reference.',
    };
  } else {
    const pairKey = top && runnerUp ? [top[0], runnerUp[0]].sort().join('|') : null;
    verdict = {
      status: 'insufficient_evidence',
      class: null,
      ...(top ? { leading_candidate: { class: top[0], findings: top[1] } } : {}),
      explanation: 'No class has two agreeing findings yet. Two agreeing tests are the bar the method sets.',
      next_test: (pairKey && NEXT_TEST_FOR[pairKey])
        || 'Test 1 (halve the work per unit) separates more cases than any other single test.',
    };
  }

  return {
    findings,
    votes,
    verdict,
    reminders: [
      'Two constraints often sit close together: relieve the first and the second binds within 20% of the old time. That is normal, not a failed diagnosis.',
      'Nothing here is a substitute for a profiler. Nsight Systems, py-spy, a renderer\'s own stats panel and Houdini\'s performance monitor give the answer directly.',
    ],
  };
}
