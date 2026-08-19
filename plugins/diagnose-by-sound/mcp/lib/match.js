import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

export const TAXONOMY = JSON.parse(fs.readFileSync(path.join(dataDir, 'taxonomy.json'), 'utf8'));
export const { signatures: SIGNATURES } = JSON.parse(fs.readFileSync(path.join(dataDir, 'signatures.json'), 'utf8'));

/**
 * How much each observed dimension counts toward a match.
 *
 * Character and what the noise *changes with* carry the most weight because
 * they are the two things that actually separate systems: a speed-linked hum
 * and an RPM-linked hum are different vehicles' worth of diagnosis apart.
 * Location is weighted low on purpose — sound travels through a structure and
 * people localise it badly.
 */
const WEIGHTS = {
  character: 3.0,
  changes_with: 2.5,
  rhythm: 2.0,
  occurs_when: 1.5,
  pitch: 0.8,
  location: 1.0,
};

/** A dimension the observation contradicts costs this fraction of its weight. */
const CONTRADICTION_PENALTY = 0.7;

const asArray = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

/**
 * Score one observation against every signature.
 *
 * Only dimensions the user actually answered contribute, so an early partial
 * description still ranks sensibly — it just reports lower coverage.
 */
export function matchSignatures(observation, { limit = 5, systemFilter = null } = {}) {
  const observed = normaliseObservation(observation);
  const answered = Object.keys(WEIGHTS).filter((dim) => observed[dim]?.length);

  if (!answered.length) {
    return { ranked: [], coverage: 0, answered, warning: 'No usable observations were supplied.' };
  }

  const maxScore = answered.reduce((sum, dim) => sum + WEIGHTS[dim], 0);
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

  // How much of the available evidence the caller actually supplied. A perfect
  // match against one answered dimension is a weak result, not a certainty, and
  // reporting it as 100% would be the single most misleading thing this tool
  // could do. `fit` stays raw for ranking; `confidence` is damped by coverage.
  const evidenceFactor = maxScore / totalWeight;

  const scored = SIGNATURES
    .filter((sig) => !systemFilter || sig.system === systemFilter)
    .map((sig) => {
      let score = 0;
      const supporting = [];
      const conflicting = [];

      for (const dim of answered) {
        const expected = sig.match[dim] || [];
        if (!expected.length) continue; // signature is agnostic on this dimension
        const overlap = observed[dim].filter((v) => expected.includes(v));
        if (overlap.length) {
          // Partial credit when the user gave several values and only some fit.
          score += WEIGHTS[dim] * (overlap.length / observed[dim].length);
          supporting.push(`${dim}: ${overlap.join(', ')}`);
        } else {
          score -= WEIGHTS[dim] * CONTRADICTION_PENALTY;
          conflicting.push(`${dim}: expected ${expected.slice(0, 3).join(' / ')}`);
        }
      }

      return {
        id: sig.id,
        label: sig.label,
        system: sig.system,
        severity: sig.severity,
        confidence: Math.max(0, Math.round((score / maxScore) * evidenceFactor * 100)),
        fit: Math.max(0, Math.round((score / maxScore) * 100)),
        raw_score: Number(score.toFixed(2)),
        supporting,
        conflicting,
        why: sig.why,
        hint: sig.hint,
        confirm: sig.confirm,
        discriminators: sig.discriminators,
        typical_parts: sig.typical_parts,
        labor_hours: sig.labor_hours,
      };
    })
    .filter((entry) => entry.fit > 0)
    .sort((a, b) => b.fit - a.fit || severityRank(a.severity) - severityRank(b.severity));

  const ranked = scored.slice(0, limit);

  return {
    ranked,
    coverage: Math.round((answered.length / Object.keys(WEIGHTS).length) * 100),
    answered,
    unanswered: Object.keys(WEIGHTS).filter((dim) => !answered.includes(dim)),
    total_considered: scored.length,
    evidence_weight: Math.round(evidenceFactor * 100),
    spread: ranked.length > 1 ? ranked[0].fit - ranked[1].fit : null,
  };
}

/**
 * Given the ranked candidates, work out which questions would actually change
 * the answer. A question is only worth asking if the leaders disagree about it.
 */
export function discriminatingQuestions(ranked, { max = 4 } = {}) {
  if (ranked.length < 2) return [];

  const contenders = ranked.filter((c) => c.fit >= ranked[0].fit - 25).slice(0, 4);
  if (contenders.length < 2) return [];

  const questions = [];
  const seen = new Set();

  // Dimensions where the contenders genuinely differ, most-weighted first.
  const dimensions = Object.entries(WEIGHTS).sort(([, a], [, b]) => b - a);
  for (const [dim] of dimensions) {
    const sets = contenders.map((c) => {
      const sig = SIGNATURES.find((s) => s.id === c.id);
      return new Set(sig.match[dim] || []);
    });
    const differs = sets.some((set, i) =>
      sets.some((other, j) => i !== j && [...set].some((v) => !other.has(v)))
    );
    if (!differs) continue;

    for (const candidate of contenders) {
      for (const question of candidate.discriminators || []) {
        if (seen.has(question)) continue;
        seen.add(question);
        questions.push({ question, separates: candidate.label, dimension: dim });
        if (questions.length >= max) return questions;
      }
    }
  }

  return questions.slice(0, max);
}

/** Highest severity among the plausible candidates — drives the safety call. */
export function safetyVerdict(ranked, { threshold = 35 } = {}) {
  const plausible = ranked.filter((c) => c.fit >= threshold);
  if (!plausible.length) {
    return { level: 'unknown', advice: 'Not enough information yet to judge whether the vehicle is safe to drive.' };
  }
  const worst = plausible.reduce((a, b) => (severityRank(a.severity) <= severityRank(b.severity) ? a : b));
  return {
    level: worst.severity,
    driven_by: worst.label,
    advice: TAXONOMY.severity[worst.severity],
    // A low-confidence critical candidate still governs the advice: being wrong
    // about a brake failure is far more expensive than an unnecessary tow.
    note: worst.fit < 60
      ? 'This is precautionary — the leading candidate is not yet confirmed, but it is the one worth being wrong about.'
      : null,
  };
}

export function normaliseObservation(raw = {}) {
  const clean = (values, vocabulary) =>
    asArray(values)
      .map((v) => String(v).trim().toLowerCase().replace(/[\s-]+/g, '_'))
      .filter((v) => vocabulary[v]);

  return {
    character: clean(raw.character, TAXONOMY.character),
    pitch: clean(raw.pitch, TAXONOMY.pitch),
    rhythm: clean(raw.rhythm, TAXONOMY.rhythm),
    occurs_when: clean(raw.occurs_when, TAXONOMY.occurs_when),
    location: clean(raw.location, TAXONOMY.location),
    changes_with: clean(raw.changes_with, TAXONOMY.changes_with),
  };
}

/** Terms the caller supplied that are not in the vocabulary. */
export function rejectedTerms(raw = {}) {
  const rejected = {};
  const dims = { character: 'character', pitch: 'pitch', rhythm: 'rhythm',
                 occurs_when: 'occurs_when', location: 'location', changes_with: 'changes_with' };
  for (const [field, vocab] of Object.entries(dims)) {
    const bad = asArray(raw[field])
      .map((v) => String(v).trim().toLowerCase().replace(/[\s-]+/g, '_'))
      .filter((v) => v && !TAXONOMY[vocab][v]);
    if (bad.length) rejected[field] = bad;
  }
  return rejected;
}

function severityRank(severity) {
  return { critical: 0, high: 1, moderate: 2, low: 3 }[severity] ?? 4;
}

export { WEIGHTS };
