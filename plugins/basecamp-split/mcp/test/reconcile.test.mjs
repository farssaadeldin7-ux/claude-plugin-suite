#!/usr/bin/env node
/**
 * Regression tests for lib/reconcile.js.
 *
 * reconcilePlan is the only export (the four per-ledger checks it runs —
 * gear, systems, loads, costs — are private), so every check here goes
 * through the public function and inspects its `failures`/`passed`/
 * `not_checked`/`finished` shape. The reference doc has no numeric worked
 * example for this file (it is a mechanical pass/fail check on names, tags
 * and sums, not arithmetic), so coverage here is built from SKILL.md step 8's
 * stated rules and the boundary values in the code's own comparisons.
 *
 *   node plugins/basecamp-split/mcp/test/reconcile.test.mjs
 */
import assert from 'node:assert/strict';
import { reconcilePlan } from '../lib/reconcile.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// A fully valid seven-systems table: every one of the 7 ids from
// gear.js's SPOF_SYSTEMS, each with an owner, a backup, and a backup_owner
// different from the owner — the rule stated in gear-taxonomy.md ("named
// owner and a stated backup owned by a different person").
const validSystems = () => ({
  shelter: { owner: 'A', backup: 'Tarp', backup_owner: 'B' },
  water_treatment: { owner: 'A', backup: 'Tablets', backup_owner: 'B' },
  fire_stove: { owner: 'B', backup: 'Second stove', backup_owner: 'C' },
  navigation: { owner: 'C', backup: 'GPS', backup_owner: 'D' },
  first_aid: { owner: 'D', backup: 'Trained second', backup_owner: 'A' },
  communications: { owner: 'A', backup: 'Phone', backup_owner: 'B' },
  repair: { owner: 'B', backup: 'Second multitool', backup_owner: 'C' },
});

try {
  // ---- checkGear: SHARED boundary (1 instance passes, 2 fails) -------------
  {
    const oneInstance = reconcilePlan({ gear: [{ item: 'Tent', tag: 'SHARED', carrier: 'A' }] });
    assert.deepEqual(oneInstance.failures, undefined, 'a single SHARED instance is exactly the rule and must not fail');
    assert.deepEqual(oneInstance.passed, ['gear_ledger']);

    const twoInstances = reconcilePlan({
      gear: [
        { item: 'Tent', tag: 'SHARED', carrier: 'A' },
        { item: 'Tent', tag: 'SHARED', carrier: 'B' },
      ],
    });
    assert.match(twoInstances.failures.gear_ledger[0], /is SHARED with 2 instances/);
  }
  ok('checkGear (via reconcilePlan) accepts exactly one SHARED instance and flags a second one, matching the "exactly one carrier" rule');

  // ---- checkGear: REDUNDANT-SHARED boundary (needs >= 2, in different packs) ----
  {
    const oneInstance = reconcilePlan({ gear: [{ item: 'Filter', tag: 'REDUNDANT-SHARED', carrier: 'A' }] });
    assert.match(oneInstance.failures.gear_ledger[0], /only one instance/);

    const samePack = reconcilePlan({
      gear: [
        { item: 'Filter', tag: 'REDUNDANT-SHARED', carrier: 'A' },
        { item: 'Filter', tag: 'REDUNDANT-SHARED', carrier: 'A' },
      ],
    });
    assert.match(samePack.failures.gear_ledger[0], /not in different people's packs/);

    const differentPacks = reconcilePlan({
      gear: [
        { item: 'Filter', tag: 'REDUNDANT-SHARED', carrier: 'A' },
        { item: 'Filter', tag: 'REDUNDANT-SHARED', carrier: 'B' },
      ],
    });
    assert.equal(differentPacks.failures, undefined, 'two REDUNDANT-SHARED instances in two different packs is exactly the rule and must pass');
  }
  ok('checkGear requires at least two REDUNDANT-SHARED instances in different people\'s packs, rejecting one instance and two instances in the same pack');

  // ---- checkGear: an inherited-property tag name must not slip through -----
  {
    const result = reconcilePlan({ gear: [{ item: 'Mystery', tag: 'constructor', carrier: 'A' }] });
    assert.match(result.failures.gear_ledger[0], /unknown tag "constructor"/,
      '"constructor" must be rejected as an unknown tag, not resolve Object.prototype.constructor');
  }
  ok('checkGear rejects an inherited-property name ("constructor") as an unknown gear tag rather than silently resolving it');

  // ---- checkGear: SHARED/REDUNDANT-SHARED need a named carrier, PERSONAL does not ----
  {
    const noCarrier = reconcilePlan({ gear: [{ item: 'Stove', tag: 'SHARED' }] });
    assert.match(noCarrier.failures.gear_ledger[0], /has no named carrier/);
    const personalNoCarrier = reconcilePlan({ gear: [{ item: 'Boots', tag: 'PERSONAL' }] });
    assert.equal(personalNoCarrier.failures, undefined, 'a PERSONAL line needs no named carrier — it belongs to whoever\'s line it is');
  }
  ok('checkGear requires a named carrier for SHARED and REDUNDANT-SHARED lines but not for PERSONAL ones');

  // ---- checkSystems: all seven systems required, and owner != backup_owner ----
  {
    const complete = reconcilePlan({ systems: validSystems() });
    assert.equal(complete.failures, undefined, 'a fully valid seven-systems table must pass');

    const missingOne = reconcilePlan({ systems: { ...validSystems(), repair: undefined } });
    assert.match(missingOne.failures.seven_systems[0], /no entry at all/);

    const sameOwner = reconcilePlan({ systems: { ...validSystems(), shelter: { owner: 'A', backup: 'Tarp', backup_owner: 'A' } } });
    assert.match(sameOwner.failures.seven_systems[0], /both with A/,
      'primary and backup owned by the same person must fail even though every field is filled in');

    assert.throws(
      () => reconcilePlan({ systems: { ...validSystems(), campfire: { owner: 'A', backup: 'x', backup_owner: 'B' } } }),
      (err) => err instanceof ToolError && err.code === 'unknown_system',
      'an id outside the canonical seven systems must be rejected, not silently accepted as an eighth system'
    );
  }
  ok('checkSystems requires all seven canonical systems, fails when primary and backup share an owner, and rejects an unknown system id');

  // ---- checkLoads: load_kg > limit_kg boundary is exclusive of equality ----
  {
    const atLimit = reconcilePlan({ loads: [{ name: 'D', load_kg: 8.7, limit_kg: 8.7 }] });
    assert.equal(atLimit.failures, undefined, 'a load exactly at the limit is not over it — the check is strictly `>`');

    const overLimit = reconcilePlan({ loads: [{ name: 'D', load_kg: 12.5, limit_kg: 10 }] });
    assert.match(overLimit.failures.weight_ledger[0], /is 2\.5 kg over their band/);

    const missingFigures = reconcilePlan({ loads: [{ name: 'E' }] });
    assert.match(missingFigures.failures.weight_ledger[0], /both required/);
  }
  ok('checkLoads treats a load exactly at the limit as within band (strict `>`, not `>=`), reports the correct over-by-kg for a real overage, and flags missing figures');

  // ---- checkCosts: the zero-sum tolerance boundary is inclusive at 0.005 ---
  {
    const justUnder = reconcilePlan({ costs: { balances: { A: 0.00499, B: -0.00499 } } });
    assert.equal(justUnder.failures, undefined, 'a combined rounding slip just under the 0.005 tolerance must not fail');

    const atTolerance = reconcilePlan({ costs: { balances: { A: 0.005, B: 0 } } });
    assert.match(atTolerance.failures.cost_ledger[0], /Balances sum to/,
      'a sum exactly at the 0.005 tolerance must fail — the check is `>=`, not `>`');

    const noBalances = reconcilePlan({ costs: {} });
    assert.match(noBalances.failures.cost_ledger[0], /No balance table supplied/);

    const missingFields = reconcilePlan({ costs: { balances: { A: 0, B: 0 }, expenses: [{ label: 'Fuel' }] } });
    assert.equal(missingFields.failures.cost_ledger.length, 2, '"Fuel" is missing both a payer and a model — each must be flagged separately');
  }
  ok('checkCosts treats the 0.005 zero-sum tolerance as inclusive of failure at the boundary, and flags missing balances and missing payer/model separately');

  // ---- reconcilePlan combines all four checks and reports what was not run ----
  {
    const partial = reconcilePlan({ gear: [{ item: 'Boots', tag: 'PERSONAL' }] });
    assert.equal(partial.finished, false, 'a plan is not finished while three of the four ledgers were never supplied');
    assert.deepEqual(partial.passed, ['gear_ledger']);
    assert.deepEqual(partial.not_checked.checks, ['seven_systems', 'weight_ledger', 'cost_ledger']);

    const everything = reconcilePlan({
      gear: [{ item: 'Boots', tag: 'PERSONAL' }],
      systems: validSystems(),
      loads: [{ name: 'D', load_kg: 8.0, limit_kg: 8.7 }],
      costs: { balances: { A: 0, B: 0 }, expenses: [{ label: 'Fuel', payer: 'A', model: 'even' }] },
    });
    assert.equal(everything.finished, true, 'all four ledgers supplied and passing must report finished');
    assert.equal(everything.failures, undefined);
    assert.equal(everything.not_checked, undefined);

    assert.throws(
      () => reconcilePlan({}),
      (err) => err instanceof ToolError && err.code === 'nothing_to_check',
      'no ledgers supplied at all must be rejected rather than reporting a vacuous pass'
    );
  }
  ok('reconcilePlan reports not_checked for omitted ledgers, only reports finished when all four are supplied and pass, and rejects an entirely empty call');

  // ---- the two always-required safety items: declined is recorded, not dropped ----
  {
    const result = reconcilePlan({
      gear: [{ item: 'Boots', tag: 'PERSONAL' }],
      emergency_communications: 'Declined',
      route_plan_left_with: 'Left with Sam, back by Sunday 6pm',
    });
    assert.equal(result.always_required.emergency_communications.status, 'declined',
      '"Declined" must be recorded as declined (case-insensitively), never silently dropped from the output');
    assert.equal(result.always_required.route_plan_left_with.status, 'recorded');
    assert.equal(result.always_required.route_plan_left_with.detail, 'Left with Sam, back by Sunday 6pm');

    const nothingSaid = reconcilePlan({ gear: [{ item: 'Boots', tag: 'PERSONAL' }] });
    assert.equal(nothingSaid.always_required.emergency_communications.status, 'not recorded');
  }
  ok('the two always-required safety items are recorded as declined (case-insensitively) rather than dropped, and reported as not recorded when never mentioned');

  console.log(`\n${passed} reconcile.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
