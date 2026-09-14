#!/usr/bin/env node
/**
 * Regression tests for lib/costs.js.
 *
 * The core case is the worked example printed verbatim in
 * references/cost-splitting.md ("four people, three days") — its balance
 * table and three-transfer settle-up were hand-verified against the same
 * doc's own stated formulas (owed_i = sum of shares, balance_i = paid_i -
 * owed_i, settle by repeatedly transferring min(largest creditor, largest
 * debtor)) before being encoded here, so this checks the code against an
 * independently-computed reference, not the code's own math reflected back.
 *
 *   node plugins/basecamp-split/mcp/test/costs.test.mjs
 */
import assert from 'node:assert/strict';
import { buildLedger, settleCosts } from '../lib/costs.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- the worked example from references/cost-splitting.md -----------------
  const people = ['A', 'B', 'C', 'D'];
  const expenses = [
    { label: 'Diesel and tolls', amount: 132.00, payer: 'A', model: 'even' },
    { label: 'Campsite', amount: 96.00, payer: 'B', model: 'weighted', weights: { A: 3, B: 3, C: 1, D: 3 } },
    { label: 'Group food', amount: 108.00, payer: 'C', model: 'weighted', weights: { A: 3, B: 3, C: 1, D: 3 } },
    { label: 'Gas and permits', amount: 24.00, payer: 'D', model: 'even' },
  ];

  {
    const ledger = buildLedger(people, expenses);

    // Owed, per the doc's table: A/B/D 100.20 each, C 59.40.
    assert.equal(ledger.owed.A, 10020);
    assert.equal(ledger.owed.B, 10020);
    assert.equal(ledger.owed.C, 5940);
    assert.equal(ledger.owed.D, 10020);

    // Paid: whoever fronted each expense.
    assert.equal(ledger.paid.A, 13200);
    assert.equal(ledger.paid.B, 9600);
    assert.equal(ledger.paid.C, 10800);
    assert.equal(ledger.paid.D, 2400);

    // Balance = paid - owed, exactly the doc's table: +31.80, -4.20, +48.60, -76.20.
    assert.equal(ledger.balance.A, 3180);
    assert.equal(ledger.balance.B, -420);
    assert.equal(ledger.balance.C, 4860);
    assert.equal(ledger.balance.D, -7620);
    assert.equal(ledger.balance.A + ledger.balance.B + ledger.balance.C + ledger.balance.D, 0,
      'balances must sum to exactly zero before anything is settled');
  }
  ok('buildLedger reproduces the worked example\'s owed/paid/balance table in references/cost-splitting.md exactly, for both the weighted and even models');

  {
    const settlement = settleCosts(people, expenses);
    const byName = Object.fromEntries(settlement.balances.map((b) => [b.name, b]));
    assert.equal(byName.A.balance, 31.80);
    assert.equal(byName.B.balance, -4.20);
    assert.equal(byName.C.balance, 48.60);
    assert.equal(byName.D.balance, -76.20);

    // No proper subset of {31.80, -4.20, 48.60, -76.20} cancels exactly (hand-
    // checked: every pair and trio sum was confirmed non-zero against the
    // doc's own claim "no proper subset cancels exactly"), so this settles as
    // one group of four in the doc's exact three transfers and exact order.
    assert.equal(settlement.transfers.length, 3);
    assert.deepEqual(settlement.transfers, [
      { from: 'D', to: 'C', amount: 48.60 },
      { from: 'D', to: 'A', amount: 27.60 },
      { from: 'B', to: 'A', amount: 4.20 },
    ]);
    assert.equal(settlement.settles_in, '3 transfers');
    assert.match(settlement.floor_note, /the floor for this group is 3 transfers/);
  }
  ok('settleCosts reproduces the worked example\'s exact three-transfer settle-up (D to C 48.60, D to A 27.60, B to A 4.20) in the doc\'s own order');

  // ---- rounding: shares round down, the leftover goes to the largest creditor ----
  // 10.00 split three ways under "even" floors to 3.33 each with a 1-cent
  // leftover; hand-verified: floor(1000/3)=333 (x3=999), leftover 1 cent goes
  // to A (the payer and largest creditor at 6.67 before the adjustment).
  {
    const ledger = buildLedger(['A', 'B', 'C'], [
      { label: 'Split three ways', amount: 10.00, payer: 'A', model: 'even' },
    ]);
    assert.equal(ledger.owed.A, 334, 'A receives the leftover cent on top of their own 333 share');
    assert.equal(ledger.owed.B, 333);
    assert.equal(ledger.owed.C, 333);
    assert.equal(ledger.balance.A, 666);
    assert.equal(ledger.balance.B, -333);
    assert.equal(ledger.balance.C, -333);
    assert.equal(ledger.balance.A + ledger.balance.B + ledger.balance.C, 0, 'the leftover cent must never break the zero-sum');
  }
  ok('a three-way even split that does not divide evenly rounds every share down and gives the leftover penny to the largest creditor, without breaking the zero-sum');

  // ---- disjoint zero-sum subgroups settle independently and save a transfer ----
  // Two fully independent zero-sum pairs (A owes B nothing, in fact A is owed
  // by B; C is owed by D) built via itemised expenses for exact control:
  // balances end up +100/-100/+50/-50, and the doc's algorithm (step 1) must
  // find both pairs before falling back to the n-1 floor for the whole group.
  {
    const settlement = settleCosts(['A', 'B', 'C', 'D'], [
      { label: 'A covers B', amount: 100.00, payer: 'A', model: 'itemised', shares: { B: 100.00 } },
      { label: 'C covers D', amount: 50.00, payer: 'C', model: 'itemised', shares: { D: 50.00 } },
    ]);
    assert.equal(settlement.transfers.length, 2, 'two independent zero-sum pairs must settle in 2 transfers, not the naive n-1=3 floor for a group of four');
    assert.deepEqual(settlement.transfers, [
      { from: 'B', to: 'A', amount: 100.00 },
      { from: 'D', to: 'C', amount: 50.00 },
    ]);
    assert.equal(settlement.settles_in, '2 transfers');
    assert.match(settlement.floor_note, /2 zero-sum subgroups settle independently/);
  }
  ok('settleCosts finds disjoint zero-sum subgroups and settles each independently, beating the plain n-1 transfer floor for the whole group');

  // ---- itemised shares must sum exactly to the expense amount ---------------
  {
    assert.throws(
      () => buildLedger(['A', 'B'], [{ label: 'Room', amount: 50.00, payer: 'A', model: 'itemised', shares: { B: 49.99 } }]),
      (err) => err instanceof ToolError && err.code === 'ledger_mismatch',
      'itemised shares one cent short of the amount must be rejected, not silently absorbed'
    );
    assert.doesNotThrow(
      () => buildLedger(['A', 'B'], [{ label: 'Room', amount: 50.00, payer: 'A', model: 'itemised', shares: { B: 50.00 } }]),
      'itemised shares that sum exactly to the amount must be accepted'
    );
  }
  ok('an itemised expense whose shares do not sum exactly to its amount is rejected as a ledger_mismatch, even a single cent short');

  // ---- unknown model, including an inherited-property name ------------------
  {
    assert.throws(
      () => buildLedger(['A', 'B'], [{ label: 'X', amount: 10, payer: 'A', model: 'constructor' }]),
      (err) => err instanceof ToolError && err.code === 'unknown_model',
      '"constructor" must be rejected as an unknown split model, not resolve Object.prototype.constructor'
    );
  }
  ok('buildLedger rejects an inherited-property name ("constructor") as an unknown split model rather than silently resolving it');

  // ---- structural rejects: too few people, non-positive amounts, unknown people ----
  {
    assert.throws(() => buildLedger(['A'], [{ amount: 10, payer: 'A', model: 'even' }]),
      (err) => err instanceof ToolError && err.code === 'invalid_people',
      'a single-person group must be rejected — there is nobody to split with');
    assert.doesNotThrow(() => buildLedger(['A', 'B'], [{ amount: 10, payer: 'A', model: 'even' }]),
      'exactly two people is the minimum valid group');
    assert.throws(() => buildLedger(['A', 'B'], [{ amount: 0, payer: 'A', model: 'even' }]),
      (err) => err instanceof ToolError && err.code === 'invalid_amount',
      'an amount of exactly 0 must be rejected');
    assert.throws(() => buildLedger(['A', 'B'], [{ amount: 10, payer: 'Zed', model: 'even' }]),
      (err) => err instanceof ToolError && err.code === 'unknown_person');
    assert.throws(() => buildLedger(['A', 'B', 'A'], [{ amount: 10, payer: 'A', model: 'even' }]),
      (err) => err instanceof ToolError && err.code === 'invalid_people',
      'duplicate names must be rejected');
  }
  ok('buildLedger rejects fewer than two people, a non-positive expense amount, an unrecognised payer, and duplicate names');

  // ---- a disputed expense is excluded from settlement and flagged separately ----
  {
    const settlement = settleCosts(['A', 'B'], [
      { label: 'Fuel', amount: 20.00, payer: 'A', model: 'even' },
      { label: 'Contested hire fee', amount: 40.00, payer: 'B', model: 'even', disputed: true },
    ]);
    assert.equal(settlement.expenses.length, 1, 'the disputed expense must not appear among the settled lines');
    assert.equal(settlement.disputed.length, 1);
    assert.equal(settlement.disputed[0].label, 'Contested hire fee');

    assert.throws(
      () => settleCosts(['A', 'B'], [{ label: 'All contested', amount: 20.00, payer: 'A', model: 'even', disputed: true }]),
      (err) => err instanceof ToolError && err.code === 'nothing_to_settle',
      'if every expense is disputed there is nothing left to settle'
    );
  }
  ok('a disputed expense is left out of the ledger and settlement and reported separately, and an all-disputed expense list is rejected as nothing_to_settle');

  console.log(`\n${passed} costs.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
