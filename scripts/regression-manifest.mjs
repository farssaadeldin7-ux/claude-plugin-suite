/**
 * The registry check-regressions.mjs verifies against: one entry per tracked
 * defect fix, naming the test file(s) that must contain a real assertion
 * proving it. This is data, not logic — see check-regressions.mjs for how
 * an entry is actually checked.
 *
 * `pattern` must appear on a line that also contains "assert" in at least
 * one of `testFiles` — never source files, and never a bare substring match
 * anywhere in the file. That's the whole fix for the two known failure
 * modes: `nosniff` matching the server's own source instead of a test
 * asserting on it, and `minLength|maxLength|pattern` matching the English
 * word "patterns" in unrelated prose. Scoping to test files closes the
 * first; requiring the exact keyword (not a substring-prone OR) closes the
 * second — see check-regressions.test.mjs for both, reproduced and proven
 * caught.
 *
 * This is not a mapping of all 78 audit items — many (doc wording, a CI
 * script's own logic) have no test-file pattern to check at all, and are
 * out of scope for this tool by nature. It covers the fixes that a test
 * assertion can actually speak to.
 */
export const REGRESSIONS = [
  // ---- shared runtime (packages/suite-runtime/mcp-lite.js) -----------------
  {
    id: '64',
    summary: 'inputSchema published in tools/list was never enforced',
    testFiles: ['packages/suite-runtime/test/mcp-lite.test.mjs'],
    pattern: /invalid_arguments/,
  },
  {
    id: '04',
    summary: 'Infinity/NaN in a tool result silently became null',
    testFiles: ['packages/suite-runtime/test/mcp-lite.test.mjs'],
    pattern: /overflowed.*['"]Infinity['"]/,
  },
  {
    id: '26',
    summary: 'a handler returning nothing produced a missing text field, not a visible error',
    testFiles: ['packages/suite-runtime/test/mcp-lite.test.mjs'],
    pattern: /returned no value/,
  },
  {
    id: '27',
    summary: 'an unbounded, newline-free input could grow the read buffer without limit',
    testFiles: ['packages/suite-runtime/test/mcp-lite.test.mjs'],
    pattern: /must still respond after an oversized, newline-free write/,
  },
  {
    id: '63',
    summary: 'process.exit() on stdin close could truncate a queued response',
    testFiles: ['packages/suite-runtime/test/mcp-lite.test.mjs'],
    pattern: /exits 0.*when stdin closes/,
  },

  // ---- licence client (packages/suite-runtime/license-client.js) ----------
  {
    id: '52',
    summary: 'denials hardcoded missing_license regardless of what actually failed',
    testFiles: ['packages/suite-runtime/test/license-client.test.mjs'],
    pattern: /billing_unreachable.*never a fabricated missing_license/,
  },
  {
    id: '53',
    summary: 'a build never pointed at a real billing host looked like an ordinary network failure',
    testFiles: ['packages/suite-runtime/test/license-client.test.mjs'],
    pattern: /billing_not_configured/,
  },
  {
    id: '49',
    summary: 'a 429/5xx response body was read as if it were a real entitlement',
    testFiles: ['packages/suite-runtime/test/license-client.test.mjs'],
    pattern: /degraded, true/,
  },
  {
    id: '24',
    summary: 'server error codes/messages were forwarded to the caller unchecked',
    testFiles: ['packages/suite-runtime/test/license-client.test.mjs'],
    pattern: /activation_failed.*fall back/,
  },
  {
    id: '23',
    summary: 'recordUsage minted a fresh idempotency key on every call, including retries',
    testFiles: ['packages/suite-runtime/test/license-client.test.mjs'],
    pattern: /caller-chosen-key/,
  },
  {
    id: '68',
    summary: "mkdirSync's mode is ignored when the config directory already exists",
    testFiles: [
      'packages/suite-runtime/test/license-client.test.mjs',
      'packages/suite-runtime/test/local-store.test.mjs',
    ],
    pattern: /0o700/,
  },

  // ---- local storage (packages/suite-runtime/local-store.js) --------------
  {
    id: '60',
    summary: 'a store silently destroyed records when the file could not be read',
    testFiles: ['packages/suite-runtime/test/local-store.test.mjs'],
    pattern: /is not valid JSON/,
  },
  {
    id: '73',
    summary: 'every plugin store lost records to concurrent writes',
    testFiles: ['packages/suite-runtime/test/local-store.test.mjs'],
    pattern: /lose no records/,
  },

  // ---- billing service (services/billing) ----------------------------------
  {
    id: '43',
    summary: 'the store swallowed every read error and started empty',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /corrupt.*throw|throw.*corrupt/i,
  },
  {
    id: '46',
    summary: 'catalog lookups resolved inherited members (e.g. /v1/catalog/constructor)',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /constructor/,
  },
  {
    id: '45',
    summary: 'webhook signature checks compared string length against byte buffers, and only checked the last v1=',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /timingSafeEqual|multibyte|rotation/i,
  },
  {
    id: '38',
    summary: 'a webhook event was claimed before its handler ran and never released on failure',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /never read as deduplicated/,
  },
  {
    id: '20',
    summary: 'the success page promised a key was shown "only here, once" after a 15-minute window existed',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /cache-control/,
  },
  {
    id: '13',
    summary: "activation returned the entitlement reason as its error code",
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /activation_failed/,
  },
  {
    id: '42',
    summary: 'entitlement deny-listed three Stripe statuses instead of allow-listing "active"',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /denied by default, not allowed by default/,
  },
  {
    id: '19',
    summary: 'no SIGTERM handler, so a redeploy cut off in-flight requests',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /SIGTERM/,
  },
  {
    id: '48',
    summary: "setup-stripe's 0600 mode never applied to an existing .env",
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /chmod 0600 unconditionally/,
  },

  // ---- plugins: domain logic ------------------------------------------------
  {
    id: '01',
    summary: 'a crisis-resource block could claim verification on a date that does not exist',
    testFiles: ['plugins/mental-health-chatbot/mcp/test/resources.test.mjs'],
    pattern: /does not exist on the calendar/,
  },
  {
    id: '02',
    summary: 'the quarterly re-verification window stretched on month-end dates',
    testFiles: ['plugins/mental-health-chatbot/mcp/test/resources.test.mjs'],
    pattern: /more than three months/,
  },
  {
    id: '31',
    summary: 'the 10x-overhead dispatch rule was skipped above 30 minutes per frame',
    testFiles: ['plugins/predictive-resource-allocation/mcp/test/domain.test.mjs'],
    pattern: /10x threshold/,
  },
  {
    id: '33',
    summary: 'the weight ledger compared rounded totals; the headroom warning threshold did not match its own message; any body weight was accepted',
    testFiles: ['plugins/basecamp-split/mcp/test/weight.test.mjs'],
    pattern: /implausible_body_weight/,
  },
  {
    id: '61',
    summary: 'the ADR escalation regex was missing the case-insensitive flag',
    testFiles: ['plugins/customer-sales-support/mcp/test/escalation.test.mjs'],
    pattern: /legal_regulatory/,
  },
  {
    id: '62a',
    summary: 'the wrong-fire risk term was named backwards, and the payback formula divided by zero',
    testFiles: ['plugins/neural-link-intention-layer/mcp/test/score.test.mjs'],
    pattern: /invalid_term/,
  },
  {
    id: '62b',
    summary: 'the flat-stretch merge check only compared scene-index adjacency',
    testFiles: ['plugins/emotional-resonance-analyzer/mcp/test/arc.test.mjs'],
    pattern: /not merged/,
  },
  {
    id: '62c',
    summary: 'the capture checklist reported five-of-five when nothing was described',
    testFiles: ['plugins/diagnose-by-sound/mcp/test/acoustics.test.mjs'],
    pattern: /not a clean five-of-five/,
  },
  {
    id: '62d',
    summary: 'a yield note contradicted its own band table at the exact 1.5 boundary',
    testFiles: ['plugins/five-minute-fluency/mcp/test/yield.test.mjs'],
    pattern: /fill_only/,
  },
  {
    id: '62e',
    summary: 'the estimate review reported zero within a factor of two on a perfectly calibrated log',
    testFiles: ['plugins/predictive-resource-allocation/mcp/test/domain.test.mjs'],
    pattern: /within_factor_two, 3/,
  },
  {
    id: '72',
    summary: 'the fold report contradicted itself (truncated:false with nonzero characters_hidden)',
    testFiles: ['plugins/ghost-post-preview/mcp/test/fold.test.mjs'],
    pattern: /agree even when everything past the cut is blank/,
  },
  {
    id: '76',
    summary: 'a char-cap cut could split a surrogate-pair character in half',
    testFiles: ['plugins/ghost-post-preview/mcp/test/fold.test.mjs'],
    pattern: /surrogate pair/,
  },
  {
    id: '71',
    summary: 'table lookups by caller-supplied string resolved inherited Object.prototype members',
    testFiles: ['test/plugin-table-lookups.test.mjs'],
    pattern: /Object\.prototype/,
  },

  // ---- packaging & build ----------------------------------------------------
  {
    id: '65',
    summary: 'build.mjs zipped the whole plugin directory with no exclusions',
    testFiles: ['test/build.test.mjs'],
    pattern: /dev-only test files/,
  },
  {
    id: '66',
    summary: 'no archive contained the repository LICENSE',
    testFiles: ['test/build.test.mjs'],
    pattern: /contains the repository LICENSE/,
  },
];
