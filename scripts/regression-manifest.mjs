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
  // ---- go-live hardening (services/billing, release artifacts) -------------
  {
    id: 'env',
    summary: 'the service would start with a test Stripe key in production, issuing real licences against payments that never happened',
    testFiles: ['services/billing/test/env.test.mjs'],
    pattern: /test key/,
  },
  {
    id: 'baked-url',
    summary: 'an archive built without bake-billing-url.mjs points every licence check at the placeholder host',
    testFiles: ['test/shipped-artifacts.test.mjs'],
    pattern: /placeholder/,
  },

  // ---- shared runtime (packages/suite-runtime/mcp-lite.js) -----------------
  {
    id: '81',
    summary: 'no schema in the suite declared a maximum, so every numeric argument was unbounded and an absurd value was answered instead of refused',
    testFiles: ['test/tool-behaviour.test.mjs'],
    pattern: /ceiling exists at all/,
  },
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
    id: '80',
    summary: 'an invalid tool schema pattern threw a SyntaxError instead of producing a validation error',
    testFiles: ['packages/suite-runtime/test/mcp-lite.test.mjs'],
    pattern: /invalid pattern/,
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
  {
    id: '79',
    summary: 'writes were never fsynced, so a power cut right after a successful write or rename could still lose it',
    testFiles: [
      'packages/suite-runtime/test/local-store.test.mjs',
      'services/billing/test/e2e.mjs',
    ],
    pattern: /fsyncs the write and the rename/,
  },

  // ---- billing service (services/billing) ----------------------------------
  {
    id: 'catalog-index',
    summary: 'GET /v1/catalog shared a branch with the per-plugin route, so split(\'/\').pop() looked up the literal "catalog" and the storefront\'s own route always 404ed',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /bare catalog path/,
  },
  {
    id: 'plan-availability',
    summary: 'available was hardcoded true on all 28 plans, so a plugin with no provisioned Stripe price advertised a Buy button that could only 503',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /unprovisioned plan/,
  },
  {
    id: 'usage-requires-active',
    summary: 'POST /v1/usage checked only that the licence key existed, so a cancelled, past_due or unpaid licence could keep driving the meter',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /cancelled licence/i,
  },
  {
    id: 'seat-ceiling-unidentified',
    summary: 'the seat check lived inside if (deviceId), so omitting device_id skipped seat accounting and gave an unlimited number of machines a fully active entitlement',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /unidentified caller/,
  },
  {
    id: 'device-label-validation',
    summary: 'device_label was pushed onto the seat list with no type or length check, beside a device_id validator written to stop exactly that',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /device_label/,
  },
  {
    id: 'usage-input-bounds',
    summary: 'meter and idempotency_key were charset-checked but never length-bounded, and neither is ever pruned from the store',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /65-character meter/,
  },
  {
    id: 'usage-idempotency-meter-scope',
    summary: 'the usage claim id omitted the meter, so a second meter reported under one retry key was dropped while the response still said recorded: true',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /replay of the first/,
  },
  {
    id: 'json-body-must-be-object',
    summary: 'a body of the literal JSON value null parsed fine and was returned to handlers that read a property off it — an uncaught 500 on four routes',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /not a 500/,
  },
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
    id: 'usage-claim-atomicity',
    summary: 'recordUsage persisted its increment and claimed its event as two separate writes; a failure on the second, after the first succeeded, double-counted usage on the caller\'s retry',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /record the usage exactly once/,
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
    id: 'audit-isodate-rollover',
    summary: "audit.js's isoDayOf had the same date-rollover bug already fixed in resources.js's parseDate: Date.parse('2024-02-30') silently rolls forward to March 1st instead of throwing, so a session (or a since/until filter) could claim a calendar date that never happened",
    testFiles: ['plugins/mental-health-chatbot/mcp/test/audit.test.mjs'],
    pattern: /Feb 29 in a non-leap year/,
  },
  {
    id: 'profile-version-fallback',
    summary: 'saveProfile carried every field forward with an existing-value fallback except version, which was set to input.version with no fallback — an update call that omitted version silently nulled it out',
    testFiles: ['plugins/generative-digital-twin/mcp/test/domain.test.mjs'],
    pattern: /preserve the existing version, not drop it to undefined/,
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
    testFiles: ['plugins/trail-split/mcp/test/weight.test.mjs'],
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
  {
    id: 'effort-map-worked-example',
    summary: "professor-mind-reader's effortMap is checked against the exact worked numbers printed in references/rubric-decomposition.md, catching drift between the reference doc's own arithmetic and the code",
    testFiles: ['plugins/professor-mind-reader/mcp/test/domain.test.mjs'],
    pattern: /on_budget\/thin boundary/,
  },
  {
    id: 'ratio-verdict-boundary',
    summary: 'an investment-ratio threshold using >= instead of the documented > would misclassify a value sitting exactly on a boundary (e.g. 1.5) into the wrong bucket',
    testFiles: ['plugins/professor-mind-reader/mcp/test/domain.test.mjs'],
    pattern: /1\.5-to-1\.2 bucket/,
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

  // ---- ESM module-type, licence-store aliasing, release tooling ------------
  {
    id: 'esm-module-type',
    summary: 'no package.json anywhere in the repo declared "type": "module", so every shipped .js file failed to load on real Node (20.x/22.0-22.6) with SyntaxError, masked only by this sandbox\'s newer unflagged syntax-detection',
    testFiles: ['test/esm-compat.test.mjs'],
    pattern: /declaring "type": "module"/,
  },
  {
    id: 'license-aliasing',
    summary: 'getLicense/findLicense handed out the live in-memory object, so a caller mutating its result corrupted the store before putLicense was ever called, making rollback-on-failed-save a no-op',
    testFiles: ['services/billing/test/e2e.mjs'],
    pattern: /detached copy/,
  },
  {
    id: 'bake-url-substitution',
    summary: "bake-billing-url.mjs used String.replace()'s string form, so a URL containing $& corrupted the rewritten plugin server file instead of being written literally",
    testFiles: ['test/bake-billing-url.test.mjs'],
    pattern: /written literally/,
  },
  {
    id: 'bake-url-injection',
    summary: 'bake-billing-url.mjs interpolated the URL into a single-quoted JS string literal unescaped, so a quote in the URL broke out of the literal and injected code that would run the next time the plugin server started',
    testFiles: ['test/bake-billing-url.test.mjs'],
    pattern: /single quote was accepted/,
  },
  {
    id: 'sbom-manifest-false-positive',
    summary: 'sbom.mjs treated any tracked package.json as evidence of a dependency, so the package.json files added purely to declare "type": "module" would have failed --check with no real dependency present',
    testFiles: ['test/sbom.test.mjs'],
    pattern: /dependency-free package\.json failed the check/,
  },
  {
    id: 'mcp-json-missing',
    summary: 'validate.mjs silently skipped its entire .mcp.json check when the file was absent instead of erroring, so a plugin shipping with zero registered MCP tools passed validation',
    testFiles: ['test/validate-mcp-json.test.mjs'],
    pattern: /no \.mcp\.json passed validation/,
  },
];
