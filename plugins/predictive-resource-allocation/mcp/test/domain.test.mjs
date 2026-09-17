#!/usr/bin/env node
/**
 * Regression tests for predictive-resource-allocation's domain logic:
 * lib/dispatch.js (farm/cloud dispatch bands, the 10x-overhead rule, the
 * Young-Daly checkpoint interval), lib/estimates.js (the estimate-review
 * calibration tally), lib/memory.js (VRAM capacity arithmetic for rendering
 * and training, the fits/thin/does_not_fit cliff verdict), lib/domains.js
 * (the domain-name lookup), and lib/triage.js (the four discriminating
 * tests and the bottleneck classifier that aggregates them).
 *
 * Several assertions below reproduce the worked examples printed verbatim in
 * the skill's references/*.md files (memory-arithmetic.md's 24 GB-card and
 * 1.3B-model examples, domain-profiles.md's dispatch-threshold sentences,
 * the Young-Daly checkpoint example) — turning a reference doc's own
 * independently-computed numbers into an assertion is a stronger check than
 * hand-picked test data, because the doc's author and this test now have to
 * agree twice.
 *
 *   node plugins/predictive-resource-allocation/mcp/test/domain.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dispatchPlan, checkpointInterval } from '../lib/dispatch.js';
import { domainFor } from '../lib/domains.js';
import {
  usableBudget, renderVramEstimate, trainingVramEstimate,
} from '../lib/memory.js';
import { classifyBottleneck } from '../lib/triage.js';
import { parseMib, allocatableRamGb } from '../lib/telemetry.js';
import { headroomCheck } from '../lib/headroom.js';
import { ToolError } from '../mcp-lite.js';

process.env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'pra-domain-test-'));
const { logEstimate, recordActual, reviewEstimates } = await import('../lib/estimates.js');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  // ---- the 10x-overhead rule applies above 30 minutes too ----------------
  // Regression test: a 45-minute frame behind a 10-minute overhead was told
  // to dispatch per frame unconditionally once past the 30-minute mark,
  // even though overhead was 18% of the total — nearly double the 10% the
  // rule promises to keep it under.
  {
    const result = dispatchPlan({ frame_time_seconds: 45 * 60, overhead_seconds: 10 * 60 });
    assert.equal(result.verdict.dispatch, 'batch', `overhead is ${result.overhead_fraction_if_dispatched_per_frame} of the total if dispatched per frame — the 10x rule should have said batch`);
  }
  ok('a long frame whose overhead still fails the 10x threshold is batched, not dispatched per frame just for being over 30 minutes');

  {
    // A frame genuinely far past its overhead should still dispatch per frame.
    const result = dispatchPlan({ frame_time_seconds: 45 * 60, overhead_seconds: 60 });
    assert.equal(result.verdict.dispatch, 'per_frame');
  }
  ok('a long frame that genuinely clears the 10x threshold still dispatches per frame');

  // ---- within_factor_two is cumulative, not "factor-two but not 25%" -----
  // Regression test: a perfectly calibrated log (every ratio near 1.0, well
  // inside the tighter 25% band) reported zero "within a factor of two",
  // because the two checks were chained as mutually exclusive else-if
  // branches instead of independent, overlapping bands.
  {
    for (let i = 0; i < 3; i++) {
      const rec = logEstimate({ job: `job${i}`, predicted_value: 10 });
      recordActual(rec.id, { actual_value: 10 }); // ratio exactly 1.0 — perfectly calibrated
    }
    const review = reviewEstimates();
    assert.equal(review.calibration.resolved, 3);
    assert.equal(review.calibration.within_25_percent, 3);
    assert.equal(review.calibration.within_factor_two, 3, 'every one of these ratios is also within a factor of two, and must be counted as such');
    assert.equal(review.calibration.outside_factor_two, 0);
  }
  ok('a perfectly calibrated log reports the true within-factor-two count, not zero');

  // ---- reviewEstimates: within_25_percent boundary (ratio 0.8 to 1.25,
  // inclusive both ends) is independent of the within_factor_two boundary --
  {
    const mk = (predicted_value, actual_value) => {
      const rec = logEstimate({ job: 'boundary', predicted_value });
      recordActual(rec.id, { actual_value });
      return rec.id;
    };
    mk(100, 80);   // ratio 0.80 exactly -> within 25%
    mk(100, 79);   // ratio 0.79        -> outside 25%, still within factor of two
    mk(100, 125);  // ratio 1.25 exactly -> within 25%
    mk(100, 126);  // ratio 1.26        -> outside 25%, still within factor of two
    const review = reviewEstimates({ limit: 100 });
    // Combined with the 3 perfectly-calibrated records already logged above.
    assert.equal(review.calibration.resolved, 7);
    assert.equal(review.calibration.within_25_percent, 5, '3 perfectly-calibrated + ratio 0.80 + ratio 1.25, both boundary values included');
    assert.equal(review.calibration.within_factor_two, 7, 'all seven ratios (0.79, 0.80, 1.0x3, 1.25, 1.26) are within a factor of two');
  }
  ok('reviewEstimates counts the documented within_25_percent boundary (ratio 0.80 to 1.25) inclusive on both ends, independently of the within_factor_two tally');

  // ---- reviewEstimates: within_factor_two boundary (ratio 0.5 to 2.0,
  // inclusive both ends) --------------------------------------------------
  {
    const mk = (predicted_value, actual_value) => {
      const rec = logEstimate({ job: 'factor-two-boundary', predicted_value });
      recordActual(rec.id, { actual_value });
    };
    mk(1000, 500);   // ratio 0.50 exactly -> within factor of two
    mk(1000, 499);   // ratio 0.499        -> outside factor of two
    mk(1000, 2000);  // ratio 2.00 exactly -> within factor of two
    mk(1000, 2001);  // ratio 2.001        -> outside factor of two
    const review = reviewEstimates({ limit: 100 });
    assert.equal(review.calibration.resolved, 11);
    // 7 previously-resolved (all within factor of two) + this batch's 0.50 and 2.00.
    assert.equal(review.calibration.within_factor_two, 9);
    assert.equal(review.calibration.outside_factor_two, 2, 'exactly the 0.499 and 2.001 ratios must be counted as outside the factor-of-two band');
  }
  ok('reviewEstimates counts the documented within_factor_two boundary (ratio 0.50 to 2.00) inclusive on both ends, and correctly tallies the two ratios one step outside it');

  // ---- recordActual against an unknown id, and unresolved estimates are
  // excluded from calibration but counted in total_estimates ---------------
  {
    const missing = recordActual('est_does_not_exist', { actual_value: 5 });
    assert.equal(missing, null, 'recording against an unrecognised id must report no result, not silently create one');

    // 11 resolved records logged by the two boundary blocks above, none
    // unresolved yet.
    const before = reviewEstimates({ limit: 100 });
    assert.equal(before.total_estimates, 11);
    assert.equal(before.unresolved, 0);

    logEstimate({ job: 'never-resolved', predicted_value: 42 });
    const after = reviewEstimates({ limit: 100 });
    assert.equal(after.total_estimates, 12);
    assert.equal(after.unresolved, 1, 'the new estimate has no recorded actual and must be excluded from calibration but counted in total_estimates');
    assert.equal(after.calibration.resolved, 11, 'calibration.resolved must not include the unresolved estimate');
  }
  ok('recordActual returns null for an unrecognised id without creating a record, and an estimate with no recorded actual is counted as unresolved and excluded from calibration');

  // ==== dispatch.js: batching bands, doc-quoted 10x threshold, checkpoints ====

  // ---- dispatch.js: the doc's "20 min at 2min overhead" worked threshold
  // sentence sits exactly on the per-frame side of the 10x line -------------
  // domain-profiles.md: "send per-frame only when render time per frame
  // exceeds roughly 10x that overhead ... 5 minutes per frame at 30-second
  // overhead, 20 minutes at 2-minute overhead." Only the 20-minute example is
  // usable as a direct assertion: per the doc's own table, "1-5 minutes" is a
  // flat, overhead-independent "batch 5-10" band, so the "5 minutes at
  // 30-second overhead" sentence never actually reaches the 10x-rule code
  // path at all — it is captured by the flat band first (verified below,
  // and flagged in the report as a prose/table inconsistency worth a
  // second look, not a code bug: the table is unambiguous and the code
  // matches it exactly).
  {
    const atLine2 = dispatchPlan({ frame_time_seconds: 20 * 60, overhead_seconds: 2 * 60 });
    assert.equal(atLine2.verdict.dispatch, 'per_frame', 'exactly 20 min at 2 min overhead is the doc\'s worked threshold point, and 20 min is past the flat 1-5min band so the 10x rule genuinely applies');

    const justUnder2 = dispatchPlan({ frame_time_seconds: 20 * 60 - 1, overhead_seconds: 2 * 60 });
    assert.equal(justUnder2.verdict.dispatch, 'batch', 'one second under the doc\'s own threshold example must batch');

    // The doc's other sentence ("5 minutes per frame at 30-second overhead")
    // sits exactly on the boundary of the flat "1-5 minutes: batch 5-10"
    // band, which the table defines as unconditional (no overhead check at
    // all) — so despite frame_time_seconds == threshold here, the verdict is
    // still 'batch', not 'per_frame'. This matches the table exactly; it is
    // the prose sentence that reads as if it were also a per-frame example.
    const atFiveMinuteLine = dispatchPlan({ frame_time_seconds: 5 * 60, overhead_seconds: 30 });
    assert.equal(atFiveMinuteLine.verdict.dispatch, 'batch', 'exactly 5 minutes is still inside the flat, overhead-independent 1-5 minute band per the doc\'s own table, even though frame_time_seconds equals 10x the overhead here');
  }
  ok('dispatchPlan places the doc\'s "20 min at 2min overhead" worked threshold sentence exactly on the per_frame side of the 10x line, one second short on the batch side, and confirms the doc\'s "5 min at 30s overhead" sentence is captured by the flat 1-5 minute band first (matching the table, not the prose reading in isolation)');

  // ---- dispatch.js: the <=30min / >30min branches both apply the same 10x
  // rule at their own 30-minute boundary ------------------------------------
  {
    const overhead = 3 * 60; // 3 min -> threshold is exactly 30 min
    const atThirty = dispatchPlan({ frame_time_seconds: 30 * 60, overhead_seconds: overhead });
    assert.equal(atThirty.verdict.dispatch, 'per_frame', 'exactly 30 min, on the <=30min branch, still clears its own 10x threshold');

    const justOverThirty = dispatchPlan({ frame_time_seconds: 30 * 60 + 60, overhead_seconds: overhead });
    assert.equal(justOverThirty.verdict.dispatch, 'per_frame', 'one minute past 30, now on the >30min branch, the same threshold still clears');
    assert.match(justOverThirty.verdict.detail, /Over 30 minutes per frame/, 'the >30min branch must use its own wording, not silently reuse the <=30min branch\'s');

    // Same >30min branch, but overhead large enough that the 10x line is not met.
    const overThirtyBatched = dispatchPlan({ frame_time_seconds: 30 * 60 + 60, overhead_seconds: 200 });
    assert.equal(overThirtyBatched.verdict.dispatch, 'batch', 'a long frame can still fail its own 10x threshold past the 30-minute mark');
  }
  ok('dispatchPlan applies the 10x-overhead rule independently on each side of the 30-minute branch split, with branch-appropriate wording');

  // ---- dispatch.js: the per-frame-time batching bands (under 1 min / 1-5
  // min), isolated from the 10x rule with a deliberately huge overhead so the
  // band boundary alone is under test -----------------------------------
  {
    const bigOverhead = 1000;
    const under1 = dispatchPlan({ frame_time_seconds: 59, overhead_seconds: bigOverhead });
    assert.equal(under1.verdict.frames_per_task, '20–50', 'under 1 minute per frame batches 20-50 frames per task');

    const atOneMinute = dispatchPlan({ frame_time_seconds: 60, overhead_seconds: bigOverhead });
    assert.equal(atOneMinute.verdict.frames_per_task, '5–10', 'exactly 1 minute belongs to the 1-5 minute band, not the under-1-minute band');

    const atFiveMinutes = dispatchPlan({ frame_time_seconds: 300, overhead_seconds: bigOverhead });
    assert.equal(atFiveMinutes.verdict.frames_per_task, '5–10', 'exactly 5 minutes still belongs to the 1-5 minute band');

    const justOverFive = dispatchPlan({ frame_time_seconds: 301, overhead_seconds: bigOverhead });
    assert.equal(justOverFive.verdict.frames_per_task, '2–5', 'one second past 5 minutes moves into the 5-30 minute band');
  }
  ok('dispatchPlan\'s per-frame-time batching bands (under 1 min: 20-50, 1-5 min: 5-10, 5-30 min: 2-5) land each documented boundary value on the correct side');

  // ---- dispatch.js: simulation is not frame-parallel regardless of timing ---
  {
    const sim = dispatchPlan({ frame_time_seconds: 600, overhead_seconds: 60, work_type: 'simulation' });
    assert.equal(sim.verdict.dispatch, 'not_frame_parallel');
    assert.match(sim.verdict.detail, /frame N depends on frame N-1/);
  }
  ok('dispatchPlan reports simulation as not_frame_parallel regardless of frame time or overhead');

  // ---- dispatch.js: invalid inputs are rejected, not silently coerced ------
  {
    assert.throws(() => dispatchPlan({ frame_time_seconds: 0, overhead_seconds: 60 }), ToolError);
    assert.throws(() => dispatchPlan({ frame_time_seconds: 60, overhead_seconds: -1 }), ToolError);
    assert.throws(() => dispatchPlan({ frame_time_seconds: 60, overhead_seconds: 60, work_type: 'bogus' }), (err) => err instanceof ToolError && err.code === 'invalid_work_type');
  }
  ok('dispatchPlan rejects a non-positive frame_time_seconds or overhead_seconds and an unrecognised work_type');

  // ---- checkpointInterval: the Young-Daly worked example from
  // domain-profiles.md — "a 60-second checkpoint and a 4-hour mean time to
  // preemption" is "about 22 minutes". sqrt(2*60*14400) = 24*sqrt(3000),
  // hand-computed to 1314.534s (sqrt(30) = 5.477225575...), independently of
  // the code, before checking it against the function. ----------------------
  {
    const result = checkpointInterval({ checkpoint_cost_seconds: 60, mean_time_between_interruptions_hours: 4 });
    assert.equal(result.optimal_interval_seconds, 1315, 'sqrt(2 x 60 x 14400) = 24 x sqrt(3000) ~= 1314.534s, which rounds to 1315');
    assert.equal(result.optimal_interval_minutes, 21.9, 'reference doc rounds this loosely to "about 22 minutes"; the precise figure is 21.9');
  }
  ok('checkpointInterval reproduces the Young-Daly worked example from references/domain-profiles.md (60s checkpoint, 4hr MTBI ~= 21.9min, hand-verified via 24*sqrt(3000))');

  {
    assert.throws(() => checkpointInterval({ checkpoint_cost_seconds: 0, mean_time_between_interruptions_hours: 4 }), ToolError);
    assert.throws(() => checkpointInterval({ checkpoint_cost_seconds: 60, mean_time_between_interruptions_hours: 0 }), ToolError);
  }
  ok('checkpointInterval rejects a non-positive checkpoint cost or mean time between interruptions');

  // ==== domains.js: name normalisation and the prototype-pollution guard ====
  {
    assert.equal(domainFor('path_tracing').label, 'GPU path tracing — Cycles, Redshift, Octane');
    assert.equal(domainFor('Path Tracing').label, domainFor('path_tracing').label, 'lookup must be case- and space-insensitive');
    assert.equal(domainFor('houdini-flip').label, 'Houdini FLIP', 'a dash must normalise the same as a space');
    assert.equal(domainFor('  training  ').usually_binds_on, 'VRAM capacity, then the input pipeline, then compute.', 'lookup must trim whitespace');
    assert.equal(domainFor('constructor'), null, 'an inherited Object.prototype name must not be handed back as a domain profile');
    assert.equal(domainFor('toString'), null, 'another inherited prototype name must also be rejected');
    assert.equal(domainFor('nonexistent_domain'), null);
    assert.equal(domainFor(undefined), null);
    assert.equal(domainFor(null), null);
  }
  ok('domainFor normalises case, spaces and dashes and trims whitespace for real domains, and returns null (not an inherited Object.prototype member) for an unrecognised or malicious name');

  // ==== memory.js: capacity arithmetic ======================================

  // ---- usableBudget: memory-arithmetic.md's own headline claim -------------
  {
    const budget = usableBudget(24);
    assert.equal(budget.usable_low_gb, 20.4);
    assert.equal(budget.usable_high_gb, 21.6);
    assert.equal(budget.usable_working_gb, 21.0, 'reference doc: "A 24 GB card gives about 21 GB of usable budget"');
  }
  ok('usableBudget reproduces the reference\'s own "24 GB card gives about 21 GB usable" figure exactly (21.0 GB working budget)');

  {
    assert.throws(() => usableBudget(0), ToolError);
    assert.throws(() => usableBudget(-5), ToolError);
  }
  ok('usableBudget rejects a non-positive vram_gb');

  // ---- renderVramEstimate: the texture-size table in memory-arithmetic.md,
  // reproduced from its own formula (width x height x channels x
  // bytes_per_channel x 1.33), independently confirming the table assumes
  // *square* power-of-two texture resolutions (2048/4096/8192), which is not
  // stated explicitly in the doc's prose — only recoverable by working the
  // formula backwards from the table's own MB figures. ----------------------
  {
    const budget = usableBudget(9999); // budget irrelevant here; only texture_breakdown is under test
    const twoK = renderVramEstimate({ vram_gb: 9999, triangles: 0, textures: [{ width_px: 2048, height_px: 2048, channels: 3, bytes_per_channel: 1 }] });
    assert.equal(twoK.texture_breakdown[0].estimated_gb, 0.02, '2K 8-bit RGB (2048x2048x3x1x1.33) ~= 16.7 MB, rounds to 0.02 GB, matching the table\'s "~17 MB"');

    const fourK = renderVramEstimate({ vram_gb: 9999, triangles: 0, textures: [{ width_px: 4096, height_px: 4096, channels: 3, bytes_per_channel: 1 }] });
    assert.equal(fourK.texture_breakdown[0].estimated_gb, 0.07, '4K 8-bit RGB ~= 66.9 MB, matching the table\'s "~67 MB"');

    const fourKHalf = renderVramEstimate({ vram_gb: 9999, triangles: 0, textures: [{ width_px: 4096, height_px: 4096, channels: 4, bytes_per_channel: 2 }] });
    assert.equal(fourKHalf.texture_breakdown[0].estimated_gb, 0.18, '4K 16-bit-half RGBA ~= 178.5 MB, matching the table\'s "~180 MB"');

    const eightKHalf = renderVramEstimate({ vram_gb: 9999, triangles: 0, textures: [{ width_px: 8192, height_px: 8192, channels: 4, bytes_per_channel: 2 }] });
    assert.equal(eightKHalf.texture_breakdown[0].estimated_gb, 0.71, '8K 16-bit-half RGBA ~= 714 MB, matching the table\'s "~715 MB"');
    void budget;
  }
  ok('renderVramEstimate\'s texture formula reproduces all four rows of memory-arithmetic.md\'s texture-size table, confirming the table assumes square power-of-two resolutions');

  // ---- renderVramEstimate: the full worked "24 GB card" example -----------
  // memory-arithmetic.md: "18M triangles at 64 bytes is 1.15 GB; BVH at 1.6x
  // adds 1.84 GB; 22 texture sets, mostly 4K 8-bit with four at 8K half, come
  // to 4.1 GB; a 4K framebuffer with 8 AOVs is 2.1 GB; renderer and driver
  // overhead 1.5 GB. Total ~10.7 GB, comfortable inside a 21 GB budget."
  // Hand-verified independently before writing this assertion:
  //   geometry  = 18,000,000 x 64 / 1e9           = 1.152  -> 1.15 GB
  //   bvh       = geometry x 1.6                  = 1.8432 -> 1.84 GB
  //   textures  = 18x(4096^2x3x1x1.33) + 4x(8192^2x4x2x1.33), /1e9 = 4.0611 -> 4.06 GB
  //   framebuffer = 3840x2160x8 AOVs x16x2 / 1e9  = 2.1234 -> 2.12 GB
  //   overhead  = 1.5 GB (default)
  //   total_working = (geometry+textures+framebuffer+overhead) + geometry x 1.6
  //                 = 8.8369 + 1.8432 = 10.6801 -> 10.68 GB, under the 21.6 GB
  //                   usable-high budget on a 24 GB card -> "fits"
  {
    const result = renderVramEstimate({
      vram_gb: 24,
      triangles: 18_000_000,
      textures: [
        { width_px: 4096, height_px: 4096, channels: 3, bytes_per_channel: 1, count: 18 },
        { width_px: 8192, height_px: 8192, channels: 4, bytes_per_channel: 2, count: 4 },
      ],
      resolution: { width_px: 3840, height_px: 2160 },
      aov_count: 8,
    });
    assert.equal(result.components_gb.geometry, 1.15, 'matches the doc\'s own "18M triangles at 64 bytes is 1.15 GB"');
    assert.equal(result.components_gb.bvh.working_gb, 1.84, 'matches the doc\'s own "BVH at 1.6x adds 1.84 GB"');
    assert.equal(result.components_gb.textures, 4.06, 'hand-computed from the doc\'s own "22 texture sets ... come to 4.1 GB" (4.06 GB at 2 decimal places rounds to the doc\'s 4.1 GB at 1 decimal place)');
    assert.equal(result.components_gb.framebuffer, 2.12, 'matches the doc\'s own "a 4K framebuffer with 8 AOVs is 2.1 GB"');
    assert.equal(result.total_gb.working, 10.68, 'matches the doc\'s own "Total ~10.7 GB"');
    assert.equal(result.verdict, 'fits', 'matches the doc\'s own "comfortable inside a 21 GB budget"');
  }
  ok('renderVramEstimate reproduces the full worked 24 GB-card example from references/memory-arithmetic.md: 1.15 GB geometry, 1.84 GB BVH, 4.06 GB textures, 2.12 GB framebuffer, 10.68 GB total, verdict fits');

  // ---- renderVramEstimate: the doc's follow-on scaling example -------------
  // memory-arithmetic.md continues: "Raise the four 8K half sets to twelve
  // and textures reach roughly 9.8 GB, total ~16.4 GB — still fits, but thin
  // enough that adding volumetrics pushes it over." Hand-verified: textures
  // = 18x(4096^2x3x1x1.33) + 12x(8192^2x4x2x1.33) /1e9 = 9.7734 -> 9.77 GB;
  // total_working = 16.3920 -> 16.39 GB, matching "~16.4 GB". BUT: by the
  // code's own fits/thin boundary (thin when total x1.2 >= usable_low_gb),
  // 16.39 x 1.2 = 19.67, which is BELOW the 24 GB card's usable_low_gb of
  // 20.4 — so the code's own verdict here is 'fits', not the "thin" the doc's
  // prose suggests. This is flagged in the report as a discrepancy between
  // the doc's qualitative wording and the code's own numeric threshold — not
  // asserted as "thin" here, since that would just be hand-writing an
  // assertion the code itself does not produce.
  {
    const result = renderVramEstimate({
      vram_gb: 24,
      triangles: 18_000_000,
      textures: [
        { width_px: 4096, height_px: 4096, channels: 3, bytes_per_channel: 1, count: 18 },
        { width_px: 8192, height_px: 8192, channels: 4, bytes_per_channel: 2, count: 12 },
      ],
      resolution: { width_px: 3840, height_px: 2160 },
      aov_count: 8,
    });
    assert.equal(result.components_gb.textures, 9.77, 'matches the doc\'s own "textures reach roughly 9.8 GB"');
    assert.equal(result.total_gb.working, 16.39, 'matches the doc\'s own "total ~16.4 GB"');
    assert.equal(result.verdict, 'fits', 'the code\'s own thin/fits threshold (total x1.2 >= usable_low_gb) is not crossed here (16.39x1.2=19.67 < 20.4), even though the doc\'s prose calls this scenario "thin" — see report');
  }
  ok('renderVramEstimate reproduces the doc\'s scaled-up follow-on example (9.77 GB textures, 16.39 GB total) and its own fits/thin threshold is checked against that figure directly, rather than assumed from the doc\'s prose');

  // ---- renderVramEstimate: subdivision multiplies the base count by 4^level -
  {
    const result = renderVramEstimate({ vram_gb: 999, triangles: 1000, subdivision_level: 3 });
    assert.equal(result.components_gb.geometry, 0.0, 'round2 of 1000*64*4^3/1e9 = 0.004096 rounds to 0 at 2 decimal places');
    assert.match(result.components_gb.subdivision_note, /4\^3 = 64x/, 'matches the doc\'s own "subdivision level 3 is 4^3 = 64x the base triangle count"');
    assert.match(result.components_gb.subdivision_note, /64,000 effective triangles/);
  }
  ok('renderVramEstimate\'s subdivision multiplier matches the reference\'s "4^level x the base triangle count" rule exactly (level 3 -> 64x, 1000 -> 64,000 effective triangles)');

  // ---- renderVramEstimate: fits / thin / does_not_fit boundaries, isolated
  // via a zero-geometry, zero-texture render whose only cost is the fixed
  // engine_overhead_gb, so total_gb.working is set precisely by that one
  // input -------------------------------------------------------------------
  // budget for vram_gb=24: usable_low=20.4, usable_high=21.6.
  // thin/fits boundary: total*1.2 >= 20.4  <=>  total >= 17.0 exactly.
  // thin/does_not_fit boundary: total > 21.6 exactly.
  {
    const atUsableHigh = renderVramEstimate({ vram_gb: 24, triangles: 0, engine_overhead_gb: 21.6 });
    assert.equal(atUsableHigh.verdict, 'thin', 'exactly at usable_high_gb the comparison is a strict ">", so this must still be thin, not does_not_fit');

    const justOverUsableHigh = renderVramEstimate({ vram_gb: 24, triangles: 0, engine_overhead_gb: 21.61 });
    assert.equal(justOverUsableHigh.verdict, 'does_not_fit');

    const atThinLine = renderVramEstimate({ vram_gb: 24, triangles: 0, engine_overhead_gb: 17.0 });
    assert.equal(atThinLine.verdict, 'thin', 'exactly at total*1.2 == usable_low_gb, the ">=" comparison must count this as thin');

    const justUnderThinLine = renderVramEstimate({ vram_gb: 24, triangles: 0, engine_overhead_gb: 16.99 });
    assert.equal(justUnderThinLine.verdict, 'fits');
  }
  ok('renderVramEstimate\'s fits/thin/does_not_fit verdict lands each boundary value (total==usable_high, total*1.2==usable_low) on the documented side, both exactly on the line and one step past it');

  // ---- renderVramEstimate: invalid inputs -----------------------------------
  {
    assert.throws(() => renderVramEstimate({ vram_gb: 24, triangles: -1 }), ToolError);
    assert.throws(() => renderVramEstimate({ vram_gb: 24, triangles: 100, bytes_per_triangle: 10 }), ToolError, 'bytes_per_triangle outside the reference range 50-100 must be rejected');
    assert.throws(() => renderVramEstimate({ vram_gb: 24, triangles: 100, subdivision_level: 7 }), ToolError, 'subdivision_level is capped at 6');
    assert.throws(() => renderVramEstimate({ vram_gb: 24, triangles: 100, resolution: { width_px: 100, height_px: 100 } }), ToolError, 'resolution without a positive aov_count must be rejected');
  }
  ok('renderVramEstimate rejects negative triangle counts, an out-of-range bytes_per_triangle, an out-of-range subdivision_level, and a resolution given without aov_count');

  // ---- trainingVramEstimate: the full worked "1.3B on a 24 GB card" example -
  // memory-arithmetic.md: "Static state under mixed precision with Adam is
  // 20.8 GB against a usable budget of about 21 GB, which leaves nothing at
  // all for activations ... Verdict: it does not fit ... 8-bit Adam takes
  // static state to 13 GB and leaves 8 GB for activations; LoRA takes it to
  // about 2.6 GB plus adapters." Hand-verified: 1.3 x 16 = 20.8; 1.3 x 10 =
  // 13; 1.3 x 2 = 2.6 — all exact, before checking the function.
  {
    const result = trainingVramEstimate({ vram_gb: 24, parameters_billion: 1.3 });
    assert.equal(result.static_state_gb, 20.8);
    assert.equal(result.total_gb, 20.8, 'no activations were supplied, so the total is static state alone');
    assert.equal(result.verdict, 'does_not_fit', 'matches the doc\'s own "Verdict: it does not fit"');
    assert.equal(result.cliff.algorithmic_remedies[0], '8-bit Adam — static state falls to 13 GB at 10 bytes per parameter', 'matches the doc\'s own "8-bit Adam takes static state to 13 GB"');
    assert.equal(result.cliff.algorithmic_remedies[1], 'LoRA with the base frozen — static state falls to about 2.6 GB plus adapters', 'matches the doc\'s own "LoRA takes it to about 2.6 GB plus adapters"');
  }
  ok('trainingVramEstimate reproduces the full worked 1.3B-on-24GB example from references/memory-arithmetic.md exactly: 20.8 GB static state, does_not_fit, and both quoted algorithmic remedies (13 GB, 2.6 GB)');

  // ---- trainingVramEstimate: the "static state alone consumes the card"
  // cliff override fires at its own documented boundary (>=usable_low_gb),
  // inclusive, and does not fire just below it -------------------------------
  // usable_low_gb for a 24 GB card is 20.4. 20.4 / 16 = 1.275 exactly.
  {
    const atBoundary = trainingVramEstimate({ vram_gb: 24, parameters_billion: 1.275 });
    assert.equal(atBoundary.static_state_gb, 20.4);
    assert.equal(atBoundary.verdict, 'does_not_fit', 'exactly at usable_low_gb, the cliff override\'s ">=" must still fire');
    assert.ok(atBoundary.cliff, 'the cliff remedies block must be present exactly at the boundary');

    const justUnder = trainingVramEstimate({ vram_gb: 24, parameters_billion: 1.27 });
    assert.equal(justUnder.static_state_gb, 20.32);
    assert.equal(justUnder.verdict, 'thin', 'just under usable_low_gb the cliff override must not fire, and the plain thin/fits check takes over (20.32*1.2=24.38 >= 20.4)');
    assert.equal(justUnder.cliff, undefined, 'no cliff remedies block when the override has not fired');
  }
  ok('trainingVramEstimate\'s "static state alone consumes the card" cliff override fires exactly at static_state_gb == usable_low_gb and not one step below it');

  // ---- trainingVramEstimate: LoRA formula, hand-computed -------------------
  // 7B base frozen at 2 bytes/param = 14 GB; 25M trainable adapter params at
  // 16 bytes/param = 0.4 GB; total 14.4 GB, comfortably under a 24 GB card.
  {
    const result = trainingVramEstimate({ vram_gb: 24, parameters_billion: 7, configuration: 'lora', trainable_adapter_parameters_million: 25 });
    assert.equal(result.static_state_gb, 14.4);
    assert.equal(result.verdict, 'fits');
  }
  ok('trainingVramEstimate\'s LoRA formula (2 bytes/base-param + 16 bytes/adapter-param) matches a hand-computed 7B-base/25M-adapter example (14.4 GB)');

  {
    assert.throws(() => trainingVramEstimate({ vram_gb: 24, parameters_billion: 7, configuration: 'lora' }), ToolError, 'LoRA without trainable_adapter_parameters_million must be rejected');
    assert.throws(() => trainingVramEstimate({ vram_gb: 24, parameters_billion: 1, configuration: 'bogus_config' }), (err) => err instanceof ToolError && err.code === 'invalid_configuration');
    assert.throws(() => trainingVramEstimate({ vram_gb: 24, parameters_billion: 0 }), ToolError);
  }
  ok('trainingVramEstimate rejects LoRA without adapter parameters, an unrecognised configuration, and a non-positive parameters_billion');

  // ---- trainingVramEstimate: activations formula, hand-computed, and the
  // fused-attention caveat is present only when fused_attention is false ----
  // layers x batch x seq_len x hidden x 34 / 1e9 = 10x2x1000x1000x34/1e9 = 0.68
  {
    const fused = trainingVramEstimate({
      vram_gb: 999, parameters_billion: 1, configuration: 'inference_fp16',
      activations: { layers: 10, batch_size: 2, seq_len: 1000, hidden_size: 1000, fused_attention: true },
    });
    assert.equal(fused.activations_gb, 0.68);
    assert.equal(fused.total_gb, 2.68, '1 x 2 bytes/param (inference_fp16) = 2 GB static + 0.68 GB activations');
    assert.ok(!fused.notes.some((n) => n.includes('seq_len squared')), 'the quadratic-attention caveat must not appear when fused_attention is true');

    const unfused = trainingVramEstimate({
      vram_gb: 999, parameters_billion: 1, configuration: 'inference_fp16',
      activations: { layers: 10, batch_size: 2, seq_len: 1000, hidden_size: 1000, fused_attention: false },
    });
    assert.equal(unfused.activations_gb, 0.68, 'the numeric estimate is the same either way — only the note differs');
    assert.ok(unfused.notes.some((n) => n.includes('seq_len squared')), 'the quadratic-attention caveat must appear when fused_attention is false (the default)');
  }
  ok('trainingVramEstimate\'s activations formula matches a hand-computed example (0.68 GB), and the unfused-attention caveat note appears only when fused_attention is false');

  {
    assert.throws(() => trainingVramEstimate({
      vram_gb: 24, parameters_billion: 1,
      activations: { layers: 0, batch_size: 1, seq_len: 1, hidden_size: 1 },
    }), ToolError, 'activations with a non-positive layers must be rejected');
  }
  ok('trainingVramEstimate rejects an activations block with a non-positive field');

  // ==== triage.js: the four discriminating tests and the classifier =========

  // ---- Test 1 (halve the work): every documented band boundary, both sides -
  // memory bank of ratio = time_after / time_before:
  //   ratio <= 1/3          -> capacity ("3x or better")
  //   ratio in [0.4, 0.6]   -> compute ("roughly half")
  //   ratio >= 0.75          -> fixed_overhead + io ("a quarter or less"), UNLESS
  //   ratio >= 0.95          -> fixed_overhead alone ("does not change")
  //   otherwise              -> between the reference bands, no verdict
  {
    const readHalveWork = (time_before_seconds, time_after_seconds) =>
      classifyBottleneck({ halve_work: { time_before_seconds, time_after_seconds } });

    // These single-finding calls all report insufficient_evidence (fewer
    // than two findings) — the `findings[0].supports`/`band` fields (visible
    // in the raw result before the aggregate verdict) are what is under test
    // here, not the aggregate status.
    const at1of3 = readHalveWork(3, 1);
    assert.deepEqual(at1of3.findings[0].supports, ['capacity'], 'ratio exactly 1/3 is documented as "3x or better" and belongs to capacity');
    const justAbove1of3 = readHalveWork(3, 1.01);
    assert.deepEqual(justAbove1of3.findings[0].supports, [], 'one hundredth above 1/3 must fall between the reference bands, not still count as capacity');

    const at040 = readHalveWork(1000, 400);
    assert.deepEqual(at040.findings[0].supports, ['compute'], '0.40 exactly is the documented lower edge of "roughly half"');
    const at039 = readHalveWork(1000, 390);
    assert.deepEqual(at039.findings[0].supports, [], '0.39 must fall between the reference bands, not count as compute');

    const at060 = readHalveWork(1000, 600);
    assert.deepEqual(at060.findings[0].supports, ['compute'], '0.60 exactly is the documented upper edge of "roughly half"');
    const at061 = readHalveWork(1000, 610);
    assert.deepEqual(at061.findings[0].supports, [], '0.61 must fall between the reference bands, not count as compute');

    const at075 = readHalveWork(1000, 750);
    assert.deepEqual(at075.findings[0].supports, ['fixed_overhead', 'io'], '0.75 exactly is the documented edge of "a quarter or less"');
    const at0749 = readHalveWork(10000, 7490);
    assert.deepEqual(at0749.findings[0].supports, [], '0.749 must fall between the reference bands');

    const at095 = readHalveWork(1000, 950);
    assert.deepEqual(at095.findings[0].supports, ['fixed_overhead'], '0.95 exactly is the documented edge of "does not change"');
    const at0949 = readHalveWork(10000, 9490);
    assert.deepEqual(at0949.findings[0].supports, ['fixed_overhead', 'io'], '0.949 belongs to the "a quarter or less" band, not "does not change"');
  }
  ok('classifyBottleneck\'s Test-1 (halve the work) reads every documented band boundary (1/3, 0.40, 0.60, 0.75, 0.95) on its correct side, on both edges');

  // ---- Test 2 (occupancy vs utilisation): the >90 / <50 boundaries are
  // strict, not inclusive -----------------------------------------------------
  {
    const readOU = (vram_occupancy_percent, gpu_utilisation_percent) =>
      classifyBottleneck({ occupancy_utilisation: { vram_occupancy_percent, gpu_utilisation_percent } });

    const at90 = readOU(90, 95);
    assert.deepEqual(at90.findings[0].supports, [], 'occupancy exactly 90 is NOT ">90" and must land in the middle zone, not the high-occupancy reading');
    const at91 = readOU(91, 95);
    assert.deepEqual(at91.findings[0].supports, ['compute', 'bandwidth'], 'occupancy 91 clears the >90 high-occupancy line');

    const at50 = readOU(50, 20);
    assert.deepEqual(at50.findings[0].supports, [], 'occupancy exactly 50 is NOT "<50" and must land in the middle zone, not the low-occupancy reading');
    const at49 = readOU(49, 20);
    assert.deepEqual(at49.findings[0].supports, ['io', 'starvation'], 'occupancy 49 clears the <50 low-occupancy line');
  }
  ok('classifyBottleneck\'s Test-2 (occupancy vs utilisation) treats the documented >90 and <50 bands as strict inequalities, both at the boundary value and one step past it');

  {
    const sawtooth = classifyBottleneck({ occupancy_utilisation: { utilisation_sawtooths: true } });
    assert.deepEqual(sawtooth.findings[0].supports, ['starvation']);
    assert.throws(() => classifyBottleneck({ occupancy_utilisation: {} }), ToolError, 'occupancy_utilisation with neither numeric readings nor sawtooth must be rejected');
  }
  ok('classifyBottleneck\'s Test-2 recognises the sawtooth reading as starvation and rejects an empty reading');

  // ---- Test 3 (cold vs warm): the <=0.7 / >=0.9 boundaries -----------------
  {
    const readCW = (cold_seconds, warm_seconds) => classifyBottleneck({ cold_warm: { cold_seconds, warm_seconds } });

    const at070 = readCW(1000, 700);
    assert.deepEqual(at070.findings[0].supports, ['io'], '0.70 exactly is the documented edge of "much faster"');
    const at0701 = readCW(1000, 701);
    assert.deepEqual(at0701.findings[0].supports, [], '0.701 must fall between the reference bands');

    const at090 = readCW(1000, 900);
    assert.deepEqual(at090.findings[0].supports, [], '0.90 exactly is the documented edge of "the same" (no class supported either way)');
    const at0899 = readCW(1000, 899);
    assert.deepEqual(at0899.findings[0].supports, [], '0.899 must also fall between the reference bands');
  }
  ok('classifyBottleneck\'s Test-3 (cold vs warm) reads the documented 0.70 and 0.90 boundaries on their correct side');

  {
    assert.throws(() => classifyBottleneck({ cold_warm: { cold_seconds: 0, warm_seconds: 1 } }), ToolError);
  }
  ok('classifyBottleneck\'s Test-3 rejects a non-positive cold_seconds or warm_seconds');

  // ---- Test 4 (clock scaling): the documented "more than 6%" boundary -----
  {
    const at6 = classifyBottleneck({ clock_scaling: { memory_clock_cut_throughput_loss_percent: 6 } });
    assert.deepEqual(at6.findings[0].supports, [], 'exactly 6% must NOT clear the documented "more than 6%" line');
    const at601 = classifyBottleneck({ clock_scaling: { memory_clock_cut_throughput_loss_percent: 6.01 } });
    assert.deepEqual(at601.findings[0].supports, ['bandwidth'], '6.01% clears the "more than 6%" line');

    const tie = classifyBottleneck({ clock_scaling: { memory_clock_cut_throughput_loss_percent: 10, core_clock_cut_throughput_loss_percent: 10 } });
    assert.deepEqual(tie.findings[0].supports, [], 'equal sensitivity on both clocks must not favour either class');

    assert.throws(() => classifyBottleneck({ clock_scaling: {} }), ToolError, 'clock_scaling with neither reading must be rejected');
  }
  ok('classifyBottleneck\'s Test-4 (clock scaling) reads the documented "more than 6%" boundary exactly, and treats an equal-loss tie as inconclusive');

  // ---- classifyBottleneck: the aggregate verdict states --------------------
  {
    assert.throws(() => classifyBottleneck({}), (err) => err instanceof ToolError && err.code === 'no_evidence');
  }
  ok('classifyBottleneck refuses to classify with no evidence supplied at all');

  {
    // A single, strongly capacity-supporting finding is still insufficient —
    // the method's own bar is two agreeing findings, not one strong one.
    const oneFinding = classifyBottleneck({ halve_work: { time_before_seconds: 100, time_after_seconds: 10 } });
    assert.equal(oneFinding.verdict.status, 'insufficient_evidence');
    assert.equal(oneFinding.verdict.class, null);
  }
  ok('classifyBottleneck reports insufficient_evidence from a single finding, however strongly it points to one class, matching "do not move to remedies on fewer than two pieces of evidence"');

  {
    // Two agreeing findings name the class: halve_work (ratio<=1/3 -> capacity)
    // plus occupancy (high occupancy, low utilisation -> capacity+starvation).
    const named = classifyBottleneck({
      halve_work: { time_before_seconds: 100, time_after_seconds: 20 },
      occupancy_utilisation: { vram_occupancy_percent: 95, gpu_utilisation_percent: 10 },
    });
    assert.equal(named.verdict.status, 'named');
    assert.equal(named.verdict.class, 'capacity');
    assert.equal(named.verdict.agreeing_findings, 2);
    assert.deepEqual(named.verdict.also_supported, { class: 'starvation', findings: 1 });
  }
  ok('classifyBottleneck names the class once two findings agree, and reports the runner-up class separately rather than dropping it');

  {
    // Two findings, one vote each for two different classes: neither reaches
    // the two-vote bar, and they are not tied at >=2 either, so this falls to
    // the final "insufficient, with a leading candidate" branch, not to
    // "conflicting" (that status is reserved for a tie at >=2 each).
    const leadingOnly = classifyBottleneck({
      halve_work: { time_before_seconds: 1000, time_after_seconds: 500 }, // ratio 0.5 -> compute, 1 vote
      cold_warm: { cold_seconds: 1000, warm_seconds: 600 }, // ratio 0.6 -> io, 1 vote
    });
    assert.equal(leadingOnly.verdict.status, 'insufficient_evidence');
    assert.equal(leadingOnly.verdict.leading_candidate.class, 'compute');
    assert.equal(leadingOnly.verdict.leading_candidate.findings, 1);
  }
  ok('classifyBottleneck treats a 1-vote-each split between two classes as insufficient evidence with a leading candidate, not as a tie (the tie status requires >=2 votes each)');

  {
    // A genuine tie at 2 votes each (compute vs bandwidth), with a mapped
    // next-test lookup: halve_work (ratio 0.5 -> compute), occupancy (both
    // >90 -> compute+bandwidth), clock_scaling (mem>core -> bandwidth).
    // Final vote order of insertion is compute, then bandwidth, both at 2.
    const conflictingMapped = classifyBottleneck({
      halve_work: { time_before_seconds: 1000, time_after_seconds: 500 },
      occupancy_utilisation: { vram_occupancy_percent: 95, gpu_utilisation_percent: 95 },
      clock_scaling: { memory_clock_cut_throughput_loss_percent: 10, core_clock_cut_throughput_loss_percent: 2 },
    });
    assert.equal(conflictingMapped.verdict.status, 'conflicting');
    assert.deepEqual(conflictingMapped.verdict.candidates, ['compute', 'bandwidth']);
    assert.match(conflictingMapped.verdict.next_test, /Test 4 \(scale one clock at a time\)/, 'a compute/bandwidth tie has a specific mapped next-test suggestion');
  }
  ok('classifyBottleneck reports a genuine 2-vs-2 tie (compute vs bandwidth) as conflicting, with the specific mapped next-test suggestion');

  {
    // A 2-vs-2 tie between two classes with no entry in NEXT_TEST_FOR (the
    // map only has 4 of the 10 possible class pairs): compute (halve_work +
    // clock_scaling) vs io (cold_warm + occupancy).
    const conflictingUnmapped = classifyBottleneck({
      halve_work: { time_before_seconds: 1000, time_after_seconds: 500 }, // compute
      cold_warm: { cold_seconds: 1000, warm_seconds: 700 }, // io
      occupancy_utilisation: { vram_occupancy_percent: 20, gpu_utilisation_percent: 20 }, // io + starvation
      clock_scaling: { memory_clock_cut_throughput_loss_percent: 2, core_clock_cut_throughput_loss_percent: 20 }, // compute
    });
    assert.equal(conflictingUnmapped.verdict.status, 'conflicting');
    assert.deepEqual(conflictingUnmapped.verdict.candidates, ['compute', 'io']);
    assert.equal(conflictingUnmapped.verdict.next_test, 'Run one more discriminating test from triage_reference.', 'an unmapped class pair must fall back to the generic next-test message, not a wrong or missing one');
  }
  ok('classifyBottleneck falls back to the generic next-test message for a tied class pair that has no specific entry in the next-test map');

  // ==== telemetry.js / headroom.js: the measured side ========================
  // The live probes (nvidia-smi, ps, /proc) depend on the machine, so what is
  // tested here is everything deterministic: the nvidia-smi field parser and
  // the headroom logic over synthetic snapshots — never a live reading, whose
  // asserted value would just encode whichever machine ran the tests.

  {
    assert.equal(parseMib('24564 MiB'), 24564);
    assert.equal(parseMib(' 1024 MiB '), 1024, 'surrounding whitespace from a CSV split must not defeat the parse');
    assert.equal(parseMib('[N/A]'), null, 'nvidia-smi\'s own not-available marker must parse to null, never to a number');
    assert.equal(parseMib('24564'), null, 'a bare number without the MiB unit is not a trusted reading');
    assert.equal(parseMib(undefined), null);
  }
  ok('parseMib reads nvidia-smi\'s "N MiB" fields, tolerates CSV whitespace, and returns null (never a number) for [N/A], unitless or missing fields');

  // A synthetic snapshot: 24 GB card with 6 GB in use (18 GB free), 64 GB RAM
  // with 40 GB allocatable, and a measured process list.
  const fakeSnapshot = {
    taken_at: '2026-01-01T00:00:00.000Z',
    ram: { label: 'measured', total_gb: 64, free_gb: 12, available_gb: 40 },
    gpu: {
      available: true,
      source: 'nvidia-smi',
      gpus: [{ label: 'measured', name: 'Test GPU 24GB', memory_total_gb: 24, memory_used_gb: 6, memory_free_gb: 18 }],
    },
    top_memory_processes: {
      available: true,
      source: 'ps -eo rss,comm --sort=-rss',
      processes: [{ label: 'measured', command: 'chrome', resident_mb: 4096 }],
    },
  };
  const noGpuSnapshot = {
    ...fakeSnapshot,
    gpu: { available: false, reason: 'nvidia-smi not found or no NVIDIA GPU' },
  };

  {
    // The reference's worked 24 GB scene (10.68 GB working estimate) against
    // 18 GB measured free: usableBudget(18) is 15.3–16.2 usable, and
    // 10.68 x 1.2 = 12.82 < 15.3, so it fits. vram_gb omitted -> the
    // measured card's total feeds the estimator.
    const result = headroomCheck({
      job: 'render',
      resource: 'gpu_vram',
      render: {
        triangles: 18_000_000,
        textures: [
          { width_px: 4096, height_px: 4096, channels: 3, bytes_per_channel: 1, count: 18 },
          { width_px: 8192, height_px: 8192, channels: 4, bytes_per_channel: 2, count: 4 },
        ],
        resolution: { width_px: 3840, height_px: 2160 },
        aov_count: 8,
      },
    }, fakeSnapshot);
    assert.equal(result.estimate.label, 'estimated');
    assert.equal(result.measured.label, 'measured');
    assert.equal(result.estimate.total_gb, 10.68, 'the estimate side must be exactly what vram_estimate produces — shared function, not a copy');
    assert.equal(result.estimate.vram_gb_fed_to_estimator.value, 24);
    assert.match(result.estimate.vram_gb_fed_to_estimator.source, /^measured/, 'with vram_gb omitted, the card figure is the measured one and says so');
    assert.equal(result.measured.free_gb, 18);
    assert.equal(result.headroom.budget_gb.usable_low_gb, 15.3, 'the 10–15% reserve rule applied to the measured free figure: 18 x 0.85');
    assert.equal(result.headroom.verdict, 'fits');
    assert.equal(result.background_tasks_to_close, undefined, 'a fitting plan does not tell anyone to close anything');
  }
  ok('headroomCheck reuses renderVramEstimate verbatim (10.68 GB for the reference scene), fills vram_gb from the measured card, and applies the reserve rule to the measured 18 GB free (usable 15.3–16.2) for a fits verdict');

  {
    // 7B full fine-tune (112 GB static) against the same card: does_not_fit,
    // and the measured process list becomes the tasks-to-close list.
    const result = headroomCheck({ job: 'training', resource: 'gpu_vram', training: { parameters_billion: 7 } }, fakeSnapshot);
    assert.equal(result.estimate.total_gb, 112);
    assert.equal(result.headroom.verdict, 'does_not_fit');
    assert.equal(result.background_tasks_to_close.processes[0].command, 'chrome', 'the tasks-to-close list is the snapshot\'s measured process list, not advice invented from nothing');
    assert.match(result.background_tasks_to_close.basis, /not attributed VRAM/, 'the list must say it measures host RAM, not per-process VRAM');
  }
  ok('headroomCheck reports a 7B full fine-tune (112 GB, shared trainingVramEstimate) as does_not_fit on an 18 GB-free card and lists the snapshot\'s measured top processes as the background tasks to close');

  {
    // system_ram resource: checked against available_gb (40), not free_gb (12).
    const result = headroomCheck({ job: 'training', resource: 'system_ram', training: { vram_gb: 24, parameters_billion: 1.3 } }, fakeSnapshot);
    assert.equal(result.measured.free_gb, 40, 'system RAM headroom must use MemAvailable-style allocatable RAM, not the understating os.freemem figure');
    assert.equal(result.estimate.total_gb, 20.8);
    assert.equal(result.headroom.verdict, 'fits', '20.8 x 1.2 = 24.96 < usableBudget(40).usable_low_gb of 34, so this fits with margin');
    assert.equal(result.estimate.vram_gb_fed_to_estimator.source, 'reported by the caller');
    assert.equal(allocatableRamGb(fakeSnapshot.ram), 40);
    assert.equal(allocatableRamGb({ free_gb: 12 }), 12, 'without MemAvailable the fallback is free_gb');
  }
  ok('headroomCheck\'s system_ram resource compares the estimate against measured allocatable RAM (MemAvailable when present, os.freemem otherwise) and keeps a caller-reported vram_gb labelled as reported');

  {
    // Honesty on the missing GPU: gpu_vram without a measurable card is a
    // refusal, never a guess; and with no vram_gb from anywhere the estimate
    // cannot run at all.
    assert.throws(
      () => headroomCheck({ job: 'render', resource: 'gpu_vram', render: { vram_gb: 24, triangles: 1000 } }, noGpuSnapshot),
      (err) => err instanceof ToolError && err.code === 'gpu_unavailable' && /nvidia-smi not found or no NVIDIA GPU/.test(err.message)
    );
    assert.throws(
      () => headroomCheck({ job: 'render', resource: 'system_ram', render: { triangles: 1000 } }, noGpuSnapshot),
      (err) => err instanceof ToolError && err.code === 'no_vram_figure'
    );
    assert.throws(() => headroomCheck({ job: 'bogus', resource: 'gpu_vram' }, fakeSnapshot), (err) => err instanceof ToolError && err.code === 'invalid_job');
    assert.throws(() => headroomCheck({ job: 'render', resource: 'bogus' }, fakeSnapshot), (err) => err instanceof ToolError && err.code === 'invalid_resource');
    assert.throws(() => headroomCheck({ job: 'render', resource: 'gpu_vram' }, fakeSnapshot), (err) => err instanceof ToolError && err.code === 'invalid_input');
    assert.throws(() => headroomCheck({ job: 'render', resource: 'gpu_vram', gpu_index: 3, render: { triangles: 1 } }, fakeSnapshot), (err) => err instanceof ToolError && err.code === 'invalid_gpu_index');
  }
  ok('headroomCheck refuses a GPU check without a measurable card (quoting the probe\'s honest reason), refuses to estimate with no vram_gb from caller or measurement, and rejects a bad job, resource or gpu_index');

  {
    // A card measured completely full: the verdict is does_not_fit with a
    // negative headroom, not a divide-by-zero or a budget over 0 GB.
    const fullSnapshot = {
      ...fakeSnapshot,
      gpu: { available: true, gpus: [{ label: 'measured', name: 'Full GPU', memory_total_gb: 24, memory_used_gb: 24, memory_free_gb: 0 }] },
    };
    const result = headroomCheck({ job: 'render', resource: 'gpu_vram', render: { triangles: 1000 } }, fullSnapshot);
    assert.equal(result.headroom.verdict, 'does_not_fit');
    assert.ok(result.headroom.headroom_gb.value < 0, 'headroom against a full card must be negative, not clamped or NaN');
    assert.ok(result.background_tasks_to_close, 'a full card is exactly the case where the tasks-to-close list matters');
  }
  ok('headroomCheck handles a card measured completely full (0 GB free) as does_not_fit with negative headroom and the tasks-to-close list, rather than erroring in usableBudget');

  console.log(`\n${passed} predictive-resource-allocation domain checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(process.env.XDG_CONFIG_HOME, { recursive: true, force: true });
}
