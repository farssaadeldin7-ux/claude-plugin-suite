#!/usr/bin/env node
/**
 * Regression tests for a single defect pattern repeated across many plugins:
 * a lookup table implemented as a plain object literal, indexed directly by
 * a caller-supplied string. Every JS object inherits from Object.prototype,
 * so `TABLE["constructor"]` returns Object.prototype.constructor — a truthy,
 * non-undefined value — instead of the "not found" every caller assumed a
 * bad key would produce. That either slips past a `!result` guard (crashing
 * later on a missing field) or gets handed back as if it were real table
 * data. Each site below was fixed with Object.hasOwn(table, key), matching
 * the convention already used in services/billing/catalog.js. This file
 * proves each fixed function now treats "constructor" exactly like any
 * other unrecognised key, and still resolves a real one correctly.
 *
 *   node test/plugin-table-lookups.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const plugin = (p) => path.join(root, '..', 'plugins', p);

// A few of these modules persist local state; give them an isolated config
// directory rather than touching the real one.
process.env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-lookup-test-'));

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- the simple "resolve by id, or null" family -------------------------
  // Eleven near-identical functions of the shape
  // `TABLE[String(id).toLowerCase()] ?? null`, each vulnerable the same way.
  const nullFamily = [
    { mod: 'emotional-resonance-analyzer/mcp/lib/causes.js', fn: 'causeFor' },
    { mod: 'emotional-resonance-analyzer/mcp/lib/forms.js', fn: 'formFor' },
    { mod: 'five-minute-fluency/mcp/lib/genres.js', fn: 'genreFor' },
    { mod: 'five-minute-fluency/mcp/lib/symptoms.js', fn: 'symptomFor' },
    { mod: 'generative-digital-twin/mcp/lib/dimensions.js', fn: 'mediumFor' },
    { mod: 'podcast-video-studio/mcp/lib/destinations.js', fn: 'destinationFor' },
    { mod: 'neural-link-intention-layer/mcp/lib/catalogue.js', fn: 'catalogueFor' },
    { mod: 'neural-link-intention-layer/mcp/lib/instrumentation.js', fn: 'applicationFor' },
    { mod: 'predictive-resource-allocation/mcp/lib/domains.js', fn: 'domainFor' },
    { mod: 'customer-sales-support/mcp/lib/taxonomy.js', fn: 'normaliseKind' },
    { mod: 'ghost-post-preview/mcp/lib/fold.js', fn: 'platformFor' },
  ];
  for (const { mod, fn } of nullFamily) {
    const module = await import(plugin(mod));
    const result = module[fn]('constructor');
    assert.equal(result, null, `${mod}#${fn}("constructor") must return null, like any unrecognised key — got ${JSON.stringify(result)}`);
    const protoResult = module[fn]('__proto__');
    assert.equal(protoResult, null, `${mod}#${fn}("__proto__") must also return null`);
  }
  ok('eleven id-lookup functions treat "constructor" and "__proto__" as unrecognised, not as Object.prototype members');

  // ---- trail-split: sizeConsumables (exertion/water/fuel conditions) ----
  {
    const { sizeConsumables } = await import(plugin('trail-split/mcp/lib/consumables.js'));
    assert.throws(
      () => sizeConsumables({ people: 2, days: 3, exertion: 'constructor' }),
      (err) => err.code === 'unknown_exertion'
    );
    assert.throws(
      () => sizeConsumables({ people: 2, days: 3, water_conditions: 'constructor' }),
      (err) => err.code === 'unknown_conditions'
    );
    assert.throws(
      () => sizeConsumables({ people: 2, days: 3, fuel_conditions: 'constructor' }),
      (err) => err.code === 'unknown_conditions'
    );
    // A real value must still work.
    const result = sizeConsumables({ people: 2, days: 3, exertion: 'moderate' });
    assert.equal(result.energy.band, 'Moderate hiking');
  }
  ok('sizeConsumables rejects "constructor" as an exertion/water/fuel condition instead of silently accepting it');

  // ---- trail-split: buildLedger (expense split model) ------------------
  {
    const { buildLedger } = await import(plugin('trail-split/mcp/lib/costs.js'));
    assert.throws(
      () => buildLedger(['a', 'b'], [{ label: 'x', amount: 10, payer: 'a', model: 'constructor' }]),
      (err) => err.code === 'unknown_model'
    );
    const result = buildLedger(['a', 'b'], [{ label: 'x', amount: 10, payer: 'a', model: 'even' }]);
    assert.ok(result);
  }
  ok('buildLedger rejects "constructor" as a split model instead of falling through to the itemised branch');

  // ---- trail-split: reconcilePlan (gear tag) ----------------------------
  {
    const { reconcilePlan } = await import(plugin('trail-split/mcp/lib/reconcile.js'));
    const result = reconcilePlan({ gear: [{ item: 'stove', tag: 'constructor', carrier: 'a' }] });
    assert.ok(
      result.failures.gear_ledger?.some((f) => /unknown tag "constructor"/.test(f)),
      '"constructor" is not a real gear tag and must be reported as an unknown one'
    );
  }
  ok('reconcilePlan rejects "constructor" as a gear tag instead of accepting it as real');

  // ---- code-to-visual-interpreter: costBudget / svgExportBudget -----------
  {
    const { costBudget, svgExportBudget } = await import(plugin('code-to-visual-interpreter/mcp/lib/budgets.js'));
    assert.throws(
      () => costBudget({ elements: 100, technology: 'constructor' }),
      (err) => err.code === 'unknown_technology'
    );
    assert.throws(
      () => svgExportBudget({ points: 100, precision: 'constructor' }),
      (err) => err.code === 'unknown_precision'
    );
  }
  ok('costBudget and svgExportBudget reject "constructor" as a technology/precision instead of accepting it');

  // ---- diagnose-by-sound: normaliseObservation / rejectedTerms ------------
  {
    const { normaliseObservation, rejectedTerms } = await import(plugin('diagnose-by-sound/mcp/lib/match.js'));
    const normalised = normaliseObservation({ character: ['constructor'] });
    assert.deepEqual(normalised.character, [], '"constructor" is not a real vocabulary term and must be filtered out');
    const rejected = rejectedTerms({ character: ['constructor'] });
    assert.deepEqual(rejected.character, ['constructor'], '"constructor" must be reported as a rejected term');
  }
  ok('normaliseObservation and rejectedTerms treat "constructor" as an unrecognised vocabulary term');

  // ---- predictive-resource-allocation: trainingVramEstimate (configuration)
  {
    const { trainingVramEstimate } = await import(plugin('predictive-resource-allocation/mcp/lib/memory.js'));
    assert.throws(
      () => trainingVramEstimate({ vram_gb: 24, parameters_billion: 7, configuration: 'constructor' }),
      (err) => err.code === 'invalid_configuration'
    );
  }
  ok('trainingVramEstimate rejects "constructor" as a configuration instead of producing NaN downstream');

  // ---- trail-split: weightLedger (CARRY_BANDS) --------------------------
  {
    const { weightLedger } = await import(plugin('trail-split/mcp/lib/weight.js'));
    assert.throws(
      () => weightLedger([{ name: 'a', body_weight_kg: 70, band: 'constructor' }]),
      (err) => err.code === 'unknown_band'
    );
  }
  ok('weightLedger rejects "constructor" as a conditioning band instead of crashing on a missing .percent field');

  console.log(`\n${passed} plugin table-lookup checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(process.env.XDG_CONFIG_HOME, { recursive: true, force: true });
}
