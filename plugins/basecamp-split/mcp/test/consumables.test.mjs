#!/usr/bin/env node
/**
 * Regression tests for lib/consumables.js.
 *
 * sizeConsumables's core case is the worked example printed verbatim in
 * references/consumables-planning.md ("four people, three days, temperate,
 * moderate hiking") — turning that example's own energy/food/fuel/water
 * figures into an assertion is the point: those numbers were computed once
 * by a human for the doc and now have to agree with the code a second time.
 *
 *   node plugins/basecamp-split/mcp/test/consumables.test.mjs
 */
import assert from 'node:assert/strict';
import { sizeConsumables, ENERGY_BANDS, FOOD_WEIGHT, WATER, FUEL } from '../lib/consumables.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- the worked example from references/consumables-planning.md ----------
  // "Energy: 3,200 kcal/person/day at 4.0 kcal/g -> 800 g/person/day" and
  // "Food: 3 days x 800g = 2.40 kg each" are stated directly; the reserve
  // group total is not (the doc uses a single 0.45 kg/person figure, the
  // midpoint of the 400-500 g range, while sizeConsumables always returns
  // the full range rather than inventing a midpoint — see the file's own
  // top-of-file comment. Hand-verified here: RESERVE.grams_per_person is
  // {400, 500}, so for 4 people that's {1.6, 2.0} kg, and the doc's
  // midpoint-based 1.8 kg group figure (0.45 kg x 4) sits exactly between
  // those two ends, confirming the range brackets the doc's own number
  // rather than contradicting it.
  {
    const result = sizeConsumables({
      people: 4,
      days: 3,
      exertion: 'moderate',
      kcal_per_day: 3200,
      ration_density_kcal_per_g: 4.0,
      fuel_conditions: 'temperate',
      gas_grams_per_person_day: 20,
      water_conditions: 'temperate',
    });

    assert.equal(result.energy.kcal_per_person_day, 3200);
    assert.equal(result.energy.note, undefined, '3,200 kcal is within the 3,000-3,500 moderate-hiking band and must not warn');

    assert.equal(result.food.dry_g_per_person_day, 800, '3,200 kcal / 4.0 kcal/g = 800 g/day, exactly as the doc states');
    assert.equal(result.food.note, undefined, '800 g/day is within the 700-900 g planning band and must not warn');
    assert.equal(result.food.per_person_kg_excluding_reserve, 2.4, '3 days x 800 g = 2.40 kg each');
    assert.equal(result.food.group_total_kg_excluding_reserve, 9.6, '12 person-days x 800 g = 9.6 kg');

    assert.deepEqual(result.reserve.group_total_kg, { low: 1.6, high: 2.0 },
      'the reserve range for 4 people (400-500 g/person) brackets the doc\'s 1.8 kg midpoint figure (11.4 - 9.6 = 1.8 kg group reserve)');

    assert.equal(result.fuel.net_gas_required_g, 240, '12 person-days x 20 g/person/day = 240 g net, exactly as the doc states');

    assert.deepEqual(result.water.litres_per_person_day, { low: 3, high: 4 });
  }
  ok('sizeConsumables reproduces the worked four-person three-day example in references/consumables-planning.md: 800 g/day food, 2.40 kg/9.6 kg food totals, a reserve range bracketing the doc\'s 1.8 kg figure, and 240 g of net fuel');

  // ---- kcal-per-day band boundaries are inclusive at both ends -------------
  // moderate hiking: 3,000-3,500 kcal/day. The note should fire only once a
  // caller's figure is genuinely outside the band, not at the band's own edges.
  {
    const low = sizeConsumables({ people: 1, days: 1, exertion: 'moderate', kcal_per_day: 3000 });
    assert.equal(low.energy.note, undefined, '3,000 kcal exactly is the band\'s own low edge and must not warn');
    const justBelow = sizeConsumables({ people: 1, days: 1, exertion: 'moderate', kcal_per_day: 2999 });
    assert.match(justBelow.energy.note, /outside the moderate hiking planning band/);
    const high = sizeConsumables({ people: 1, days: 1, exertion: 'moderate', kcal_per_day: 3500 });
    assert.equal(high.energy.note, undefined, '3,500 kcal exactly is the band\'s own high edge and must not warn');
    const justAbove = sizeConsumables({ people: 1, days: 1, exertion: 'moderate', kcal_per_day: 3501 });
    assert.match(justAbove.energy.note, /outside the moderate hiking planning band/);
  }
  ok('the kcal_per_day band-mismatch note fires just past either edge of the exertion band and not at the edges themselves');

  // ---- food-weight band boundaries (700-900 g/day) are inclusive too -------
  {
    const atLow = sizeConsumables({ people: 1, days: 1, kcal_per_day: 2800, ration_density_kcal_per_g: 4.0 }); // 2800/4 = 700
    assert.equal(atLow.food.dry_g_per_person_day, 700);
    assert.equal(atLow.food.note, undefined, '700 g/day exactly is the band\'s own low edge and must not warn');
    const belowLow = sizeConsumables({ people: 1, days: 1, kcal_per_day: 2796, ration_density_kcal_per_g: 4.0 }); // 2796/4 = 699
    assert.equal(belowLow.food.dry_g_per_person_day, 699);
    assert.match(belowLow.food.note, /outside the 700–900 g\/person\/day planning band/);
    const atHigh = sizeConsumables({ people: 1, days: 1, kcal_per_day: 3600, ration_density_kcal_per_g: 4.0 }); // 3600/4 = 900
    assert.equal(atHigh.food.dry_g_per_person_day, 900);
    assert.equal(atHigh.food.note, undefined, '900 g/day exactly is the band\'s own high edge and must not warn');
    const aboveHigh = sizeConsumables({ people: 1, days: 1, kcal_per_day: 3604, ration_density_kcal_per_g: 4.0 }); // 3604/4 = 901
    assert.equal(aboveHigh.food.dry_g_per_person_day, 901);
    assert.match(aboveHigh.food.note, /outside the 700–900 g\/person\/day planning band/);
  }
  ok('the food dry-weight band-mismatch note fires just past either edge of the 700-900 g/day band and not at the edges themselves');

  // ---- fuel-rate band boundaries are inclusive at both ends ----------------
  // temperate fuel: 15-25 g/person/day.
  {
    const atLow = sizeConsumables({ people: 1, days: 1, fuel_conditions: 'temperate', gas_grams_per_person_day: 15 });
    assert.equal(atLow.fuel.note, undefined, '15 g/day exactly is the temperate band\'s own low edge and must not warn');
    const belowLow = sizeConsumables({ people: 1, days: 1, fuel_conditions: 'temperate', gas_grams_per_person_day: 14 });
    assert.match(belowLow.fuel.note, /outside the 15–25 range/);
    const atHigh = sizeConsumables({ people: 1, days: 1, fuel_conditions: 'temperate', gas_grams_per_person_day: 25 });
    assert.equal(atHigh.fuel.note, undefined, '25 g/day exactly is the temperate band\'s own high edge and must not warn');
    const aboveHigh = sizeConsumables({ people: 1, days: 1, fuel_conditions: 'temperate', gas_grams_per_person_day: 26 });
    assert.match(aboveHigh.fuel.note, /outside the 15–25 range/);
  }
  ok('the fuel-rate band-mismatch note fires just past either edge of the temperate 15-25 g/day band and not at the edges themselves');

  // ---- an unrecognised exertion/water/fuel condition is rejected, including ----
  // ---- an inherited-property name that must not be treated as a real key ----
  {
    assert.throws(() => sizeConsumables({ people: 1, days: 1, exertion: 'constructor' }),
      (err) => err instanceof ToolError && err.code === 'unknown_exertion',
      '"constructor" must be rejected as an unknown exertion band, not resolve Object.prototype.constructor');
    assert.throws(() => sizeConsumables({ people: 1, days: 1, water_conditions: 'constructor' }),
      (err) => err instanceof ToolError && err.code === 'unknown_conditions');
    assert.throws(() => sizeConsumables({ people: 1, days: 1, fuel_conditions: 'constructor' }),
      (err) => err instanceof ToolError && err.code === 'unknown_conditions');
  }
  ok('sizeConsumables rejects an inherited-property name ("constructor") as an unknown exertion/water/fuel condition rather than silently resolving it');

  // ---- invalid roster/duration inputs are rejected --------------------------
  {
    assert.throws(() => sizeConsumables({ people: 0, days: 1 }),
      (err) => err instanceof ToolError && err.code === 'invalid_roster');
    assert.throws(() => sizeConsumables({ people: 1, days: 0 }),
      (err) => err instanceof ToolError && err.code === 'invalid_duration');
    assert.throws(() => sizeConsumables({ people: 1, days: 1, ration_density_kcal_per_g: 0 }),
      (err) => err instanceof ToolError && err.code === 'invalid_density',
      'a density of exactly 0 must be rejected (division by it would produce Infinity)');
    assert.throws(() => sizeConsumables({ people: 2, days: 2, person_days: 0 }),
      (err) => err instanceof ToolError && err.code === 'invalid_duration',
      'an explicit person_days of 0 must be rejected even though people and days are individually valid');
    assert.doesNotThrow(() => sizeConsumables({ people: 1, days: 1 }), 'people=1, days=1 is the minimum valid roster');
  }
  ok('sizeConsumables rejects a non-positive people count, day count, density, or explicit person_days, and accepts the minimum valid roster');

  // ---- a water condition with no daily figure (snow_melt) passes through null ----
  {
    const result = sizeConsumables({ people: 2, days: 2, water_conditions: 'snow_melt' });
    assert.equal(result.water.litres_per_person_day, null,
      'snow-melting camps intentionally have no daily litre figure of their own — the intake matches the climate band instead');
    assert.equal(result.water.note, WATER.snow_melt.note);
  }
  ok('a water condition with a null daily figure (snow_melt) is passed through as null rather than crashing or inventing a number');

  // ---- explicit kcal_per_day / gas rate outside the band still computes, flagged ----
  {
    const result = sizeConsumables({ people: 1, days: 1, exertion: 'sedentary', kcal_per_day: 6000 });
    assert.equal(result.energy.kcal_per_person_day, 6000, 'an out-of-band figure is still used for the arithmetic, not silently clamped');
    assert.match(result.energy.note, /outside the sedentary basecamp planning band/);
  }
  ok('an explicit kcal_per_day outside its exertion band is used as given (not clamped) and flagged with a note');

  // ---- a range input (no point chosen) is mapped to both ends, not averaged ----
  {
    const result = sizeConsumables({ people: 2, days: 1, exertion: 'moderate' }); // no kcal_per_day given
    assert.deepEqual(result.energy.kcal_per_person_day, ENERGY_BANDS.moderate.kcal_per_day, 'no kcal_per_day chosen -> the whole band range is carried through, not collapsed to a midpoint');
    // 3000/4.0=750, 3500/4.0=875 g/day
    assert.deepEqual(result.food.dry_g_per_person_day, { low: 750, high: 875 });
    assert.deepEqual(result.food.per_person_kg_excluding_reserve, { low: 0.75, high: 0.88 }, '875 g x 1 day / 1000, rounded to 2 dp, rounds 0.875 up to 0.88');
  }
  ok('sizeConsumables maps an unchosen kcal range to both its low and high ends throughout the food calculation, rather than inventing a midpoint');

  console.log(`\n${passed} consumables.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
