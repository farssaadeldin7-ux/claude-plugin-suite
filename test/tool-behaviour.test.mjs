#!/usr/bin/env node
/**
 * Properties checked against every tool that actually runs.
 *
 * test/tool-properties.test.mjs reads the source and checks each registration
 * declares a description, an inputSchema and a handler. That is registration
 * hygiene, and it is worth having, but it never starts a server and never
 * calls anything — a handler can satisfy it and still hand back a number that
 * became null, a storage sentinel, or the caller's own licence key.
 *
 * This boots all fourteen servers over stdio against a licensed billing
 * service, drives every numeric argument twice — once at an ordinary value,
 * once at 1e308 — and asserts three things no correct handler can break:
 *
 *   overflow  A result field that is a number for the ordinary argument must
 *             not be null for the large one. JSON has no Infinity, so
 *             JSON.stringify writes an overflow as null, and a field that
 *             quietly vanishes inside an otherwise confident answer is worse
 *             than a wrong number.
 *   sentinel  No result may carry -1 as a limit. It is the storage sentinel
 *             for "no ceiling"; rendered by a client it reads as a quota of
 *             minus one.
 *   secrecy   The licence key the server was handed must not come back out in
 *             a tool result.
 *
 * The licensed service is not optional. An earlier version of this probe ran
 * without one, reported zero findings, and had reached zero handlers: every
 * call died at the licence gate. It now exits non-zero if it reaches no
 * handler, or if any call fails for a licensing reason.
 *
 *   node test/tool-behaviour.test.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const { CATALOG } = await import(new URL('../services/billing/catalog.js', import.meta.url));
const { generateKey } = await import(new URL('../services/billing/lib/licenses.js', import.meta.url));

/**
 * The ceiling the runtime applies to a number argument with no declared
 * maximum. Driving at 1e308 stopped being useful the moment that ceiling
 * existed: the call is refused at the gate, both members of the pair never
 * succeed, and the overflow property quietly becomes unfireable. The question
 * worth asking is the one the API still answers — the largest value a caller
 * can actually get through must not overflow the arithmetic behind it.
 */
const DEFAULT_MAXIMUM = 1e12;
const largestAccepted = (spec) => {
  // A declared maximum wins even when it is above the default ceiling — the
  // validator honours it, so it is what a caller can actually send. Clamping
  // to 1e12 here would have quietly stopped probing the real edge of any tool
  // that declares a larger one.
  const declared = typeof spec.maximum === 'number' ? spec.maximum : DEFAULT_MAXIMUM;
  return Number.isFinite(declared) ? declared : DEFAULT_MAXIMUM;
};
const PORT = 19000 + (process.pid % 900);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-behaviour-'));

// ---- a licensed billing service -------------------------------------------

const keys = {};
const licenses = {};
for (const [pluginId, entry] of Object.entries(CATALOG)) {
  const plan = entry.plans.team ?? entry.plans.pro;
  const key = generateKey(entry.code);
  keys[pluginId] = key;
  licenses[key] = {
    key,
    plugin_id: pluginId,
    plan: entry.plans.team ? 'team' : 'pro',
    status: 'active',
    email: 'probe@example.com',
    features: plan.features,
    limits: plan.limits,
    seats: { limit: plan.seats, devices: [] },
    usage: {},
    period_end: null,
    cancel_at_period_end: false,
    stripe: { customer_id: `cus_${entry.code}`, subscription_id: `sub_${entry.code}` },
    checkout_session_id: `cs_${entry.code}`,
    created_at: new Date().toISOString(),
  };
}
const storeFile = path.join(tmp, 'store.json');
fs.writeFileSync(storeFile, JSON.stringify({ version: 1, licenses, events: {} }));

const billing = spawn(process.execPath, [path.join(root, 'services/billing/server.js')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    BILLING_STORE_FILE: storeFile,
    STRIPE_SECRET_KEY: 'sk_test_probe',
    STRIPE_WEBHOOK_SECRET: 'whsec_probe',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
const BILLING_URL = `http://127.0.0.1:${PORT}`;
let up = false;
for (let i = 0; i < 100 && !up; i++) {
  try { up = (await fetch(`${BILLING_URL}/health`)).ok; } catch { /* not yet */ }
  if (!up) await new Promise((r) => setTimeout(r, 100));
}

// ---- speak the protocol ----------------------------------------------------

/** One server, one batch of calls, every reply collected by id. */
const speak = (pluginId, calls) => new Promise((resolve) => {
  const replies = new Map();
  const child = spawn(process.execPath, [path.join(root, 'plugins', pluginId, 'mcp/server.js')], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: {
      ...process.env,
      PLUGIN_SUITE_BILLING_URL: BILLING_URL,
      PLUGIN_SUITE_LICENSE_KEY: keys[pluginId],
      XDG_CONFIG_HOME: path.join(tmp, 'cfg', pluginId),
    },
  });
  child.stdin.on('error', () => { /* the child may exit first */ });
  let buffer = '';
  const finish = () => { child.kill(); resolve(replies); };
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let cut;
    while ((cut = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 1);
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.id === 0) {
        if (!calls.length) return finish();
        for (const [index, call] of calls.entries()) {
          child.stdin.write(`${JSON.stringify({
            jsonrpc: '2.0', id: index + 1, method: 'tools/call',
            params: { name: call.tool, arguments: call.args },
          })}\n`);
        }
      } else if (message.id > 0) {
        replies.set(message.id, message);
        if (replies.size === calls.length) finish();
      }
    }
  });
  child.on('exit', () => resolve(replies));
  setTimeout(finish, 120_000);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} })}\n`);
});

const listTools = (pluginId) => new Promise((resolve) => {
  const child = spawn(process.execPath, [path.join(root, 'plugins', pluginId, 'mcp/server.js')], { stdio: ['pipe', 'pipe', 'ignore'] });
  child.stdin.on('error', () => {});
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let cut;
    while ((cut = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 1);
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.id === 0) child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n`);
      else if (message.id === 1) { child.kill(); resolve(message.result?.tools ?? []); }
    }
  });
  child.on('exit', () => resolve([]));
  setTimeout(() => { child.kill(); resolve([]); }, 60_000);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} })}\n`);
});

/**
 * Every leaf in a result, addressed by path.
 *
 * Strings are captured as well as numbers and nulls, because this runtime
 * does not let an overflow through as null: toolResult stringifies a
 * non-finite number, so `Infinity` arrives as the string "Infinity". A check
 * that only looked for null would have been unfireable here — which is the
 * shape of a test that passes because it examines the wrong thing.
 */
function leaves(text) {
  const found = new Map();
  let parsed;
  try { parsed = JSON.parse(text); } catch { return found; }
  const walk = (value, at) => {
    if (typeof value === 'number' || typeof value === 'string' || value === null) found.set(at, value);
    else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${at}[${i}]`));
    else if (value && typeof value === 'object') {
      for (const [k, sub] of Object.entries(value)) walk(sub, at ? `${at}.${k}` : k);
    }
  };
  walk(parsed, '');
  return found;
}

// The licensing tools are the gate itself; driving them proves nothing about
// a handler and would spend seats on invented device ids.
const GATE = /^(license_activate|license_status|license_release|start_checkout|billing_portal|list_plans)$/;

try {
  assert.ok(up, `the billing service did not come up on ${BILLING_URL}; every call would die at the licence gate`);

  const pluginIds = fs.readdirSync(path.join(root, 'plugins'))
    .filter((id) => fs.existsSync(path.join(root, 'plugins', id, 'mcp/server.js')))
    .sort();
  assert.ok(pluginIds.length > 0, 'no plugin servers found — the layout moved');

  const findings = [];
  let reached = 0;
  let gated = 0;
  let toolsDriven = 0;
  let comparisons = 0;
  let combined = 0;
  let refusedAbsurd = 0;
  const refusals = new Map();

  for (const pluginId of pluginIds) {
    const tools = await listTools(pluginId);
    assert.ok(tools.length > 0, `${pluginId} advertised no tools`);

    const calls = [];
    for (const tool of tools) {
      if (GATE.test(tool.name)) continue;
      const properties = Object.entries(tool.inputSchema?.properties ?? {});
      const required = tool.inputSchema?.required ?? [];
      const base = {};
      for (const name of required) {
        const spec = tool.inputSchema.properties?.[name] ?? {};
        base[name] = spec.enum ? spec.enum[0]
          : spec.type === 'number' || spec.type === 'integer' ? 1
          : spec.type === 'boolean' ? true
          : spec.type === 'array' ? [{}]
          : spec.type === 'object' ? {} : 'x';
      }
      let drivenHere = false;
      for (const [name, spec] of properties) {
        if (spec.type !== 'number' && spec.type !== 'integer') continue;
        drivenHere = true;
        calls.push({ tool: tool.name, arg: name, kind: 'ordinary', args: { ...base, [name]: spec.type === 'integer' ? 3 : 2.5 } });
        calls.push({ tool: tool.name, arg: name, kind: 'extreme', args: { ...base, [name]: largestAccepted(spec) } });
        // And a value no real caller means. This must be refused, not
        // answered: it is the only property that holds the ceiling itself
        // down. Driving only at the accepted maximum went quiet the moment
        // the ceiling existed — remove the ceiling and the probe passed,
        // because 1e12 does not overflow anything here.
        calls.push({ tool: tool.name, arg: name, kind: 'absurd', args: { ...base, [name]: 1e308 } });
      }
      if (!properties.length) calls.push({ tool: tool.name, arg: '(none)', kind: 'ordinary', args: {} });
      if (drivenHere) {
        toolsDriven += 1;
        // Every numeric argument at its ceiling at once. Driving one at a time
        // leaves the others small, so a product of two arguments never gets
        // near the edge — and a per-argument ceiling of 1e12 does nothing to
        // stop 1e12 x 1e12. This is the combination a caller can actually
        // send, so it is the one that has to hold.
        const all = { ...base };
        for (const [name, spec] of properties) {
          if (spec.type === 'number' || spec.type === 'integer') all[name] = largestAccepted(spec);
        }
        calls.push({ tool: tool.name, arg: 'every numeric argument', kind: 'together', args: all });
        const modest = { ...base };
        for (const [name, spec] of properties) {
          if (spec.type === 'number' || spec.type === 'integer') modest[name] = spec.type === 'integer' ? 3 : 2.5;
        }
        calls.push({ tool: tool.name, arg: 'every numeric argument', kind: 'together-ordinary', args: modest });
      }
    }

    const replies = await speak(pluginId, calls);
    const shapes = new Map();
    for (const [id, message] of replies) {
      const call = calls[id - 1];
      const text = message.result?.content?.[0]?.text ?? '';
      if (message.result?.isError) {
        let code = 'unparsed';
        try { code = JSON.parse(text).error ?? 'unnamed'; } catch { /* not JSON */ }
        if (/licen[cs]e|seat|quota|entitle|billing|payment/i.test(code)) gated += 1;
        if (call.kind === 'absurd') refusedAbsurd += 1;
        // A refusal and a crash arrive by the same door. mcp-lite reports a
        // handler that throws in-band, and an exception with no `code` of its
        // own becomes `tool_error` — indistinguishable, to a probe that just
        // skips every isError, from a tool deliberately saying no. A Node
        // system error keeps its own code (ENOENT, EACCES), which reads like a
        // designed refusal and is not one.
        if (code === 'tool_error' || code === 'unparsed' || code === 'unnamed' || /^E[A-Z]{2,}$/.test(code)) {
          let detail = text;
          try { detail = JSON.parse(text).message ?? text; } catch { /* keep the raw text */ }
          findings.push(
            `crash     ${pluginId}/${call.tool} [${call.arg}, ${call.kind}] → ${code}: ${String(detail).slice(0, 120)}`
          );
        }
        refusals.set(code, (refusals.get(code) ?? 0) + 1);
        continue;
      }
      if (call.kind === 'absurd') {
        findings.push(
          `unbounded ${pluginId}/${call.tool} [${call.arg}=1e308] → answered instead of refused; `
          + 'a number argument with no declared maximum has no ceiling'
        );
        continue;
      }
      reached += 1;
      shapes.set(`${call.tool}|${call.arg}|${call.kind}`, leaves(text));

      for (const [at, value] of leaves(text)) {
        if (value === -1 && /limit|quota|ceiling|max/i.test(at)) {
          findings.push(`sentinel  ${pluginId}/${call.tool} → ${at} is -1, the "no ceiling" storage sentinel`);
        }
      }
      if (text.includes(keys[pluginId])) {
        findings.push(`secrecy   ${pluginId}/${call.tool} → the licence key came back in the result`);
      }
    }

    for (const call of calls) {
      if (call.kind !== 'extreme' && call.kind !== 'together') continue;
      const pairedWith = call.kind === 'extreme' ? 'ordinary' : 'together-ordinary';
      const extreme = shapes.get(`${call.tool}|${call.arg}|${call.kind}`);
      const ordinary = shapes.get(`${call.tool}|${call.arg}|${pairedWith}`);
      if (!extreme || !ordinary) continue;
      comparisons += 1;
      if (call.kind === 'together') combined += 1;
      for (const [at, value] of extreme) {
        const before = ordinary.get(at);
        if (typeof before !== 'number') continue;
        const overflowed = value === null
          || (typeof value === 'string' && /^-?(Infinity|NaN)$/.test(value));
        if (overflowed) {
          findings.push(
            `overflow  ${pluginId}/${call.tool} [${call.arg} at the accepted maximum] → ${at} was the number ${before}, `
            + `came back ${value === null ? 'null' : JSON.stringify(value)}`
          );
          break;
        }
      }
    }
  }

  // A probe that reaches nothing looks exactly like a probe that finds nothing.
  assert.equal(gated, 0, `${gated} call(s) died at the licence gate — the probe was measuring the gate, not the handlers`);
  assert.ok(reached > 0, 'the probe reached 0 handlers and therefore proved nothing');
  assert.ok(toolsDriven > 0, 'no tool took a numeric argument, so the overflow property was never exercised');
  // A pair where either half was refused is silently skipped, so counting the
  // comparisons is the only way to tell "nothing overflowed" from "nothing was
  // compared". The second is what an earlier version of this probe reported.
  assert.ok(comparisons > 0, 'no ordinary/maximum pair both succeeded — the overflow property compared nothing');
  assert.ok(combined > 0, 'no all-arguments-at-once pair both succeeded — the combination was never actually tested');
  assert.ok(refusedAbsurd > 0, 'no argument was driven to 1e308, so nothing checked that a ceiling exists at all');
  console.log(`  ${comparisons} ordinary/maximum pairs compared, ${combined} of them with every numeric argument at once`);
  console.log(`  ${refusedAbsurd} arguments refused at 1e308`);
  console.log(`  ${[...refusals.values()].reduce((a, b) => a + b, 0)} refusals, all of them named: `
    + `${[...refusals.keys()].sort().join(', ')}`);

  assert.deepEqual(findings, [], `\n${findings.join('\n')}\n`);
  ok(`${reached} handler calls across ${pluginIds.length} servers: no overflow to null, no -1 sentinel, no licence key in a result`);

  console.log(`\n${passed} tool-behaviour checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  billing.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
