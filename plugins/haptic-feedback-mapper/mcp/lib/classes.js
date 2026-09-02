import { ToolError } from '../mcp-lite.js';

/**
 * The event classes from the skill's step 3, as data, and the mechanical
 * audit of a recorded event->class mapping against the stated rules. The
 * audit reports facts with the evidence quoted — it never decides whether an
 * event belongs in a class; that judgement is the skill's and the user's.
 */

export const THE_ONE_RULE =
  'A haptic that fires for something ignorable is worse than the screen it replaced. The channel ' +
  'works because it is scarce and trusted: every buzz means something the artist actually needs to ' +
  'know, and silence reliably means "keep working".';

export const EVENT_CLASSES = [
  {
    id: 'act_now',
    name: 'Act now',
    criterion: 'The artist must do something: a render failed, a client approved, a blocking question arrived.',
    channel: 'A distinct haptic, immediately.',
    requires_decision: true,
    examples: ['render failed', 'client approved the draft', 'export blocked on a missing asset'],
  },
  {
    id: 'done',
    name: 'Done',
    criterion: 'A wait has ended and work can resume or ship.',
    channel: 'One simple haptic.',
    requires_decision: true,
    examples: ['export complete', 'upload finished', 'render queue empty'],
  },
  {
    id: 'ambient',
    name: 'Ambient',
    criterion: 'Progress the artist would peek at, feeding no decision until it completes.',
    channel: 'Silence by default, or an opt-in low-intensity pulse pattern.',
    requires_decision: false,
    examples: ['50% rendered', 'queue position moved', 'sync in progress'],
  },
  {
    id: 'noise',
    name: 'Noise',
    criterion: 'Feeds no decision during flow.',
    channel: 'Nothing. Deferred to a batch digest after the session.',
    requires_decision: false,
    examples: ['likes', 'newsletters', 'non-blocking chat'],
  },
];

/** More act-now events than this in one mapping is flagged: the tray is being rebuilt in vibration form. */
export const ACT_NOW_CEILING = 5;

export const DISTRIBUTION_NOTE =
  'In a healthy mapping most events land in ambient or noise. If more than a handful land in ' +
  `act_now (this audit flags more than ${ACT_NOW_CEILING}), the mapping is re-creating the ` +
  'notification tray in vibration form.';

export const NO_DECISION_RULE =
  'A check that feeds no decision — "still going" — is pure load and maps to silence, not to a haptic.';

export const classById = (id) => EVENT_CLASSES.find((c) => c.id === id) ?? null;

const CLASS_IDS = EVENT_CLASSES.map((c) => c.id);
const HAPTIC_CLASSES = ['act_now', 'done'];

/**
 * Mechanical audit of an event->class mapping. Each entry:
 *   { event, class, decision_fed?, haptic? }
 * Findings are facts against the stated rules, with the entries quoted.
 */
export function auditMapping({ events }) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new ToolError('invalid_request', 'Pass "events": a non-empty array of { event, class, decision_fed?, haptic? }.');
  }

  const findings = [];
  const counts = Object.fromEntries(CLASS_IDS.map((id) => [id, 0]));

  events.forEach((entry, i) => {
    const label = entry?.event?.trim();
    if (!label) {
      throw new ToolError('invalid_request', `events[${i}] has no "event" label.`);
    }
    const cls = entry.class;
    if (!CLASS_IDS.includes(cls)) {
      throw new ToolError('unknown_class', `events[${i}] ("${label}") has class "${cls}".`, { valid: CLASS_IDS });
    }
    counts[cls] += 1;

    const hasHaptic = entry.haptic === true || (typeof entry.haptic === 'string' && entry.haptic.trim() !== '');
    if (!HAPTIC_CLASSES.includes(cls) && hasHaptic) {
      findings.push({
        rule: cls === 'noise' ? 'noise_gets_nothing' : 'ambient_is_silent_by_default',
        event: label,
        class: cls,
        evidence: `haptic: ${JSON.stringify(entry.haptic)}`,
        note: cls === 'noise'
          ? 'Noise maps to nothing during the session — defer it to the post-session digest.'
          : 'Ambient is silence by default; a haptic here must be an explicit opt-in low-intensity pulse, and each one spends the channel\'s trust.',
      });
    }
    if (HAPTIC_CLASSES.includes(cls) && !hasHaptic) {
      findings.push({
        rule: 'haptic_class_without_haptic',
        event: label,
        class: cls,
        note: `"${cls}" events carry the channel — this one has no haptic recorded.`,
      });
    }
    if (entry.decision_fed !== undefined && !String(entry.decision_fed).trim() && HAPTIC_CLASSES.includes(cls)) {
      findings.push({
        rule: 'no_decision_fed',
        event: label,
        class: cls,
        note: NO_DECISION_RULE,
      });
    }
  });

  if (counts.act_now > ACT_NOW_CEILING) {
    findings.push({
      rule: 'act_now_ceiling',
      evidence: `${counts.act_now} events classed act_now (ceiling ${ACT_NOW_CEILING}).`,
      note: DISTRIBUTION_NOTE,
    });
  }

  const total = events.length;
  const quietShare = (counts.ambient + counts.noise) / total;

  return {
    events_audited: total,
    distribution: counts,
    quiet_share: Number(quietShare.toFixed(2)),
    findings,
    finding_count: findings.length,
    distribution_note: DISTRIBUTION_NOTE,
    the_one_rule: THE_ONE_RULE,
    what_this_did_not_judge:
      'Whether each event is in the right class. The audit checks the recorded mapping against the ' +
      'stated rules only — reclassifying an event is the skill\'s job, done with the user.',
  };
}
