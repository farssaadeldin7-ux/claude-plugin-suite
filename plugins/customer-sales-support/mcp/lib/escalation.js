/**
 * Hard escalation triggers, the handover format and the grounding contract —
 * ported from references/escalation-and-eval.md. The screen matches the
 * trigger table's literal detection phrases against a message, nothing more:
 * it misses paraphrase, it does not read sentiment, and a message can require
 * escalation without matching any pattern here. It exists so the trigger list
 * can be exercised against real ticket text, not to replace the agent's own
 * trigger implementation.
 */

export const TRIGGERS = [
  {
    id: 'billing_dispute',
    label: 'Billing dispute',
    detection: 'Customer contests a charge, says "I was charged twice", "I never authorised this"',
    why: 'Money plus a factual disagreement',
    patterns: [
      /charged twice/i,
      /double[- ]?charged/i,
      /never authori[sz]ed/i,
      /did ?n[o']t authori[sz]e/i,
      /unauthori[sz]ed/i,
      /contest(?:ing)? (?:this|that|the) charge/i,
      /overcharged/i,
    ],
  },
  {
    id: 'refund_above_threshold',
    label: 'Refund above threshold',
    detection: 'Requested or implied amount over your limit',
    why: 'Set the limit deliberately — a business decision, not a knowledge one',
    needs: 'refund_amount and refund_threshold',
  },
  {
    id: 'chargeback',
    label: 'Chargeback mentioned',
    detection: '"chargeback", "dispute with my bank", "section 75", card-network language',
    why: 'Regulated process with deadlines',
    patterns: [
      /chargeback/i,
      /dispute .{0,20}with my bank/i,
      /section 75/i,
      /card network/i,
    ],
  },
  {
    id: 'cancellation_with_anger',
    label: 'Cancellation with anger',
    detection: 'Cancellation intent plus negative sentiment or escalating language',
    why: 'Retention and tone; never automate',
    // Both halves must match. The anger half is a literal word list, not
    // sentiment analysis — an angry cancellation phrased calmly will not fire.
    requires_both: {
      cancellation: [
        /cancel(?:l(?:ed|ing)|lation)?\b.{0,40}\b(subscription|account|order|plan|membership)/i,
        /\bcancel (it|this|everything|my)\b/i,
      ],
      anger: [
        /\b(ridiculous|unacceptable|furious|fed up|disgusted|appalling|useless|pathetic|worst)\b/i,
        /\b(a joke|a scam|never again)\b/i,
        /!{2,}/,
      ],
    },
  },
  {
    id: 'data_deletion',
    label: 'Data deletion',
    detection: '"delete my account", "delete my data", "GDPR", "right to erasure"',
    why: 'Irreversible and regulated',
    patterns: [
      /delete my (account|data)/i,
      /erase my data/i,
      /remove (?:all )?my (data|information)/i,
      /right to erasure/i,
      /\bgdpr\b/i,
    ],
  },
  {
    id: 'legal_regulatory',
    label: 'Legal or regulatory',
    detection: 'Solicitor, lawsuit, regulator, ombudsman, ADR, trading standards',
    why: 'Anything said here is on the record',
    patterns: [
      /\bsolicitor\b/i,
      /\blawyer\b/i,
      /\battorney\b/i,
      /\blawsuit\b/i,
      /legal action/i,
      /\bregulator\b/i,
      /\bombudsman\b/i,
      /\bADR\b/,
      /trading standards/i,
      /small claims/i,
      /\bsu(?:e|ing) you\b/i,
    ],
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    detection: 'Screen reader, disability, accommodation request, WCAG',
    why: 'Duty of care and legal exposure',
    patterns: [
      /screen ?reader/i,
      /\bdisabilit(?:y|ies)\b/i,
      /\bdisabled\b/i,
      /\baccommodation\b/i,
      /\bWCAG\b/i,
      /accessibilit/i,
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    detection: 'Injury, allergic reaction, faulty or dangerous product, self-harm language',
    why: 'Human, immediately, with the right escalation path',
    patterns: [
      /\binjur(?:y|ed|ies)\b/i,
      /allergic reaction/i,
      /\bdangerous\b/i,
      /\bfaulty\b/i,
      /caught fire/i,
      /\bburn(?:ed|t)?\b/i,
      /electric shock/i,
      /self[- ]?harm/i,
      /\bsuicid/i,
      /kill myself/i,
      /end my life/i,
    ],
  },
  {
    id: 'three_failed_turns',
    label: 'Three failed turns',
    detection: 'Three agent responses without resolution in one conversation',
    why: 'The agent is not converging; further attempts erode trust',
    needs: 'turns_without_resolution',
  },
  {
    id: 'explicit_request',
    label: 'Explicit request for a human',
    detection: '"human", "agent", "person", "representative", "manager"',
    why: 'Honour it on the first ask, without negotiation',
    patterns: [
      /\bhuman\b/i,
      /\bagent\b/i,
      /\bperson\b/i,
      /\brepresentative\b/i,
      /\bmanager\b/i,
    ],
  },
  {
    id: 'vip_account',
    label: 'VIP or enterprise account',
    detection: 'Account above your revenue threshold',
    why: 'Worth adding for most businesses',
    additional: true,
    needs: 'vip_account',
  },
  {
    id: 'public_complaint',
    label: 'Public complaint mentioned',
    detection: '"posting this review", "taking this to Twitter"',
    why: 'Worth adding for most businesses',
    additional: true,
    patterns: [
      /post(?:ing)? (?:a |this |my )?review/i,
      /taking this to (?:twitter|x\b|social)/i,
      /leave (?:a |an )?(?:bad |negative |one[- ]star |1[- ]star )?review/i,
    ],
  },
];

export const REFUND_THRESHOLD_NOTE =
  'Setting the refund threshold is a business decision, not a knowledge one. Set it where the ' +
  'cost of a wrong automated refund is smaller than the cost of a human touch — for most consumer ' +
  'stores that lands somewhere between £15 and £30; above it, a human decides. Write the number ' +
  'down in one place and reference it, exactly as with any other policy value.';

export const EXPLICIT_REQUEST_NOTE =
  'The explicit-request trigger has no retention step. The agent does not ask "can I try one more ' +
  'thing?" A customer who asks for a human and is asked to justify it is a customer who leaves. ' +
  'Hand over on the first request.';

export const HANDOVER_FORMAT = `Escalation: <trigger name>
Intent (best guess): <intent from taxonomy, or "unclassified">
Customer asked: <one sentence, their words>
Known facts: <order id / plan / region / error code / dates — only what was verified>
Attempted: <what the agent said, and which articles it cited, or "nothing attempted">
Sentiment: <neutral | frustrated | angry>
Suggested owner: <queue or team>`;

export const HANDOVER_RULES = [
  'The agent stops answering and produces the structured handover. Nothing else.',
  'To the customer it says one short thing: that a person is taking over, and what they already have. No apology paragraph, no restating the policy, no final attempt at the answer.',
  'Never re-litigate. Once a trigger fires the conversation belongs to a human. An agent that adds "but just so you know, our policy says..." after escalating has made the handover worse than no answer at all.',
];

export const GROUNDING_CONTRACT = {
  rules: [
    'Answer only from the retrieved articles. If a fact is not in them, you do not have it.',
    'Cite the article you used, by title, in every substantive answer.',
    'If nothing is retrieved above the confidence threshold, say you do not know and escalate.',
    'Never infer a policy value, a price, a date or an entitlement. Never combine two articles to produce a value that neither states.',
    'Never restate a customer\'s guess back to them as confirmation.',
  ],
  rule_4_note:
    'Rule 4 is the one that gets skipped and the one that causes the worst incidents. An agent ' +
    'that reads "returns within 30 days" in one article and "exchanges follow the returns process" ' +
    'in another will happily invent a 30-day exchange window that does not exist.',
  i_dont_know:
    'Make "I don\'t know" a first-class, rewarded outcome: a correct escalation scores as a pass ' +
    'in the regression set, not as a miss. If your scoring counts escalations against the agent, ' +
    'you have built an incentive to guess, and it will guess.',
  threshold_note:
    'Retrieval scores are not comparable across systems, so do not copy a confidence threshold ' +
    'from anywhere. Set it empirically from the regression set — the lowest threshold at which ' +
    'false-containment stays under your ceiling.',
};

const matchFirst = (text, patterns) => {
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m) return m[0];
  }
  return null;
};

export const FAILED_TURNS_LIMIT = 3;

/**
 * Screen one customer message, plus any supplied conversation state, against
 * the hard-trigger table. Literal phrase matching only: a match is evidence a
 * trigger may apply and is quoted back; no match is not clearance. Triggers
 * are evaluated before retrieval — if any fires, the agent hands over and
 * does not attempt an answer first.
 */
export function screenMessage({
  message = '',
  turns_without_resolution = null,
  refund_amount = null,
  refund_threshold = null,
  vip_account = null,
} = {}) {
  const text = String(message ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');

  const fired = [];
  const not_evaluable = [];

  for (const trigger of TRIGGERS) {
    if (trigger.patterns) {
      const match = matchFirst(text, trigger.patterns);
      if (match) fired.push({ trigger: trigger.id, label: trigger.label, matched: match, why: trigger.why });
      continue;
    }
    if (trigger.requires_both) {
      const cancellation = matchFirst(text, trigger.requires_both.cancellation);
      const anger = matchFirst(text, trigger.requires_both.anger);
      if (cancellation && anger) {
        fired.push({
          trigger: trigger.id, label: trigger.label,
          matched: `"${cancellation}" with "${anger}"`, why: trigger.why,
        });
      } else if (cancellation) {
        not_evaluable.push({
          trigger: trigger.id,
          reason:
            'Cancellation language matched but no escalating-language phrase did. This screen ' +
            'matches a literal word list, not sentiment — an angry cancellation phrased calmly ' +
            'will not fire here.',
        });
      }
      continue;
    }
    // State-based triggers.
    if (trigger.id === 'three_failed_turns') {
      if (turns_without_resolution == null) {
        not_evaluable.push({ trigger: trigger.id, reason: 'turns_without_resolution not supplied.' });
      } else if (turns_without_resolution >= FAILED_TURNS_LIMIT) {
        fired.push({
          trigger: trigger.id, label: trigger.label,
          matched: `${turns_without_resolution} turns without resolution`, why: trigger.why,
        });
      }
    } else if (trigger.id === 'refund_above_threshold') {
      if (refund_amount == null || refund_threshold == null) {
        not_evaluable.push({
          trigger: trigger.id,
          reason: 'Needs both refund_amount and refund_threshold. ' + REFUND_THRESHOLD_NOTE,
        });
      } else if (refund_amount > refund_threshold) {
        fired.push({
          trigger: trigger.id, label: trigger.label,
          matched: `refund_amount ${refund_amount} > threshold ${refund_threshold}`, why: trigger.why,
        });
      }
    } else if (trigger.id === 'vip_account') {
      if (vip_account == null) {
        not_evaluable.push({ trigger: trigger.id, reason: 'vip_account flag not supplied. An additional trigger the reference marks as worth adding for most businesses.' });
      } else if (vip_account === true) {
        fired.push({ trigger: trigger.id, label: trigger.label, matched: 'vip_account = true', why: trigger.why });
      }
    }
  }

  return {
    fired,
    rule: fired.length
      ? 'A hard trigger fired: hand over before any retrieval attempt, using the handover format. Do not attempt an answer first, and never re-litigate.'
      : 'No literal detection phrase matched. That is not clearance — this screen misses paraphrase and reads no sentiment. The message can still require escalation.',
    ...(fired.length ? { handover_format: HANDOVER_FORMAT } : {}),
    not_evaluable,
    caveats: [
      'Literal phrase matching only. A match can also be incidental ("my account manager") — confirm the intent before acting on it.',
      'Triggers are evaluated on the incoming message and conversation state, before retrieval.',
    ],
  };
}
