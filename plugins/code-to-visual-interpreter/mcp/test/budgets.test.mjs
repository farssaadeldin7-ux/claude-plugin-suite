#!/usr/bin/env node
/**
 * Regression tests for lib/budgets.js: the element-count/technology switch
 * points in costBudget, and the SVG path-size arithmetic in svgExportBudget.
 *
 * The svgExportBudget precision table is the strongest check available: the
 * reference (references/performance-budgets.md) prints a literal worked
 * table — bytes-per-point at each precision for a 5,000-point path, with the
 * resulting KB spelled out (185 / 105 / 75 / 35) — so reproducing that table
 * from the code's own formula (points x bytes_per_point / 1000) is checking
 * the code against numbers an independent author already computed, not
 * against data invented for this test.
 *
 *   node plugins/code-to-visual-interpreter/mcp/test/budgets.test.mjs
 */
import assert from 'node:assert/strict';
import { costBudget, svgExportBudget } from '../lib/budgets.js';
import { ToolError } from '../mcp-lite.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- svgExportBudget: the worked 5,000-point precision table -----------
  // references/performance-budgets.md states this table verbatim:
  //   full ~37 B/pt -> 185 KB; 6 decimals ~21 B/pt -> 105 KB;
  //   3 decimals ~15 B/pt -> 75 KB (bolded); integer ~7 B/pt -> 35 KB.
  // Hand check: 5000 x 37 = 185000 -> 185.0 KB; 5000 x 21 = 105000 -> 105.0;
  // 5000 x 15 = 75000 -> 75.0; 5000 x 7 = 35000 -> 35.0. All match the doc.
  {
    const full = svgExportBudget({ points: 5000, precision: 'full' });
    assert.equal(full.path_data.raw_kb, 185, 'full float precision at 5,000 points must match the doc\'s 185 KB');

    const six = svgExportBudget({ points: 5000, precision: 6 });
    assert.equal(six.precision, '6', 'numeric precision 6 must normalise to the "6" bucket');
    assert.equal(six.path_data.raw_kb, 105);

    const three = svgExportBudget({ points: 5000, precision: '3' });
    assert.equal(three.path_data.raw_kb, 75, 'three-decimal precision at 5,000 points must match the doc\'s bolded 75 KB figure');

    const intPrec = svgExportBudget({ points: 5000, precision: 0 });
    assert.equal(intPrec.precision, 'integer', 'numeric precision 0 must normalise to "integer"');
    assert.equal(intPrec.path_data.raw_kb, 35);

    // at_each_precision must independently reproduce the same four figures.
    assert.deepEqual(
      Object.fromEntries(Object.entries(full.at_each_precision).map(([k, v]) => [k, v.raw_kb])),
      { full: 185, 6: 105, 3: 75, integer: 35 },
      'at_each_precision must report the full table, not just the requested row'
    );
  }
  ok('svgExportBudget reproduces the worked 5,000-point precision table from references/performance-budgets.md exactly: 185/105/75/35 KB at full/6-decimal/3-decimal/integer precision');

  // ---- svgExportBudget: precision aliases and the prototype-pollution guard ----
  {
    assert.equal(svgExportBudget({ points: 100, precision: 'FULL' }).precision, 'full', 'precision lookup must be case-insensitive');
    assert.throws(
      () => svgExportBudget({ points: 100, precision: 'constructor' }),
      (err) => err instanceof ToolError && err.code === 'unknown_precision',
      '"constructor" must not resolve to Object.prototype.constructor through the alias lookup'
    );
    assert.throws(
      () => svgExportBudget({ points: 100, precision: 'nope' }),
      (err) => err instanceof ToolError && err.code === 'unknown_precision'
    );
  }
  ok('svgExportBudget normalises precision case-insensitively and rejects an unknown or prototype-name precision instead of guessing');

  // ---- svgExportBudget: invalid points ------------------------------------
  {
    for (const bad of [0, -5, NaN, Infinity]) {
      assert.throws(
        () => svgExportBudget({ points: bad }),
        (err) => err instanceof ToolError && err.code === 'invalid_points'
      );
    }
  }
  ok('svgExportBudget rejects zero, negative, NaN and infinite point counts');

  // ---- svgExportBudget: RDP use_case reduction range, hand-verified ------
  // references/performance-budgets.md: "standard_web" -> epsilon 0.5, reduction
  // 70-90%. A 90% reduction leaves the FEWEST points (n x 0.10); a 70%
  // reduction leaves the MOST (n x 0.30) — so points_after_range must be
  // [low-count-from-high-pct, high-count-from-low-pct], not the reverse.
  // Hand check at n=5000: [5000*0.10, 5000*0.30] = [500, 1500].
  {
    const r = svgExportBudget({ points: 5000, precision: '3', use_case: 'standard_web' });
    assert.equal(r.simplification.rdp_epsilon, '0.5 device px');
    assert.deepEqual(r.simplification.points_after_range, [500, 1500],
      'a 90% reduction leaves fewer points than a 70% reduction, so the range must be [fewest, most], not [most, fewest]');
  }
  ok('svgExportBudget computes the RDP points_after_range in the correct order (heavier reduction -> fewer points survive) for the "standard_web" use case, hand-verified against the reference\'s 70-90% figure');

  {
    assert.throws(
      () => svgExportBudget({ points: 100, use_case: 'printed_on_paper' }),
      (err) => err instanceof ToolError && err.code === 'unknown_use_case'
    );
  }
  ok('svgExportBudget rejects an unrecognised use_case rather than silently omitting the simplification section');

  // ---- svgExportBudget: element-count bands, both sides of every boundary ----
  // references/performance-budgets.md: "Under 1,000 is fine... From 1,000 to
  // 5,000... From 5,000 to 20,000... Above 20,000, use canvas or
  // pre-rasterise." Each boundary value belongs to the band whose upper
  // bound it equals (the lookup is `n <= up_to`), not the next band up.
  {
    const verdictFor = (elements) => svgExportBudget({ points: 10, elements }).element_count.static_verdict;
    assert.equal(verdictFor(1000), 'Fine, including per-element CSS.', '1,000 exactly belongs to the up-to-1,000 band');
    assert.match(verdictFor(1001), /style recalculation is noticeable/);
    assert.match(verdictFor(5000), /style recalculation is noticeable/, '5,000 exactly belongs to the 1,000-to-5,000 band');
    assert.match(verdictFor(5001), /parse and layout run into hundreds of ms/);
    assert.match(verdictFor(20000), /parse and layout run into hundreds of ms/, '20,000 exactly belongs to the 5,000-to-20,000 band, not "above 20,000"');
    assert.equal(verdictFor(20001), 'Use canvas or pre-rasterise.');
  }
  ok('svgExportBudget places every SVG element-count boundary (1,000 / 5,000 / 20,000) in its lower band, matching the reference\'s own "up to" wording');

  {
    for (const bad of [0, -1, NaN]) {
      assert.throws(
        () => svgExportBudget({ points: 10, elements: bad }),
        (err) => err instanceof ToolError && err.code === 'invalid_elements'
      );
    }
  }
  ok('svgExportBudget rejects a non-positive or NaN elements count');

  // ---- costBudget: animated switch points, both sides of every boundary --
  // references/performance-budgets.md's switch-point table: "Up to 500
  // (animated): DOM/SVG", "500-10,000: Canvas 2D", "10,000-100,000: WebGL
  // instanced", "Above 100,000: transform feedback or WebGPU compute". The
  // code's own bucketing is `n <= 500`, `n <= 10000`, `n <= 100000`, else —
  // so each boundary value belongs to the lower bucket.
  {
    const techFor = (elements) => costBudget({ elements, animated: true }).recommended.technology;
    assert.equal(techFor(500), 'DOM or SVG nodes', '500 exactly is animated-safe DOM/SVG, not yet Canvas 2D');
    assert.equal(techFor(501), 'Canvas 2D');
    assert.equal(techFor(10000), 'Canvas 2D', '10,000 exactly still belongs to the Canvas 2D bucket');
    assert.equal(techFor(10001), 'WebGL instanced rendering');
    assert.equal(techFor(100000), 'WebGL instanced rendering', '100,000 exactly still belongs to the WebGL instanced bucket');
    assert.equal(techFor(100001), 'GPU-side state');
  }
  ok('costBudget places every animated switch-point boundary (500 / 10,000 / 100,000) in its lower bucket, not the next technology up');

  // ---- costBudget: static recommendation switches at 20,000 --------------
  {
    const at20000 = costBudget({ elements: 20000, animated: false });
    assert.equal(at20000.recommended.technology, 'SVG or Canvas 2D', '20,000 exactly is still within the SVG-viable static range');
    const at20001 = costBudget({ elements: 20001, animated: false });
    assert.equal(at20001.recommended.technology, 'Canvas 2D or pre-rasterise');
  }
  ok('costBudget switches its static recommendation from "SVG or Canvas 2D" to "Canvas 2D or pre-rasterise" only just past the 20,000-element boundary');

  // ---- costBudget: canvas2d_batched arithmetic matches the doc's own worked figure ----
  // references/performance-budgets.md: "One beginPath, 10,000 moveTo/arc
  // pairs and one fill is 2-4 ms, fine." The code derives this from
  // msRange(n, [0.2, 0.4]); hand check: 10000*0.2/1000 = 2, 10000*0.4/1000 = 4.
  {
    const result = costBudget({ elements: 10000, animated: true });
    assert.deepEqual(result.arithmetic.canvas2d_batched.estimate, { low_ms: 2, high_ms: 4 },
      'batched Canvas 2D draw cost at 10,000 elements must reproduce the doc\'s literal "2-4 ms, fine" figure');
  }
  ok('costBudget\'s canvas2d_batched arithmetic reproduces the doc\'s literal "2-4 ms" worked figure at 10,000 elements');

  // ---- costBudget: per-technology ceiling check, both sides of the boundary ----
  // p5.js: "weak at more than roughly 5,000 elements per frame" -> ceiling 5000.
  {
    const at5000 = costBudget({ elements: 5000, animated: true, technology: 'p5' });
    assert.equal(at5000.stated_technology.within_ceiling, true, '5,000 exactly is still within p5\'s stated ceiling');
    const at5001 = costBudget({ elements: 5001, animated: true, technology: 'p5' });
    assert.equal(at5001.stated_technology.within_ceiling, false);
  }
  ok('costBudget\'s stated_technology.within_ceiling flips exactly past p5.js\'s documented ~5,000-element ceiling, not before or after');

  // ---- costBudget: unknown / prototype-name technology is rejected -------
  {
    assert.throws(
      () => costBudget({ elements: 100, animated: false, technology: 'webgpu_compute' }),
      (err) => err instanceof ToolError && err.code === 'unknown_technology'
    );
    assert.throws(
      () => costBudget({ elements: 100, animated: false, technology: 'constructor' }),
      (err) => err instanceof ToolError && err.code === 'unknown_technology',
      '"constructor" must not resolve to Object.prototype.constructor through the technology lookup'
    );
  }
  ok('costBudget rejects an unrecognised or prototype-name technology rather than silently matching it');

  // ---- costBudget: invalid elements ---------------------------------------
  {
    for (const bad of [0, -10, NaN, Infinity]) {
      assert.throws(
        () => costBudget({ elements: bad }),
        (err) => err instanceof ToolError && err.code === 'invalid_elements'
      );
    }
  }
  ok('costBudget rejects zero, negative, NaN and infinite element counts');

  console.log(`\n${passed} budgets.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
