/**
 * The intent taxonomy: the three-kind classification, the three-way test with
 * its edge cases, the clustering thresholds, and the two worked taxonomies —
 * the canonical tables the customer-sales-support skill's help-centre audit
 * (step 1) records tickets against. The audit applies only the
 * checks those tables state mechanically; whether an intent really is
 * static for this business is a judgement the audit does not make.
 */

// Every numeric threshold the method states, in one place.
export const THRESHOLDS = {
  export_min_days: 90,
  export_min_tickets: 2000,
  min_tickets_for_volumes: 500,
  top_intents: 20,
  top_coverage_percent: 70,
  article_min_volume_percent: 0.5,
  policy_changes_per_quarter: 2,
  multi_intent_percent: 15,
  // Rounding allowance for the shares-sum-to-100 check, in percentage points.
  volume_sum_tolerance: 2,
};

export const KINDS = {
  static: {
    test: 'The correct answer is identical for every customer who asks it today',
    agent_behaviour: 'May be auto-answered from an article',
  },
  account: {
    test: 'The answer depends on a lookup into order, subscription or account state',
    agent_behaviour: 'Answer only with a verified live lookup; never from memory or inference',
  },
  judgement: {
    test: 'The answer depends on discretion, tone, risk or an exception',
    agent_behaviour: 'Hand to a human',
  },
};

export const THREE_WAY_TEST = {
  ask_in_order: [
    'Would the correct answer be identical for every customer asking this today? Yes: static.',
    'Does answering require reading this customer\'s order, subscription or account state? Yes: account-specific.',
    'Otherwise: judgement.',
  ],
  default_rule:
    'If you cannot say which of the three an intent is, it is not static; default to escalation.',
  variant_rule:
    'A static intent that is plan-, region- or currency-dependent is not one static intent. ' +
    'It is N static intents, one per variant, or one article with an explicit qualifier table.',
  turn_rule:
    'An intent may be static in its first turn and judgement thereafter — "what is your returns ' +
    'window" is static; the follow-up "that\'s ridiculous, I want an exception" is a judgement ' +
    'turn. Classify the turn, not just the ticket.',
};

export const EDGE_CASES = [
  { situation: '"What is your returns window?"', kind: 'static', why: 'One policy, one answer' },
  { situation: '"Can I return this order?"', kind: 'account', why: 'Depends on order date and item type' },
  { situation: '"Can I return this outside the window?"', kind: 'judgement', why: 'It is an exception request' },
  { situation: '"How do I reset my password?"', kind: 'static', why: 'Procedure is the same for everyone' },
  { situation: '"Why is my password reset email not arriving?"', kind: 'account', why: 'Needs delivery logs' },
  { situation: '"Do you support SSO?"', kind: 'static', why: 'Unless the answer is plan-dependent — then split per plan' },
  { situation: '"Does my plan include SSO?"', kind: 'account', why: 'Lookup' },
  { situation: '"Where is my order?"', kind: 'account', why: 'Only automatable if you can query the carrier live' },
  { situation: '"My order is late, I want compensation"', kind: 'judgement', why: 'Discretionary' },
  { situation: 'Anything with the word "refund" attached to a dispute', kind: 'judgement', why: 'Escalate' },
];

export const CLUSTERING_METHOD = [
  'Export at least 90 days or 2,000 tickets, whichever is larger. Include the first customer message verbatim — not the subject line, which is often empty or "Help".',
  'Strip signatures, order numbers and quoted history. Keep error codes.',
  'Cluster by first message. Embedding-based clustering is fine as a first pass, but a human must read a sample of 20 per cluster and rename it in customer language.',
  'Merge until the top 20 intents cover 70% or more of volume. Too many small clusters is the normal failure; over-merging shows up as an intent whose sampled tickets need two different answers.',
  'Record volume, resolution path and kind for each.',
  'Keep the long tail visible: everything below the top 20 goes into a single "tail" row with its combined percentage. It is usually 20-30% of volume and it is nearly all escalation.',
];

export const VOLUME_FLOOR_NOTE =
  'Under 500 tickets, report the taxonomy but not the percentages. Say the volumes are indicative only.';

export const RECORDING_FORMAT = {
  columns: 'intent | customer phrasing examples (3) | volume % | kind | resolution path | article id | owner | last reviewed',
  note:
    'One table, owned by a named person, reviewed quarterly. The customer-phrasing column is not ' +
    'decoration: it is the input to the retrieval test and the source of the article titles.',
};

export const TAXONOMY_SYMPTOMS = [
  { symptom: 'An intent\'s sampled tickets need two different answers', reading: 'Over-merged — split it.' },
  { symptom: 'An article exists with no intent behind it', reading: 'Written from the product side, not the ticket side. It will not be retrieved. Delete or map it.' },
  { symptom: 'A high-volume intent has no resolution path recorded', reading: 'Nobody actually knows how it is resolved today, which means it is being resolved inconsistently by humans. Fix that before automating it.' },
  { symptom: 'Volume shares do not sum to 100%', reading: 'Tickets with multiple intents were double-counted. Count the primary intent only, and note the multi-intent rate separately; above 15% it changes the agent design.' },
];

// Worked examples. Illustrative volumes — use the shape, not the numbers.
export const WORKED_TAXONOMIES = {
  ecommerce: {
    label: 'Direct-to-consumer e-commerce',
    basis: 'A mid-sized store, roughly 4,000 tickets per quarter. Illustrative volumes — use the shape, not the numbers.',
    intents: [
      { intent: 'Where is my order', volume_percent: 18, kind: 'account', resolution_path: 'Look up order, carrier status, paraphrase ETA' },
      { intent: 'How do I return an item', volume_percent: 11, kind: 'static', resolution_path: 'Point at returns portal, state window and condition rules' },
      { intent: 'Is this item back in stock', volume_percent: 7, kind: 'account', resolution_path: 'Check stock feed for SKU, offer restock alert' },
      { intent: 'Change or cancel my order', volume_percent: 7, kind: 'account', resolution_path: 'Check fulfilment state; cancellable only pre-pick' },
      { intent: 'Discount code not working', volume_percent: 6, kind: 'static', resolution_path: 'Explain the four standard rejection reasons' },
      { intent: 'Where is my refund', volume_percent: 6, kind: 'account', resolution_path: 'Check refund state, quote the 5-10 working day bank window' },
      { intent: 'Wrong or damaged item received', volume_percent: 5, kind: 'judgement', resolution_path: 'Requires photo assessment and a goodwill decision' },
      { intent: 'Sizing and fit questions', volume_percent: 5, kind: 'static', resolution_path: 'Size guide per product category' },
      { intent: 'Delivery to my country / duties', volume_percent: 4, kind: 'static', resolution_path: 'Per-region table; must be region-qualified' },
      { intent: 'Payment declined at checkout', volume_percent: 4, kind: 'static', resolution_path: 'The declined-card article with literal error strings' },
      { intent: 'Order never arrived / marked delivered', volume_percent: 3, kind: 'judgement', resolution_path: 'Loss claim, fraud exposure' },
      { intent: 'Return not refunded yet', volume_percent: 3, kind: 'account', resolution_path: 'Check receipt scan at warehouse' },
      { intent: 'Tail (60+ intents)', volume_percent: 21, kind: 'mixed', resolution_path: 'Mostly escalation' },
    ],
    arithmetic:
      'Static share: 30%. Automatable account-specific with a live order lookup: 34%. Containment ' +
      'ceiling by the step-2 definition: 64%. Discount for retrieval and lookup failures to 55-60%, ' +
      'and expect 40-45% realistically at launch.',
  },
  saas: {
    label: 'B2B SaaS',
    basis: 'Roughly 1,200 tickets per quarter, 300 accounts. Illustrative volumes — use the shape, not the numbers.',
    intents: [
      { intent: 'How do I do X in the product', volume_percent: 16, kind: 'static', resolution_path: 'Procedure article per feature' },
      { intent: 'Login / SSO failure', volume_percent: 10, kind: 'account', resolution_path: 'Check IdP config and recent auth logs' },
      { intent: 'Billing: what am I being charged for', volume_percent: 9, kind: 'account', resolution_path: 'Read the invoice and seat count' },
      { intent: 'Invite users / manage permissions', volume_percent: 8, kind: 'static', resolution_path: 'Role matrix article' },
      { intent: 'API error or rate limit', volume_percent: 7, kind: 'static', resolution_path: 'Error-code article, literal codes in text' },
      { intent: 'Does the product do Y', volume_percent: 7, kind: 'static', resolution_path: 'Capability answer, plan-qualified' },
      { intent: 'Data import failing', volume_percent: 6, kind: 'account', resolution_path: 'Inspect the import job' },
      { intent: 'Request a feature', volume_percent: 5, kind: 'judgement', resolution_path: 'Route to product, do not promise' },
      { intent: 'Upgrade, downgrade, seat change', volume_percent: 5, kind: 'judgement', resolution_path: 'Commercial' },
      { intent: 'Cancel subscription', volume_percent: 4, kind: 'judgement', resolution_path: 'Always human, always' },
      { intent: 'Security or DPA questionnaire', volume_percent: 4, kind: 'judgement', resolution_path: 'Legal and security review' },
      { intent: 'Outage / "is it just me"', volume_percent: 3, kind: 'account', resolution_path: 'Status page plus tenant health' },
      { intent: 'Tail', volume_percent: 16, kind: 'mixed', resolution_path: 'Escalation' },
    ],
    arithmetic:
      'Static share: roughly 38%, but note plan-dependency. "Does the product do Y" and the role ' +
      'matrix both need per-plan variants or they will produce wrong answers for the cheapest tier, ' +
      'which is where most of the volume is.',
  },
};

export const CEILING_NOTE =
  'The containment ceiling is the share of volume held by static intents plus automatable ' +
  'account-specific intents. Nothing above it is achievable. For most e-commerce stores it lands ' +
  'between 35% and 55%; anyone promising 80% is counting escalations as deflections.';

const KIND_ALIASES = {
  static: 'static',
  account: 'account',
  'account-specific': 'account',
  account_specific: 'account',
  judgement: 'judgement',
  judgment: 'judgement',
};

export function normaliseKind(kind) {
  return KIND_ALIASES[String(kind ?? '').trim().toLowerCase()] ?? null;
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Mechanical audit of a recorded taxonomy against the method's stated
 * thresholds, plus the containment-ceiling arithmetic from step 2 of the
 * skill. Every finding quotes its evidence. It does not re-classify intents,
 * and it does not estimate a realistic containment figure — the ceiling is
 * arithmetic; the discount below it is not.
 */
export function auditTaxonomy({
  intents,
  total_tickets = null,
  window_days = null,
  tail_percent = null,
  multi_intent_percent = null,
} = {}) {
  const findings = [];
  const flag = (check, evidence, why) => findings.push({ check, evidence, why });

  const rows = intents.map((raw, index) => ({
    index,
    intent: String(raw.intent ?? '').trim(),
    volume_percent: typeof raw.volume_percent === 'number' ? raw.volume_percent : null,
    kind: normaliseKind(raw.kind),
    kind_as_given: raw.kind ?? null,
    resolution_path: typeof raw.resolution_path === 'string' && raw.resolution_path.trim() ? raw.resolution_path.trim() : null,
    lookup_available: raw.lookup_available === true,
    lookup_stated: typeof raw.lookup_available === 'boolean',
    safety_adjacent: raw.safety_adjacent === true,
    plan_or_region_dependent: raw.plan_or_region_dependent === true,
    answer_changes_last_quarter: typeof raw.answer_changes_last_quarter === 'number' ? raw.answer_changes_last_quarter : null,
  }));

  // ---- data-set checks ----------------------------------------------------

  const volumesUsable = total_tickets == null ? null : total_tickets >= THRESHOLDS.min_tickets_for_volumes;
  if (volumesUsable === false) {
    flag('volumes_are_noise', `total_tickets = ${total_tickets}`,
      'Under 500 tickets the volume figures are noise. The taxonomy still stands, but nothing below ' +
      'is ranked on volumes and the automation-surface arithmetic is withheld.');
  }
  if (window_days != null && window_days < THRESHOLDS.export_min_days
      && (total_tickets == null || total_tickets < THRESHOLDS.export_min_tickets)) {
    flag('export_window_short', `window_days = ${window_days}`,
      'The method asks for at least 90 days or 2,000 tickets, whichever is larger.');
  }

  // ---- volume checks ------------------------------------------------------

  const withVolume = rows.filter((r) => r.volume_percent != null);
  const useVolumes = volumesUsable !== false && withVolume.length > 0;

  if (useVolumes) {
    const top = [...withVolume].sort((a, b) => b.volume_percent - a.volume_percent)
      .slice(0, THRESHOLDS.top_intents);
    const coverage = round1(top.reduce((sum, r) => sum + r.volume_percent, 0));
    if (coverage < THRESHOLDS.top_coverage_percent) {
      flag('top_intents_under_coverage', `top ${top.length} intents cover ${coverage}% of volume`,
        'Keep clustering until the top 20 intents cover 70% or more of volume. If they do not, the clusters are too fine; merge.');
    }

    const sum = round1(withVolume.reduce((s, r) => s + r.volume_percent, 0) + (tail_percent ?? 0));
    if (Math.abs(sum - 100) > THRESHOLDS.volume_sum_tolerance) {
      flag('volumes_do_not_sum', `intent shares${tail_percent != null ? ' plus tail' : ''} sum to ${sum}% (tolerance ±${THRESHOLDS.volume_sum_tolerance})`,
        'Tickets with multiple intents were double-counted. Count the primary intent only, and note the multi-intent rate separately.');
    }
  }

  if (multi_intent_percent != null && multi_intent_percent > THRESHOLDS.multi_intent_percent) {
    flag('multi_intent_rate_high', `multi_intent_percent = ${multi_intent_percent}%`,
      'Above 15% the multi-intent rate changes the agent design: the agent must handle the second intent or escalate.');
  }

  // ---- per-intent checks --------------------------------------------------

  for (const row of rows) {
    const name = row.intent || `intent #${row.index + 1}`;
    if (!row.kind) {
      flag('unclassified_intent', `${name}: kind "${row.kind_as_given ?? '(none)'}"`,
        'If you cannot say which of the three kinds an intent is, it is not static; default to escalation. It is excluded from the automation surface below.');
    }
    if (!row.resolution_path) {
      flag('missing_resolution_path', name,
        'Nobody actually knows how this is resolved today, which means it is being resolved inconsistently by humans. Fix that before automating it.');
    }
    if (row.kind === 'static' && row.plan_or_region_dependent) {
      flag('variant_dependent_static', name,
        'A static intent that is plan-, region- or currency-dependent is not one static intent. It is N static intents, one per variant, or one article with an explicit qualifier table.');
    }
    if (row.answer_changes_last_quarter != null
        && row.answer_changes_last_quarter > THRESHOLDS.policy_changes_per_quarter) {
      flag('policy_not_procedure', `${name}: answer changed ${row.answer_changes_last_quarter} times last quarter`,
        'An intent whose answer changed more than twice last quarter is policy, not procedure. It still gets an article, but the policy value lives in its own short article with its own owner.');
    }
    if (row.kind === 'account' && !row.lookup_available) {
      flag('account_intent_without_lookup', `${name}${row.lookup_stated ? '' : ' (lookup_available not stated — treated as no lookup)'}`,
        'Account-specific intents are automated only where a live lookup exists. No lookup, no automation: the agent collects the identifiers and hands over.');
    }
  }

  // ---- automation surface and article backlog -----------------------------

  let automation_surface = null;
  let article_backlog = null;

  if (useVolumes) {
    const share = (predicate) => round1(withVolume.filter(predicate).reduce((s, r) => s + r.volume_percent, 0));
    const staticShare = share((r) => r.kind === 'static');
    const automatableAccountShare = share((r) => r.kind === 'account' && r.lookup_available);

    automation_surface = {
      static_share_percent: staticShare,
      automatable_account_share_percent: automatableAccountShare,
      containment_ceiling_percent: round1(staticShare + automatableAccountShare),
      judgement_share_percent: share((r) => r.kind === 'judgement'),
      account_without_lookup_percent: share((r) => r.kind === 'account' && !r.lookup_available),
      unclassified_share_percent: share((r) => !r.kind),
      ...(tail_percent != null ? { tail_percent } : {}),
      note: CEILING_NOTE + ' Realistic launch figures sit well below the ceiling; this audit does not estimate them.',
    };

    const statics = withVolume.filter((r) => r.kind === 'static')
      .sort((a, b) => b.volume_percent - a.volume_percent);
    const eligible = statics.filter((r) => r.volume_percent >= THRESHOLDS.article_min_volume_percent || r.safety_adjacent);
    const deferred = statics.filter((r) => r.volume_percent < THRESHOLDS.article_min_volume_percent && !r.safety_adjacent);
    article_backlog = {
      note: 'Static intents sorted by volume, descending — that ordered list is the article backlog.',
      write_now: eligible.map((r) => ({
        intent: r.intent,
        volume_percent: r.volume_percent,
        ...(r.safety_adjacent && r.volume_percent < THRESHOLDS.article_min_volume_percent
          ? { included_because: 'safety-, legal- or accessibility-adjacent' } : {}),
      })),
      deferred: deferred.map((r) => ({
        intent: r.intent,
        volume_percent: r.volume_percent,
        why: 'Below 0.5% of volume and not safety-, legal- or accessibility-adjacent — no article yet.',
      })),
    };
  }

  return {
    intents_audited: rows.length,
    volumes_usable: volumesUsable === null
      ? 'total_tickets not supplied — the 500-ticket floor could not be checked, so treat every percentage as unverified'
      : volumesUsable,
    findings,
    ...(automation_surface ? { automation_surface } : {}),
    ...(article_backlog ? { article_backlog } : {}),
    note:
      'Mechanical checks against the method\'s stated thresholds only. The audit does not ' +
      're-classify intents — the three-way test is applied by a person reading real tickets — and ' +
      'it names no realistic containment figure, only the arithmetic ceiling.',
  };
}
