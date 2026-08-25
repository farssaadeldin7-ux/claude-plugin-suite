import { ToolError } from '../mcp-lite.js';

/**
 * The cost ledger and settle-up, ported from references/cost-splitting.md.
 * All arithmetic is in integer minor units (pennies, cents): shares round
 * down, the leftover goes to the largest creditor, and the balances must sum
 * to exactly zero before anything is settled. The greedy settle-up is not
 * provably minimal and the output never claims it is.
 */

export const SPLIT_MODELS = {
  even: {
    label: 'Even',
    use_when: 'Everyone benefits equally regardless of how long they stayed',
    typical_expenses: 'Vehicle fuel, tolls, ferry, group repair kit, permits held by the group',
  },
  weighted: {
    label: 'Weighted by nights or person-days',
    use_when: 'Consumption tracks time on the trip',
    typical_expenses: 'Campsite and hut fees, group food, gas, hire of shared kit',
  },
  itemised: {
    label: 'Itemised',
    use_when: 'The cost exists because of specific people',
    typical_expenses: 'One person\'s rescue insurance, a hired ice axe, a single vegan resupply, a private room',
  },
};

export const MODEL_RULES = [
  'Decide the model per expense, not per trip. Fuel for the drive and a permit for one climber are not the same kind of cost.',
  'Agree the models before the trip, in writing, including what happens if someone drops out. Retro-fitting a model to a ledger always looks like someone gaining.',
  'Decide up front how private gear is treated: either price it at an agreed per-trip hire figure and put it in the ledger, or exclude it entirely and say so.',
  'Non-cash contributions — driving, cooking, carrying more — are real and are not money. Do not convert them into currency unless the group asked for that. Note them.',
];

const toMinor = (amount, context) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ToolError('invalid_amount', `${context} must be a positive number.`);
  }
  return Math.round(amount * 100);
};

const toMajor = (minor) => Number((minor / 100).toFixed(2));

/**
 * Build the ledger: per-expense shares under each expense's own model, then
 * balance = paid − owed per person, with an exact zero-sum check.
 */
export function buildLedger(people, expenses) {
  if (!Array.isArray(people) || people.length < 2) {
    throw new ToolError('invalid_people', 'people must list at least two names.');
  }
  const names = people.map((n) => String(n).trim());
  if (names.some((n) => !n)) throw new ToolError('invalid_people', 'Every person needs a name.');
  if (new Set(names).size !== names.length) throw new ToolError('invalid_people', 'Names must be unique.');
  if (!Array.isArray(expenses) || !expenses.length) {
    throw new ToolError('invalid_expenses', 'expenses must be a non-empty array.');
  }

  const requireKnown = (name, context) => {
    if (!names.includes(name)) {
      throw new ToolError('unknown_person', `${context} names "${name}", who is not in the people list.`);
    }
    return name;
  };

  const paid = Object.fromEntries(names.map((n) => [n, 0]));
  const owed = Object.fromEntries(names.map((n) => [n, 0]));
  let leftoverMinor = 0;
  const lines = [];
  const disputed = [];

  expenses.forEach((expense, index) => {
    const label = expense.label || `expense ${index + 1}`;
    if (expense.disputed) {
      // A disputed expense is left out of the settlement and flagged, rather
      // than averaged over a disagreement.
      disputed.push({ label, amount: expense.amount ?? null, payer: expense.payer ?? null });
      return;
    }
    const amountMinor = toMinor(expense.amount, `Amount for "${label}"`);
    const payer = requireKnown(String(expense.payer ?? '').trim(), `"${label}"`);
    const model = expense.model;
    if (!SPLIT_MODELS[model]) {
      throw new ToolError('unknown_model', `"${label}" has model "${model}".`, { available: Object.keys(SPLIT_MODELS) });
    }

    const shares = Object.fromEntries(names.map((n) => [n, 0]));

    if (model === 'even') {
      const participants = (expense.applies_to ?? names).map((n) => requireKnown(String(n).trim(), `"${label}" applies_to`));
      if (!participants.length) throw new ToolError('invalid_expense', `"${label}" applies to nobody.`);
      const share = Math.floor(amountMinor / participants.length);
      for (const n of participants) shares[n] = share;
      leftoverMinor += amountMinor - share * participants.length;
    } else if (model === 'weighted') {
      const weights = expense.weights;
      if (!weights || typeof weights !== 'object' || !Object.keys(weights).length) {
        throw new ToolError('invalid_expense', `"${label}" is weighted but has no weights — pass nights or person-days per person.`);
      }
      let totalWeight = 0;
      for (const [n, w] of Object.entries(weights)) {
        requireKnown(n, `"${label}" weights`);
        if (!Number.isFinite(w) || w < 0) throw new ToolError('invalid_expense', `Weight for "${n}" on "${label}" must be a non-negative number.`);
        totalWeight += w;
      }
      if (totalWeight <= 0) throw new ToolError('invalid_expense', `"${label}" has zero total weight.`);
      let allocated = 0;
      for (const [n, w] of Object.entries(weights)) {
        const share = Math.floor((amountMinor * w) / totalWeight);
        shares[n] = share;
        allocated += share;
      }
      leftoverMinor += amountMinor - allocated;
    } else {
      const itemShares = expense.shares;
      if (!itemShares || typeof itemShares !== 'object' || !Object.keys(itemShares).length) {
        throw new ToolError('invalid_expense', `"${label}" is itemised but has no shares — pass the amount each person is responsible for.`);
      }
      let allocated = 0;
      for (const [n, amount] of Object.entries(itemShares)) {
        requireKnown(n, `"${label}" shares`);
        const share = toMinor(amount, `Share for "${n}" on "${label}"`);
        shares[n] = share;
        allocated += share;
      }
      if (allocated !== amountMinor) {
        throw new ToolError('ledger_mismatch',
          `Itemised shares on "${label}" sum to ${toMajor(allocated)} against an amount of ${toMajor(amountMinor)}. A ledger that does not sum to zero is a bug, not a rounding issue.`);
      }
    }

    paid[payer] += amountMinor;
    for (const n of names) owed[n] += shares[n];
    lines.push({
      label,
      amount: toMajor(amountMinor),
      payer,
      model: SPLIT_MODELS[model].label,
      shares: Object.fromEntries(names.filter((n) => shares[n] > 0).map((n) => [n, toMajor(shares[n])])),
    });
  });

  if (!lines.length) {
    throw new ToolError('nothing_to_settle', 'Every expense is disputed — nothing can be settled until at least one is agreed.');
  }

  // Rounding rule: shares rounded down, the leftover pennies go to the
  // largest creditor, so the zero-sum is never changed by rounding.
  const balance = Object.fromEntries(names.map((n) => [n, paid[n] - owed[n]]));
  if (leftoverMinor > 0) {
    const largestCreditor = names.reduce((best, n) => (balance[n] > balance[best] ? n : best), names[0]);
    owed[largestCreditor] += leftoverMinor;
    balance[largestCreditor] -= leftoverMinor;
  }

  const sum = names.reduce((s, n) => s + balance[n], 0);
  if (sum !== 0) {
    // Unreachable by construction; kept because a ledger that does not sum to
    // zero must never be settled.
    throw new ToolError('ledger_mismatch', 'Balances do not sum to zero — an expense has no payer, a share list is wrong, or something was double-counted.');
  }

  return { names, paid, owed, balance, lines, disputed };
}

/**
 * Extract disjoint zero-sum subgroups — pairs and trios whose balances cancel
 * exactly — then settle each greedily. Each exact subgroup found saves one
 * transfer against the n − 1 floor.
 */
function extractSubgroups(entries) {
  const remaining = entries.filter((e) => e.balance !== 0);
  const subgroups = [];

  const findZeroSet = (size) => {
    const pick = (start, chosen, sum) => {
      if (chosen.length === size) return sum === 0 ? [...chosen] : null;
      for (let i = start; i < remaining.length; i++) {
        const found = pick(i + 1, [...chosen, i], sum + remaining[i].balance);
        if (found) return found;
      }
      return null;
    };
    return pick(0, [], 0);
  };

  let found;
  while (remaining.length > 2 && (found = findZeroSet(2) || findZeroSet(3))) {
    subgroups.push(found.map((i) => remaining[i]));
    for (const i of [...found].reverse()) remaining.splice(i, 1);
  }
  if (remaining.length) subgroups.push(remaining);
  return subgroups;
}

function settleSubgroup(members) {
  const creditors = members.filter((m) => m.balance > 0).map((m) => ({ ...m }));
  const debtors = members.filter((m) => m.balance < 0).map((m) => ({ ...m, balance: -m.balance }));
  const transfers = [];
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
    debtors.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
    const amount = Math.min(creditors[0].balance, debtors[0].balance);
    transfers.push({ from: debtors[0].name, to: creditors[0].name, amount: toMajor(amount) });
    creditors[0].balance -= amount;
    debtors[0].balance -= amount;
    if (creditors[0].balance === 0) creditors.shift();
    if (debtors[0]?.balance === 0) debtors.shift();
  }
  return transfers;
}

/** Build the ledger and settle it down to a transfer list. */
export function settleCosts(people, expenses) {
  const ledger = buildLedger(people, expenses);
  const entries = ledger.names.map((name) => ({ name, balance: ledger.balance[name] }));
  const subgroups = extractSubgroups(entries);
  const transfers = subgroups.flatMap((group) => settleSubgroup(group));
  const nonZero = entries.filter((e) => e.balance !== 0).length;

  return {
    expenses: ledger.lines,
    balances: ledger.names.map((name) => ({
      name,
      paid: toMajor(ledger.paid[name]),
      owed: toMajor(ledger.owed[name]),
      balance: toMajor(ledger.balance[name]),
    })),
    zero_sum_check: 'Balances sum to zero. The ledger is valid.',
    transfers,
    settles_in: `${transfers.length} transfer${transfers.length === 1 ? '' : 's'}`,
    ...(nonZero
      ? {
          floor_note: subgroups.length > 1
            ? `${subgroups.length} zero-sum subgroups settle independently, each in at most one fewer transfer than its size.`
            : `No proper subset cancels exactly, so the floor for this group is ${nonZero - 1} transfers.`,
        }
      : {}),
    ...(ledger.disputed.length
      ? {
          disputed: ledger.disputed,
          disputed_note: 'These expenses were left out of the settlement and flagged, rather than averaged over a disagreement. Re-run once they are agreed.',
        }
      : {}),
    honest_limit:
      'The greedy method is not provably minimal — the true minimum is a partition problem and NP-hard in general. For a trip-sized group this result is optimal or within one transfer of it. Describe it as what it is: it settles in this many transfers.',
    practical_note:
      'Practical constraints beat theoretical minimality. If two people share a bank account, one person only uses cash, or somebody settles in a different currency, fix those first and re-run.',
    presentation_note:
      'The total each person spent and the total each person is settling are different numbers — confusing them is the second most common argument.',
  };
}
