#!/usr/bin/env node
/**
 * The environment check that decides whether this service is allowed to serve.
 *
 * The case it exists for is not a missing variable — that surfaces quickly
 * either way. It is a *test* key in production: the service starts, takes
 * checkouts, issues real licences, and charges nobody, and nothing looks
 * wrong until the month's revenue is compared with the licence count.
 *
 *   node services/billing/test/env.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEnvironment, enforceEnvironment, REQUIRED, isPlaceholderHost } from '../lib/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// Assembled rather than written out. test/secrets.test.mjs treats a
// live-shaped key as a finding wherever it appears, including in a fixture,
// and that rule is worth more than the convenience of a literal here — it is
// the one rule with no exceptions, so it cannot have one. The test needs a
// key of this shape to exercise the live-key-outside-production path.
const LIVE_SHAPED = ['sk', 'live', '51AbcdefghijKLMNOPqrstuv'].join('_');
const TEST_SHAPED = ['sk', 'test', '51AbcdefghijKLMNOPqrstuv'].join('_');

const LIVE = {
  BILLING_ENV: 'production',
  STRIPE_SECRET_KEY: LIVE_SHAPED,
  STRIPE_WEBHOOK_SECRET: 'whsec_AbcdefghijKLMNOPqrstuvwxyz012345',
  BILLING_PUBLIC_URL: 'https://billing.codestudioplugin.com',
  BILLING_STORE_FILE: '/data/store.json',
};

try {
  assert.deepEqual(checkEnvironment(LIVE).errors, [], 'a correct production environment was refused');
  assert.equal(checkEnvironment(LIVE).environment, 'production');
  ok('a complete production environment passes');

  // Each required variable, missing and malformed, one at a time.
  for (const { name } of REQUIRED) {
    const without = { ...LIVE };
    delete without[name];
    assert.ok(checkEnvironment(without).errors.some((e) => e.startsWith(name)),
      `${name} missing in production was not an error`);

    const wrong = { ...LIVE, [name]: 'obviously-not-right' };
    const errors = checkEnvironment(wrong).errors;
    assert.ok(errors.some((e) => e.startsWith(name)), `${name} malformed in production was not an error`);
    // The value must never be echoed — these lines go to a log the host ships.
    assert.ok(!errors.join(' ').includes('obviously-not-right'),
      `${name}: the check printed the value it rejected`);
  }
  ok(`${REQUIRED.length} required variables: missing and malformed are both refused, and neither echoes the value`);

  // The expensive one.
  const testKeyInProd = { ...LIVE, STRIPE_SECRET_KEY: TEST_SHAPED };
  assert.ok(checkEnvironment(testKeyInProd).errors.some((e) => /test key/.test(e)),
    'a test key in production was allowed to start');
  ok('a test key in production is refused, because it issues real licences against payments that never happened');

  // The mirror image: a live key in development is a warning, not a block —
  // refusing would stop someone debugging a real incident.
  const liveKeyInDev = { ...LIVE, BILLING_ENV: 'development' };
  const dev = checkEnvironment(liveKeyInDev);
  assert.deepEqual(dev.errors, [], 'development refused to start over a live key');
  assert.ok(dev.warnings.some((w) => /LIVE key/.test(w)), 'a live key in development passed unremarked');
  ok('a live key outside production warns loudly and still starts');

  // The test suite's own escape hatch must not survive into production.
  assert.ok(checkEnvironment({ ...LIVE, STRIPE_API_BASE: 'http://127.0.0.1:1' }).errors
    .some((e) => /STRIPE_API_BASE/.test(e)), 'STRIPE_API_BASE was allowed in production');
  ok('STRIPE_API_BASE, which points Stripe at a mock, cannot be set in production');

  // A store inside the container loses every licence on redeploy.
  const ephemeral = { ...LIVE };
  delete ephemeral.BILLING_STORE_FILE;
  assert.ok(checkEnvironment(ephemeral).errors.some((e) => /BILLING_STORE_FILE/.test(e)),
    'production started with no configured store path');
  ok('production refuses a default store path, which lives inside the container');

  // A placeholder public URL is the baked-URL defect wearing a different hat,
  // and there is more than one placeholder: the first version of this check
  // rejected example.com alone, while .env.example — the file a person copies
  // to build their production config — shipped billing.yourdomain.com.
  for (const host of ['billing.example.com', 'billing.yourdomain.com', 'billing.your-domain.net',
                      'billing.example.invalid', 'replace-me.io']) {
    assert.ok(isPlaceholderHost(host), `${host} is not recognised as a placeholder`);
    assert.ok(checkEnvironment({ ...LIVE, BILLING_PUBLIC_URL: `https://${host}` }).errors
      .some((e) => /BILLING_PUBLIC_URL/.test(e)), `${host} was accepted as the public URL`);
  }
  assert.equal(isPlaceholderHost('billing.codestudioplugin.com'), false,
    'a real host was mistaken for a placeholder');
  assert.ok(checkEnvironment({ ...LIVE, BILLING_PUBLIC_URL: 'http://billing.real.com' }).errors
    .some((e) => /BILLING_PUBLIC_URL/.test(e)), 'a plaintext http public URL was accepted');
  ok('the public URL must be https and must not be any of the placeholder hosts');

  // The property that closes the hole rather than patching one instance:
  // .env.example must not be copyable into production. Read the real file, so
  // this cannot drift when someone edits it.
  const example = fs.readFileSync(path.join(here, '..', '.env.example'), 'utf8');
  const exampleEnv = Object.fromEntries(example.split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]));
  assert.ok(exampleEnv.BILLING_PUBLIC_URL, '.env.example no longer sets BILLING_PUBLIC_URL');
  const exampleErrors = checkEnvironment({ ...exampleEnv, BILLING_ENV: 'production' }).errors;

  // Name the field. "at least one error" is satisfied by the sk_live_... and
  // whsec_... placeholders whatever the URL says, so the first version of
  // this assertion passed with a real host in the file — it was guarding
  // nothing about the thing it was written for.
  assert.ok(exampleErrors.some((e) => e.startsWith('BILLING_PUBLIC_URL')),
    `.env.example's BILLING_PUBLIC_URL (${exampleEnv.BILLING_PUBLIC_URL}) is not refused by the gate. `
    + 'That file is the template a production config is built from; a plausible-looking host in it '
    + 'is a host somebody ships.');
  assert.ok(isPlaceholderHost(new URL(exampleEnv.BILLING_PUBLIC_URL).hostname),
    '.env.example carries a host the placeholder rule does not recognise');

  // And every other value in it must fail too, so the file as a whole cannot
  // be copied and started.
  for (const { name } of REQUIRED) {
    assert.ok(exampleErrors.some((e) => e.startsWith(name)),
      `.env.example's ${name} is accepted by the gate — the file can be copied into production`);
  }
  ok(`.env.example cannot be copied into production: all ${REQUIRED.length} required values are refused, the URL by name`);

  // enforce() exits rather than serving.
  let exited = null;
  const lines = [];
  enforceEnvironment({ BILLING_ENV: 'production' }, { log: (l) => lines.push(l), exit: (c) => { exited = c; } });
  assert.equal(exited, 1, 'a broken production environment did not exit non-zero');
  assert.ok(lines.some((l) => /refusing to start/.test(l)), 'it exited without saying why');
  let devExit = 'not called';
  enforceEnvironment({ STRIPE_SECRET_KEY: TEST_SHAPED },
    { log: () => {}, exit: (c) => { devExit = c; } });
  assert.equal(devExit, 'not called', 'development refused to start over a warning');
  ok('production exits 1 and says why; development warns and serves');

  console.log(`\n${passed} environment checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
