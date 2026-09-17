import { HARD_FAIL_RULE, scoreDraft } from './scoring.js';

/**
 * Apprentice mode's deterministic half: compiling a stored profile into a
 * governed work order, and gating what the apprentice produced with the same
 * scoring arithmetic every other draft goes through.
 *
 * Nothing here generates work or judges it. The work order is the profile's
 * own entries rearranged verbatim around a task — never list as hard
 * constraints, anchors as exemplars, dimension entries as measurable
 * requirements — and the gate is scoreDraft's arithmetic on scores a reviewer
 * has already assigned. The apprentice itself is the model following the
 * skill; it works from this document alone and observes nothing.
 */

export const TASK_TYPES = {
  repetitive:
    'Execute the described task once per item. Hold every hard constraint on every item — consistency across ' +
    'items is the point of handing this to an apprentice, so sameness is correct and variation is not.',
  variation:
    'Produce alternative treatments of the described project, one per count. Every variation must satisfy ' +
    'every hard constraint — vary within the profile, never outside it. A variation that needs a constraint ' +
    'relaxed is a different brief, not a variation.',
  fill:
    'Produce background or supporting elements that sit inside the established aesthetic without drawing ' +
    'attention. The exemplars set the register; fill sits beneath it and must not compete with the foreground work.',
};

// The pass threshold comes from the mean bands in scoring.js: under 2.8 reads
// as the generic-output signature ("do not polish — rebrief"), so an
// apprentice output below it never reaches the user.
export const GATE_PASS_MEAN = 2.8;

export const GATE_RULE =
  'An apprentice output clears the gate only when it has no never-list breach and its weighted mean is ' +
  `${GATE_PASS_MEAN} or above. ` + HARD_FAIL_RULE +
  ' Under 2.8 is the generic-output signature — do not polish it into delivery.';

export const STANDING_RULE =
  'Before anything is delivered, assign each requirement a 0-4 score against the produced output — honestly, ' +
  'against the stated numbers — and run apprentice_check on this profile. ' + GATE_RULE;

/**
 * Compile a work order from a stored profile and a task. Every constraint,
 * exemplar and requirement is quoted from the profile verbatim; the only text
 * added is the fixed rules above. Callers check the profile exists and has a
 * never list before calling — a work order without hard constraints cannot
 * be gated and must not be compiled.
 */
export function compileBrief(profile, task) {
  const gaps = [];
  if (!(profile.anchors?.length)) {
    gaps.push({
      gap: 'no_anchors',
      reading: 'The profile stores no anchor pieces, so this work order carries no exemplars. Add three to five with save_profile.',
    });
  }
  if (!(profile.dimensions?.length)) {
    gaps.push({
      gap: 'no_dimensions',
      reading: 'The profile stores no dimensions, so this work order carries no measurable requirements and apprentice_check will have nothing to score. Add them with save_profile.',
    });
  }

  return {
    work_order: {
      profile_id: profile.profile_id,
      profile_name: profile.name,
      profile_version: profile.version,
      task: { type: task.type, description: task.description, count: task.count ?? 1 },
      task_rule: TASK_TYPES[task.type],
      ...(profile.scope ? { scope: profile.scope } : {}),
      hard_constraints: {
        entries: profile.never_list,
        rule: 'Each entry is a hard constraint on every item produced. ' + HARD_FAIL_RULE,
      },
      exemplars: {
        anchors: profile.anchors ?? [],
        rule:
          'The profile\'s own anchor pieces, verbatim — the register to match. Match them in the measurable ' +
          'terms the requirements state; do not copy any one of them.',
      },
      requirements: (profile.dimensions ?? []).map((d) => ({
        dimension: d.name,
        target: d.entry,
        ...(d.example ? { example: d.example } : {}),
        weight: d.weight ?? 1,
      })),
      ...(profile.boundary?.length
        ? {
            boundary: {
              near_misses: profile.boundary,
              rule: 'The profile\'s own near-misses, verbatim — almost right and rejected. Output that resembles one fails the same way.',
            },
          }
        : {}),
      ...(profile.preamble ? { preamble: profile.preamble } : {}),
      standing_rule: STANDING_RULE,
    },
    compiled_from_profile_verbatim: true,
    ...(gaps.length ? { gaps } : {}),
  };
}

/**
 * The delivery gate: scoreDraft's arithmetic on the reviewer's scores,
 * framed as pass or fail against the profile's hard-fail and band rules.
 * Weights and breach-entry verification are the caller's job (the tool layer
 * resolves weights from the profile and checks breached entries verbatim).
 */
export function apprenticeGate(profile, scores) {
  const scoring = scoreDraft(scores);
  const scored = new Set(scores.map((s) => s.dimension));
  const unscored = (profile.dimensions ?? []).map((d) => d.name).filter((name) => !scored.has(name));

  const base = {
    profile_id: profile.profile_id,
    profile_version: profile.version,
    gate_rule: GATE_RULE,
    ...(unscored.length
      ? {
          profile_dimensions_not_scored: unscored,
          unscored_rule:
            'Every profile dimension is scored before the gate is read — an unscored dimension is a gap in the check, not a pass on that dimension.',
        }
      : {}),
    scoring,
  };

  if (scoring.hard_fail) {
    return {
      gate: 'fail',
      deliver: false,
      fail_reason: 'never_list_breach',
      breaches: scoring.breaches,
      revision: 'A breach is not revised around — remove it, rescore every dimension, and only then read the mean.',
      ...base,
    };
  }

  if (scoring.weighted_mean >= GATE_PASS_MEAN) {
    return {
      gate: 'pass',
      deliver: true,
      weighted_mean: scoring.weighted_mean,
      band: scoring.band,
      read_as: scoring.read_as,
      weakest_dimensions: scoring.weakest_dimensions,
      delivery_note:
        scoring.weighted_mean >= 3.5
          ? 'On profile. Deliver, and still name the two weakest dimensions so the reviewer knows where to look first.'
          : 'Usable with named corrections — deliver with the two weakest dimensions and one specific correction each stated.',
      ...base,
    };
  }

  return {
    gate: 'fail',
    deliver: false,
    fail_reason: scoring.flat_twos ? 'generic_output_signature' : 'below_gate_mean',
    weighted_mean: scoring.weighted_mean,
    band: scoring.band,
    read_as: scoring.read_as,
    weakest_dimensions: scoring.weakest_dimensions,
    revision: scoring.flat_twos
      ? 'Flat 2s mean the constraints never reached the work — rebuild from the work order rather than polishing.'
      : 'Revise against the weakest dimensions named, then rescore with apprentice_check before delivering anything.',
    ...base,
  };
}
