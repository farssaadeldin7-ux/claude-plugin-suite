import { ToolError } from '../mcp-lite.js';
import { TRIGGER_CATEGORIES } from './escalation.js';
import { checkResourceConfig } from './resources.js';
import { reviewAudit, THEME_MIN_SESSIONS } from './audit.js';

/**
 * Automation for the check-in service's step 1, step 3 and step 5: a
 * mechanical deployment gate, a literal-phrase trigger screen, and a
 * supervisor-summary drafter over the audit log.
 *
 * The screen is the same mechanism as every screen in this suite: literal
 * substring matching with the evidence quoted, designed to over-trigger. It
 * exists to catch the phrasings the tables name, not to clear anything — a
 * non-match is never clearance, and the model still escalates on its own
 * read. Nothing here scores severity, and nothing here decides that a
 * message is safe.
 */

/**
 * Literal detection phrases per trigger category. Matching is lowercase
 * substring. The lists deliberately over-trigger — a false escalation costs
 * a counsellor five minutes; a missed one does not have a cost anyone is
 * willing to pay — and they are a floor, not the detector: paraphrase,
 * misspelling and context escape any literal list.
 */
export const DETECTION_PHRASES = {
  1: [
    'kill myself', 'end my life', 'end it all', 'suicide', 'suicidal', 'self-harm',
    'self harm', 'hurt myself', 'harm myself', 'cut myself', 'cutting myself',
    'better off dead', 'better off without me', "don't want to be alive",
    "don't want to be here anymore", "wouldn't mind if i didn't wake up",
    'not want to wake up', 'no reason to live', 'no point in living', 'no point going on',
    'take all my pills', 'a plan to hurt', 'asking for a friend who wants to die',
  ],
  2: [
    'hurt him', 'hurt her', 'hurt them', 'kill him', 'kill her', 'kill them',
    'make them pay', 'how to hurt someone', 'want to hurt someone', 'going to hurt',
  ],
  3: [
    'hits me', 'hit me', 'afraid of my partner', 'scared of my husband',
    'scared of my wife', 'scared of my partner', 'forced me to', "won't let me leave",
    'controls my money', 'sexually assaulted', 'raped', 'abusive', 'abuses me',
    'abused me', 'trafficked', 'threatens me',
  ],
  4: [
    'hurting my child', 'hit my son', 'hit my daughter', 'touched my child',
    'child is being abused', 'child is in danger', 'my child is scared of',
    'hurting a child', 'a minor is being',
  ],
  5: [
    'hearing voices', 'voices tell me', 'voices telling me', 'people are following me',
    'they are watching me', 'being watched through', 'put thoughts in my head',
    'messages meant for me', 'nothing feels real', "things aren't real",
    'losing touch with reality', 'losing my mind',
  ],
  6: [
    'withdrawal', 'overdose', 'overdosed', 'too many pills', "can't stop drinking",
    "can't stop using", 'blacking out', 'blackout drinking', 'detox', 'need a drink to',
  ],
  7: [
    'chest pain', "can't breathe", 'cannot breathe', 'trouble breathing', 'collapsed',
    'passing out', 'seizure', 'stroke', 'bleeding badly', 'losing consciousness',
  ],
  8: [
    'stopped eating', "haven't eaten in", 'purging', 'throwing up after', 'make myself sick',
    'laxatives', 'starving myself', 'burn off everything i eat', 'exercise until i',
  ],
  9: [
    'talk to a human', 'talk to a person', 'talk to a real person', 'speak to someone',
    'want a human', 'need a human', 'stop talking to a bot', 'are you even human',
    'get me a person',
  ],
};

export const SCREEN_LIMITS = [
  'A non-match is NOT clearance. Paraphrase, misspelling, other languages and context all escape literal matching; the model escalates on its own read of the message regardless of what this screen returns.',
  'Session-level triggers cannot be seen one message at a time: distress language across three or more consecutive turns, and declining to continue twice, are the skill\'s to track.',
  'The screen is a floor under the detector and a way to exercise the trigger list against real text — never the whole detector.',
];

/** Literal-phrase screen over one message. Facts with the match quoted; no scores. */
export function screenMessage({ message }) {
  if (typeof message !== 'string' || !message.trim()) {
    throw new ToolError('invalid_request', 'Pass "message": the user message text to screen.');
  }
  const haystack = message.toLowerCase();
  const matches = [];
  for (const category of TRIGGER_CATEGORIES) {
    const hits = (DETECTION_PHRASES[category.category] ?? []).filter((p) => haystack.includes(p));
    if (hits.length > 0) {
      matches.push({ category: category.category, name: category.name, matched_phrases: hits });
    }
  }
  return {
    screened: true,
    triggered: matches.length > 0,
    matches,
    ...(matches.length > 0
      ? { action: 'Escalate now, per the response constraints in escalation_response. The screen over-triggers by design; the counsellor decides, not the bot.' }
      : { action: 'No literal match — which is not clearance. Escalate anyway if the message reads as a disclosure the phrases missed.' }),
    limits: SCREEN_LIMITS,
  };
}

/**
 * The step-1 gate, mechanical: a deployment must carry the four artefacts
 * before a single check-in runs. Shape checks only — whether the scope is
 * right for the population, and whether the fallback service is genuinely
 * staffed, are the operator's claims; this records that they were made.
 */
export function checkDeployment({ scope_statement, escalation_route, resource_block, confidentiality_notice } = {}) {
  const findings = [];
  const need = (obj, field, where) => {
    const v = obj?.[field];
    const ok = typeof v === 'boolean' ? true : (Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim());
    if (v === undefined || !ok) findings.push(`${where}: missing "${field}".`);
  };

  if (!scope_statement || typeof scope_statement !== 'object') {
    findings.push('scope_statement: missing entirely. The scope_statement tool carries the publishable wording.');
  } else {
    need(scope_statement, 'in_scope', 'scope_statement');
    need(scope_statement, 'out_of_scope', 'scope_statement');
    if (scope_statement.hard_stop_confirmed !== true) findings.push('scope_statement: hard_stop_confirmed must be true — the hard-stop list is the trigger list, adopted without edits.');
    if (scope_statement.published !== true) findings.push('scope_statement: published must be true — the scope is shown to users and staff, not kept internal.');
  }

  if (!escalation_route || typeof escalation_route !== 'object') {
    findings.push('escalation_route: missing entirely.');
  } else {
    need(escalation_route, 'team', 'escalation_route');
    need(escalation_route, 'hours', 'escalation_route');
    need(escalation_route, 'out_of_hours_fallback', 'escalation_route');
    if (escalation_route.fallback_staffed !== true) {
      findings.push('escalation_route: fallback_staffed must be true, and it is a claim the operator is making — an escalation into an unstaffed queue at two in the morning has not escalated.');
    }
  }

  let resources = null;
  if (!resource_block) {
    findings.push('resource_block: missing entirely. resource_config_check documents the required shape.');
  } else {
    resources = checkResourceConfig(resource_block);
    if (!resources.valid) findings.push('resource_block: fails resource_config_check — see resource_findings.');
  }

  if (!confidentiality_notice || typeof confidentiality_notice !== 'object') {
    findings.push('confidentiality_notice: missing entirely.');
  } else {
    for (const field of ['who_reads', 'retention', 'employer_sees', 'disclosure_triggers']) {
      need(confidentiality_notice, field, 'confidentiality_notice');
    }
    if (confidentiality_notice.shown_before_first_message !== true) {
      findings.push('confidentiality_notice: shown_before_first_message must be true — users disclose on the assumption of confidentiality unless told otherwise first.');
    }
  }

  return {
    ready: findings.length === 0,
    findings,
    ...(resources ? { resource_findings: resources } : {}),
    rule: findings.length === 0
      ? 'The four artefacts are present. What this did not judge: whether the scope fits the population, whether the fallback really answers at 2am, whether the notice is honest — those are the operator\'s claims, now on record.'
      : 'No configuration, no check-ins. Fix the findings before a session runs; help build the artefacts rather than running without them.',
  };
}

export const STANDING_CAVEAT =
  'Themes in this summary are conversational patterns, not clinical findings.';

/**
 * Draft the supervisor summary's quantitative sections mechanically from the
 * audit log, enforcing the resolution rules: denominators on every claim,
 * themes below the minimum session count withheld, escalations referenced by
 * case id only. The operator supplies the themes; the log supplies the
 * numbers; prose stays with the skill.
 */
export function draftSummary({ since, until, themes, config_version } = {}) {
  if (!since) throw new ToolError('invalid_request', 'Pass "since" (YYYY-MM-DD) — a summary without a stated reporting window is not publishable.');
  const audit = reviewAudit({ since, until, limit: 10000 });
  const total = audit.total_sessions;

  const themeRows = [];
  const withheld = [];
  for (const t of Array.isArray(themes) ? themes : []) {
    const label = t?.theme?.trim();
    const behind = Number(t?.sessions_behind);
    if (!label || !(behind >= 0)) {
      throw new ToolError('invalid_request', 'Each theme needs { theme, sessions_behind } — the denominator is not optional.');
    }
    if (behind > total) {
      throw new ToolError('invalid_request', `Theme "${label}" claims ${behind} sessions behind it, but the window holds ${total}.`);
    }
    if (behind < THEME_MIN_SESSIONS) {
      withheld.push({ theme: label, sessions_behind: behind, reason: `Below the ${THEME_MIN_SESSIONS}-session minimum — reporting it risks identifying individuals.` });
    } else {
      themeRows.push({ theme: label, sessions_behind: behind });
    }
  }

  return {
    reporting_window: { since, until: until ?? 'now', sessions: total, ...(config_version ? { config_version } : {}) },
    participation: { sessions: total, endings: audit.endings },
    escalations: {
      total: audit.escalations.total,
      by_category: audit.escalations.by_category,
      case_ids_for_receiving_team: audit.sessions.filter((s) => s.escalated).map((s) => s.id),
      rule: 'Referenced by case id only — escalated sessions are never narrated in the summary.',
    },
    themes: themeRows,
    ...(withheld.length > 0 ? { themes_withheld: withheld } : {}),
    ...(audit.missed_escalations.count > 0
      ? { missed_escalations: { count: audit.missed_escalations.count, note: 'These are incidents, not summary lines — they go to the incident review, and the count is stated here because hiding it would make the summary a fiction.' } }
      : {}),
    standing_caveat: STANDING_CAVEAT,
    resolution_reminder:
      'Individual detail appears only where the confidentiality notice says it does. This draft ' +
      'carries the numbers; the prose around them is written by the skill, inside the same rules.',
  };
}
