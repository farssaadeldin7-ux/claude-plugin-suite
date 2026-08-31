/**
 * The scoring pass and the re-audit arithmetic, ported from
 * skills/generative-digital-twin/references/drift-and-governance.md.
 *
 * Everything here is counting against stated thresholds: the 0-4 scale, the
 * hard-fail rule, the mean bands, the regression flags. Assigning a score to a
 * draft — deciding that palette discipline is a 2 — is judgement and stays in
 * the skill. This module only does the arithmetic on scores it is handed, and
 * it never averages a never-list breach away.
 */

export const SCORE_SCALE = [
  { score: 4, meaning: 'Indistinguishable from corpus work on this dimension', typical_evidence: 'Values sit inside the profile\'s stated range' },
  { score: 3, meaning: 'In range. A reviewer would not stop on it', typical_evidence: 'Close to the range, no jarring departure' },
  { score: 2, meaning: 'Plausible but generic — could be anyone in this genre', typical_evidence: 'Nothing wrong, nothing identifying' },
  { score: 1, meaning: 'Off-profile. A reviewer would notice and comment', typical_evidence: 'Outside the stated range in a visible way' },
  { score: 0, meaning: 'Violates a never-list entry', typical_evidence: 'Breach, named' },
];

export const HARD_FAIL_RULE =
  'Any 0 is a hard fail. Report the breached entry first, before the mean. Do not average it away — a mean of 3.4 ' +
  'with one breach is a reject.';

export const MEAN_BANDS = [
  { min: 3.5, band: '3.5+', read_as: 'On profile. Direct it as you would a good junior draft.' },
  { min: 2.8, band: '2.8 to under 3.5', read_as: 'Usable with named corrections on the two weakest dimensions.' },
  { min: 2.0, band: '2.0 to under 2.8', read_as: 'The generic-output signature. The preamble is not landing. Do not polish — rebrief.' },
  { min: -Infinity, band: 'under 2.0', read_as: 'Either the profile is wrong for this brief, or the brief is outside the profile\'s scope. Say which.' },
];

export const FLAT_TWOS_NOTE =
  'A flat set of 2s across every dimension is diagnostically different from a mix of 4s and 1s. Flat 2s mean the ' +
  'constraints never reached the model. Mixed scores mean specific dimensions are weak, which is a correction ' +
  'problem, not a briefing problem.';

export const BASELINE_RULE =
  'Take the baseline at profile build time by scoring three corpus pieces against the finished profile. They should ' +
  'score 3.5 or above; treat 3.0 to 3.4 as borderline and re-check the piece\'s dimension notes. If a corpus piece ' +
  'scores below 3, the profile does not describe the corpus and the extraction is wrong — fix that before ' +
  'generating anything.';

export const REAUDIT = {
  cadence: 'Every quarter, or every 20 outputs, whichever comes first.',
  minimum_sample: 8,
  sample_rule: 'Take at least eight recent outputs, chosen at random rather than by quality. Cherry-picked samples make a clean audit and a false one.',
  blind_rule: 'Score the sample before re-reading the profile\'s baseline numbers, so the baseline does not anchor the scoring.',
  flag_rules: [
    'A dimension is flagged if its mean has fallen by 1.0 or more from baseline.',
    'A dimension is flagged if 40% or more of samples score 2 or below on it.',
    'Any never-list breach in the sample is flagged regardless of the mean. More than one breach of the same entry means the entry is not reaching the preamble.',
  ],
  mean_fall_threshold: 1.0,
  low_score_share_threshold: 0.4,
};

export const DIAGNOSIS_TABLE = [
  { pattern: 'Every dimension down slightly, none badly', likely_cause: 'Preamble has been trimmed or reordered over time', fix: 'Restore the full preamble; re-check the never list is verbatim' },
  { pattern: 'One dimension down sharply, others stable', likely_cause: 'The entry is vague and cannot be checked', fix: 'Rewrite it with a number or a count' },
  { pattern: 'Never-list breaches rising', likely_cause: 'Never list is being cut for length, or has grown past what fits', fix: 'Move the never list to the top of the preamble; consolidate to 20 entries' },
  { pattern: 'Scores fine, director still unhappy', likely_cause: 'The profile has fallen behind the director\'s current work', fix: 'Re-curate: add the last quarter\'s work, drop the oldest' },
  { pattern: 'Flat 2s from the first output onward', likely_cause: 'The preamble was never effective', fix: 'Rebuild it from the profile rather than patching' },
];

export const DISCLOSURE_CHECKLIST = [
  'What is said to a client about generative involvement, in one sentence',
  'Whether it is said proactively or only when asked',
  'Which clients contractually prohibit it — check the contracts, do not assume',
  'Whether generated first drafts may go to a client at all, or only director-edited work',
  'Who in the studio may run the apprentice, and who may not',
  'Whether the profile itself is ever shared outside the studio',
];

export const GOVERNANCE_MINIMUMS = [
  'The profile has a named owner. One person, not the studio',
  'The profile has a version number and a dated changelog',
  'The corpus list is stored with the profile, not in someone\'s memory',
  'The audit date is in a calendar, not an intention',
  'Corrections are written into the profile the day they are made, or they are lost',
];

const round2 = (n) => Math.round(n * 100) / 100;

export function meanBand(mean) {
  return MEAN_BANDS.find((band) => mean >= band.min);
}

export function scoreIsValid(score) {
  return Number.isInteger(score) && score >= 0 && score <= 4;
}

/**
 * The arithmetic of the scoring pass: weighted mean, hard fail on any 0,
 * band from the reading table, the two weakest dimensions. Weights default
 * to 1 where the profile has not set them.
 */
export function scoreDraft(scores) {
  const breaches = scores.filter((s) => s.score === 0);

  let weightSum = 0;
  let total = 0;
  for (const s of scores) {
    const weight = s.weight ?? 1;
    weightSum += weight;
    total += s.score * weight;
  }
  const mean = round2(total / weightSum);
  const band = meanBand(mean);

  const ranked = [...scores].sort((a, b) => a.score - b.score);
  const flatTwos = scores.every((s) => s.score === 2);

  const base = {
    dimensions_scored: scores.length,
    per_dimension: scores.map(({ dimension, score, weight, breached_never_entry }) => ({
      dimension, score, weight: weight ?? 1,
      ...(breached_never_entry ? { breached_never_entry } : {}),
    })),
    weighted_mean: mean,
  };

  if (breaches.length) {
    // Hard fail reported first; the mean is included but must not soften it.
    return {
      verdict: 'reject',
      hard_fail: true,
      breaches: breaches.map((b) => ({ dimension: b.dimension, never_entry: b.breached_never_entry })),
      rule: HARD_FAIL_RULE,
      ...base,
    };
  }

  return {
    hard_fail: false,
    band: band.band,
    read_as: band.read_as,
    ...(flatTwos ? { flat_twos: true, flat_twos_note: FLAT_TWOS_NOTE } : {}),
    weakest_dimensions: ranked.slice(0, 2).map((s) => ({ dimension: s.dimension, score: s.score })),
    ...base,
    next_step: 'Name one specific correction for each weakest dimension, citing the draft — that judgement is the skill\'s, not this tool\'s.',
  };
}

/**
 * The re-audit comparison: per-dimension sample means against the recorded
 * baseline, flagged by the two stated thresholds, plus breach counting.
 */
export function driftAudit(dimensions, breaches = []) {
  const sampleSizes = dimensions.map((d) => d.sample_scores.length);
  const smallest = Math.min(...sampleSizes);

  const results = dimensions.map((d) => {
    const mean = round2(d.sample_scores.reduce((a, b) => a + b, 0) / d.sample_scores.length);
    const fall = round2(d.baseline_mean - mean);
    const lowShare = round2(d.sample_scores.filter((s) => s <= 2).length / d.sample_scores.length);
    const reasons = [];
    if (fall >= REAUDIT.mean_fall_threshold) {
      reasons.push(`mean fell ${fall.toFixed(2)} from baseline (threshold: 1.0 or more)`);
    }
    if (lowShare >= REAUDIT.low_score_share_threshold) {
      reasons.push(`${Math.round(lowShare * 100)}% of samples score 2 or below (threshold: 40% or more)`);
    }
    return {
      dimension: d.dimension,
      baseline_mean: d.baseline_mean,
      sample_mean: mean,
      change: round2(mean - d.baseline_mean),
      share_scoring_2_or_below: lowShare,
      samples: d.sample_scores.length,
      flagged: reasons.length > 0,
      ...(reasons.length ? { flag_reasons: reasons } : {}),
    };
  });

  const breachFindings = breaches.map((b) => ({
    never_entry: b.entry,
    occurrences: b.occurrences,
    flagged: true,
    reading: b.occurrences > 1
      ? 'More than one breach of the same entry means the entry is not reaching the preamble.'
      : 'Any never-list breach in the sample is flagged regardless of the mean.',
  }));

  return {
    ...(smallest < REAUDIT.minimum_sample
      ? {
          sample_size_warning:
            `The smallest per-dimension sample is ${smallest}; the protocol asks for at least ` +
            `${REAUDIT.minimum_sample} recent outputs, chosen at random rather than by quality. ` +
            'Treat these flags as provisional.',
        }
      : {}),
    dimensions: results,
    flagged: results.filter((r) => r.flagged).map((r) => r.dimension),
    never_breaches: breachFindings,
    diagnosis_table: DIAGNOSIS_TABLE,
    next_step: 'Diagnose a flagged dimension against the table before rewriting anything, then add a dated changelog entry: what was audited, what was flagged, what changed.',
  };
}
