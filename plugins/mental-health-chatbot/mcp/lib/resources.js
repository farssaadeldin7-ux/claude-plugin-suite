/**
 * Mechanical validation of a regional crisis-resource configuration block,
 * against the resource rules the mental-health-chatbot skill's step 4
 * (route to real resources only) configures a deployment with.
 *
 * The protocol forbids hardcoding crisis numbers from memory and forbids the
 * model generating them; this module accordingly contains no numbers, no
 * service names and no defaults. It checks the shape and the dates of a block
 * the deployer supplies, and it names — without checking — the rules only a
 * human can verify. Findings fail the block: the reference makes staleness a
 * build failure, not a warning.
 */

export const RESOURCE_RULES = [
  'Verified against the provider\'s own published page, not a directory or an aggregator.',
  'Re-verified quarterly, and the review date enforced in CI — a stale block fails the build.',
  'At least one non-voice option per region, because many people will not make a call.',
  'A default for users whose region is unknown, plus the instruction to ask which country they ' +
    'are in before giving a number.',
  'Emergency services number stated separately from the crisis line, and never conflated.',
];

export const NO_GENERATED_NUMBERS =
  'Do not hardcode crisis numbers from memory, and do not let the model generate them. Numbers ' +
  'change, coverage differs by country and region, and a wrong number given to someone in crisis ' +
  'is the worst possible failure of this product.';

/** Rules a tool cannot check from the block alone; a human must. */
export const HUMAN_VERIFICATION_REQUIRED = [
  'Each service was verified against the provider\'s own published page, not a directory or an aggregator.',
  'At least one listed service is a non-voice option (text, chat) — many people will not make a call.',
  'The deployment has a default block for users whose region is unknown, plus the instruction to ' +
    'ask which country they are in before giving a number.',
  'The emergency services number is stated separately from the crisis line, and never conflated.',
];

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value) {
  if (typeof value !== 'string' || !DATE_SHAPE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Quarterly means three calendar months; the reference's own example block
 *  runs 2026-08-01 to 2026-11-01. */
function addThreeMonths(date) {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + 3);
  return next;
}

/**
 * Validate one resource block. Pure: `today` is injectable for tests and
 * defaults to the current UTC date. Any finding makes the block invalid —
 * a stale block fails the build.
 */
export function checkResourceConfig(block, { today = new Date() } = {}) {
  const findings = [];

  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return {
      valid: false,
      findings: ['The configuration is not an object. See the required shape.'],
      requires_human_verification: HUMAN_VERIFICATION_REQUIRED,
    };
  }

  for (const field of ['region', 'verified_on', 'verified_by', 'review_due']) {
    if (typeof block[field] !== 'string' || !block[field].trim()) {
      findings.push(`Missing or empty field "${field}".`);
    }
  }

  const verifiedOn = parseDate(block.verified_on);
  const reviewDue = parseDate(block.review_due);
  if (block.verified_on && !verifiedOn) {
    findings.push('"verified_on" is not a date in YYYY-MM-DD form.');
  }
  if (block.review_due && !reviewDue) {
    findings.push('"review_due" is not a date in YYYY-MM-DD form.');
  }

  if (verifiedOn && verifiedOn.getTime() > today.getTime()) {
    findings.push('"verified_on" is in the future — the block claims a verification that has not happened.');
  }
  if (reviewDue && reviewDue.getTime() < today.getTime()) {
    findings.push(
      `Stale: "review_due" (${block.review_due}) has passed. Re-verification is quarterly, and a ` +
      'stale block fails the build.'
    );
  }
  if (verifiedOn && reviewDue) {
    if (reviewDue.getTime() <= verifiedOn.getTime()) {
      findings.push('"review_due" is not after "verified_on".');
    } else if (reviewDue.getTime() > addThreeMonths(verifiedOn).getTime()) {
      findings.push(
        `"review_due" (${block.review_due}) is more than three months after "verified_on" ` +
        `(${block.verified_on}) — re-verification is quarterly.`
      );
    }
  }

  if (!Array.isArray(block.services) || block.services.length === 0) {
    findings.push('"services" must be a non-empty array.');
  } else {
    block.services.forEach((service, index) => {
      if (!service || typeof service !== 'object') {
        findings.push(`services[${index}] is not an object.`);
        return;
      }
      for (const field of ['name', 'contact', 'hours']) {
        if (typeof service[field] !== 'string' || !service[field].trim()) {
          findings.push(`services[${index}] is missing "${field}".`);
        }
      }
    });
  }

  return {
    valid: findings.length === 0,
    findings,
    requires_human_verification: HUMAN_VERIFICATION_REQUIRED,
  };
}
