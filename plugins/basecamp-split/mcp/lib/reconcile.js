import { ToolError } from '../mcp-lite.js';
import { SPOF_SYSTEMS, TAGS } from './gear.js';

/**
 * The reconciliation from SKILL.md step 8: the plan is done when all four
 * checks pass, and the output states which failed, failures first. These are
 * mechanical checks on names, tags, packs and sums — whether a backup is any
 * good, or a plan is wise, is the skill's judgement and is not checked here.
 */

const SYSTEM_IDS = Object.keys(SPOF_SYSTEMS);

const name = (value) => String(value ?? '').trim();

/** Check 1: every SHARED instance one named carrier; REDUNDANT-SHARED at
 *  least two instances in different people's packs. */
function checkGear(gear) {
  if (!Array.isArray(gear)) return null;
  const failures = [];
  const byItem = new Map();

  gear.forEach((line, index) => {
    const item = name(line.item) || `line ${index + 1}`;
    const tag = line.tag;
    if (!TAGS[tag]) {
      failures.push(`"${item}" has ${tag ? `unknown tag "${tag}"` : 'no tag'}. A line with no tag is the line that gets forgotten or doubled.`);
      return;
    }
    if (tag !== 'PERSONAL' && !name(line.carrier)) {
      failures.push(`"${item}" (${tag}) has no named carrier. An item owned by "the group" is an item nobody packs.`);
    }
    if (!byItem.has(item)) byItem.set(item, []);
    byItem.get(item).push({ tag, carrier: name(line.carrier) });
  });

  for (const [item, instances] of byItem) {
    const tags = new Set(instances.map((i) => i.tag));
    if (tags.size > 1) {
      failures.push(`"${item}" appears with more than one tag (${[...tags].join(', ')}) — tag each item one way.`);
      continue;
    }
    const [tag] = tags;
    if (tag === 'SHARED' && instances.length > 1) {
      failures.push(`"${item}" is SHARED with ${instances.length} instances. A second instance is dead weight unless justified — retag it REDUNDANT-SHARED in another pack, or delete it and tell the owner before they pack it.`);
    }
    if (tag === 'REDUNDANT-SHARED') {
      const carriers = new Set(instances.map((i) => i.carrier).filter(Boolean));
      if (instances.length < 2) {
        failures.push(`"${item}" is REDUNDANT-SHARED with only one instance. The duplication is the backup — it needs a minimum of two, in different packs.`);
      } else if (carriers.size < 2) {
        failures.push(`"${item}" is REDUNDANT-SHARED but its instances are not in different people's packs.`);
      }
    }
  }
  return failures;
}

/** Check 2: each of the seven systems has an owner and a backup, and the
 *  backup is owned by a different person. */
function checkSystems(systems) {
  if (!systems || typeof systems !== 'object') return null;
  const failures = [];
  for (const id of SYSTEM_IDS) {
    const label = SPOF_SYSTEMS[id].label;
    const entry = systems[id];
    if (!entry) {
      failures.push(`${label}: no entry at all. A blank in this table is a blocker, not a footnote.`);
      continue;
    }
    const owner = name(entry.owner);
    const backupOwner = name(entry.backup_owner);
    if (!owner) failures.push(`${label}: no named owner.`);
    if (!name(entry.backup)) failures.push(`${label}: no stated backup. Acceptable: ${SPOF_SYSTEMS[id].acceptable_backup}. Not a backup: ${SPOF_SYSTEMS[id].not_a_backup}.`);
    if (!backupOwner) failures.push(`${label}: the backup has no named owner.`);
    if (owner && backupOwner && owner === backupOwner) {
      failures.push(`${label}: primary and backup are both with ${owner}. Primary and backup never share a pack — if one pack goes into a river, the group should lose capability, not a system.`);
    }
  }
  const unknown = Object.keys(systems).filter((id) => !SYSTEM_IDS.includes(id));
  if (unknown.length) {
    throw new ToolError('unknown_system', `Unknown system id(s): ${unknown.join(', ')}.`, { available: SYSTEM_IDS });
  }
  return failures;
}

/** Check 3: no person exceeds their band at the heaviest point of the trip. */
function checkLoads(loads) {
  if (!Array.isArray(loads)) return null;
  const failures = [];
  for (const entry of loads) {
    const person = name(entry.name) || 'unnamed carrier';
    if (!Number.isFinite(entry.load_kg) || !Number.isFinite(entry.limit_kg)) {
      failures.push(`${person}: load_kg and limit_kg are both required to check the band.`);
      continue;
    }
    if (entry.load_kg > entry.limit_kg) {
      const over = Math.round((entry.load_kg - entry.limit_kg) * 10) / 10;
      failures.push(`${person} is ${over} kg over their band (${entry.load_kg} kg against ${entry.limit_kg} kg). An exceeded band is a design fault in the plan, not something the carrier should absorb.`);
    }
  }
  return failures;
}

/** Check 4: balances sum to zero and every expense has a payer and a model. */
function checkCosts(costs) {
  if (!costs || typeof costs !== 'object') return null;
  const failures = [];
  if (costs.balances && typeof costs.balances === 'object') {
    const sum = Object.values(costs.balances).reduce((s, b) => s + (Number(b) || 0), 0);
    if (Math.abs(sum) >= 0.005) {
      failures.push(`Balances sum to ${sum.toFixed(2)}, not zero — an expense has no payer, a share list is wrong, or something was double-counted.`);
    }
  } else {
    failures.push('No balance table supplied — run settle_costs and pass its balances.');
  }
  if (Array.isArray(costs.expenses)) {
    costs.expenses.forEach((expense, index) => {
      const label = name(expense.label) || `expense ${index + 1}`;
      if (!name(expense.payer)) failures.push(`"${label}" has no payer.`);
      if (!name(expense.model)) failures.push(`"${label}" has no split model. People accept a number when they can see the rule that produced it.`);
    });
  }
  return failures;
}

/** The two items that are always insisted on, whatever was asked (step 9).
 *  Recorded as declined rather than dropped when the user says no. */
function safetyEssentials({ emergency_communications, route_plan_left_with } = {}) {
  const state = (value, description) => {
    const v = name(value);
    if (!v) return { status: 'not recorded', required: description };
    if (v.toLowerCase() === 'declined') return { status: 'declined', note: 'Recorded as declined rather than dropped.' };
    return { status: 'recorded', detail: v };
  };
  return {
    emergency_communications: state(emergency_communications,
      'Who carries what, what it can and cannot do, whether there is coverage, and who is the named contact.'),
    route_plan_left_with: state(route_plan_left_with,
      'Route, intended camps, party list, vehicle details, expected return time, and the time at which that person should raise the alarm — left with someone not on the trip.'),
  };
}

/**
 * Run whichever of the four checks the input covers. A check with no input is
 * reported as not checked — and a plan with an unchecked ledger is not
 * finished, it is unexamined.
 */
export function reconcilePlan({ gear, systems, loads, costs, emergency_communications, route_plan_left_with }) {
  const results = {
    gear_ledger: checkGear(gear),
    seven_systems: checkSystems(systems),
    weight_ledger: checkLoads(loads),
    cost_ledger: checkCosts(costs),
  };

  const checked = Object.entries(results).filter(([, r]) => r !== null);
  if (!checked.length) {
    throw new ToolError('nothing_to_check',
      'None of the four ledgers were supplied. Pass gear, systems, loads and/or costs.');
  }

  const failed = checked.filter(([, r]) => r.length);
  const passed = checked.filter(([, r]) => !r.length).map(([check]) => check);
  const notChecked = Object.entries(results).filter(([, r]) => r === null).map(([check]) => check);

  return {
    finished: failed.length === 0 && notChecked.length === 0,
    // Failures and blanks first, before the tidy parts.
    ...(failed.length
      ? { failures: Object.fromEntries(failed.map(([check, r]) => [check, r])) }
      : {}),
    passed,
    ...(notChecked.length
      ? { not_checked: { checks: notChecked, note: 'An unchecked ledger is not a passed ledger. The plan is done when all four pass.' } }
      : {}),
    always_required: safetyEssentials({ emergency_communications, route_plan_left_with }),
    verdict: failed.length
      ? 'The plan is not finished. If you cannot name the person, say so rather than presenting a tidy-looking list with holes in it.'
      : notChecked.length
        ? 'No failures in what was checked, but the plan is done only when all four ledgers pass.'
        : 'All four checks pass. This confirms names, tags, packs and sums — not that the route, the season or the plan is wise.',
  };
}
