import { toSeconds, toTimecode } from './timecode.js';
import { flatStretches } from './arc.js';
import { checkTells } from './tells.js';
import { BASELINES } from './forms.js';

/**
 * The modelled engagement series and its rendering. One point per scene,
 * computed deterministically from the same arithmetic the rest of the server
 * already runs — the editor's intensity score, the valence movement between
 * consecutive scenes, and a penalty for every drop-off tell check_tells trips
 * on the stretch the scene sits in. Nothing here is a measurement of any
 * audience: the series is a restatement of the editor's own scores and the
 * tell arithmetic as one curve, and the output says so everywhere it goes.
 */

export const SERIES_BASIS = 'modelled from scene scores';

export const SERIES_CAPTION = 'modelled from scene scores — not a measurement of any audience';

export const FORMULA = {
  statement:
    'engagement = intensity + |valence movement from the previous scene| − 1 per drop-off tell covering the scene',
  components: [
    'intensity (0–5): the editor\'s intensity score for the scene, unchanged',
    'valence movement (0–6): the absolute change in the editor\'s valence score from the previous scene; 0 for the first scene. Movement, not level — flat stretches are the problem, not low stretches',
    'tell penalty: minus 1 for each distinct drop-off cause whose tripped stretch (the check_tells arithmetic, unchanged) overlaps the scene',
  ],
  note:
    'A unitless modelled figure, deterministic in the scores supplied. It is not a measurement of any ' +
    'audience, not a retention prediction and not a score of the film — rescoring a scene moves the curve.',
};

// The flat-series check reuses the monotony arithmetic: no movement of two or
// more points across the five-minute window. The references name no per-form
// figure for this, so the generic baseline applies whatever the form.
const FLAT_SHIFT = 2;
const FLAT_WINDOW_SECONDS = BASELINES.monotony_window_seconds;

/** Distinct causes whose tripped stretch overlaps the scene's span. */
function causesCovering(scene, stretches) {
  const end = Math.max(scene.end, scene.start);
  const causes = new Set();
  for (const s of stretches) {
    if (s.from < end && s.to > scene.start) causes.add(s.cause);
  }
  return [...causes].sort();
}

/**
 * Compute the modelled series and the flagged segments. `scenes` and
 * `questions` are already normalised; `form` is a forms.js entry or null;
 * `ledgerSupplied` says whether the caller gave a Q&A ledger at all — without
 * one, an empty ledger reads as a single whole-film coverage gap, so the
 * ledger-coverage stretches are dropped and the tool's output says the check
 * did not run.
 */
export function engagementGraph({ scenes, questions, runtime, form, ledgerSupplied }) {
  const { stretches: allStretches } = checkTells({ scenes, questions, runtime, form });
  const stretches = ledgerSupplied
    ? allStretches
    : allStretches.filter((s) => !s.from_ledger_coverage);

  const series = scenes.map((scene, i) => {
    const movement = i ? Math.abs(scene.valence - scenes[i - 1].valence) : 0;
    const causes = causesCovering(scene, stretches);
    return {
      scene: scene.position,
      timecode: toTimecode(scene.start),
      ...(scene.description ? { description: scene.description } : {}),
      engagement: scene.intensity + movement - causes.length,
      components: {
        intensity: scene.intensity,
        valence_movement: movement,
        tell_penalty: causes.length,
        ...(causes.length ? { tells_covering_scene: causes } : {}),
      },
      // The scene's midpoint in seconds, for plotting only.
      _mid: scene.start + (Math.max(scene.end, scene.start) - scene.start) / 2,
    };
  });

  // Flat modelled series beyond the window: the same flat-stretch arithmetic
  // the tonal-monotony tell runs, applied to the engagement values.
  const flatSeries = flatStretches(
    scenes.map((s, i) => ({ ...s, engagement: series[i].engagement })),
    (s) => s.engagement,
    { shift: FLAT_SHIFT, windowSeconds: FLAT_WINDOW_SECONDS }
  ).map(({ score_at_start, score_at_end, scores, from, to, ...range }) => ({
    from,
    to,
    ...range,
    engagement_at_start: score_at_start,
    engagement_at_end: score_at_end,
    engagements: scores,
    _from: toSeconds(from),
    _to: toSeconds(to),
  }));

  const tellStretches = stretches.map((s) => ({
    cause: s.cause,
    from: toTimecode(s.from),
    to: toTimecode(s.to),
    duration_seconds: Math.round(s.to - s.from),
    _from: s.from,
    _to: s.to,
  }));

  return {
    series,
    tellStretches,
    flatSeries,
    flatThresholdSeconds: FLAT_WINDOW_SECONDS,
    flatShift: FLAT_SHIFT,
  };
}

// ------------------------------------------------------------------ SVG

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

const esc = (text) => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Fixed-precision coordinate so the file is byte-identical run to run. */
const fmt = (n) => {
  const rounded = Math.round(n * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

/** A tick interval that yields a readable number of x-axis timecode ticks. */
function tickStep(runtime) {
  for (const step of [10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]) {
    if (runtime / step <= 8) return step;
  }
  return 7200;
}

/** Merge overlapping flagged ranges into shaded bands, each keeping its labels. */
function mergeBands(segments) {
  const bands = [];
  for (const seg of [...segments].sort((a, b) => a.from - b.from || a.to - b.to)) {
    const last = bands[bands.length - 1];
    if (last && seg.from < last.to) {
      last.to = Math.max(last.to, seg.to);
      if (!last.labels.includes(seg.label)) last.labels.push(seg.label);
    } else {
      bands.push({ from: seg.from, to: seg.to, labels: [seg.label] });
    }
  }
  return bands;
}

/**
 * A self-contained SVG line chart of the modelled series: x-axis timecodes,
 * flagged ranges shaded and keyed by number, the modelled-not-measured
 * caption baked into the image. No external assets, no scripts, and
 * deterministic output for the same input.
 */
export function renderEngagementSvg({ series, runtime, tellStretches, flatSeries, formLabel }) {
  // Chart chrome on an explicit light surface so the file reads anywhere.
  const ink = '#0b0b0b';
  const inkSecondary = '#52514e';
  const inkMuted = '#898781';
  const grid = '#e1e0d9';
  const axis = '#c3c2b7';
  const surface = '#fcfcfb';
  const seriesColour = '#2a78d6';
  const flagColour = '#d03b3b';

  const bands = mergeBands([
    ...tellStretches.map((s) => ({ from: s._from, to: s._to, label: `${s.cause.replace(/_/g, ' ')} ${s.from}–${s.to}` })),
    ...flatSeries.map((s) => ({ from: s._from, to: s._to, label: `flat modelled series ${s.from}–${s.to}` })),
  ]);

  const margin = { top: 64, right: 24, bottom: 8 };
  const width = 920;
  const marginLeft = 52;
  const plotW = width - marginLeft - margin.right;
  const plotH = 260;
  const axisY = margin.top + plotH;

  // Key lines under the axis, one per band label, marker on the first.
  const keyLineH = 16;
  let keyY = axisY + 44;
  const keyRendered = [];
  bands.forEach((band, i) => {
    band.labels.forEach((label, j) => {
      keyRendered.push({ marker: j === 0 ? String(i + 1) : '', text: label, y: keyY });
      keyY += keyLineH;
    });
  });
  const captionY = keyY + (keyRendered.length ? 8 : 0);
  const height = captionY + margin.bottom + 8;

  const xOf = (sec) => marginLeft + (runtime > 0 ? (sec / runtime) * plotW : 0);
  const values = series.map((p) => p.engagement);
  const yMin = Math.min(0, ...values);
  const yMax = Math.max(1, ...values);
  const ySpan = yMax - yMin || 1;
  const yOf = (v) => margin.top + plotH - ((v - yMin) / ySpan) * plotH;
  const yStep = Math.max(1, Math.ceil(ySpan / 6));

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${fmt(height)}" viewBox="0 0 ${width} ${fmt(height)}" role="img" aria-label="Modelled engagement series — ${esc(SERIES_CAPTION)}">`);
  parts.push(`<rect width="${width}" height="${fmt(height)}" fill="${surface}"/>`);
  parts.push(`<text x="${marginLeft}" y="26" fill="${ink}" font-family="${FONT}" font-size="15" font-weight="600">Modelled engagement — one point per scene</text>`);
  parts.push(`<text x="${marginLeft}" y="44" fill="${inkSecondary}" font-family="${FONT}" font-size="12">Judged against: ${esc(formLabel)}. Intensity + valence movement − tell penalties, from the editor's scene scores.</text>`);

  // Shaded flagged bands, behind the grid and the series.
  bands.forEach((band, i) => {
    const x = xOf(band.from);
    const w = Math.max(1, xOf(band.to) - x);
    parts.push(`<rect x="${fmt(x)}" y="${margin.top}" width="${fmt(w)}" height="${plotH}" fill="${flagColour}" fill-opacity="0.08"/>`);
    parts.push(`<rect x="${fmt(x)}" y="${margin.top}" width="${fmt(w)}" height="3" fill="${flagColour}" fill-opacity="0.55"/>`);
    parts.push(`<text x="${fmt(x + w / 2)}" y="${margin.top + 16}" text-anchor="middle" fill="${flagColour}" font-family="${FONT}" font-size="11" font-weight="600">${i + 1}</text>`);
  });

  // Horizontal gridlines and y-axis tick labels (unitless modelled score).
  for (let v = Math.ceil(yMin); v <= yMax; v += yStep) {
    const y = yOf(v);
    parts.push(`<line x1="${marginLeft}" y1="${fmt(y)}" x2="${marginLeft + plotW}" y2="${fmt(y)}" stroke="${v === 0 ? axis : grid}" stroke-width="1"/>`);
    parts.push(`<text x="${marginLeft - 8}" y="${fmt(y + 4)}" text-anchor="end" fill="${inkMuted}" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${v}</text>`);
  }

  // X axis: baseline plus timecode ticks.
  parts.push(`<line x1="${marginLeft}" y1="${fmt(axisY)}" x2="${marginLeft + plotW}" y2="${fmt(axisY)}" stroke="${axis}" stroke-width="1"/>`);
  const step = tickStep(runtime);
  for (let t = 0; t <= runtime; t += step) {
    const x = xOf(t);
    parts.push(`<line x1="${fmt(x)}" y1="${fmt(axisY)}" x2="${fmt(x)}" y2="${fmt(axisY + 4)}" stroke="${axis}" stroke-width="1"/>`);
    parts.push(`<text x="${fmt(x)}" y="${fmt(axisY + 18)}" text-anchor="middle" fill="${inkMuted}" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${toTimecode(t)}</text>`);
  }

  // The modelled series: a 2px line through one point per scene, plotted at
  // the scene's midpoint, with a ringed marker per scene.
  const points = series.map((p) => `${fmt(xOf(p._mid))},${fmt(yOf(p.engagement))}`).join(' ');
  parts.push(`<polyline points="${points}" fill="none" stroke="${seriesColour}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
  for (const p of series) {
    parts.push(`<circle cx="${fmt(xOf(p._mid))}" cy="${fmt(yOf(p.engagement))}" r="3" fill="${seriesColour}" stroke="${surface}" stroke-width="2"/>`);
  }

  // Selective direct labels: the highest and lowest modelled points only.
  const maxPoint = series.reduce((a, b) => (b.engagement > a.engagement ? b : a));
  const minPoint = series.reduce((a, b) => (b.engagement < a.engagement ? b : a));
  for (const p of new Set([maxPoint, minPoint])) {
    const below = p === minPoint && p !== maxPoint;
    // A below-the-point label that would land on the axis or its timecode
    // labels flips above the point instead.
    const rawY = yOf(p.engagement) + (below ? 16 : -8);
    const labelY = below && rawY > axisY - 2 ? yOf(p.engagement) - 8 : rawY;
    parts.push(`<text x="${fmt(xOf(p._mid))}" y="${fmt(labelY)}" text-anchor="middle" fill="${inkSecondary}" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${p.engagement}</text>`);
  }

  // Key for the shaded bands.
  for (const line of keyRendered) {
    if (line.marker) {
      parts.push(`<text x="${marginLeft}" y="${fmt(line.y)}" fill="${flagColour}" font-family="${FONT}" font-size="11" font-weight="600">${line.marker}</text>`);
    }
    parts.push(`<text x="${marginLeft + 16}" y="${fmt(line.y)}" fill="${inkSecondary}" font-family="${FONT}" font-size="11">${esc(line.text)}</text>`);
  }

  // The honesty caption, baked into the image.
  parts.push(`<text x="${marginLeft}" y="${fmt(captionY)}" fill="${inkMuted}" font-family="${FONT}" font-size="11" font-style="italic">${esc(SERIES_CAPTION)}</text>`);
  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}
