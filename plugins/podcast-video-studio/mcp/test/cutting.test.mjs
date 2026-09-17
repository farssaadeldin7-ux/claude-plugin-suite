#!/usr/bin/env node
/**
 * Regression tests for lib/cutting.js: timecode parsing on every documented
 * form, the destination render targets derived from the spec table, plan
 * validation (all-or-nothing refusals, including the longer-than-destination
 * refusal citing the spec band), deterministic output naming, and the shape
 * of the ffmpeg commands. Nothing here runs ffmpeg — command execution is
 * covered by the functional smoke, which needs ffmpeg installed.
 *
 *   node plugins/podcast-video-studio/mcp/test/cutting.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseTimecode, formatTimecode, timecodeToken, formatSpecFor, planCuts, shellCommand,
} from '../lib/cutting.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pvs-cutting-'));
const source = path.join(tmp, 'episode.mp4');
fs.writeFileSync(source, 'not really media, but it exists');

try {
  // ---- parseTimecode: every documented form ---------------------------------
  {
    assert.equal(parseTimecode('00:14:22'), 14 * 60 + 22);
    assert.equal(parseTimecode('01:02:03.5'), 3723.5);
    assert.equal(parseTimecode('14:22'), 862, 'mm:ss without hours');
    assert.equal(parseTimecode('90'), 90, 'numeric string of seconds');
    assert.equal(parseTimecode(90.5), 90.5, 'plain number of seconds');
    assert.equal(parseTimecode('1:70:00'), null, '70 minutes is not a timecode');
    assert.equal(parseTimecode('abc'), null);
    assert.equal(parseTimecode(-5), null, 'negative seconds are not a position');
    assert.equal(parseTimecode(''), null);
  }
  ok('parseTimecode accepts hh:mm:ss, mm:ss and seconds, and rejects everything else');

  // ---- formatTimecode round-trips and the filename token --------------------
  {
    assert.equal(formatTimecode(862), '00:14:22');
    assert.equal(formatTimecode(3723.5), '01:02:03.500');
    assert.equal(parseTimecode(formatTimecode(4521.25)), 4521.25, 'format then parse is the identity');
    assert.equal(timecodeToken(862), '00-14-22', 'no colons or dots in a filename token');
    assert.ok(!/[:.]/.test(timecodeToken(3723.5)));
  }
  ok('formatTimecode emits ffmpeg-valid positions and timecodeToken is filename-safe');

  // ---- formatSpecFor: derived from the spec table, not restated -------------
  {
    for (const id of ['tiktok', 'instagram_reels', 'youtube_shorts']) {
      const spec = formatSpecFor(id);
      assert.equal(spec.width, 1080, `${id} renders at the spec's 1080×1920`);
      assert.equal(spec.height, 1920);
      assert.equal(spec.max_seconds, 60);
    }
    assert.equal(formatSpecFor('linkedin').width, 1080, 'linkedin uses the first frame the spec lists (1080×1080)');
    assert.equal(formatSpecFor('linkedin').height, 1080);
    assert.equal(formatSpecFor('x').width, 1280);
    assert.equal(formatSpecFor('youtube_chapter').height, 1080);
    assert.equal(formatSpecFor('nowhere'), null);
    assert.equal(formatSpecFor('constructor'), null, 'inherited prototype keys are not destinations');
  }
  ok('formatSpecFor derives each render target from destinations.js and rejects unknown ids');

  // ---- planCuts: source must exist ------------------------------------------
  {
    assert.throws(
      () => planCuts({ source: path.join(tmp, 'missing.mp4'), clips: [{ start: 0, end: 3 }] }),
      (e) => e.code === 'source_not_found'
    );
    assert.throws(() => planCuts({ source, clips: [] }), (e) => e.code === 'no_clips');
  }
  ok('planCuts refuses a missing source file and an empty clip list');

  // ---- planCuts: the longer-than-destination refusal cites the spec ---------
  {
    let thrown = null;
    try {
      planCuts({ source, clips: [{ start: '00:00:10', end: '00:01:20', destination: 'tiktok' }] });
    } catch (e) { thrown = e; }
    assert.ok(thrown, 'a 70s tiktok clip must be refused');
    assert.equal(thrown.code, 'clips_rejected');
    assert.equal(thrown.detail.problems.length, 1);
    assert.match(thrown.detail.problems[0], /70\.0s/, 'the refusal states the clip\'s actual duration');
    assert.match(thrown.detail.problems[0], /TikTok/, 'the refusal names the destination');
    assert.match(thrown.detail.problems[0], /20–60s/, 'the refusal cites the spec\'s length band');
  }
  ok('a clip longer than its destination\'s band is refused, citing the spec');

  // ---- planCuts: all-or-nothing — one bad clip refuses the batch -------------
  {
    let thrown = null;
    try {
      planCuts({
        source,
        clips: [
          { start: '00:00:01', end: '00:00:04' },
          { start: '00:00:10', end: '00:00:05' },
          { start: 'nonsense', end: '00:00:20' },
          { start: 0, end: 30, destination: 'myspace' },
        ],
      });
    } catch (e) { thrown = e; }
    assert.equal(thrown.code, 'clips_rejected');
    assert.equal(thrown.detail.problems.length, 3, 'every problem is named, not just the first');
    assert.match(thrown.detail.problems[0], /clip 2/, 'problems name the clip by index');
    assert.match(thrown.detail.problems[2], /myspace/);
  }
  ok('planCuts is all-or-nothing and names every refused clip');

  // ---- planCuts: deterministic naming and command shape ----------------------
  {
    const plan = planCuts({
      source,
      clips: [{ start: '00:14:22', end: '00:15:08', label: 'Senior hiring', destination: 'tiktok' }],
    });
    assert.equal(plan.out_dir, path.join(tmp, 'clips'), 'default out_dir is "clips" next to the source');
    const [clip] = plan.clips;
    assert.equal(clip.duration_seconds, 46);
    assert.equal(clip.outputs.length, 2, 'a destination clip gets the plain cut and the formatted variant');

    const [plain, formatted] = clip.outputs;
    assert.equal(path.basename(plain.file), 'episode.clip01.senior-hiring.00-14-22-00-15-08.mp4');
    assert.equal(path.basename(formatted.file), 'episode.clip01.senior-hiring.00-14-22-00-15-08.tiktok.mp4');

    // The plain cut must be a stream copy of exactly the requested span.
    const plainCmd = shellCommand(plain.args);
    assert.match(plainCmd, /-ss 00:14:22 -to 00:15:08/);
    assert.match(plainCmd, /-c copy/);
    assert.ok(!/libx264/.test(plainCmd), 'the plain cut never re-encodes');

    // The variant re-encodes through the 9:16 scale+crop from the spec.
    const fmtCmd = shellCommand(formatted.args);
    assert.match(fmtCmd, /scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920/);
    assert.match(fmtCmd, /libx264/);
    assert.equal(formatted.frame, '1080×1920');

    // Determinism: the same request plans the same files and commands.
    const again = planCuts({
      source,
      clips: [{ start: '00:14:22', end: '00:15:08', label: 'Senior hiring', destination: 'tiktok' }],
    });
    assert.deepEqual(again, plan);
  }
  ok('planCuts names files deterministically, stream-copies the plain cut and scale+crops the variant');

  // ---- shellCommand quotes only what needs it --------------------------------
  {
    assert.equal(shellCommand(['ffmpeg', '-i', 'a.mp4']), 'ffmpeg -i a.mp4');
    assert.equal(shellCommand(['echo', "it's here"]), `echo 'it'\\''s here'`);
  }
  ok('shellCommand renders a paste-able command, quoting arguments with spaces or quotes');

  console.log(`\n${passed} cutting.js checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
