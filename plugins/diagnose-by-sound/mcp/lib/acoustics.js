import { ToolError } from '../mcp-lite.js';

/**
 * The deterministic half of the acoustic-signal-processing skill: the
 * frequency-band families as data, the order arithmetic that ties a
 * spectrogram line or stripe rate to a rotating part, the staged elimination
 * protocol as a machine-readable table with a planner over recorded results,
 * and a mechanical capture-quality check. Arithmetic and table lookups only —
 * nothing here listens to audio, judges a recording, or decides what a noise
 * is; the ear, the elimination drive and the diagnosis stay with the skill.
 */

export const BAND_CAVEAT =
  'Every figure is a band, not a threshold. Consumer microphones and cabin acoustics shift ' +
  'absolute levels; what survives is the relationships — what a sound tracks, how harmonics ' +
  'space, how a rate compares to a rotation.';

export const FAMILY_BANDS = [
  { family: 'Knock (rod, main bearing)', behaviour: 'Periodic impacts tracking crank rate', band_hz: [100, 600], spectrogram: 'Evenly spaced vertical stripes; spacing shortens as RPM rises' },
  { family: 'Piston slap', behaviour: 'Impacts, worst cold, fades warm', band_hz: [200, 800], spectrogram: 'Stripes at cold idle that thin out with temperature' },
  { family: 'Injector / valvetrain tick', behaviour: 'Light impacts at half-crank rate (four-stroke)', band_hz: [2000, 8000], spectrogram: 'Fine, fast stripes riding above the engine tonal stack' },
  { family: 'Rattle (heat shield, trim, hanger)', behaviour: 'Irregular impact bursts excited by surface', band_hz: [1000, 8000], spectrogram: 'Ragged vertical smears over bumps; silent on smooth tarmac' },
  { family: 'Whine — gear (diff, gearbox, PS pump)', behaviour: 'Continuous tone, load-sensitive', band_hz: [300, 3000], spectrogram: 'Clean horizontal/sloping line, often with 2–3 harmonics' },
  { family: 'Whine — alternator / accessory', behaviour: 'Tone tracking RPM through the pulley ratio', band_hz: [1000, 5000], spectrogram: 'Line that moves with revving in neutral, stationary' },
  { family: 'Wheel bearing', behaviour: 'Rough growl tracking road speed, loads in curves', band_hz: [300, 800], spectrogram: 'Fuzzy band sloping with speed, louder loading one side' },
  { family: 'Belt squeal / chirp', behaviour: 'Tonal squeal (slip) or rhythmic chirp (misalignment)', band_hz: [1000, 4000], spectrogram: 'Intense line at rev changes or with AC engagement' },
  { family: 'Brake squeal', behaviour: 'High pure tone during application', band_hz: [2000, 10000], spectrogram: 'Very clean line only while braking' },
  { family: 'Exhaust leak', behaviour: 'Puffing/ticking at firing rate, raspy broadband', band_hz: [100, 2000], spectrogram: 'Stripes at firing rate plus wash, loudest cold' },
  { family: 'Wind / road roar (maskers)', behaviour: 'Continuous, speed-dependent broadband', band_hz: [20, 1000], spectrogram: 'Full-height wash that drowns structure' },
];

export const HARMONIC_RULE =
  'Two lines that keep a fixed ratio as everything speeds up are one source (harmonics). Two ' +
  'lines that move independently are two sources — treat them as two observations.';

const round2 = (n) => Number(n.toFixed(2));

/**
 * Tie a measured spectrogram line (Hz) or stripe rate (events/second) to the
 * rotating parts it could be, from the vehicle context supplied. Pure
 * arithmetic with the working shown; matching within a stated tolerance.
 */
export function matchOrders({
  measured_hz, events_per_second, rpm, cylinders, speed_kmh, tyre_circumference_m,
  pulley_ratio, tolerance_pct,
}) {
  const measured = measured_hz !== undefined ? Number(measured_hz) : Number(events_per_second);
  if (!(measured > 0)) {
    throw new ToolError('invalid_request', 'Pass measured_hz (a spectrogram line) or events_per_second (a stripe rate) as a positive number.');
  }
  if (rpm === undefined && speed_kmh === undefined) {
    throw new ToolError('invalid_request', 'Pass at least one of rpm (engine side) or speed_kmh (road side) — without a rotation to compare against, no order can be computed.');
  }
  const tol = tolerance_pct === undefined ? 10 : Number(tolerance_pct);
  if (!(tol > 0 && tol <= 50)) throw new ToolError('invalid_request', 'tolerance_pct must be between 0 and 50.');

  const bases = [];
  if (rpm !== undefined) {
    const crank = Number(rpm) / 60;
    if (!(crank > 0)) throw new ToolError('invalid_request', 'rpm must be positive.');
    bases.push({ source: 'crank rate', hz: crank, working: `${rpm} RPM / 60 = ${round2(crank)} Hz` });
    bases.push({ source: 'camshaft / half-crank rate (valvetrain ticks)', hz: crank / 2, working: `${rpm} RPM / 120 = ${round2(crank / 2)} Hz` });
    if (cylinders !== undefined) {
      const firing = (crank * Number(cylinders)) / 2;
      bases.push({ source: 'firing rate (four-stroke)', hz: firing, working: `${rpm}/60 × ${cylinders}/2 = ${round2(firing)} Hz` });
    }
    if (pulley_ratio !== undefined) {
      const acc = crank * Number(pulley_ratio);
      bases.push({ source: `accessory at pulley ratio ${pulley_ratio}`, hz: acc, working: `${round2(crank)} Hz crank × ${pulley_ratio} = ${round2(acc)} Hz` });
    } else {
      bases.push({ source: 'accessory band (typical alternator, 2–3× crank)', hz: crank * 2.5, band: [crank * 2, crank * 3], working: `${round2(crank)} Hz crank × 2 to 3 = ${round2(crank * 2)}–${round2(crank * 3)} Hz` });
    }
  }
  if (speed_kmh !== undefined) {
    const circ = tyre_circumference_m === undefined ? 2.0 : Number(tyre_circumference_m);
    if (!(circ > 0.5 && circ < 4)) throw new ToolError('invalid_request', 'tyre_circumference_m looks wrong — typical car tyres are 1.7–2.3 m.');
    const wheel = (Number(speed_kmh) / 3.6) / circ;
    bases.push({
      source: `wheel rate${tyre_circumference_m === undefined ? ' (assumed 2.0 m circumference)' : ''}`,
      hz: wheel,
      working: `${speed_kmh} km/h / 3.6 / ${circ} m = ${round2(wheel)} Hz`,
    });
  }

  const matches = [];
  for (const base of bases) {
    for (let order = 1; order <= 6; order += 1) {
      const target = base.hz * order;
      const lo = base.band ? base.band[0] * order : target * (1 - tol / 100);
      const hi = base.band ? base.band[1] * order : target * (1 + tol / 100);
      if (measured >= lo && measured <= hi) {
        matches.push({
          source: base.source,
          order,
          expected_hz: base.band ? `${round2(lo)}–${round2(hi)}` : round2(target),
          measured_hz: measured,
          working: order === 1 ? base.working : `${base.working}; × order ${order} = ${round2(target)} Hz`,
        });
      }
    }
  }
  matches.sort((a, b) => a.order - b.order);

  return {
    measured_hz: measured,
    tolerance_pct: tol,
    candidate_rates: bases.map(({ source, hz, working, band }) => ({ source, hz: round2(hz), ...(band ? { band_hz: [round2(band[0]), round2(band[1])] } : {}), working })),
    matches,
    ...(matches.length === 0
      ? { note: 'No computed rate matches within tolerance. Either the context is incomplete (missing cylinders, pulley ratio, tyre size), the measurement is a harmonic above order 6, or the source is not rotation-locked (a rattle or a resonance).' }
      : {}),
    ...(matches.length > 1
      ? { disambiguation: 'Multiple rates match. The elimination tests decide, not the arithmetic: a rate that tracks revving in neutral is engine-side; one that tracks a neutral coast is road-side.' }
      : {}),
    harmonic_rule: HARMONIC_RULE,
    caveat: BAND_CAVEAT,
  };
}

/**
 * The staged elimination protocol as data. Outcomes per test:
 *   'survives' — the noise is still there under the test
 *   'gone'     — the test silenced it
 *   'unchanged' is an alias for 'survives'.
 */
export const ELIMINATION_TESTS = [
  { id: 'engine_off', stage: 1, test: 'Engine off, key on, sit quietly', silences: 'everything mechanical', survives: 'Electrical (fuel pump prime, relays) or interior trim settling', gone: 'Mechanical — continue' },
  { id: 'idle_parked', stage: 1, test: 'Idle, parked, HVAC off, radio off', silences: 'road, wind, tyres, driveline', survives: 'Engine, accessories or exhaust — stay parked, the road adds maskers for no information', gone: 'Road-speed side or load-dependent — move to stage 2' },
  { id: 'rev_neutral', stage: 1, test: 'Rev slowly to ~3,000 in neutral, parked', silences: 'whole road side', survives: 'RPM-linked: engine internals, accessories, exhaust', gone: 'Not purely RPM-linked' },
  { id: 'hvac_sweep', stage: 1, test: 'HVAC fan through its speeds', silences: 'nothing (adds one source)', survives: 'Rate follows fan speed → blower motor or debris in the box', gone: '—' },
  { id: 'ac_toggle', stage: 1, test: 'AC compressor on/off at idle', silences: 'nothing (adds one source)', survives: 'Appears with AC → compressor, clutch, or belt under load', gone: '—' },
  { id: 'neutral_coast', stage: 2, test: 'Neutral coast through the speed where it happens', silences: 'engine load', survives: 'Wheels, tyres, driveline, suspension (road-speed side)', gone: 'Engine or load side' },
  { id: 'two_gears', stage: 2, test: 'Same road speed in two gears', silences: '—', survives: 'Pitch follows speed → road side. Pitch follows RPM → engine side', gone: '—' },
  { id: 'surface_change', stage: 2, test: 'Smooth tarmac vs coarse chip vs bumps', silences: 'surface excitation', survives: 'Steady on all surfaces → rotating source', gone: 'Only on rough surface → rattle (loose component)' },
  { id: 's_turns', stage: 2, test: 'Gentle S-turns at steady speed', silences: '—', survives: 'Louder loading one side → bearing on the loaded side. Clicking only at angle → CV joint', gone: '—' },
  { id: 'brake_drag', stage: 2, test: 'Light brake drag at speed', silences: '—', survives: 'Changes with light pedal → pads, rotors, shields', gone: '—' },
  { id: 'throttle_lift', stage: 2, test: 'Throttle on/off at steady speed', silences: '—', survives: 'Clunk or boom only on load reversal → mounts, U-joints, diff lash', gone: '—' },
  { id: 'windows', stage: 2, test: 'Windows up vs cracked', silences: 'wind masking', survives: 'Mechanical', gone: 'Large change → aeroacoustic, not mechanical' },
];

export const VOCAB_MAPPING =
  'Elimination results map straight onto the diagnose vocabulary: coast and gear results feed ' +
  'changes_with, surface and manoeuvre results feed occurs_when, probe results feed location. A ' +
  'test that changed nothing is evidence too — it kills lookalike candidates in the ranking.';

const OUTCOMES = ['survives', 'gone', 'unchanged'];

/**
 * Given recorded test outcomes, return what each result mechanically rules in,
 * the derived side of the vehicle where the tables decide it, and the ordered
 * tests still worth running. Table lookups only — it never hears the noise.
 */
export function planElimination({ results } = {}) {
  const recorded = results && typeof results === 'object' && !Array.isArray(results) ? results : {};
  const readings = [];
  const sides = new Set();

  for (const [id, outcomeRaw] of Object.entries(recorded)) {
    const test = ELIMINATION_TESTS.find((t) => t.id === id);
    if (!test) throw new ToolError('unknown_test', `"${id}" is not a test id.`, { valid: ELIMINATION_TESTS.map((t) => t.id) });
    const outcome = outcomeRaw === 'unchanged' ? 'survives' : outcomeRaw;
    if (!OUTCOMES.includes(outcomeRaw)) {
      throw new ToolError('invalid_outcome', `"${outcomeRaw}" is not an outcome for "${id}".`, { valid: OUTCOMES });
    }
    const meaning = outcome === 'survives' ? test.survives : test.gone;
    readings.push({ test: test.id, outcome, means: meaning });
    if (id === 'idle_parked' && outcome === 'survives') sides.add('engine_side');
    if (id === 'rev_neutral' && outcome === 'survives') sides.add('engine_side');
    if (id === 'neutral_coast' && outcome === 'survives') sides.add('road_side');
    if (id === 'neutral_coast' && outcome === 'gone') sides.add('engine_side');
  }

  const conflict = sides.has('engine_side') && sides.has('road_side');
  const remaining = ELIMINATION_TESTS.filter((t) => !(t.id in recorded));
  const nextTests = remaining
    .filter((t) => {
      if (sides.size === 0 || conflict) return true;
      if (sides.has('engine_side')) return t.stage === 1 || ['two_gears'].includes(t.id);
      return t.stage === 2 || ['idle_parked', 'rev_neutral'].includes(t.id);
    })
    .sort((a, b) => a.stage - b.stage);

  return {
    tests_recorded: readings.length,
    readings,
    derived_side: conflict ? 'conflicting' : (sides.size === 1 ? [...sides][0] : 'undecided'),
    ...(conflict
      ? { conflict_note: 'The results point at both sides of the vehicle. Either a test was misread or there are two noises — isolate and describe them separately, and run diagnose twice.' }
      : {}),
    next_tests: nextTests.map(({ id, stage, test, survives, gone }) => ({ id, stage, test, if_it_survives: survives, if_it_goes_quiet: gone })),
    vocabulary_mapping: VOCAB_MAPPING,
    what_this_did_not_judge:
      'Whether each outcome was read correctly on the actual car. The planner orders the stated ' +
      'tests and reads the stated table; the ear and the drive belong to the person.',
  };
}

/** Capture rules stated by the skill, applied mechanically to described conditions. */
export function checkCapture({
  windows_closed, hvac_off, radio_off, phone_mounted, reproduced_live,
} = {}) {
  const findings = [];
  const flag = (condition, finding, fix) => { if (condition) findings.push({ finding, fix }); };

  flag(hvac_off === false, 'HVAC was running — the blower is a broadband masker and one more source in the mixture.', 'Re-record with HVAC off; sweep the fan separately as its own test.');
  flag(radio_off === false, 'Audio system was on — music and speech sit exactly where mechanical structure lives on a spectrogram.', 'Re-record with the radio off.');
  flag(windows_closed === false, 'Windows open — wind buffeting produces full-height wash that drowns structure.', 'Windows up for the capture; compare windows-cracked separately for the aeroacoustic test.');
  flag(phone_mounted === false, 'Phone was handheld — handling noise reads as impacts and low-frequency rumble.', 'Mount the phone or rest it on a soft surface; do not hold it.');
  flag(reproduced_live === false, 'The noise was not reproduced during the capture — a clip of the car not making the noise carries no signal.', 'Record while the noise is actually happening, in the condition that produces it.');

  return {
    conditions_checked: 5,
    findings,
    verdict: findings.length === 0
      ? 'No capture-rule failures in the described conditions.'
      : 'Fix the capture before interpreting the spectrogram — wash and maskers cannot be removed after the fact.',
    note: 'Mechanical checks on the described conditions only. Nothing here has heard the recording; if wash dominates the spectrogram anyway, the capture failed regardless of this checklist.',
  };
}
