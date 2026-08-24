import { ToolError } from '../mcp-lite.js';

/**
 * The weight ledger, ported from SKILL.md steps 5 and 6 and the worked example
 * in references/consumables-planning.md. The carry bands are military and
 * expedition load convention, not physiology, and the output says so. All the
 * arithmetic is here; the decision about what to cut stays with the skill.
 */

export const CARRY_BANDS = {
  conditioned: {
    label: 'Fit, conditioned, load-experienced',
    percent: { low: 25, high: 30 },
  },
  typical: {
    label: 'Typical healthy adult',
    percent: { low: 20, high: 20 },
  },
  unconditioned: {
    label: 'Unconditioned, young, older, or recovering',
    percent: { low: 15, high: 15 },
    note: '15% or less',
  },
};

export const BANDS_CAVEAT =
  'These are guidance, not physiology. They come from military and expedition load convention and they are wrong for individuals in both directions. Treat an exceeded band as a design fault in the plan, never as something the carrier should absorb.';

export const REBALANCE_ORDER = [
  'Fuel and water (dense, divisible)',
  'Food',
  'Bulky shared items',
  'Split systems',
];

export const NEVER_RULE =
  'Never close the gap by quietly adding the surplus to the strongest carrier past their own band. If the group\'s total mass exceeds the sum of the bands, the trip as specified does not fit and that is the answer.';

export const BURN_DOWN_NOTE =
  'Consumables burn down at roughly 1–1.5 kg/person/day, so a load that is over on day one may be inside the band by day two. Check the second morning before redesigning the plan.';

const HEADROOM_PERCENT = 90;

const round1 = (x) => Math.round(x * 10) / 10;

const nonNegative = (value, field, name) => {
  const n = value ?? 0;
  if (!Number.isFinite(n) || n < 0) {
    throw new ToolError('invalid_mass', `${field} for "${name}" must be a non-negative number of kilograms.`);
  }
  return n;
};

/**
 * Total each person's load against their band. A person is described either by
 * body weight plus a conditioning band (calculated limit) or, where body
 * weight was refused or is unavailable, by a self-declared target load — and
 * the output states plainly which basis was used.
 */
export function weightLedger(roster) {
  if (!Array.isArray(roster) || !roster.length) {
    throw new ToolError('invalid_roster', 'roster must be a non-empty array of people.');
  }

  const people = roster.map((person) => {
    const name = String(person.name ?? '').trim();
    if (!name) throw new ToolError('unnamed_carrier', 'Every roster entry needs a name — a kilogram assigned to nobody is a kilogram someone is quietly carrying.');

    const personal = nonNegative(person.personal_kg, 'personal_kg', name);
    const water = nonNegative(person.water_kg, 'water_kg', name);
    const consumables = nonNegative(person.consumables_kg, 'consumables_kg', name);
    const group = nonNegative(person.group_kg, 'group_kg', name);

    let basis, limit, bandLabel, percentUsed;
    if (Number.isFinite(person.body_weight_kg) && person.body_weight_kg > 0) {
      const band = CARRY_BANDS[person.band];
      if (!band) {
        throw new ToolError('unknown_band', `"${name}" needs a conditioning band.`, { available: Object.keys(CARRY_BANDS) });
      }
      // The band's low end is the default. A chosen percentage may sit inside
      // the band or below it — overrides go downwards, never upwards.
      percentUsed = Number.isFinite(person.band_percent) ? person.band_percent : band.percent.low;
      if (percentUsed > band.percent.high) {
        throw new ToolError('band_exceeded',
          `band_percent ${percentUsed} is above the ${band.percent.high}% ceiling for "${band.label}". Injuries, age and known limits override the band downwards, never upwards.`);
      }
      if (percentUsed <= 0) {
        throw new ToolError('invalid_band_percent', `band_percent for "${name}" must be a positive percentage.`);
      }
      basis = 'calculated';
      bandLabel = band.label;
      limit = (person.body_weight_kg * percentUsed) / 100;
      // Where the band is a range and no point was chosen, the conservative
      // low end is used and the output says so.
      if (!Number.isFinite(person.band_percent) && band.percent.high > band.percent.low) {
        person = { ...person, _bandNote: `The ${band.percent.low}–${band.percent.high}% range's conservative low end was used — pass band_percent to choose inside the range.` };
      }
    } else if (Number.isFinite(person.target_load_kg) && person.target_load_kg > 0) {
      basis = 'self_declared';
      bandLabel = 'Self-declared target load';
      percentUsed = null;
      limit = person.target_load_kg;
    } else {
      throw new ToolError('no_limit_basis',
        `"${name}" needs either body_weight_kg plus a band, or a self-declared target_load_kg. Do not silently substitute an assumed body weight.`);
    }

    const nonGroup = personal + water + consumables;
    const total = nonGroup + group;
    const percentOfLimit = Math.round((total / limit) * 100);
    const overBy = total - limit;

    return {
      name,
      basis,
      band: bandLabel,
      ...(percentUsed != null ? { band_percent: percentUsed } : {}),
      ...(person._bandNote ? { band_note: person._bandNote } : {}),
      ...(Number.isFinite(person.body_weight_kg) ? { body_weight_kg: person.body_weight_kg } : {}),
      limit_kg: round1(limit),
      personal_kg: round1(personal),
      water_kg: round1(water),
      consumables_kg: round1(consumables),
      group_kg: round1(group),
      total_kg: round1(total),
      percent_of_limit: percentOfLimit,
      ...(overBy > 0
        ? { over_by_kg: round1(overBy) }
        : { headroom_kg: round1(-overBy) }),
      // The binding-constraint finding: over before a gram of group mass is
      // added means no rebalance of group gear can fix it.
      ...(nonGroup > limit
        ? { binding_constraint: `${name}'s limit is ${round1(limit)} kg and their personal kit, water and consumables come to ${round1(nonGroup)} kg — over before a gram of group mass is added. No rebalance of group gear can fix that.` }
        : {}),
      ...(overBy <= 0 && percentOfLimit > HEADROOM_PERCENT
        ? { headroom_warning: `Starting at ${percentOfLimit}% of the limit. Nobody should start above about 90–95% of their band — one forgotten item consumes this slack.` }
        : {}),
    };
  });

  const duplicates = people.map((p) => p.name).filter((n, i, all) => all.indexOf(n) !== i);
  if (duplicates.length) {
    throw new ToolError('duplicate_names', `Roster names must be unique: ${[...new Set(duplicates)].join(', ')}.`);
  }

  const totalAllowance = round1(people.reduce((sum, p) => sum + p.limit_kg, 0));
  const totalLoad = round1(people.reduce((sum, p) => sum + p.total_kg, 0));
  const overloaded = people.filter((p) => p.over_by_kg != null);
  const anyConsumables = people.some((p) => p.consumables_kg > 0);
  const anySelfDeclared = people.some((p) => p.basis === 'self_declared');

  return {
    people,
    summary: {
      total_allowance_kg: totalAllowance,
      total_load_kg: totalLoad,
      fits_in_aggregate: totalLoad <= totalAllowance,
      fits_as_split: overloaded.length === 0,
      ...(overloaded.length && totalLoad <= totalAllowance
        ? { finding: 'The load fits in aggregate and does not fit as split. That is the normal result, and the reason the ledger exists — rebalance before cutting scope.' }
        : {}),
      ...(totalLoad > totalAllowance
        ? { finding: `Total load ${totalLoad} kg exceeds the sum of the bands (${totalAllowance} kg). ${NEVER_RULE}` }
        : {}),
      over_band: overloaded.map((p) => p.name),
    },
    ...(overloaded.length
      ? {
          rebalance: {
            order: REBALANCE_ORDER,
            note: 'Move group mass towards the strongest carriers in this order, then check every band again. If someone is still over, cut scope: fewer nights, a resupply, a cached drop, a lighter shelter, a shorter menu.',
            never: NEVER_RULE,
            ...(anyConsumables ? { burn_down: BURN_DOWN_NOTE } : {}),
          },
        }
      : {}),
    caveats: [
      BANDS_CAVEAT,
      'Every mass here was supplied, not measured. A stated tent weight is a manufacturer figure, and real packed weight runs 5–10% over once stuff sacks, pegs and mud are counted.',
      ...(anySelfDeclared
        ? ['At least one limit is a self-declared target load, not a calculated band — the load guidance for that person is self-declared, not calculated.']
        : []),
    ],
  };
}
