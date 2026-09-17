import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';

/**
 * Host telemetry — the measured half of the plugin.
 *
 * Everything else in this server is arithmetic over inputs the user reported;
 * this module is the one place that reads the actual machine, and it only
 * ever reports what a Node built-in or a probed system command actually
 * returned. Where a reading cannot be taken — no nvidia-smi, no /proc on a
 * non-Linux host, load averages on Windows — the gap is reported with its
 * reason, never filled with a guess. A snapshot is a point in time, not a
 * profile over a job: the numbers move as other work starts and stops.
 *
 * Units: "gb" figures are binary gibibytes, matching how cards and memory
 * modules are sold (a "24 GB" card is 24 GiB), rounded to two decimals.
 */

const round2 = (n) => Math.round(n * 100) / 100;
const GIB = 2 ** 30;
// External probes get a short leash: a hung nvidia-smi (driver mid-reset, a
// container with the binary but no device) must degrade to an honest
// "unavailable", not stall the whole tool call.
const PROBE_TIMEOUT_MS = 2500;

const GPU_UNAVAILABLE_REASON = 'nvidia-smi not found or no NVIDIA GPU';

/** execFile as a promise. Rejection carries the spawn/timeout/exit error. */
function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: PROBE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/** "24564 MiB" -> 24564. Anything else — including nvidia-smi's own
 *  "[N/A]" — is null, so a malformed field can never become a number. */
export function parseMib(field) {
  const m = /^([\d.]+)\s*MiB$/.exec((field ?? '').trim());
  return m ? Number(m[1]) : null;
}

/**
 * Probe `nvidia-smi --query-gpu=name,memory.total,memory.used
 * --format=csv,noheader`. On any failure — binary missing, timeout, no
 * device, unparseable output — the result is {available: false} with the
 * reason. GPU data is never invented: a non-NVIDIA card, or an NVIDIA card
 * without its driver, reports unavailable rather than a guess.
 */
export async function probeNvidiaSmi() {
  let stdout;
  try {
    stdout = await run('nvidia-smi', ['--query-gpu=name,memory.total,memory.used', '--format=csv,noheader']);
  } catch (err) {
    return {
      available: false,
      reason: GPU_UNAVAILABLE_REASON,
      detail: err.code === 'ENOENT' ? 'nvidia-smi is not on PATH' : (err.message || String(err)),
      note: 'Only NVIDIA cards with a working driver are measurable here. AMD, Intel and Apple GPUs report unavailable — that is a limit of the probe, not a statement about the hardware.',
    };
  }
  const gpus = [];
  for (const line of stdout.trim().split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split(',').map((s) => s.trim());
    const totalMib = parseMib(parts[1]);
    const usedMib = parseMib(parts[2]);
    if (parts.length !== 3 || !parts[0] || totalMib === null || usedMib === null) {
      return {
        available: false,
        reason: GPU_UNAVAILABLE_REASON,
        detail: `nvidia-smi answered, but a line could not be parsed as "name, N MiB, N MiB": ${JSON.stringify(line)}`,
      };
    }
    gpus.push({
      label: 'measured',
      name: parts[0],
      memory_total_gb: round2(totalMib / 1024),
      memory_used_gb: round2(usedMib / 1024),
      memory_free_gb: round2((totalMib - usedMib) / 1024),
    });
  }
  if (gpus.length === 0) {
    return { available: false, reason: GPU_UNAVAILABLE_REASON, detail: 'nvidia-smi answered with no GPU rows.' };
  }
  return { available: true, source: 'nvidia-smi', gpus };
}

/** MemAvailable and friends from /proc/meminfo (Linux only), in GiB. */
function readProcMeminfo() {
  if (process.platform !== 'linux') return null;
  let text;
  try {
    text = fs.readFileSync('/proc/meminfo', 'utf8');
  } catch {
    return null;
  }
  const grabKb = (key) => {
    const m = new RegExp(`^${key}:\\s+(\\d+) kB`, 'm').exec(text);
    return m ? Number(m[1]) : null;
  };
  const availableKb = grabKb('MemAvailable');
  if (availableKb === null) return null;
  return { mem_available_gb: round2((availableKb * 1024) / GIB) };
}

/**
 * Top resident-memory processes, via `ps -eo rss,comm --sort=-rss` — Linux
 * only, because that flag set is GNU ps. Elsewhere the block says why it is
 * missing instead of pretending an empty machine.
 */
export async function topMemoryProcesses(limit = 5) {
  if (process.platform !== 'linux') {
    return {
      available: false,
      reason: `Per-process memory is only probed on Linux (ps -eo rss,comm --sort=-rss is GNU ps); this machine is ${process.platform}, so the list is omitted rather than approximated.`,
    };
  }
  let stdout;
  try {
    stdout = await run('ps', ['-eo', 'rss,comm', '--sort=-rss']);
  } catch (err) {
    return { available: false, reason: `The ps probe failed: ${err.message || String(err)}` };
  }
  const processes = [];
  for (const line of stdout.trim().split('\n').slice(1)) {
    const m = /^\s*(\d+)\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    processes.push({
      label: 'measured',
      command: m[2],
      resident_mb: Math.round(Number(m[1]) / 1024),
    });
    if (processes.length >= limit) break;
  }
  return {
    available: true,
    source: 'ps -eo rss,comm --sort=-rss',
    unit_note: 'resident_mb is resident set size in MiB — host RAM actually held right now, not virtual size.',
    processes,
  };
}

function ramReadings(meminfo) {
  return {
    label: 'measured',
    total_gb: round2(os.totalmem() / GIB),
    free_gb: round2(os.freemem() / GIB),
    ...(meminfo
      ? {
        available_gb: meminfo.mem_available_gb,
        available_note: 'MemAvailable from /proc/meminfo — what could be allocated without swapping, including reclaimable page cache. This is the honest planning figure; free_gb alone understates it on a machine with a warm cache.',
      }
      : {
        available_note: `No /proc/meminfo on ${process.platform}, so free_gb (os.freemem) is the only free figure here. It can understate what is really allocatable.`,
      }),
    source: meminfo ? 'os.totalmem / os.freemem, plus /proc/meminfo' : 'os.totalmem / os.freemem',
  };
}

/** The measured free-RAM figure a plan should be checked against. */
export function allocatableRamGb(ram) {
  return ram.available_gb ?? ram.free_gb;
}

function loadReadings() {
  if (process.platform === 'win32') {
    return {
      unsupported: true,
      reason: 'Load averages are not supported on Windows — os.loadavg() returns zeros there, which would be a fabricated reading, not a measurement, so none is shown.',
    };
  }
  const [one, five, fifteen] = os.loadavg();
  return {
    label: 'measured',
    one_min: round2(one),
    five_min: round2(five),
    fifteen_min: round2(fifteen),
    reading: 'Runnable processes averaged over each window. Compare against cpu.logical_cores: sustained load above the core count means CPU work is queueing.',
  };
}

/**
 * One point-in-time reading of the actual machine. Every figure is measured;
 * every gap states its reason. Nothing leaves this machine — the snapshot is
 * returned to the caller and stored nowhere.
 */
export async function systemSnapshot() {
  const [gpu, top_memory_processes] = await Promise.all([probeNvidiaSmi(), topMemoryProcesses()]);
  const cpus = os.cpus();
  return {
    label: 'measured',
    note: 'Every figure below is measured on this machine at taken_at — none of it is estimated. A snapshot is a point in time, not a profile over a job: readings move as work starts and stops.',
    taken_at: new Date().toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    ram: ramReadings(readProcMeminfo()),
    cpu: {
      label: 'measured',
      logical_cores: cpus.length,
      model: cpus[0]?.model ?? 'unknown',
      source: 'os.cpus',
    },
    load_averages: loadReadings(),
    gpu,
    top_memory_processes,
    unit_note: 'gb figures are binary gibibytes, matching how cards and memory modules are sold.',
  };
}
