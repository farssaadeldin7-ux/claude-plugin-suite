#!/usr/bin/env node
/**
 * End-to-end test of the billing service against a mock Stripe.
 *
 *   node services/billing/test/e2e.mjs
 *
 * Boots the real server on a random port with a throwaway store, points
 * STRIPE_API_BASE at a local mock, and walks every flow the license-client
 * uses: key issuance through signed webhooks, entitlement, seats, usage
 * metering, checkout, webhook signature rejection and replay, portal, and
 * cancellation.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { signWebhookPayload } from '../lib/stripe.js';
import { Store } from '../lib/store.js';

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.js');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billing-test-'));

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// ---- mock Stripe -----------------------------------------------------------

const stripeCalls = [];
const stripeState = { products: {}, prices: [], webhooks: [] };
const mockStripe = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    stripeCalls.push({ method: req.method, path: req.url, body });
    const url = new URL(req.url, 'http://mock');
    const route = `${req.method} ${url.pathname}`;
    const form = Object.fromEntries(new URLSearchParams(body));
    const reply = (status, payload) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
    };

    if (route === 'POST /v1/checkout/sessions') {
      return reply(200, { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    }
    if (route === 'POST /v1/billing_portal/sessions') {
      return reply(200, { id: 'bps_test_1', url: 'https://billing.stripe.com/p/session/bps_test_1' });
    }
    if (/^GET \/v1\/products\/[\w-]+$/.test(route)) {
      const id = url.pathname.split('/').pop();
      return stripeState.products[id]
        ? reply(200, stripeState.products[id])
        : reply(404, { error: { message: 'No such product' } });
    }
    if (route === 'POST /v1/products') {
      stripeState.products[form.id] = { id: form.id, name: form.name };
      return reply(200, stripeState.products[form.id]);
    }
    if (route === 'GET /v1/prices') {
      const lookup = url.searchParams.get('lookup_keys[0]');
      return reply(200, { data: stripeState.prices.filter((p) => p.active && p.lookup_key === lookup) });
    }
    if (route === 'POST /v1/prices') {
      const price = {
        id: `price_mock_${stripeState.prices.length + 1}`,
        product: form.product,
        unit_amount: Number(form.unit_amount),
        recurring: { interval: form['recurring[interval]'] },
        lookup_key: form.lookup_key,
        active: true,
      };
      // transfer_lookup_key moves the key off any older price, like Stripe does.
      for (const p of stripeState.prices) if (p.lookup_key === price.lookup_key) p.lookup_key = null;
      stripeState.prices.push(price);
      return reply(200, price);
    }
    if (route === 'GET /v1/webhook_endpoints') {
      return reply(200, { data: stripeState.webhooks });
    }
    if (route === 'POST /v1/webhook_endpoints') {
      const endpoint = { id: `we_mock_${stripeState.webhooks.length + 1}`, url: form.url, secret: 'whsec_mock_created' };
      stripeState.webhooks.push(endpoint);
      return reply(200, endpoint);
    }
    return reply(404, { error: { message: `mock has no ${route}` } });
  });
});
await new Promise((resolve) => mockStripe.listen(0, resolve));
const stripePort = mockStripe.address().port;

// ---- billing service under test -------------------------------------------

const PORT = 18787 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const WEBHOOK_SECRET = 'whsec_test_secret';

const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    PORT: String(PORT),
    BILLING_PUBLIC_URL: BASE,
    BILLING_STORE_FILE: path.join(tmpDir, 'store.json'),
    STRIPE_API_BASE: `http://127.0.0.1:${stripePort}`,
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_DBS_PRO: 'price_pro_mock',
    STRIPE_PRICE_DBS_TEAM: 'price_team_mock',
    STRIPE_PRICE_GPP_PRO: 'price_gpp_pro_mock',
    STRIPE_PRICE_GPP_TEAM: 'price_gpp_team_mock',
    BILLING_ALLOWED_ORIGINS: 'https://www.codestudioplugin.com, https://codestudioplugin.com',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let serverLog = '';
child.stderr.on('data', (d) => { serverLog += d; });

const until = async (fn, ms = 5000) => {
  const deadline = Date.now() + ms;
  for (;;) {
    try { return await fn(); } catch (err) { if (Date.now() > deadline) throw err; }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
  }
};

const api = async (method, endpoint, { body, key, raw, headers = {} } = {}) => {
  const response = await fetch(`${BASE}${endpoint}`, {
    method,
    headers: {
      ...(raw === undefined ? { 'content-type': 'application/json' } : {}),
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
};

// A signed checkout.session.completed delivery — the only way a key is born.
const completeCheckout = (eventId, session) => {
  const payload = JSON.stringify({ id: eventId, type: 'checkout.session.completed', data: { object: session } });
  return { payload, headers: { 'stripe-signature': signWebhookPayload(payload, WEBHOOK_SECRET) } };
};

try {
  // ---- a corrupted store must never look like an empty one ----------------
  // Regression test: the Store constructor caught every read error alike,
  // so a truncated/corrupted (but existing) file was silently treated as
  // "first run, start empty" — and the next save() would overwrite it for
  // good. A file that genuinely doesn't exist yet must still start empty.
  const corruptStorePath = path.join(tmpDir, 'corrupt-store.json');
  fs.writeFileSync(corruptStorePath, '{ this is not valid JSON');
  assert.throws(() => new Store(corruptStorePath), /not valid JSON/);
  const missingStorePath = path.join(tmpDir, 'never-created-store.json');
  assert.doesNotThrow(() => new Store(missingStorePath));
  ok('a store file that exists but fails to parse refuses to start; one that never existed starts empty');

  // ---- writes are durable: fsync on both the data file and its rename -----
  // Regression test: save() only ever wrote-then-renamed with no fsync at
  // all — a write can return before the bytes are actually on disk, and a
  // rename can return before the directory entry it updated is durable
  // either. A power cut right after a successful save() could still leave
  // the store pointing at a stale or missing file. Spied rather than
  // actually pulling the plug: fsyncSync must be called once for the data
  // file and (off Windows) once for the directory it was renamed into.
  {
    const store = new Store(path.join(tmpDir, 'fsync-store.json'));
    const originalFsync = fs.fsyncSync;
    let fsyncCalls = 0;
    fs.fsyncSync = (...args) => { fsyncCalls++; return originalFsync.apply(fs, args); };
    try {
      store.putLicense({ key: 'PS-TST-AAAAA-BBBBB-CCCCC-DDDD' });
    } finally {
      fs.fsyncSync = originalFsync;
    }
    const expected = process.platform === 'win32' ? 1 : 2;
    assert.equal(fsyncCalls, expected, 'both the data file and (off Windows) its directory must be fsynced on every save');
  }
  ok('save() fsyncs the write and the rename so a crash right after cannot lose it');

  // ---- getLicense/findLicense hand out a copy, never the live object ------
  // Regression test: every real caller (recordUsage, device registration,
  // both subscription webhook handlers) does getLicense()/findLicense() ->
  // mutate the result in place -> putLicense(that same object). If the read
  // handed out the live object sitting in the store, that in-place mutation
  // already lands in the store's own state before putLicense is ever
  // called — which means putLicense's own "previous" snapshot, taken at the
  // top of the call from the store's current state, is already the mutated
  // value. Rolling back to "previous" on a failed save then restores the
  // object to itself: a no-op. The unpersisted mutation stays in memory for
  // an unrelated later save to resurrect, even though this call reported
  // failure to its caller.
  {
    const store = new Store(path.join(tmpDir, 'alias-store.json'));
    store.putLicense({ key: 'PS-TST-AAAAA-BBBBB-CCCCC-DDDD', usage: { calls: { '2026-01': 1 } } });

    const fetched = store.getLicense('PS-TST-AAAAA-BBBBB-CCCCC-DDDD');
    fetched.usage.calls['2026-01'] = 999999; // exactly what recordUsage does: mutate the object it got back

    // Before putLicense is ever called again, the store's own state must be
    // untouched — the mutation above must have landed on a detached copy.
    const stillOriginal = store.getLicense('PS-TST-AAAAA-BBBBB-CCCCC-DDDD');
    assert.equal(stillOriginal.usage.calls['2026-01'], 1,
      'mutating the object getLicense() returned changed the store before putLicense was ever called');

    // And the rollback this enables actually works: a failed save must
    // leave the store's in-memory state exactly as it was before the call.
    const originalWriteSync = fs.writeSync;
    fs.writeSync = () => { throw new Error('simulated disk failure'); };
    try {
      assert.throws(() => store.putLicense(fetched), /simulated disk failure/);
    } finally {
      fs.writeSync = originalWriteSync;
    }
    const afterFailedWrite = store.getLicense('PS-TST-AAAAA-BBBBB-CCCCC-DDDD');
    assert.equal(afterFailedWrite.usage.calls['2026-01'], 1,
      'a failed save left the caller\'s in-place mutation resident in the store anyway');

    // findLicense must be equally defensive.
    const found = store.findLicense((l) => l.key === 'PS-TST-AAAAA-BBBBB-CCCCC-DDDD');
    found.usage.calls['2026-01'] = 777777;
    assert.equal(store.getLicense('PS-TST-AAAAA-BBBBB-CCCCC-DDDD').usage.calls['2026-01'], 1,
      'mutating the object findLicense() returned changed the store directly');
  }
  ok('getLicense/findLicense return a detached copy, so putLicense\'s rollback on a failed save actually rolls back');

  await until(async () => {
    const { data } = await api('GET', '/health');
    assert.equal(data.ok, true);
  });
  ok('health');

  // ---- catalog ------------------------------------------------------------
  const catalog = (await api('GET', '/v1/catalog/diagnose-by-sound')).data;
  assert.equal(catalog.name, 'Diagnose by Sound');
  assert.deepEqual(catalog.plans.map((p) => p.id).sort(), ['pro', 'team']);
  const pro = catalog.plans.find((p) => p.id === 'pro');
  assert.equal(pro.price, 5000);
  assert.equal(pro.seats, 2);
  const team = catalog.plans.find((p) => p.id === 'team');
  assert.equal(team.price, 15000);
  assert.equal(team.seats, 10);
  ok('catalog lists exactly pro and team with correct prices and seats');

  const cssCatalog = (await api('GET', '/v1/catalog/customer-sales-support')).data;
  assert.equal(cssCatalog.plans.find((p) => p.id === 'pro').price, 100000);
  assert.equal(cssCatalog.plans.find((p) => p.id === 'team').price, 500000);
  ok('customer-sales-support prices at $1,000/$5,000');

  assert.equal((await api('GET', '/v1/catalog/nonsense')).status, 404);
  ok('unknown plugin catalog is a 404');

  // ---- a catalog lookup never resolves an inherited member -----------------
  // Regression test: CATALOG[pluginId] on a plain object resolves inherited
  // Object.prototype members too, so /v1/catalog/constructor found the
  // Object constructor function instead of nothing, and calling .plans on
  // it threw — a 500, not the clean 404 an unknown plugin id gets.
  for (const trap of ['constructor', 'prototype', '__proto__', 'hasOwnProperty', 'toString']) {
    const res = await api('GET', `/v1/catalog/${trap}`);
    assert.equal(res.status, 404, `/v1/catalog/${trap} must be a 404, not resolve an inherited member`);
  }
  ok('a catalog lookup ignores inherited Object.prototype members');

  // ---- a malformed body is a clean 400, not an uncaught 500 ----------------
  // Regression test: four routes (usage, activate, checkout, portal) parsed
  // JSON.parse(raw) with no guard, so a body that failed to parse threw
  // inside the handler and surfaced as a generic internal_error.
  for (const route of ['/v1/usage', '/v1/license/activate', '/v1/checkout', '/v1/portal']) {
    const res = await api('POST', route, { raw: '{not json', headers: { 'content-type': 'application/json' } });
    assert.equal(res.status, 400, `${route} with malformed JSON must be a 400`);
    assert.equal(res.data.error, 'invalid_json');
  }
  ok('malformed JSON is a clean 400 on every route that parses a body');

  // ---- an oversized body gets a real 413, not a reset connection ----------
  // Regression test: the body-size guard called req.destroy() the moment it
  // tripped. req and res share one socket, so destroying req made writing
  // any response — including the 413 this was supposed to produce —
  // impossible; the caller saw a broken connection instead of a clean error.
  const oversized = await fetch(`${BASE}/v1/usage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'x'.repeat(70 * 1024),
  });
  assert.equal(oversized.status, 413);
  ok('an oversized request body gets a real 413 response, not a dropped connection');

  assert.equal((await api('POST', '/v1/trial', { body: { plugin_id: 'diagnose-by-sound', email: 'shop@example.com' } })).status, 404);
  ok('there is no trial endpoint');

  // ---- webhook issues the key --------------------------------------------
  const dbsCheckout = completeCheckout('evt_dbs_1', {
    id: 'cs_dbs_1', customer: 'cus_dbs_1', subscription: 'sub_dbs_1',
    customer_details: { email: 'owner@example.com' },
    metadata: { plugin_id: 'diagnose-by-sound', plan: 'pro' },
  });

  const badSig = await api('POST', '/v1/stripe/webhook', { raw: dbsCheckout.payload, headers: { 'stripe-signature': 't=1,v1=deadbeef' } });
  assert.equal(badSig.status, 400);
  ok('a bad webhook signature is rejected');

  // ---- a garbage v1 value is a clean 400, never a crash --------------------
  // Regression test: the signature check compared given.length (JS string
  // length, UTF-16 code units) to expected.length, then handed both to
  // timingSafeEqual as Buffers. A multibyte character in v1 can make its
  // UTF-8 byte length differ from its string length while the string
  // lengths still matched, and timingSafeEqual throws — not returns false —
  // on Buffers of unequal byte length, turning a bad signature into a 500.
  const multibyteSigTime = Math.floor(Date.now() / 1000);
  const multibyteSig = await api('POST', '/v1/stripe/webhook', {
    raw: dbsCheckout.payload,
    headers: { 'stripe-signature': `t=${multibyteSigTime},v1=${'é'.repeat(64)}` },
  });
  assert.equal(multibyteSig.status, 400, 'a multibyte v1 value must be a clean 400, not an uncaught crash');
  ok('a malformed (multibyte) signature value is rejected cleanly, not a 500');

  // ---- signature rotation: any active secret's v1 must verify -------------
  // Regression test: the header was parsed with Object.fromEntries, which
  // keeps only the last value for a repeated key — so of the several v1
  // values Stripe sends during signing-secret rotation (one per active
  // secret), only the last one in the header was ever actually checked.
  const rotationTime = Math.floor(Date.now() / 1000);
  const correctV1 = signWebhookPayload(dbsCheckout.payload, WEBHOOK_SECRET, rotationTime * 1000).split('v1=')[1];
  const rotatedHeader = `t=${rotationTime},v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef,v1=${correctV1}`;
  const rotated = await api('POST', '/v1/stripe/webhook', { raw: dbsCheckout.payload, headers: { 'stripe-signature': rotatedHeader } });
  assert.equal(rotated.status, 200, 'the correct v1 must verify no matter where it falls among several');
  ok('any matching v1 in a multi-secret signature header verifies, not only the last one');

  // ---- the webhook route has its own, larger body budget -------------------
  // Regression test: every route shared one 64 kB body cap, which a
  // legitimately large Stripe event (many line items, heavy metadata) can
  // exceed; the webhook route needs its own, bigger budget.
  const bigCheckout = completeCheckout('evt_big_1', {
    id: 'cs_big_1', customer: 'cus_big_1', subscription: 'sub_big_1',
    customer_details: { email: 'owner@example.com' },
    metadata: { plugin_id: 'diagnose-by-sound', plan: 'pro', padding: 'x'.repeat(100 * 1024) },
  });
  const bigWebhook = await api('POST', '/v1/stripe/webhook', { raw: bigCheckout.payload, headers: bigCheckout.headers });
  assert.equal(bigWebhook.status, 200, 'a webhook body over 64kB but under the webhook budget must not be a 413');
  ok('a webhook body well over 64kB, under its own larger budget, is accepted');

  assert.equal((await api('POST', '/v1/stripe/webhook', { raw: dbsCheckout.payload, headers: dbsCheckout.headers })).status, 200);
  const replayed = (await api('POST', '/v1/stripe/webhook', { raw: dbsCheckout.payload, headers: dbsCheckout.headers })).data;
  assert.equal(replayed.deduplicated, true);
  ok('a signed checkout.session.completed lands once and replays are ignored');

  // ---- a handler failure must not burn the idempotency id -----------------
  // Regression test: claimEvent() used to record an event as seen before
  // handleStripeEvent() ran. If the handler then failed (here: the store
  // write itself fails), the id was already claimed, so Stripe's retry of
  // the identical event came back "deduplicated" with a 200 and the paid
  // licence was never issued — silently, and for good. A failed delivery
  // must instead keep failing (real 5xx, never deduplicated) until the
  // underlying problem clears and the retry actually gets to run.
  {
    const brokenPort = 20787 + Math.floor(Math.random() * 1000);
    const blockerFile = path.join(tmpDir, 'store-write-blocker');
    fs.writeFileSync(blockerFile, 'a file, not a directory');
    // Every store.save() throws ENOTDIR here, regardless of the OS user
    // running the test — a structural error, not a permission one.
    const brokenStoreFile = path.join(blockerFile, 'nested', 'store.json');

    const brokenChild = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        PORT: String(brokenPort),
        BILLING_PUBLIC_URL: `http://127.0.0.1:${brokenPort}`,
        BILLING_STORE_FILE: brokenStoreFile,
        STRIPE_API_BASE: `http://127.0.0.1:${stripePort}`,
        STRIPE_SECRET_KEY: 'sk_test_mock',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        STRIPE_PRICE_DBS_PRO: 'price_pro_mock',
        STRIPE_PRICE_DBS_TEAM: 'price_team_mock',
      },
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    try {
      await until(async () => {
        const r = await fetch(`http://127.0.0.1:${brokenPort}/health`);
        assert.equal(r.status, 200);
      });

      const failing = completeCheckout('evt_store_write_failure', {
        id: 'cs_store_write_failure', customer: 'cus_x', subscription: 'sub_x',
        customer_details: { email: 'owner@example.com' },
        metadata: { plugin_id: 'diagnose-by-sound', plan: 'pro' },
      });
      const deliver = () => fetch(`http://127.0.0.1:${brokenPort}/v1/stripe/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...failing.headers },
        body: failing.payload,
      }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

      const first = await deliver();
      assert.equal(first.status, 500, 'a handler failure must surface as a real error, not a false 200');
      assert.notEqual(first.data?.deduplicated, true);

      const second = await deliver();
      assert.equal(second.status, 500, 'the retry of the SAME event must actually run the handler again');
      assert.notEqual(second.data?.deduplicated, true, 'a failed delivery must never read as deduplicated — that is exactly how the licence gets lost');

      ok("a webhook handler failure never claims the event, so Stripe's retry is not silently dropped");
    } finally {
      brokenChild.kill();
    }
  }

  // ---- a resend must not mint a second licence for one payment ------------
  // Regression test: event-id idempotency only catches Stripe redelivering
  // the identical event. A dashboard "resend" (or this event being
  // reprocessed after a crash between handling and claiming) arrives as a
  // genuinely different event id for the same checkout session, and used to
  // sail straight through to a second issueLicense call.
  {
    const resendSession = {
      id: 'cs_resend_1', customer: 'cus_resend_1', subscription: 'sub_resend_1',
      customer_details: { email: 'resend@example.com' },
      metadata: { plugin_id: 'diagnose-by-sound', plan: 'pro' },
    };
    const first = completeCheckout('evt_resend_a', resendSession);
    const resend = completeCheckout('evt_resend_b', resendSession);
    assert.equal((await api('POST', '/v1/stripe/webhook', { raw: first.payload, headers: first.headers })).status, 200);
    assert.equal((await api('POST', '/v1/stripe/webhook', { raw: resend.payload, headers: resend.headers })).status, 200);
    const stored = JSON.parse(fs.readFileSync(path.join(tmpDir, 'store.json'), 'utf8'));
    const matches = Object.values(stored.licenses).filter((l) => l.checkout_session_id === 'cs_resend_1');
    assert.equal(matches.length, 1, 'a resend of the same session must not create a second licence');
    ok('two different event ids for the same checkout session issue exactly one licence');
  }

  // ---- a session without payment must not become a licence -----------------
  // Regression test: checkout.session.completed can fire before payment has
  // actually landed (delayed-notification payment methods); issuing here
  // handed out a licence for money that was never received.
  {
    const unpaid = completeCheckout('evt_unpaid_1', {
      id: 'cs_unpaid_1', customer: 'cus_unpaid_1', subscription: 'sub_unpaid_1',
      customer_details: { email: 'unpaid@example.com' },
      metadata: { plugin_id: 'diagnose-by-sound', plan: 'pro' },
      payment_status: 'unpaid',
    });
    assert.equal((await api('POST', '/v1/stripe/webhook', { raw: unpaid.payload, headers: unpaid.headers })).status, 200);
    const stored = JSON.parse(fs.readFileSync(path.join(tmpDir, 'store.json'), 'utf8'));
    assert.equal(Object.values(stored.licenses).some((l) => l.checkout_session_id === 'cs_unpaid_1'), false);
    ok('a checkout session whose payment has not arrived does not issue a licence');
  }

  // ---- an event matching nothing sellable is logged, not swallowed --------
  // Regression test: an unsellable plan in the metadata and a subscription
  // event matching no licence both returned with zero visibility — a real
  // anomaly would leave no trace to investigate.
  {
    const bogus = completeCheckout('evt_bogus_plan', {
      id: 'cs_bogus_1', customer: 'cus_bogus_1',
      metadata: { plugin_id: 'diagnose-by-sound', plan: 'nonexistent' },
    });
    await api('POST', '/v1/stripe/webhook', { raw: bogus.payload, headers: bogus.headers });
    await until(async () => assert.match(serverLog, /named no sellable plan/));
    ok('a checkout naming an unsellable plan is logged, not silently ignored');
  }

  const success = await api('GET', '/success?session_id=cs_dbs_1');
  const key = /PS-DBS(?:-[A-Z2-9]+){4}/.exec(success.data)?.[0];
  assert.ok(key, 'success page shows the issued key');
  ok('the success page shows the new pro licence key');

  // ---- a page carrying a licence key is never cached, sniffed, or scripted -
  // Regression test: the page holding a live key had no cache-control (a
  // proxy or browser could keep re-serving it long after the fact), no
  // x-content-type-options (a misconfigured server upstream could let a
  // browser sniff it as something executable), no CSP, and no doctype.
  const successResponse = await fetch(`${BASE}/success?session_id=cs_dbs_1`);
  assert.equal(successResponse.headers.get('cache-control'), 'no-store');
  assert.equal(successResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(successResponse.headers.get('content-security-policy'), 'a licence-key page needs a CSP');
  assert.match(await successResponse.text(), /^<!doctype html>/i);
  ok('the success page is never cached, sniffed, or missing a doctype');

  // ---- a status check must never itself spend a seat ----------------------
  // Regression test: GET /v1/entitlement registered the calling device on
  // any check, so license_status — which promises to only report — silently
  // burned a seat the first time anyone called it on a new device.
  const peeked = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a&peek=true', { key })).data;
  assert.equal(peeked.active, true);
  assert.equal(peeked.seats.used, 0, 'peeking an unregistered device must not register it');
  const peekedAgain = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a&peek=true', { key })).data;
  assert.equal(peekedAgain.seats.used, 0, 'repeated peeks stay side-effect-free');
  ok('peek=true checks status without registering the device against a seat');

  // ---- entitlement + seats ------------------------------------------------
  const ent = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a', { key })).data;
  assert.equal(ent.active, true);
  assert.equal(ent.status, 'active');
  assert.equal(ent.plan, 'pro');
  assert.deepEqual(ent.features, ['diagnose', 'repair_plan', 'history']);
  assert.equal(ent.limits.diagnoses_per_month, null, 'no ceiling is null outward, never the internal -1 sentinel');
  assert.equal(ent.seats.limit, 2);
  assert.equal(ent.seats.used, 1);
  ok('the pro entitlement is active and registers the first device');

  const secondSeat = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-b', { key })).data;
  assert.equal(secondSeat.active, true);
  const thirdSeat = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-c', { key })).data;
  assert.deepEqual(thirdSeat, { active: false, reason: 'seat_limit_reached' });
  ok('a third device on a 2-seat pro plan is refused');

  const wrongPlugin = (await api('GET', '/v1/entitlement?plugin_id=ghost-post-preview&device_id=device-a', { key })).data;
  assert.deepEqual(wrongPlugin, { active: false, reason: 'wrong_plugin' });
  ok('the key is scoped to its plugin');

  assert.equal((await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound', { key: 'PS-DBS-AAAAA-BBBBB-CCCCC-DDDD' })).data.reason, 'unknown_license');
  assert.equal((await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound', { key: 'garbage' })).data.reason, 'malformed_license');
  ok('unknown and malformed keys are told apart');

  // ---- device_id is validated before it can be stored on a seat -----------
  // Regression test: device_id reached the seat list with no validation at
  // all — a caller could burn every seat on a shared key with arbitrary
  // invented strings (and store arbitrary blobs against a licence).
  const badDeviceId = await api('GET', `/v1/entitlement?plugin_id=diagnose-by-sound&device_id=${encodeURIComponent('not a real device id!!')}`, { key });
  assert.equal(badDeviceId.status, 400);
  ok('a malformed device_id is refused before it can reach the seat list');

  // ---- usage metering -----------------------------------------------------
  const use = (idem) => api('POST', '/v1/usage', { key, body: { plugin_id: 'diagnose-by-sound', meter: 'diagnoses_per_month', quantity: 1, idempotency_key: idem } });
  assert.equal((await use('u-1')).data.used, 1);
  assert.equal((await use('u-2')).data.used, 2);
  const replay = (await use('u-2')).data;
  assert.equal(replay.deduplicated, true);
  const after = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a', { key })).data;
  assert.equal(after.usage.diagnoses_per_month, 2);
  ok('usage is metered, idempotent on replay, and visible in the entitlement');

  // ---- an idempotency_key is required and scoped to the licence -----------
  // Regression test: an omitted idempotency_key became the literal string
  // "usage:undefined" for every caller, in one flat namespace shared by
  // every licence — so the first customer anywhere to omit it claimed a
  // single shared slot, and no key-less usage from any customer was ever
  // recorded again.
  assert.equal((await api('POST', '/v1/usage', {
    key, body: { plugin_id: 'diagnose-by-sound', meter: 'diagnoses_per_month', quantity: 1 },
  })).status, 400, 'a missing idempotency_key must be refused, not default to a shared bucket');
  ok('idempotency_key is required on /v1/usage');

  // ---- usage quantity is validated, never silently coerced -----------------
  // Regression test: Number(body.quantity) || 1 let a negative quantity
  // through as-is (walking the ledger backwards) and silently defaulted any
  // non-numeric garbage to 1 instead of refusing it.
  for (const badQuantity of [-5, 1.5, 0, 999_999_999]) {
    const res = await api('POST', '/v1/usage', {
      key, body: { plugin_id: 'diagnose-by-sound', meter: 'diagnoses_per_month', quantity: badQuantity, idempotency_key: `u-bad-${badQuantity}` },
    });
    assert.equal(res.status, 400, `quantity ${badQuantity} must be refused, not coerced`);
  }
  ok('a negative, fractional, or absurdly large quantity is refused, not silently coerced');

  // ---- usage is scoped to the plugin the key was sold for ------------------
  // Regression test: /v1/usage read plugin_id off the body and never checked
  // it against the licence, so a key for one plugin could meter another's
  // work under its own name.
  const wrongPluginUsage = await api('POST', '/v1/usage', {
    key, body: { plugin_id: 'ghost-post-preview', meter: 'diagnoses_per_month', quantity: 1, idempotency_key: 'u-wrong-plugin' },
  });
  assert.equal(wrongPluginUsage.status, 403);
  assert.equal(wrongPluginUsage.data.error, 'wrong_plugin');
  ok('/v1/usage refuses a plugin_id that does not match the licence');

  // ---- a meter name is never trusted as a raw object key --------------------
  // Regression test: recordUsage wrote `license.usage[meter][period] = ...`
  // with no validation, so {"meter":"__proto__"} reached into and wrote onto
  // Object.prototype itself — visible from every other object in the process.
  // "constructor" is the case a naive "letters only" pattern still lets
  // through: it matches such a pattern but reaches the shared Object
  // constructor function just as directly.
  for (const dangerousMeter of ['__proto__', 'constructor', 'prototype']) {
    const before = Object.prototype.polluted;
    const attempt = await api('POST', '/v1/usage', {
      key, body: { plugin_id: 'diagnose-by-sound', meter: dangerousMeter, quantity: 1, idempotency_key: `u-${dangerousMeter}` },
    });
    assert.equal(attempt.status, 400, `"${dangerousMeter}" as a meter name must be refused`);
    assert.equal(Object.prototype.polluted, before, 'Object.prototype must come out exactly as it went in');
  }
  ok('dangerous meter names are refused before any of them reaches an object key');

  // ---- activation ---------------------------------------------------------
  const activate = (await api('POST', '/v1/license/activate', { body: {
    license_key: key.toLowerCase(), plugin_id: 'diagnose-by-sound', device_id: 'device-a', device_label: 'shop pc',
  } })).data;
  assert.equal(activate.activated, true);
  assert.equal(activate.plan, 'pro');
  ok('activate accepts the key case-insensitively and reports the plan');

  // ---- a failed activation never reveals which keys exist ------------------
  // Regression test: activation echoed entitlement.reason as the error code,
  // which told a guesser "unknown_license" from "wrong_plugin" from
  // "seat_limit_reached" — an oracle for which key strings actually exist.
  const badActivate = await api('POST', '/v1/license/activate', { body: {
    license_key: 'PS-DBS-AAAAA-BBBBB-CCCCC-DDDD', plugin_id: 'diagnose-by-sound', device_id: 'device-z',
  } });
  assert.equal(badActivate.status, 403);
  assert.equal(badActivate.data.error, 'activation_failed');
  ok('a failed activation always answers with the same generic error code');

  // ---- checkout -----------------------------------------------------------
  const checkout = (await api('POST', '/v1/checkout', { body: { plugin_id: 'diagnose-by-sound', plan: 'pro', email: 'owner@example.com' } })).data;
  assert.equal(checkout.checkout_url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  const stripeCall = stripeCalls.find((c) => c.path === '/v1/checkout/sessions');
  assert.match(stripeCall.body, /line_items%5B0%5D%5Bprice%5D=price_pro_mock/);
  assert.match(stripeCall.body, /metadata%5Bplugin_id%5D=diagnose-by-sound/);
  ok('checkout creates a Stripe session with the pro price and metadata');

  assert.equal((await api('POST', '/v1/checkout', { body: { plugin_id: 'diagnose-by-sound', plan: 'enterprise' } })).status, 404);
  ok('unknown plan is refused');

  // ---- email is validated before it reaches Stripe --------------------------
  // Regression test: email went to Stripe's customer_email straight off an
  // unauthenticated body with no validation at all.
  const badEmailCheckout = await api('POST', '/v1/checkout', {
    body: { plugin_id: 'diagnose-by-sound', plan: 'pro', email: 'not-an-email' },
  });
  assert.equal(badEmailCheckout.status, 400);
  ok('a malformed email is refused before it reaches Stripe');

  // ---- a network failure reaching Stripe never reaches the public caller --
  // Regression test: stripeRequest() only distinguished a Stripe API error
  // (safe to relay — Stripe writes those to be shown to a user) from
  // everything else by whether fetch() itself threw. A DNS failure, a
  // refused connection, or a proxy in between all threw plain fetch/Node
  // errors, and those were relayed verbatim to an unauthenticated browser
  // endpoint — exactly where an internal hostname must never surface.
  {
    const deadPort = 8; // universally closed (the old TCP "chargen" port); connection refused, no DNS lookup needed
    const unreachablePort = 20787 + Math.floor(Math.random() * 1000);
    const unreachableChild = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        PORT: String(unreachablePort),
        BILLING_PUBLIC_URL: `http://127.0.0.1:${unreachablePort}`,
        BILLING_STORE_FILE: path.join(tmpDir, 'unreachable-store.json'),
        STRIPE_API_BASE: `http://127.0.0.1:${deadPort}`,
        STRIPE_SECRET_KEY: 'sk_test_mock',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        STRIPE_PRICE_DBS_PRO: 'price_pro_mock',
        STRIPE_PRICE_DBS_TEAM: 'price_team_mock',
      },
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    try {
      await until(async () => {
        const r = await fetch(`http://127.0.0.1:${unreachablePort}/health`);
        assert.equal(r.status, 200);
      });
      const res = await fetch(`http://127.0.0.1:${unreachablePort}/v1/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plugin_id: 'diagnose-by-sound', plan: 'pro' }),
      });
      const data = await res.json();
      assert.equal(res.status, 502);
      assert.equal(data.error, 'stripe_unreachable');
      assert.equal(data.message, 'Could not reach Stripe.');
      assert.doesNotMatch(data.message, /ECONNREFUSED|127\.0\.0\.1|fetch failed/, 'the raw network error must never reach the caller');
    } finally {
      unreachableChild.kill();
    }
  }
  ok('a network failure reaching Stripe answers with a generic message, not the raw error');

  // ---- second plugin: ghost-post-preview ---------------------------------
  const gppCatalog = (await api('GET', '/v1/catalog/ghost-post-preview')).data;
  assert.equal(gppCatalog.name, 'Ghost Post Preview');
  assert.equal(gppCatalog.plans.find((p) => p.id === 'pro').price, 50000);
  assert.equal(gppCatalog.plans.find((p) => p.id === 'team').price, 200000);
  const gppCheckout = completeCheckout('evt_gpp_1', {
    id: 'cs_gpp_1', customer: 'cus_gpp_1', subscription: 'sub_gpp_1',
    customer_details: { email: 'shop@example.com' },
    metadata: { plugin_id: 'ghost-post-preview', plan: 'pro' },
  });
  assert.equal((await api('POST', '/v1/stripe/webhook', { raw: gppCheckout.payload, headers: gppCheckout.headers })).status, 200);
  const gppSuccess = await api('GET', '/success?session_id=cs_gpp_1');
  const gppKey = /PS-GPP(?:-[A-Z2-9]+){4}/.exec(gppSuccess.data)?.[0];
  assert.ok(gppKey, 'success page shows the issued GPP key');
  const gppEnt = (await api('GET', '/v1/entitlement?plugin_id=ghost-post-preview&device_id=device-a', { key: gppKey })).data;
  assert.equal(gppEnt.active, true);
  assert.deepEqual(gppEnt.features, ['lint', 'history']);
  const crossPlugin = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a', { key: gppKey })).data;
  assert.deepEqual(crossPlugin, { active: false, reason: 'wrong_plugin' });
  ok('ghost-post-preview has its own catalog, webhook-issued keys, and plugin-scoped licences');

  // ---- a subscription that has stopped paying must lose entitlement -------
  // Regression test: the status check was a deny-list of exactly three
  // strings ('canceled', 'inactive', 'past_due'), so 'unpaid' — what a
  // subscription becomes after every dunning retry has failed — was fully
  // entitled by default, same as 'incomplete', 'incomplete_expired' and
  // 'paused'.
  const unpaidSub = JSON.stringify({
    id: 'evt_gpp_unpaid', type: 'customer.subscription.updated', data: { object: { id: 'sub_gpp_1', status: 'unpaid' } },
  });
  await api('POST', '/v1/stripe/webhook', { raw: unpaidSub, headers: { 'stripe-signature': signWebhookPayload(unpaidSub, WEBHOOK_SECRET) } });
  const unpaidEnt = (await api('GET', '/v1/entitlement?plugin_id=ghost-post-preview&device_id=device-a', { key: gppKey })).data;
  assert.deepEqual(unpaidEnt, { active: false, reason: 'inactive' });
  ok('a status other than active is denied by default, not allowed by default');

  // ---- portal -------------------------------------------------------------
  const portal = (await api('POST', '/v1/portal', { body: { license_key: key } })).data;
  assert.equal(portal.portal_url, 'https://billing.stripe.com/p/session/bps_test_1');
  ok('portal opens a Stripe billing portal session for a licence');

  // ---- cancellation -------------------------------------------------------
  const deleted = JSON.stringify({ id: 'evt_dbs_2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_dbs_1' } } });
  await api('POST', '/v1/stripe/webhook', { raw: deleted, headers: { 'stripe-signature': signWebhookPayload(deleted, WEBHOOK_SECRET) } });
  const cancelled = (await api('GET', '/v1/entitlement?plugin_id=diagnose-by-sound&device_id=device-a', { key })).data;
  assert.deepEqual(cancelled, { active: false, reason: 'inactive' });
  ok('subscription.deleted deactivates the licence');

  // ---- CORS for the storefront -------------------------------------------
  const SITE = 'https://www.codestudioplugin.com';
  const preflight = await fetch(`${BASE}/v1/checkout`, {
    method: 'OPTIONS',
    headers: { origin: SITE, 'access-control-request-method': 'POST' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), SITE);
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);

  const corsGet = await fetch(`${BASE}/v1/catalog/diagnose-by-sound`, { headers: { origin: SITE } });
  assert.equal(corsGet.headers.get('access-control-allow-origin'), SITE);

  const strangerGet = await fetch(`${BASE}/v1/catalog/diagnose-by-sound`, { headers: { origin: 'https://evil.example' } });
  assert.equal(strangerGet.headers.get('access-control-allow-origin'), null);
  ok('CORS allows the storefront origins and nobody else');

  // ---- SIGTERM shuts down gracefully, not mid-response ---------------------
  // Regression test: with no SIGTERM handler, a redeploy's kill signal cut
  // every in-flight request off immediately — including a webhook handler
  // that had already run and was about to record its claim. server.close()
  // stops accepting new connections and lets the process exit only once
  // existing ones finish, instead of the default (immediate) termination.
  {
    const sigtermPort = 20787 + Math.floor(Math.random() * 1000);
    const sigtermChild = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        PORT: String(sigtermPort),
        BILLING_PUBLIC_URL: `http://127.0.0.1:${sigtermPort}`,
        BILLING_STORE_FILE: path.join(tmpDir, 'sigterm-store.json'),
        STRIPE_API_BASE: `http://127.0.0.1:${stripePort}`,
        STRIPE_SECRET_KEY: 'sk_test_mock',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      },
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    await until(async () => {
      const r = await fetch(`http://127.0.0.1:${sigtermPort}/health`);
      assert.equal(r.status, 200);
    });
    const exited = new Promise((resolve) => sigtermChild.on('exit', (code, signal) => resolve({ code, signal })));
    sigtermChild.kill('SIGTERM');
    const result = await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 3000)),
    ]);
    assert.notEqual(result, 'timeout', 'SIGTERM must be handled, not ignored until the host force-kills it');
    assert.equal(result.code, 0, 'a graceful shutdown must exit 0, not be force-killed');
  }
  ok('SIGTERM triggers a graceful shutdown instead of being left unhandled');

  // ---- stripe provisioning script ----------------------------------------
  const setupScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'setup-stripe.mjs');
  const envFile = path.join(tmpDir, 'provision.env');
  const runSetup = () => new Promise((resolve) => {
    const proc = spawn(process.execPath, [setupScript], {
      env: {
        ...process.env,
        STRIPE_API_BASE: `http://127.0.0.1:${stripePort}`,
        STRIPE_SECRET_KEY: 'sk_test_mock',
        BILLING_PUBLIC_URL: 'https://billing.example.test',
        BILLING_ENV_FILE: envFile,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { out += d; });
    proc.on('close', (code) => resolve({ code, out }));
  });

  const first = await runSetup();
  assert.equal(first.code, 0, first.out);
  const provisioned = fs.readFileSync(envFile, 'utf8');
  assert.match(provisioned, /STRIPE_PRICE_DBS_PRO=price_mock_\d+/);
  assert.match(provisioned, /STRIPE_PRICE_DBS_TEAM=price_mock_\d+/);
  assert.match(provisioned, /STRIPE_PRICE_GPP_PRO=price_mock_\d+/);
  assert.match(provisioned, /STRIPE_PRICE_GPP_TEAM=price_mock_\d+/);
  assert.match(provisioned, /STRIPE_WEBHOOK_SECRET=whsec_mock_created/);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'dbs_pro')?.unit_amount, 5000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'dbs_team')?.unit_amount, 15000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'gpp_pro')?.unit_amount, 50000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'gpp_team')?.unit_amount, 200000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'hfm_pro')?.unit_amount, 10000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'css_team')?.unit_amount, 500000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'pra_team')?.unit_amount, 250000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'pmr_pro')?.unit_amount, 5000);
  assert.equal(stripeState.prices.find((p) => p.lookup_key === 'mhc_team')?.unit_amount, 5000);
  assert.equal(stripeState.prices.length, 28);
  assert.equal(stripeState.webhooks[0].url, 'https://billing.example.test/v1/stripe/webhook');
  ok('setup-stripe provisions both plugins’ products, per-plugin prices, webhook, and the env file');

  const pricesBefore = stripeState.prices.length;
  const webhooksBefore = stripeState.webhooks.length;
  const second = await runSetup();
  assert.equal(second.code, 0, second.out);
  assert.equal(stripeState.prices.length, pricesBefore);
  assert.equal(stripeState.webhooks.length, webhooksBefore);
  assert.match(second.out, /already correct/);
  ok('re-running setup-stripe creates nothing new');

  // ---- the generated .env is always 0600, even over an existing file -----
  // Regression test: fs.writeFileSync's `mode` option only applies when the
  // file is newly created; on a re-run against an existing .env it silently
  // keeps whatever permissions the file already had.
  fs.chmodSync(envFile, 0o644);
  const third = await runSetup();
  assert.equal(third.code, 0, third.out);
  assert.equal(fs.statSync(envFile).mode & 0o777, 0o600, 'the env file holding a live Stripe secret must be 0600 after every write');
  ok('the generated .env is chmod 0600 unconditionally, not just on first creation');

  // ---- a write that 404s must fail the script, not write "undefined" -----
  // Regression test: the script's own Stripe client treated any 404 —
  // including on a POST/write, not just the existence-check GETs it was
  // meant for — as "not a failure", so a broken or deprecated endpoint let
  // provisioning appear to succeed while writing the literal string
  // "undefined" into .env as a Stripe price id.
  {
    const brokenStripe = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        // Every write 404s; only the product-existence GET is allowed to,
        // and even that path here is irrelevant since we never reach it.
        res.statusCode = 404;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: { message: 'not found' } }));
      });
    });
    await new Promise((resolve) => brokenStripe.listen(0, resolve));
    try {
      const brokenEnvFile = path.join(tmpDir, 'broken-provision.env');
      const proc = spawn(process.execPath, [setupScript], {
        env: {
          ...process.env,
          STRIPE_API_BASE: `http://127.0.0.1:${brokenStripe.address().port}`,
          STRIPE_SECRET_KEY: 'sk_test_mock',
          BILLING_PUBLIC_URL: 'https://billing.example.test',
          BILLING_ENV_FILE: brokenEnvFile,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      proc.stdout.on('data', (d) => { out += d; });
      proc.stderr.on('data', (d) => { out += d; });
      const code = await new Promise((resolve) => proc.on('close', resolve));
      assert.notEqual(code, 0, 'a 404 on a write must fail the script, not exit 0');
      assert.equal(fs.existsSync(brokenEnvFile), false, 'no .env should be written after a failed provisioning run');
    } finally {
      brokenStripe.close();
    }
  }
  ok('a 404 on a Stripe write fails the script instead of writing a broken .env');

  console.log(`\n${passed} billing checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  console.error(serverLog);
  process.exitCode = 1;
} finally {
  child.kill();
  mockStripe.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
