/**
 * The escalation protocol, ported verbatim from
 * skills/wellbeing-companion/references/escalation-protocol.md.
 *
 * Triggers are mechanical. The model matches a pattern and routes. It does not
 * weigh severity. Nothing in this module estimates severity, scores a message,
 * or decides whether a trigger "really" applies — it serves the protocol text
 * so the exact rules are available at the point of use.
 */

export const ONE_RULE =
  'Escalation is never a judgement call the model makes about severity. The moment a trigger ' +
  'appears, the conversation routes to a human. The model does not weigh how serious it sounds, ' +
  'does not ask assessment questions to decide, and does not attempt to talk someone down first.';

/** The nine trigger categories. `includes` is exhaustive of the listed items
 *  and carries the reference's own qualifier: without exception. */
export const TRIGGER_CATEGORIES = [
  {
    category: 1,
    name: 'Suicide and self-harm',
    includes_without_exception:
      'Direct statements, passive ideation ("I wouldn\'t mind if I didn\'t wake up"), hypotheticals, ' +
      'jokes, past attempts raised in the present, third-person framings ("asking for a friend"), ' +
      'method questions, references to a plan, timeline or means',
  },
  {
    category: 2,
    name: 'Harm to others',
    includes_without_exception:
      'Threats, intent, fantasies described as intent, questions about how to harm',
  },
  {
    category: 3,
    name: 'Abuse and violence',
    includes_without_exception:
      'Domestic abuse, sexual violence, coercive control, financial abuse, trafficking, elder abuse — ' +
      'current or historical',
  },
  {
    category: 4,
    name: 'Minors',
    includes_without_exception:
      'Any disclosure involving a child\'s safety, and any indication the user is under 18',
  },
  {
    category: 5,
    name: 'Loss of contact with reality',
    includes_without_exception:
      'Reported hallucinations, delusional content, severe dissociation, mania',
  },
  {
    category: 6,
    name: 'Substances',
    includes_without_exception:
      'Withdrawal symptoms, overdose, acute intoxication during the conversation',
  },
  {
    category: 7,
    name: 'Medical emergency',
    includes_without_exception:
      'Chest pain, breathing difficulty, injury, collapse, pregnancy complications',
  },
  {
    category: 8,
    name: 'Eating and body',
    includes_without_exception:
      'Restriction, purging, compulsive exercise, rapid weight change',
  },
  {
    category: 9,
    name: 'Conversational',
    includes_without_exception:
      'Explicit request for a human; two declines to continue; distress language in three or more ' +
      'consecutive user turns; the same concern repeated three times without resolution',
  },
];

export const INDIRECT_PHRASINGS_NOTE =
  'The indirect phrasings are in category 1 because they are the majority of real disclosures. ' +
  'People test the ground before they say the thing directly. A detector tuned to explicit ' +
  'statements will miss most of what it exists to catch, and will miss it precisely in the cases ' +
  'where the person was being careful. Build the red-team set around indirect phrasings first, ' +
  'explicit ones second.';

export const DETECTOR_DESIGN =
  'Design the detector to over-trigger. A false escalation costs a counsellor five minutes. ' +
  'A missed one does not have a cost you are willing to pay. Set the review target on ' +
  'false-negative rate, and treat a low false-positive rate as a warning sign rather than an ' +
  'achievement.';

/** The response when a trigger fires: four constraints, all of them load-bearing. */
export const RESPONSE_CONSTRAINTS = [
  {
    constraint: 'No assessment questions.',
    detail:
      'Do not ask about plan, means, intent, timeline or history. Asking these implies the answers ' +
      'change what happens next. They do not.',
  },
  {
    constraint: 'No advice, no coping technique, no grounding exercise.',
    detail:
      'These belong to a trained person, and offering one signals that the conversation is continuing.',
  },
  { constraint: 'Short.', detail: 'Two or three sentences.' },
  {
    constraint: 'Concrete and immediate.',
    detail: 'Name what happens now and give the direct route.',
  },
];

export const RESPONSE_SHAPES = {
  standard: {
    shape:
      'Thank you for telling me that. I am not the right support for this and I want you to have ' +
      'someone who is — I am passing this to [named team] now, and they will pick it up ' +
      '[timeframe]. If you need someone immediately, [regional service] is available [hours] on ' +
      '[number].',
    after: 'Then stop. Do not answer further messages in that session beyond repeating the route.',
  },
  medical_emergency: {
    applies_to:
      'The overdose item in Category 6, and all of Category 7 — chest pain, breathing difficulty, ' +
      'collapse. The route is different and comes first.',
    shape:
      'This needs medical help now — call [emergency services number] straight away. I am also ' +
      'passing this to [named team] so someone follows up with you.',
    note:
      'The emergency services number comes from configuration like every other resource, and is ' +
      'never the crisis line.',
  },
};

export const OUT_OF_HOURS =
  'If the human team is not staffed 24/7, the out-of-hours path must be an external service that ' +
  'genuinely is. State the staffed hours in the onboarding, before the user\'s first message, not ' +
  'at the point of escalation. A service that escalates into an unstaffed queue at two in the ' +
  'morning has not escalated.';

/** The handover packet the receiving human gets. */
export const HANDOVER_PACKET = [
  { field: 'transcript', contents: 'Full session, verbatim' },
  { field: 'trigger', contents: 'Category number and the matching text' },
  { field: 'fired_at', contents: 'Timestamp, with timezone' },
  { field: 'told_user', contents: 'Exact wording the user received' },
  { field: 'region', contents: 'Resolved region and the resource block given' },
  { field: 'prior_sessions', contents: 'Count and dates only, unless policy permits more' },
];

export const HANDOVER_NOTE =
  'The receiving human must not have to ask the person to repeat what they have already said. ' +
  'That repetition is the most commonly reported harm in escalation from automated services.';

export const WHAT_NEVER_HAPPENS = [
  'The model does not continue supporting alongside the human.',
  'The model does not follow up later, automatically or otherwise.',
  'The model does not reopen the thread if the user returns within the same session.',
  'No survey, no rating request, no "how did I do" after an escalation.',
];

export function triggerCategory(number) {
  return TRIGGER_CATEGORIES.find((c) => c.category === Number(number)) ?? null;
}
