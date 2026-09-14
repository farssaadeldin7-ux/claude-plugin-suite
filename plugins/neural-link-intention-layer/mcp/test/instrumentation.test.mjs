#!/usr/bin/env node
/**
 * Regression tests for lib/instrumentation.js — a data table ported from
 * references/instrumentation.md plus one lookup function, applicationFor().
 * Same shape of risk as catalogue.js: the only real logic is the name
 * normalisation and the Object.prototype-inherited-key trap.
 *
 *   node plugins/neural-link-intention-layer/mcp/test/instrumentation.test.mjs
 */
import assert from 'node:assert/strict';
import { applicationFor, APPLICATIONS, TIERS } from '../lib/instrumentation.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- applicationFor: exact key, and normalisation of case/space/hyphen ---
  {
    assert.equal(applicationFor('photoshop'), APPLICATIONS.photoshop);
    assert.equal(applicationFor('Photoshop'), APPLICATIONS.photoshop, 'lookup must be case-insensitive');
    assert.equal(applicationFor('  blender  '), APPLICATIONS.blender, 'lookup must trim whitespace');
    assert.equal(applicationFor('after effects'), APPLICATIONS.after_effects, 'a space must normalise to the underscored key');
    assert.equal(applicationFor('after-effects'), APPLICATIONS.after_effects, 'a hyphen must normalise to the underscored key');
  }
  ok('applicationFor looks up every application key case-, whitespace-, space- and hyphen-insensitively');

  // ---- applicationFor: unknown application returns null --------------------
  {
    assert.equal(applicationFor('krita'), null);
    assert.equal(applicationFor(''), null);
    assert.equal(applicationFor(undefined), null);
    assert.equal(applicationFor(null), null);
  }
  ok('applicationFor returns null for an application not covered by name, rather than falling back to "other" silently');

  // ---- applicationFor: must not resolve an inherited Object.prototype key --
  // Same regression class as catalogue.js's catalogueFor: `?? null` would not
  // catch a truthy inherited value such as Object.prototype.constructor.
  {
    assert.equal(applicationFor('constructor'), null);
    assert.equal(applicationFor('toString'), null);
    assert.equal(applicationFor('hasOwnProperty'), null);
    assert.equal(applicationFor('__proto__'), null);
  }
  ok('applicationFor rejects inherited Object.prototype property names as unknown applications rather than leaking them');

  // ---- the "other" entry is reachable by its own name, not just as a fallback ----
  {
    assert.equal(applicationFor('other'), APPLICATIONS.other);
    assert.equal(applicationFor('Other'), APPLICATIONS.other);
  }
  ok('the catch-all "other" entry is itself a normal, explicitly-named lookup target');

  // ---- every application entry has the fields the skill depends on ---------
  {
    for (const [key, app] of Object.entries(APPLICATIONS)) {
      assert.equal(typeof app.tier, 'string', `${key} must state a tier`);
      assert.equal(typeof app.method, 'string', `${key} must describe a method`);
    }
  }
  ok('every entry in APPLICATIONS states a tier and a method');

  // ---- TIERS table matches the reference doc's own tier table --------------
  {
    const tierA = TIERS.find((t) => t.method === 'Application action or script log');
    assert.equal(tierA.tier, 'A');
    assert.equal(tierA.action_coverage, '60-95%');
    const tierC = TIERS.find((t) => t.method === 'Structured self-report walk-through');
    assert.equal(tierC.tier, 'C');
    assert.equal(tierC.timestamps, 'No');
  }
  ok('TIERS reproduces the reference doc\'s tier table for Tier A and Tier C');

  console.log(`\n${passed} instrumentation.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
