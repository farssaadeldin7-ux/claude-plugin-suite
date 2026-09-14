#!/usr/bin/env node
/**
 * Regression tests for lib/catalogue.js — a data table ported from
 * references/automation-catalogue.md plus one small lookup function,
 * catalogueFor(). The data itself is not judgement, so the only real logic
 * worth testing is the lookup's name normalisation and its defence against
 * the JavaScript-object-inherited-property trap called out in the source
 * comment.
 *
 *   node plugins/neural-link-intention-layer/mcp/test/catalogue.test.mjs
 */
import assert from 'node:assert/strict';
import { catalogueFor, MECHANISMS, BREAK_EVEN } from '../lib/catalogue.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- catalogueFor: exact key, and normalisation of case/space/hyphen -----
  {
    assert.equal(catalogueFor('photoshop'), MECHANISMS.photoshop);
    assert.equal(catalogueFor('Photoshop'), MECHANISMS.photoshop, 'lookup must be case-insensitive');
    assert.equal(catalogueFor('  photoshop  '), MECHANISMS.photoshop, 'lookup must trim whitespace');
    assert.equal(catalogueFor('after effects'), MECHANISMS.after_effects, 'a space must normalise to the underscored key');
    assert.equal(catalogueFor('after-effects'), MECHANISMS.after_effects, 'a hyphen must normalise to the underscored key');
    assert.equal(catalogueFor('OS Level'), MECHANISMS.os_level);
    assert.equal(catalogueFor('os-level'), MECHANISMS.os_level);
  }
  ok('catalogueFor looks up every mechanism key case-, whitespace-, space- and hyphen-insensitively');

  // ---- catalogueFor: unknown application returns null, not undefined -------
  {
    assert.equal(catalogueFor('krita'), null);
    assert.equal(catalogueFor(''), null);
    assert.equal(catalogueFor(undefined), null);
    assert.equal(catalogueFor(null), null);
  }
  ok('catalogueFor returns null (not undefined, not a guess) for an application not in the catalogue');

  // ---- catalogueFor: must not resolve an inherited Object.prototype key ----
  // The regression this guards: `?? null` would not catch a truthy inherited
  // value. "constructor" (and toString, hasOwnProperty, __proto__) resolve on
  // any plain object via the prototype chain even though MECHANISMS never
  // defines them — Object.hasOwn is what keeps them rejected as unknown
  // applications instead of leaking Object.prototype.constructor out as if it
  // were catalogue data.
  {
    assert.equal(catalogueFor('constructor'), null);
    assert.equal(catalogueFor('toString'), null);
    assert.equal(catalogueFor('hasOwnProperty'), null);
    assert.equal(catalogueFor('__proto__'), null);
  }
  ok('catalogueFor rejects inherited Object.prototype property names as unknown applications rather than leaking them');

  // ---- every mechanisms table has at least one row with can/cannot text ----
  {
    for (const [key, app] of Object.entries(MECHANISMS)) {
      assert.ok(Array.isArray(app.mechanisms) && app.mechanisms.length > 0, `${key} must list at least one mechanism`);
      for (const m of app.mechanisms) {
        assert.equal(typeof m.mechanism, 'string');
        assert.equal(typeof m.can, 'string');
        assert.equal(typeof m.cannot, 'string');
      }
      assert.equal(typeof app.notes, 'string');
    }
  }
  ok('every application in MECHANISMS carries at least one mechanism row with mechanism/can/cannot text and a notes string');

  // ---- BREAK_EVEN rows match the reference doc's own break-even table ------
  {
    const byMechanism = Object.fromEntries(BREAK_EVEN.rows.map((r) => [r.mechanism, r]));
    assert.equal(byMechanism['Blender keymap entry'].break_even_f_per_week, '~10');
    assert.equal(byMechanism['Photoshop or Illustrator Action'].break_even_f_per_week, '~16');
    assert.equal(byMechanism['Figma component set'].break_even_f_per_week, '~49');
    assert.equal(byMechanism['Scripted plugin'].break_even_f_per_week, '~290');
  }
  ok('BREAK_EVEN reproduces the reference doc\'s break-even rows for the mechanisms it names');

  console.log(`\n${passed} catalogue.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
