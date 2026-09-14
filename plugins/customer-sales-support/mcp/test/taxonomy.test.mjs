#!/usr/bin/env node
/**
 * Regression tests for lib/taxonomy.js: normaliseKind's aliasing (including
 * its documented Object.prototype pollution guard), auditTaxonomy's worked
 * examples — the plugin's own WORKED_TAXONOMIES.ecommerce/saas tables, whose
 * "Static share: 30%" and "roughly 38%" lines are hand-verified below against
 * the intent rows before being asserted — and every numeric threshold in
 * THRESHOLDS, both sides of each boundary.
 *
 *   node plugins/customer-sales-support/mcp/test/taxonomy.test.mjs
 */
import assert from 'node:assert/strict';
import { normaliseKind, auditTaxonomy, THRESHOLDS, WORKED_TAXONOMIES } from '../lib/taxonomy.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const checkNames = (result) => result.findings.map((f) => f.check);
const has = (result, check) => checkNames(result).includes(check);

try {
  // ---- normaliseKind: every documented alias, case/whitespace-insensitive ----
  {
    assert.equal(normaliseKind('static'), 'static');
    assert.equal(normaliseKind('  Static  '), 'static');
    assert.equal(normaliseKind('account'), 'account');
    assert.equal(normaliseKind('account-specific'), 'account');
    assert.equal(normaliseKind('account_specific'), 'account');
    assert.equal(normaliseKind('ACCOUNT-SPECIFIC'), 'account');
    assert.equal(normaliseKind('judgement'), 'judgement');
    assert.equal(normaliseKind('judgment'), 'judgement', 'the US spelling "judgment" must alias to "judgement"');
    assert.equal(normaliseKind('mixed'), null, 'a taxonomy row kind of "mixed" (used for the illustrative tail row) is not one of the three kinds');
    assert.equal(normaliseKind(''), null);
    assert.equal(normaliseKind(undefined), null);
    assert.equal(normaliseKind(null), null);
  }
  ok('normaliseKind maps every documented alias (including the US "judgment" spelling and the account-specific variants) to its canonical kind, case- and whitespace-insensitively, and returns null for anything else');

  // ---- normaliseKind: the documented Object.prototype pollution guard ----
  // The code comment explains why this uses Object.hasOwn rather than
  // `?? null`: KIND_ALIASES['constructor'] resolves to Object.prototype's
  // own constructor function via the prototype chain, which is truthy, so a
  // naive `?? null` lookup would treat an invalid "constructor" kind as
  // successfully normalised instead of rejecting it.
  {
    assert.equal(normaliseKind('constructor'), null, 'an inherited Object.prototype property name must not be treated as a valid alias');
    assert.equal(normaliseKind('toString'), null);
    assert.equal(normaliseKind('hasOwnProperty'), null);
  }
  ok('normaliseKind rejects inherited Object.prototype property names ("constructor", "toString", "hasOwnProperty") as invalid kinds rather than resolving them through the prototype chain');

  // ---- auditTaxonomy: the ecommerce worked taxonomy's own stated arithmetic ----
  // WORKED_TAXONOMIES.ecommerce.arithmetic states "Static share: 30%". Hand
  // check against the table's own rows before trusting the code: the static
  // kind rows are "How do I return an item" (11), "Discount code not
  // working" (6), "Sizing and fit questions" (5), "Delivery to my country /
  // duties" (4), and "Payment declined at checkout" (4) — 11+6+5+4+4 = 30.
  // That hand total is what the assertion below checks the code against.
  {
    const intents = WORKED_TAXONOMIES.ecommerce.intents;
    // All twelve real intents plus the "Tail" row sum to exactly 100% in the
    // table as printed (18+11+7+7+6+6+5+5+4+4+3+3+21 = 100), so no
    // tail_percent parameter is needed on top of the rows themselves.
    const total = intents.reduce((s, r) => s + r.volume_percent, 0);
    assert.equal(total, 100, 'sanity check on the hand addition above, before trusting the code with it');

    const result = auditTaxonomy({ intents, total_tickets: 4000 });
    assert.equal(result.automation_surface.static_share_percent, 30,
      'reproduces WORKED_TAXONOMIES.ecommerce.arithmetic\'s own stated "Static share: 30%" from its intent rows');

    // The doc's "Automatable account-specific with a live order lookup: 34%"
    // and "containment ceiling: 64%" figures cannot be reproduced from the
    // table as printed: WORKED_TAXONOMIES carries no lookup_available flag
    // per intent, so auditTaxonomy has no way to tell which of the account
    // rows are automatable. Every account row here is unmarked, so the code
    // correctly (per its own stated rule: "no lookup, no automation")
    // treats the whole 41% of account-kind volume (18+7+7+6+3) as not
    // automatable, giving a containment ceiling of 30%, not the doc's 64%.
    // This is a real gap between the worked example's prose and what the
    // same worked example's data actually encodes — flagged in the report,
    // not silently resolved either way.
    const accountShare = intents.filter((r) => r.kind === 'account').reduce((s, r) => s + r.volume_percent, 0);
    assert.equal(accountShare, 41);
    assert.equal(result.automation_surface.automatable_account_share_percent, 0,
      'with no lookup_available flag on any row, none of the account-kind volume is counted as automatable');
    assert.equal(result.automation_surface.account_without_lookup_percent, 41);
    assert.equal(result.automation_surface.containment_ceiling_percent, 30,
      'the ceiling the code computes from the table as printed (30) does not match the doc prose\'s stated 64% — the prose assumes lookup availability the table itself never states');
    assert.equal(result.automation_surface.unclassified_share_percent, 21, 'the illustrative "Tail (60+ intents)" row has kind "mixed", which normaliseKind rejects, so its 21% volume is unclassified');
    assert.ok(has(result, 'unclassified_intent'), 'the Tail row itself must be flagged as unclassified');
  }
  ok('auditTaxonomy reproduces the ecommerce worked taxonomy\'s own stated "Static share: 30%" exactly, and surfaces (rather than silently papering over) the fact that its "64% containment ceiling" prose is not reproducible from the same table\'s rows, which carry no lookup_available data');

  // ---- auditTaxonomy: the SaaS worked taxonomy's "roughly 38%" static share ----
  // Hand check: static rows are "How do I do X" (16), "Invite users" (8),
  // "API error or rate limit" (7), "Does the product do Y" (7) = 38.
  {
    const intents = WORKED_TAXONOMIES.saas.intents;
    const result = auditTaxonomy({ intents, total_tickets: 1200 });
    assert.equal(result.automation_surface.static_share_percent, 38,
      'reproduces WORKED_TAXONOMIES.saas.arithmetic\'s own stated "roughly 38%" exactly');
  }
  ok('auditTaxonomy reproduces the SaaS worked taxonomy\'s own stated "roughly 38%" static share exactly from its intent rows');

  // ---- THRESHOLDS.min_tickets_for_volumes (500): both sides of the boundary ----
  {
    const base = [{ intent: 'A', volume_percent: 100, kind: 'static', resolution_path: 'x' }];
    assert.equal(THRESHOLDS.min_tickets_for_volumes, 500);
    const at = auditTaxonomy({ intents: base, total_tickets: 500 });
    assert.equal(at.volumes_usable, true, '500 tickets exactly must count as usable — the floor is "under 500", not "500 or under"');
    assert.ok(!has(at, 'volumes_are_noise'));

    const below = auditTaxonomy({ intents: base, total_tickets: 499 });
    assert.equal(below.volumes_usable, false);
    assert.ok(has(below, 'volumes_are_noise'), '499 tickets must be flagged as noise');

    const unknown = auditTaxonomy({ intents: base });
    assert.match(unknown.volumes_usable, /not supplied/, 'omitting total_tickets must report an explicit "unverified" state, not assume either true or false');
  }
  ok('the 500-ticket volumes-usable floor is inclusive at exactly 500 and fails one ticket below it, and an unsupplied total_tickets is reported as explicitly unverified rather than guessed');

  // ---- export window: window_days < 90 AND total_tickets < 2000, both legs ----
  {
    assert.equal(THRESHOLDS.export_min_days, 90);
    assert.equal(THRESHOLDS.export_min_tickets, 2000);
    const intents = [{ intent: 'A', volume_percent: 100, kind: 'static', resolution_path: 'x' }];

    const atDays = auditTaxonomy({ intents, window_days: 90, total_tickets: 100 });
    assert.ok(!has(atDays, 'export_window_short'), '90 days exactly must not be flagged — the rule is "at least 90 days"');
    const belowDays = auditTaxonomy({ intents, window_days: 89, total_tickets: 100 });
    assert.ok(has(belowDays, 'export_window_short'), '89 days with too few tickets must be flagged');

    // The short-window flag only fires when BOTH legs are short: a short
    // window is forgiven if enough tickets were exported instead.
    const atTicketFloor = auditTaxonomy({ intents, window_days: 30, total_tickets: 2000 });
    assert.ok(!has(atTicketFloor, 'export_window_short'), '2000 tickets exactly must excuse a short window — "whichever is larger"');
    const belowTicketFloor = auditTaxonomy({ intents, window_days: 30, total_tickets: 1999 });
    assert.ok(has(belowTicketFloor, 'export_window_short'), '1999 tickets must not excuse a 30-day window');
  }
  ok('export_window_short fires only when the window is under 90 days AND ticket volume is under 2000 — both legs\' boundaries (90 days, 2000 tickets) are inclusive on the passing side');

  // ---- top_intents_under_coverage: the 70% floor, both sides -------------
  {
    assert.equal(THRESHOLDS.top_coverage_percent, 70);
    const atBoundary = auditTaxonomy({ intents: [
      { intent: 'A', volume_percent: 40, kind: 'static', resolution_path: 'x' },
      { intent: 'B', volume_percent: 30, kind: 'static', resolution_path: 'x' },
    ] });
    assert.ok(!has(atBoundary, 'top_intents_under_coverage'), 'coverage of exactly 70% must not be flagged');

    const belowBoundary = auditTaxonomy({ intents: [
      { intent: 'A', volume_percent: 40, kind: 'static', resolution_path: 'x' },
      { intent: 'B', volume_percent: 29.9, kind: 'static', resolution_path: 'x' },
    ] });
    assert.ok(has(belowBoundary, 'top_intents_under_coverage'), 'coverage of 69.9% must be flagged');
  }
  ok('top_intents_under_coverage fires below 70% coverage of the top-20 intents and not at exactly 70%');

  // ---- top_intents_under_coverage: only the top 20 intents count ---------
  {
    // 25 intents at 4% each sum to 100%, but only the top 20 (80%) count
    // toward coverage — well above 70%, so this should NOT flag despite a
    // 25-row tail.
    const many = Array.from({ length: 25 }, (_, i) => ({ intent: `I${i}`, volume_percent: 4, kind: 'static', resolution_path: 'x' }));
    const result = auditTaxonomy({ intents: many });
    assert.ok(!has(result, 'top_intents_under_coverage'), 'the top 20 of 25 equal-volume intents already cover 80%, comfortably above the 70% floor');
  }
  ok('top_intents_under_coverage sums only the top 20 intents by volume, not the whole table');

  // ---- volumes_do_not_sum: the ±2 percentage-point tolerance, both sides -
  {
    assert.equal(THRESHOLDS.volume_sum_tolerance, 2);
    const atTolerance = auditTaxonomy({ intents: [
      { intent: 'A', volume_percent: 51, kind: 'static', resolution_path: 'x' },
      { intent: 'B', volume_percent: 51, kind: 'static', resolution_path: 'x' },
    ] }); // sums to 102, exactly 2 points over 100
    assert.ok(!has(atTolerance, 'volumes_do_not_sum'), 'a sum exactly 2 points off 100 must be within tolerance');

    const overTolerance = auditTaxonomy({ intents: [
      { intent: 'A', volume_percent: 51.1, kind: 'static', resolution_path: 'x' },
      { intent: 'B', volume_percent: 51, kind: 'static', resolution_path: 'x' },
    ] }); // sums to 102.1
    assert.ok(has(overTolerance, 'volumes_do_not_sum'), 'a sum 2.1 points off 100 must be flagged');
  }
  ok('volumes_do_not_sum tolerates a sum up to exactly ±2 percentage points off 100 and flags anything past it');

  // ---- multi_intent_rate_high: the 15% threshold, both sides -------------
  {
    assert.equal(THRESHOLDS.multi_intent_percent, 15);
    const intents = [{ intent: 'A', volume_percent: 100, kind: 'static', resolution_path: 'x' }];
    assert.ok(!has(auditTaxonomy({ intents, multi_intent_percent: 15 }), 'multi_intent_rate_high'), '15% exactly must not be flagged — the rule is "above 15%"');
    assert.ok(has(auditTaxonomy({ intents, multi_intent_percent: 15.1 }), 'multi_intent_rate_high'), '15.1% must be flagged');
  }
  ok('multi_intent_rate_high fires strictly above 15% and not at exactly 15%');

  // ---- policy_not_procedure: the "more than twice last quarter" threshold ----
  {
    assert.equal(THRESHOLDS.policy_changes_per_quarter, 2);
    const at = auditTaxonomy({ intents: [{ intent: 'A', volume_percent: 100, kind: 'static', resolution_path: 'x', answer_changes_last_quarter: 2 }] });
    assert.ok(!has(at, 'policy_not_procedure'), 'changed exactly twice must not be flagged — the rule is "more than twice"');
    const over = auditTaxonomy({ intents: [{ intent: 'A', volume_percent: 100, kind: 'static', resolution_path: 'x', answer_changes_last_quarter: 3 }] });
    assert.ok(has(over, 'policy_not_procedure'), 'changed three times must be flagged');
  }
  ok('policy_not_procedure fires only when the answer changed more than twice last quarter, not at exactly twice');

  // ---- article_min_volume_percent (0.5): the article-backlog write-now/deferred split ----
  {
    assert.equal(THRESHOLDS.article_min_volume_percent, 0.5);
    const result = auditTaxonomy({ intents: [
      { intent: 'At floor', volume_percent: 0.5, kind: 'static', resolution_path: 'x' },
      { intent: 'Below floor', volume_percent: 0.49, kind: 'static', resolution_path: 'x' },
      { intent: 'Below floor but safety-adjacent', volume_percent: 0.49, kind: 'static', resolution_path: 'x', safety_adjacent: true },
    ] });
    const writeNow = result.article_backlog.write_now.map((r) => r.intent);
    const deferred = result.article_backlog.deferred.map((r) => r.intent);
    assert.ok(writeNow.includes('At floor'), '0.5% exactly must be eligible — the rule is "below 0.5%", not "0.5% or below"');
    assert.ok(deferred.includes('Below floor'));
    assert.ok(writeNow.includes('Below floor but safety-adjacent'), 'a safety-adjacent intent must be eligible even under the volume floor');
    assert.ok(!deferred.includes('Below floor but safety-adjacent'));
  }
  ok('the article backlog\'s write-now/deferred split treats 0.5% volume as eligible (inclusive) and 0.49% as deferred, except when the intent is safety-adjacent, which overrides the floor');

  // ---- per-intent findings: unclassified, missing resolution path, variant-dependent, account-without-lookup ----
  {
    const result = auditTaxonomy({ intents: [
      { intent: 'No kind', volume_percent: 10, resolution_path: 'x' },
      { intent: 'No path', volume_percent: 10, kind: 'static' },
      { intent: 'Variant static', volume_percent: 10, kind: 'static', resolution_path: 'x', plan_or_region_dependent: true },
      { intent: 'Account no lookup, unstated', volume_percent: 10, kind: 'account', resolution_path: 'x' },
      { intent: 'Account no lookup, stated false', volume_percent: 10, kind: 'account', resolution_path: 'x', lookup_available: false },
      { intent: 'Account with lookup', volume_percent: 10, kind: 'account', resolution_path: 'x', lookup_available: true },
    ] });
    const byName = Object.fromEntries(result.findings.map((f) => [f.evidence, f]));

    assert.ok(has(result, 'unclassified_intent'));
    assert.ok(has(result, 'missing_resolution_path'));
    assert.ok(has(result, 'variant_dependent_static'));

    const unstated = result.findings.find((f) => f.check === 'account_intent_without_lookup' && f.evidence.startsWith('Account no lookup, unstated'));
    assert.ok(unstated, 'an account intent with no lookup_available key at all must be flagged');
    assert.match(unstated.evidence, /lookup_available not stated/, 'the evidence must say the flag was not stated, distinguishing it from an explicit false');

    const statedFalse = result.findings.find((f) => f.check === 'account_intent_without_lookup' && f.evidence.startsWith('Account no lookup, stated false'));
    assert.ok(statedFalse);
    assert.ok(!/not stated/.test(statedFalse.evidence), 'an explicit lookup_available: false must not be reported as "not stated"');

    assert.ok(!result.findings.some((f) => f.check === 'account_intent_without_lookup' && f.evidence === 'Account with lookup'), 'an account intent with lookup_available: true must not be flagged');
  }
  ok('auditTaxonomy flags an unclassified kind, a missing resolution path, a variant-dependent static intent and an account intent without a lookup independently, distinguishing an explicitly-false lookup_available from one never stated');

  console.log(`\n${passed} taxonomy.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
