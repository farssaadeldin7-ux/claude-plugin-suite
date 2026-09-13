#!/usr/bin/env node
/**
 * Regression tests for license-client.js against a minimal mock billing
 * service — no existing test exercised this file directly before. Scoped
 * to the specific defects fixed here.
 *
 *   node packages/suite-runtime/test/license-client.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { LicenseClient, registerLicenseTools } from '../license-client.js';

// LicenseClient stores its config under configDir(), which defaults to the
// real ~/.config — set XDG_CONFIG_HOME to an isolated temp directory before
// any client is constructed, or a saved licence key from one test (or one
// run of this file) leaks into the "no key configured" case of the next.
const tmpConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'license-client-test-'));
process.env.XDG_CONFIG_HOME = tmpConfigHome;

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// A fake mcp-lite server object: just enough of the .tool(name, spec) API
// for registerLicenseTools to register against, with handlers callable
// directly — no stdio transport needed for these tests.
function fakeServer() {
  const tools = new Map();
  return {
    tool(name, spec) { tools.set(name, spec); return this; },
    call(name, args = {}) { return tools.get(name).handler(args); },
  };
}

// ---- mock billing service, behaviour driven per test -----------------------
let mockBehavior = () => ({ status: 200, body: {} });
const mockBilling = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const { status, body: responseBody } = mockBehavior(req, body);
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(responseBody));
  });
});
await new Promise((resolve) => mockBilling.listen(0, resolve));
const mockPort = mockBilling.address().port;

function makeClient({ billingUrl = `http://127.0.0.1:${mockPort}`, licenseKey } = {}) {
  const client = new LicenseClient({ pluginId: 'test-plugin', defaultBillingUrl: billingUrl });
  if (licenseKey) client.saveLicenseKey(licenseKey);
  return client;
}

try {
  // ---- a status check with no key is exactly "missing_license" -----------
  {
    const client = makeClient();
    const server = fakeServer();
    registerLicenseTools(server, client, { pluginName: 'Test Plugin' });
    const status = await server.call('license_status');
    assert.equal(status.reason, 'missing_license');
    assert.match(status.explanation, /No licence key is set up/);
  }
  ok('license_status with no key reports missing_license');

  // ---- an outage must never look like "no key was ever set up" -----------
  // Regression test (#52): the degraded-entitlement branch hardcoded
  // { reason: 'missing_license' } for its explanation regardless of what
  // actually failed, so a paying customer whose billing check merely
  // couldn't complete was told their key was never configured at all.
  {
    const client = makeClient({ billingUrl: 'http://127.0.0.1:1', licenseKey: 'PS-TST-AAAAA-BBBBB-CCCCC-DDDD' });
    const server = fakeServer();
    registerLicenseTools(server, client, { pluginName: 'Test Plugin' });
    const status = await server.call('license_status');
    assert.equal(status.reason, 'billing_unreachable');
    assert.doesNotMatch(status.explanation, /No licence key is set up/);
    assert.match(status.explanation, /could not be reached/);
  }
  ok('an unreachable billing service reports billing_unreachable, never a fabricated missing_license');

  // ---- a build that was never pointed at a real host says so plainly -----
  // Regression test (#53): the placeholder URL every plugin ships with
  // (until baked or overridden) produced an ordinary-looking network
  // failure, indistinguishable from a transient outage.
  {
    const client = makeClient({ billingUrl: 'https://billing.example.com', licenseKey: 'PS-TST-AAAAA-BBBBB-CCCCC-DDDD' });
    const server = fakeServer();
    registerLicenseTools(server, client, { pluginName: 'Test Plugin' });
    const status = await server.call('license_status');
    assert.equal(status.reason, 'billing_not_configured');
    assert.match(status.explanation, /never pointed at a real billing service/);
  }
  ok('a build left at the placeholder billing URL reports billing_not_configured, not a generic network error');

  // ---- an error-shaped response is never treated as a real entitlement ---
  // Regression test (#49): a 429 or 5xx still carries a JSON body; treating
  // that body as the entitlement itself (active/free/features all
  // undefined) read as "not entitled" to every caller downstream — telling
  // a paying customer their licence had failed because the service
  // hiccuped.
  {
    mockBehavior = () => ({ status: 500, body: { error: 'internal_error', message: 'db unavailable' } });
    const client = makeClient({ licenseKey: 'PS-TST-AAAAA-BBBBB-CCCCC-DDDD' });
    const entitlement = await client.entitlement({ force: true });
    assert.equal(entitlement.degraded, true, 'a 5xx must degrade, not be read as a real (and falsely inactive) entitlement');
    assert.notEqual(entitlement.reason, undefined);
  }
  ok('a 5xx from the billing service degrades to the free tier instead of being read as a real entitlement');

  // ---- only error codes this codebase's own server actually writes are ---
  // ---- ever forwarded as-is -----------------------------------------------
  // Regression test (#24): activate()/startCheckout()/billingPortal() put
  // whatever code and message a response carried straight into the
  // ToolError a caller branches and displays on — including anything from
  // a proxy's own error page or a future server bug, not only this
  // codebase's own known error shapes.
  {
    mockBehavior = () => ({
      status: 400,
      body: { error: 'a_code_this_server_never_defined', message: 'some upstream text naming an internal host' },
    });
    const client = makeClient();
    await assert.rejects(
      () => client.activate('PS-TST-AAAAA-BBBBB-CCCCC-DDDD'),
      (err) => {
        assert.equal(err.code, 'activation_failed', 'an unrecognised code must fall back, not pass through');
        assert.notEqual(err.message, 'some upstream text naming an internal host');
        return true;
      }
    );
  }
  ok('an error code/message this server never writes is not forwarded — a safe fallback is used instead');

  // ---- a recognised server error code and message ARE preserved ----------
  {
    mockBehavior = () => ({ status: 404, body: { error: 'unknown_license', message: 'No licence matches this key.' } });
    const client = makeClient();
    await assert.rejects(
      () => client.activate('PS-TST-AAAAA-BBBBB-CCCCC-DDDD'),
      (err) => {
        assert.equal(err.code, 'unknown_license');
        assert.equal(err.message, 'No licence matches this key.');
        return true;
      }
    );
  }
  ok('a genuine, known server error code and message pass through unchanged');

  // ---- recordUsage accepts a caller-supplied idempotency key -------------
  // Regression test (#23): idempotency_key was minted fresh inside
  // recordUsage on every call, including a caller's own retry of the same
  // logical usage event, so the server's deduplication could never match a
  // retry against the original attempt.
  {
    const seenKeys = [];
    mockBehavior = (req, rawBody) => {
      seenKeys.push(JSON.parse(rawBody).idempotency_key);
      return { status: 200, body: { recorded: true, used: 1 } };
    };
    const client = makeClient({ licenseKey: 'PS-TST-AAAAA-BBBBB-CCCCC-DDDD' });
    await client.recordUsage('some_meter', 1, 'caller-chosen-key');
    await client.recordUsage('some_meter', 1, 'caller-chosen-key');
    assert.deepEqual(seenKeys, ['caller-chosen-key', 'caller-chosen-key'], 'a caller-supplied key must reach the server unchanged on every retry');
  }
  ok('recordUsage sends a caller-supplied idempotency key unchanged, so a retry can actually be deduplicated');

  // ---- the config directory is tightened even if it already existed ------
  // Regression test (#68): mkdirSync's `mode` option is only honoured for a
  // directory it actually creates — recursive:true on an already-existing
  // directory silently succeeds without touching its permissions, so the
  // licence config could sit in a world-readable folder indefinitely.
  {
    const configDir = path.join(tmpConfigHome, 'plugin-suite');
    fs.mkdirSync(configDir, { recursive: true });
    fs.chmodSync(configDir, 0o755);
    assert.equal(fs.statSync(configDir).mode & 0o777, 0o755, 'test setup: directory must start loose');
    const client = makeClient();
    client.saveLicenseKey('PS-TST-AAAAA-BBBBB-CCCCC-DDDD');
    assert.equal(fs.statSync(configDir).mode & 0o777, 0o700, 'the config directory must be tightened even though it already existed');
  }
  ok('the config directory is chmod 0700 even when it already existed with looser permissions');

  console.log(`\n${passed} license-client checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  mockBilling.close();
  fs.rmSync(tmpConfigHome, { recursive: true, force: true });
}
