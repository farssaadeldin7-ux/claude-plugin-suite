#!/usr/bin/env node
/**
 * Regression tests for lib/reconcile.js: classifying real retention drops
 * against the model's tripped stretches.
 *
 *   node plugins/emotional-resonance-analyzer/mcp/test/reconcile.test.mjs
 */
import assert from 'node:assert/strict';
import { reconcileDrops } from '../lib/reconcile.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

try {
  const stretches = [{ from: 100, to: 200, cause: 'tonal_monotony' }];

  // ---- a drop inside the stretch is explained ------------------------------
  {
    const r = reconcileDrops({ drops: [{ timecode: '150' }], stretches });
    assert.equal(r.drops[0].classification, 'explained');
    assert.deepEqual(r.drops[0].causes, ['tonal_monotony']);
    assert.equal(r.model_only_tells.length, 0, 'the stretch was matched, so it must not also appear as model-only');
  }
  ok('a drop landing inside a tripped stretch is classified explained, and the stretch is not reported as model-only');

  // ---- default after-window boundary: exactly at to+15 is still explained,
  // to+16 is not ----------------------------------------------------------
  {
    const atWindow = reconcileDrops({ drops: [{ timecode: '215' }], stretches }); // 200 + 15
    assert.equal(atWindow.drops[0].classification, 'explained', 'a drop exactly at the stretch end plus the default 15-second window must still be explained');

    const pastWindow = reconcileDrops({ drops: [{ timecode: '216' }], stretches });
    assert.equal(pastWindow.drops[0].classification, 'unexplained', 'a drop one second past the default window must be unexplained');
  }
  ok('default after-window boundary: a drop at stretch-end+15s is explained, stretch-end+16s is not');

  // ---- a drop before the stretch entirely is unexplained -------------------
  {
    const r = reconcileDrops({ drops: [{ timecode: '50' }], stretches });
    assert.equal(r.drops[0].classification, 'unexplained');
    assert.match(r.drops[0].reading, /no structural tell/);
  }
  ok('a drop that lands before any tripped stretch (and outside its window) is unexplained');

  // ---- a custom after_window_seconds is honoured, including its own boundary
  {
    const custom = reconcileDrops({ drops: [{ timecode: '230' }], stretches, afterWindowSeconds: 30 }); // 200+30
    assert.equal(custom.drops[0].classification, 'explained');
    assert.equal(custom.explained_window_seconds, 30);
    const customPast = reconcileDrops({ drops: [{ timecode: '231' }], stretches, afterWindowSeconds: 30 });
    assert.equal(customPast.drops[0].classification, 'unexplained');
  }
  ok('a custom afterWindowSeconds is applied and reported, including its own exact boundary');

  // ---- a stretch with no matching drop is reported model-only -------------
  {
    const r = reconcileDrops({ drops: [{ timecode: '9999' }], stretches: [{ from: 100, to: 200, cause: 'texture_starvation' }] });
    assert.equal(r.model_only_tells.length, 1);
    assert.equal(r.model_only_tells[0].cause, 'texture_starvation');
    assert.match(r.model_only_tells[0].reading, /model was wrong here/);
  }
  ok('a tripped stretch with no matching drop is reported as model_only, with the "model was wrong here" reading');

  // ---- one drop matching two overlapping stretches reports both causes,
  // deduplicated -------------------------------------------------------------
  {
    const overlapping = [
      { from: 100, to: 200, cause: 'tonal_monotony' },
      { from: 150, to: 250, cause: 'no_question_open' },
    ];
    const r = reconcileDrops({ drops: [{ timecode: '175' }], stretches: overlapping });
    assert.deepEqual([...r.drops[0].causes].sort(), ['no_question_open', 'tonal_monotony']);
    assert.equal(r.drops[0].stretches.length, 2);
  }
  ok('a drop matching two overlapping stretches reports both causes and both stretches');

  // ---- notes carry through, and an invalid timecode throws -----------------
  {
    const r = reconcileDrops({ drops: [{ timecode: '150', note: 'audience poll spike' }], stretches });
    assert.equal(r.drops[0].note, 'audience poll spike');

    assert.throws(() => reconcileDrops({ drops: [{ timecode: 'not-a-time' }], stretches }), /Drop 1:.*not readable/);
  }
  ok('a drop\'s note is carried through into the classified output, and an unreadable drop timecode throws with a clear 1-indexed message');

  console.log(`\n${passed} reconcile.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
