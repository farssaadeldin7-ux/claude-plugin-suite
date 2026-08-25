import { ToolError } from '../mcp-lite.js';

/**
 * Consumables figures and sizing arithmetic, ported from
 * references/consumables-planning.md. Every figure here is a planning
 * convention with a stated range; where the reference gives a range and the
 * user does not choose a point inside it, the arithmetic is done at both ends
 * and returned as a range — never collapsed to an invented midpoint.
 */

export const ENERGY_BANDS = {
  sedentary: {
    label: 'Sedentary basecamp',
    kcal_per_day: { low: 2500, high: 2500 },
    typical_case: 'Fixed camp, short walks, warm',
  },
  moderate: {
    label: 'Moderate hiking',
    kcal_per_day: { low: 3000, high: 3500 },
    typical_case: '15–20 km/day, 20–25 kg pack, temperate',
  },
  cold_or_heavy: {
    label: 'Cold weather or heavy load',
    kcal_per_day: { low: 4000, high: 5000 },
    typical_case: 'Below freezing, snow travel, 25 kg+, long days',
  },
};

export const COLD_NOTE =
  'Cold is the multiplier people forget: thermoregulation adds 500–1,000 kcal/day before any extra distance is walked.';

export const FOOD_WEIGHT = {
  planning_band_g_per_person_day: { low: 700, high: 900 },
  note: 'Dry weight, excluding packaging. Where you land in the range is decided by calorie density.',
  density_examples: [
    { density_kcal_per_g: 4.0, description: 'Ordinary mixed hill food', to_hit_3200_kcal: '800 g/day' },
    { density_kcal_per_g: 4.5, description: 'Deliberately fat-forward', to_hit_3200_kcal: '710 g/day' },
  ],
  fat_note:
    'Fat carries 9 kcal/g against 4 for carbohydrate and protein: 100 ml of olive oil adds ~830 kcal for 92 g. The cheapest weight saving on any trip, and routinely ignored.',
};

export const RESERVE = {
  rule: 'Always carry one extra day, at roughly 60% ration.',
  kcal_per_person: { low: 1800, high: 2000 },
  grams_per_person: { low: 400, high: 500 },
  conditions: [
    'No cooking required — it must work with a dead stove',
    'Sealed, carried whole by one nominated person, not split across packs',
    'Not snack food. If it is accessible it will be eaten on day two',
  ],
  purpose: 'It exists for a delay, not for a change of plan.',
};

export const WATER = {
  temperate: {
    label: 'Temperate, moderate exertion',
    litres_per_person_day: { low: 3, high: 4 },
    note: '2.5–3 drinking, 0.5–1 cooking and cleaning',
  },
  hot_arid: {
    label: 'Hot or arid, high exertion',
    litres_per_person_day: { low: 5, high: 8 },
    note: 'Heat casualties start with people who rationed',
  },
  cold_dry: {
    label: 'Cold, dry air',
    litres_per_person_day: { low: 3.5, high: 4.5 },
    note: 'Thirst is suppressed and dehydration is common',
  },
  snow_melt: {
    label: 'Snow-melting camp',
    litres_per_person_day: null,
    note: 'Same intake as the matching climate band, very different fuel bill — see the fuel table',
  },
};

export const WATER_CARRY_RULE =
  'What matters more than the daily figure is the carry between resupply points. Map the sources, find the longest dry stretch, size bottles for that stretch plus one litre. Water is 1 kg/L — a spare three litres "in case" is an extra tent.';

export const TREATMENT = [
  { method: 'Squeeze / inline hollow-fibre filter', throughput: '1.5–2 L/min new, halves as it clogs', notes: 'Backflush daily. One freeze destroys it — it sleeps inside your bag' },
  { method: 'Gravity filter', throughput: '4–6 L in 5–10 min, hands-free', notes: 'The right default for groups of four or more' },
  { method: 'Pump filter', throughput: '~1 L/min, and it is work', notes: 'Handles shallow or silty sources nothing else can' },
  { method: 'Chlorine dioxide tablets or drops', throughput: '30 min bacteria and viruses, 4 hours for Cryptosporidium', notes: 'No particulate removal. Excellent as a lightweight backup' },
  { method: 'UV pen', throughput: '90 s/L', notes: 'Needs clear water and a live battery' },
  { method: 'Boiling', throughput: '1 min at a rolling boil, 3 min above 2,000 m', notes: 'Costs about 16 g of gas per litre. A backup, not a primary' },
];

export const TREATMENT_BACKUP_NOTE =
  'Chemical treatment is the correct backup for a filter because it fails differently: a second identical filter is not a backup, since the same silt clogs both.';

export const FUEL = {
  temperate: {
    label: 'Temperate, two hot drinks and two hot meals',
    canister_gas_g_per_person_day: { low: 15, high: 25 },
  },
  freezing: {
    label: 'Below freezing, windy, no shelter for the stove',
    canister_gas_g_per_person_day: { low: 30, high: 50 },
  },
  snow_melt: {
    label: 'Melting snow for all water',
    canister_gas_g_per_person_day: { low: 80, high: 150 },
  },
};

export const FUEL_NOTES = [
  'A "230 g" canister weighs about 370 g full and 140 g empty — plan on net gas, carry gross weight.',
  'Liquid fuel runs 90–120 ml/person/day when melting snow.',
  'Round up to whole canisters. A part-used canister plus a full spare is the standard configuration, and you cannot know what is left in a part-used one without weighing it.',
];

const isRange = (value) => value && typeof value === 'object';

/** Apply f to a scalar or to both ends of a {low, high} range. */
const mapRange = (value, f) => (isRange(value) ? { low: f(value.low), high: f(value.high) } : f(value));

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Size food, reserve, water and fuel for a party. Pure arithmetic on the
 * tables above: where the user has not chosen a point inside a reference
 * range, the result carries the range.
 */
export function sizeConsumables({
  people,
  days,
  person_days,
  exertion = 'moderate',
  kcal_per_day,
  ration_density_kcal_per_g = 4.0,
  water_conditions,
  fuel_conditions,
  gas_grams_per_person_day,
}) {
  if (!Number.isFinite(people) || people < 1) {
    throw new ToolError('invalid_roster', 'people must be a number of at least 1.');
  }
  if (!Number.isFinite(days) || days < 1) {
    throw new ToolError('invalid_duration', 'days must be a number of at least 1.');
  }
  const band = ENERGY_BANDS[exertion];
  if (!band) {
    throw new ToolError('unknown_exertion', `No exertion band "${exertion}".`, { available: Object.keys(ENERGY_BANDS) });
  }
  if (!Number.isFinite(ration_density_kcal_per_g) || ration_density_kcal_per_g <= 0) {
    throw new ToolError('invalid_density', 'ration_density_kcal_per_g must be a positive number.');
  }
  if (water_conditions && !WATER[water_conditions]) {
    throw new ToolError('unknown_conditions', `No water conditions "${water_conditions}".`, { available: Object.keys(WATER) });
  }
  if (fuel_conditions && !FUEL[fuel_conditions]) {
    throw new ToolError('unknown_conditions', `No fuel conditions "${fuel_conditions}".`, { available: Object.keys(FUEL) });
  }

  const personDays = person_days ?? people * days;
  if (!Number.isFinite(personDays) || personDays < 1) {
    throw new ToolError('invalid_duration', 'person_days must be a number of at least 1.');
  }

  // Energy: the user's chosen figure, or the band's range at both ends.
  const kcal = Number.isFinite(kcal_per_day) ? kcal_per_day : band.kcal_per_day;
  const kcalNote = Number.isFinite(kcal_per_day)
    && (kcal_per_day < band.kcal_per_day.low || kcal_per_day > band.kcal_per_day.high)
    ? `${kcal_per_day} kcal/day is outside the ${band.label.toLowerCase()} planning band of ${band.kcal_per_day.low}–${band.kcal_per_day.high}.`
    : null;

  // Food: grams/day follows directly from kcal and density.
  const gramsPerDay = mapRange(kcal, (k) => Math.round(k / ration_density_kcal_per_g));
  const outsideBand = (g) => g < FOOD_WEIGHT.planning_band_g_per_person_day.low || g > FOOD_WEIGHT.planning_band_g_per_person_day.high;
  const foodBandNote = (isRange(gramsPerDay) ? outsideBand(gramsPerDay.low) || outsideBand(gramsPerDay.high) : outsideBand(gramsPerDay))
    ? 'This falls outside the 700–900 g/person/day planning band — check the density figure and the menu before trusting it.'
    : null;

  const foodPerPersonKg = mapRange(gramsPerDay, (g) => round2((g * days) / 1000));
  const foodTotalKg = mapRange(gramsPerDay, (g) => round1((g * personDays) / 1000));

  // Reserve: fixed per-person range, on top of the daily food, never split.
  const reserveTotalKg = mapRange(RESERVE.grams_per_person, (g) => round1((g * people) / 1000));

  // Fuel: net grams of canister gas; canister selection is left to the user
  // because the reference gives the round-up rule, not a packing algorithm.
  let fuel = null;
  if (fuel_conditions) {
    const fuelBand = FUEL[fuel_conditions];
    const rate = Number.isFinite(gas_grams_per_person_day) ? gas_grams_per_person_day : fuelBand.canister_gas_g_per_person_day;
    const rateNote = Number.isFinite(gas_grams_per_person_day)
      && (gas_grams_per_person_day < fuelBand.canister_gas_g_per_person_day.low || gas_grams_per_person_day > fuelBand.canister_gas_g_per_person_day.high)
      ? `${gas_grams_per_person_day} g/person/day is outside the ${fuelBand.canister_gas_g_per_person_day.low}–${fuelBand.canister_gas_g_per_person_day.high} range for these conditions.`
      : null;
    fuel = {
      conditions: fuelBand.label,
      rate_g_per_person_day: rate,
      net_gas_required_g: mapRange(rate, (r) => Math.ceil(r * personDays)),
      ...(rateNote ? { note: rateNote } : {}),
      canister_notes: FUEL_NOTES,
    };
  }

  // Water: a daily range by conditions plus the carry rule; the carry between
  // sources depends on the route, which only the user knows.
  let water = null;
  if (water_conditions) {
    const w = WATER[water_conditions];
    water = {
      conditions: w.label,
      litres_per_person_day: w.litres_per_person_day,
      note: w.note,
      carry_rule: WATER_CARRY_RULE,
    };
  }

  return {
    party: { people, days, person_days: personDays },
    energy: {
      band: band.label,
      kcal_per_person_day: kcal,
      ...(kcalNote ? { note: kcalNote } : {}),
      cold_note: exertion === 'cold_or_heavy' ? COLD_NOTE : undefined,
    },
    food: {
      ration_density_kcal_per_g,
      dry_g_per_person_day: gramsPerDay,
      planning_band_g_per_person_day: FOOD_WEIGHT.planning_band_g_per_person_day,
      ...(foodBandNote ? { note: foodBandNote } : {}),
      per_person_kg_excluding_reserve: foodPerPersonKg,
      group_total_kg_excluding_reserve: foodTotalKg,
    },
    reserve: {
      rule: RESERVE.rule,
      per_person: { grams: RESERVE.grams_per_person, kcal: RESERVE.kcal_per_person },
      group_total_kg: reserveTotalKg,
      conditions: RESERVE.conditions,
      purpose: RESERVE.purpose,
    },
    ...(water ? { water } : {}),
    ...(fuel ? { fuel } : {}),
    caveat:
      'Planning figures, not measurements: dry weights exclude packaging, and real packed weight runs 5–10% over once stuff sacks and packaging are counted. Weigh the actual rations.',
  };
}
