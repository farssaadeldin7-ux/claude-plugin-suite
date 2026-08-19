# Cost splitting

## Decide the model per expense, not per trip

Groups argue about money because they picked one model for everything. Fuel for the
drive and a permit for one climber are not the same kind of cost.

| Model | Use it when | Typical expenses |
| --- | --- | --- |
| **Even** | Everyone benefits equally regardless of how long they stayed | Vehicle fuel, tolls, ferry, group repair kit, permits held by the group |
| **Weighted by nights or person-days** | Consumption tracks time on the trip | Campsite and hut fees, group food, gas, hire of shared kit |
| **Itemised** | The cost exists because of specific people | One person's rescue insurance, a hired ice axe, a single vegan resupply, a private room |

Two rules that prevent almost every post-trip argument:

1. **Agree the models before the trip**, in writing, including what happens if someone
   drops out. Retro-fitting a model to a ledger always looks like someone gaining.
2. **Decide up front how private gear is treated.** Either price it at an agreed
   per-trip hire figure and put it in the ledger, or exclude it entirely and say so.
   The failure mode is the person whose tent, car and stove got used deciding
   afterwards that they were owed something.

Non-cash contributions — driving, cooking, carrying more — are real and are not money.
Do not convert them into currency unless the group asked for that. Note them.

## Building the ledger

For each expense record: payer, amount, currency, model, and who it applies to.

Then for each person:

```
owed_i    = sum over expenses of that person's share under that expense's model
balance_i = paid_i - owed_i
```

**Check that the balances sum to zero before going any further.** If they do not, an
expense has no payer, a share list is wrong, or something was double-counted. A ledger
that does not sum to zero is a bug, not a rounding issue.

Rounding: work in the smallest currency unit, round shares down, and give the leftover
pennies to the largest creditor. Never round in a way that changes the zero-sum.

## The settle-up algorithm

Positive balance means the person is owed; negative means they owe.

1. Split the group into **disjoint zero-sum subgroups** if any exist — a pair or trio
   whose balances cancel exactly. Settle each independently.
2. Within each subgroup, sort creditors descending and debtors descending by absolute
   value.
3. Transfer `min(largest creditor, largest debtor)` from that debtor to that creditor.
4. Whichever side reaches zero drops out; the other keeps its remainder.
5. Repeat until every balance is zero.

This produces at most **n − 1** transfers for a subgroup of n people, and one fewer for
every exact zero-sum subgroup you found in step 1.

**The honest limit:** this greedy method is not provably minimal. Finding the true
minimum number of transfers requires discovering every zero-sum subset, which is a
partition problem and NP-hard in general. For a trip-sized group the greedy result is
optimal or within one transfer of it, and step 1 catches the common cases. Do not
describe the output as "the minimum" — describe it as "settles in three transfers".

Practical constraints beat theoretical minimality anyway. If two people share a bank
account, or one person only uses cash, or somebody is settling in a different currency,
fix those first and re-run.

## Worked example: four people, three days

C drove out with the group but left after one night.

| # | Expense | Amount | Payer | Model |
| --- | --- | --- | --- | --- |
| 1 | Diesel and tolls | £132.00 | A | Even — all four travelled |
| 2 | Campsite | £96.00 | B | By nights (A 3, B 3, C 1, D 3 = 10 person-nights) |
| 3 | Group food | £108.00 | C | By person-days on the hill (10) |
| 4 | Gas and permits | £24.00 | D | Even |

Per-unit rates: expense 1 = £33.00 each; expense 2 = £9.60 per person-night;
expense 3 = £10.80 per person-day; expense 4 = £6.00 each.

**Owed**

| Person | Ex 1 | Ex 2 | Ex 3 | Ex 4 | Owed | Paid | Balance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 33.00 | 28.80 | 32.40 | 6.00 | 100.20 | 132.00 | **+31.80** |
| B | 33.00 | 28.80 | 32.40 | 6.00 | 100.20 | 96.00 | **−4.20** |
| C | 33.00 | 9.60 | 10.80 | 6.00 | 59.40 | 108.00 | **+48.60** |
| D | 33.00 | 28.80 | 32.40 | 6.00 | 100.20 | 24.00 | **−76.20** |

Totals: owed £360.00, paid £360.00, balances sum to £0.00. The ledger is valid.

**Settle**

No proper subset cancels exactly (check: −4.20 against +31.80 and +48.60, −76.20
against each and against their sum of £80.40 — none match), so this is one subgroup of
four and the floor is three transfers.

| Step | Transfer | Remaining |
| --- | --- | --- |
| 1 | D → C £48.60 | C settled; D still owes £27.60 |
| 2 | D → A £27.60 | D settled; A still owed £4.20 |
| 3 | B → A £4.20 | All balances zero |

**Three transfers.** Note what an even split would have done to C: £90.00 owed against
£59.40, so C would have subsidised two nights they were not there for by £30.60. That
is the argument this table prevents.

## Presenting it

- Show the balance table and the transfer list, nothing else, unless asked.
- State the model against every expense line. People accept a number when they can see
  the rule that produced it.
- Give the total each person spent and the total each person is settling — they are
  different numbers and confusing them is the second most common argument.
- If an expense is disputed, leave it out of the settlement and flag it separately
  rather than averaging over a disagreement.
