import { ToolError } from '../mcp-lite.js';

/**
 * The vocabulary design rules from the skill's step 4, as data, and the
 * mechanical check of a proposed pattern set: counts, collisions on the three
 * distinguishable axes, the failure-distinctiveness rule, duplicate meanings,
 * missing fallbacks. Facts with evidence — whether a pattern's meaning is the
 * right one, and whether users can actually feel the difference on real
 * hardware, stays with the user and the blind test.
 */

export const VOCABULARY_RULES = [
  'Small and learnable beats expressive: 3-5 distinguishable patterns, no more.',
  'Every pattern maps to one meaning, and that meaning holds everywhere in the product.',
  'Failure must never be confusable with success — make it the most distinctive pattern in the set.',
  'Intensity respects the context: a wrist buzz felt through a drawing glove differs from a phone on a desk.',
  'Every meaning is teachable in one sentence.',
  'The vocabulary needs a visual or audio fallback — vibration sensitivity differs across users and hardware.',
];

export const DISTINGUISHABILITY = {
  axes: ['count', 'intensity', 'rhythm'],
  rule:
    'Untrained users reliably distinguish patterns that differ on intensity, count and rhythm — ' +
    'not subtle variations. Two patterns identical on all three axes are one pattern with two ' +
    'meanings; two that differ only in intensity are a guess under a glove.',
};

export const BLIND_TEST =
  'Test the vocabulary blind: if a user cannot name the meaning of a pattern without looking, cut ' +
  'a pattern rather than add a tutorial.';

export const PATTERN_LIMITS = { min: 2, max: 5 };

export const INTENSITIES = ['low', 'medium', 'high'];

const norm = (v) => String(v ?? '').trim().toLowerCase();

/**
 * Mechanical check of a proposed vocabulary. Each pattern:
 *   { id, meaning, count, intensity, rhythm, is_failure? }
 * count: taps/pulses (number). intensity: low|medium|high. rhythm: a short
 * label like "even", "long-short", "rising". is_failure marks the failure
 * pattern for the distinctiveness rule.
 */
export function checkVocabulary({ patterns }) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new ToolError('invalid_request', 'Pass "patterns": a non-empty array of { id, meaning, count, intensity, rhythm, is_failure? }.');
  }

  const findings = [];

  patterns.forEach((p, i) => {
    if (!norm(p?.id)) throw new ToolError('invalid_request', `patterns[${i}] has no "id".`);
    if (!norm(p?.meaning)) {
      findings.push({ rule: 'one_meaning_each', pattern: p.id, note: 'No meaning recorded — a pattern without a stated meaning cannot be taught in a sentence.' });
    }
    if (!(Number(p?.count) >= 1)) {
      findings.push({ rule: 'axes_incomplete', pattern: p.id, note: 'No tap/pulse count recorded — count is one of the three axes users can actually feel.' });
    }
    if (p?.intensity !== undefined && !INTENSITIES.includes(norm(p.intensity))) {
      findings.push({ rule: 'unknown_intensity', pattern: p.id, evidence: `intensity: ${JSON.stringify(p.intensity)}`, note: `Use one of: ${INTENSITIES.join(', ')}.` });
    }
  });

  if (patterns.length > PATTERN_LIMITS.max) {
    findings.push({
      rule: 'too_many_patterns',
      evidence: `${patterns.length} patterns (maximum ${PATTERN_LIMITS.max}).`,
      note: 'Small and learnable beats expressive. Cut patterns, not corners — start from the ones users failed to name blind.',
    });
  }

  const signature = (p) => `${Number(p.count) || 0}|${norm(p.intensity)}|${norm(p.rhythm)}`;
  const dupMeanings = new Map();
  for (const p of patterns) {
    const m = norm(p.meaning);
    if (!m) continue;
    if (!dupMeanings.has(m)) dupMeanings.set(m, []);
    dupMeanings.get(m).push(p.id);
  }
  for (const [meaning, ids] of dupMeanings) {
    if (ids.length > 1) {
      findings.push({
        rule: 'duplicate_meaning',
        patterns: ids,
        evidence: `Both mean "${meaning}".`,
        note: 'Two patterns for one meaning doubles the learning cost for nothing — keep one.',
      });
    }
  }

  for (let i = 0; i < patterns.length; i += 1) {
    for (let j = i + 1; j < patterns.length; j += 1) {
      const a = patterns[i];
      const b = patterns[j];
      if (signature(a) === signature(b)) {
        findings.push({
          rule: 'pattern_collision',
          patterns: [a.id, b.id],
          evidence: `Identical on all three axes (count ${a.count}, intensity ${norm(a.intensity) || 'unset'}, rhythm ${norm(a.rhythm) || 'unset'}).`,
          note: 'One pattern with two meanings. One of them changes or goes.',
        });
      } else if (Number(a.count) === Number(b.count) && norm(a.rhythm) === norm(b.rhythm)) {
        findings.push({
          rule: 'intensity_only_difference',
          patterns: [a.id, b.id],
          evidence: `Same count (${a.count}) and rhythm ("${norm(a.rhythm) || 'unset'}"); they differ only in intensity.`,
          note: DISTINGUISHABILITY.rule,
        });
      }
    }
  }

  const failure = patterns.filter((p) => p.is_failure === true);
  if (failure.length === 0) {
    findings.push({
      rule: 'no_failure_pattern',
      note: 'No pattern is marked is_failure. If the set carries a failure meaning, mark it so the distinctiveness rule can be checked; if it does not, failures are reaching the artist through the screen again.',
    });
  }
  for (const f of failure) {
    for (const p of patterns) {
      if (p === f) continue;
      if (Number(p.count) === Number(f.count)) {
        findings.push({
          rule: 'failure_confusable',
          patterns: [f.id, p.id],
          evidence: `The failure pattern shares its count (${f.count}) with "${p.id}" ("${p.meaning}").`,
          note: 'Failure must never be confusable with success — give it a count no other pattern uses, and make it the most distinctive pattern in the set.',
        });
      }
    }
  }

  return {
    patterns_checked: patterns.length,
    within_limits: patterns.length >= PATTERN_LIMITS.min && patterns.length <= PATTERN_LIMITS.max,
    findings,
    finding_count: findings.length,
    rules: VOCABULARY_RULES,
    blind_test: BLIND_TEST,
    what_this_did_not_judge:
      'Whether the meanings are the right ones, and whether the patterns are distinguishable on the ' +
      'actual hardware in the actual working context. The blind test with real users decides that.',
  };
}
