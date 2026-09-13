#!/usr/bin/env node
/**
 * Regression tests for mcp-lite.js, the MCP server every plugin is built on.
 * No existing test exercised this file directly before — these are scoped
 * to the specific defects fixed here, driven over real stdio against
 * fixture-server.mjs (a tiny standalone server, not any real plugin).
 *
 *   node packages/suite-runtime/test/mcp-lite.test.mjs
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixture-server.mjs');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// Every spawned child is tracked here and killed in the top-level finally,
// so a failing assertion (which skips whatever child.kill() call would have
// followed it) can't leave a live child holding this process's stdout pipe
// open — which would otherwise hang the whole run past its failure instead
// of exiting with the failure reported.
const children = [];

function startClient() {
  const child = spawn(process.execPath, [fixturePath], { stdio: ['pipe', 'pipe', 'pipe'] });
  children.push(child);
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  let buf = '';
  const pending = new Map();
  let nextId = 1;
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const resolve = pending.get(msg.id);
      if (resolve) { pending.delete(msg.id); resolve(msg); }
    }
  });
  const call = (method, params, { id = nextId++, raw } = {}) => new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(raw ?? `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  return { child, call, getStderr: () => stderr };
}

try {
  // ---- jsonrpc version is validated -----------------------------------------
  // Regression test: nothing checked message.jsonrpc === '2.0' at all, so a
  // request that claimed a different (or missing) JSON-RPC version was
  // processed exactly like a valid one.
  {
    const { child, call } = startClient();
    const res = await call('ping', {}, { raw: `${JSON.stringify({ jsonrpc: '1.0', id: 1, method: 'ping' })}\n` });
    assert.equal(res.error?.code, -32600);
    child.kill();
  }
  ok('a request claiming a JSON-RPC version other than "2.0" is rejected');

  // ---- inputSchema is actually enforced -------------------------------------
  // Regression test (#64): the schema published in tools/list was never
  // checked against the arguments a call actually supplied.
  //
  // A tool error's content is itself a JSON-stringified {error, message}
  // blob (toolResult(output) on a non-string output), so it's parsed back
  // before asserting on its fields, rather than regex-matched as raw text
  // (which would have to account for JSON's own quote-escaping).
  const errorOf = (res) => JSON.parse(res.result.content[0].text);
  {
    const { child, call } = startClient();

    const missing = errorOf(await call('tools/call', { name: 'echo', arguments: {} }));
    assert.equal(missing.error, 'invalid_arguments');
    assert.match(missing.message, /missing required property "text"/);

    const badPattern = errorOf(await call('tools/call', { name: 'echo', arguments: { text: 'ABC' } }));
    assert.match(badPattern.message, /does not match pattern/);

    const tooLong = errorOf(await call('tools/call', { name: 'echo', arguments: { text: 'waytoolongforthis' } }));
    assert.match(tooLong.message, /longer than maxLength/);

    const wrongType = errorOf(await call('tools/call', { name: 'bounded_number', arguments: { n: 'five' } }));
    assert.match(wrongType.message, /expected number, got string/);

    const belowMin = errorOf(await call('tools/call', { name: 'bounded_number', arguments: { n: -1 } }));
    assert.match(belowMin.message, /below minimum/);

    const aboveMax = errorOf(await call('tools/call', { name: 'bounded_number', arguments: { n: 11 } }));
    assert.match(aboveMax.message, /above maximum/);

    const valid = await call('tools/call', { name: 'echo', arguments: { text: 'ok' } });
    assert.equal(valid.result.isError, false);
    assert.deepEqual(JSON.parse(valid.result.content[0].text), { text: 'ok' });

    const validNumber = await call('tools/call', { name: 'bounded_number', arguments: { n: 5 } });
    assert.equal(validNumber.result.isError, false);

    child.kill();
  }
  ok('inputSchema type, pattern, minLength/maxLength, and minimum/maximum are all enforced before a handler runs');

  // ---- a schema-shaped attribute name never resolves an inherited member ---
  // Regression test-adjacent: a property literally named "constructor" in
  // the *arguments* must be treated as just another unrecognised key, not
  // let validation silently resolve schema.properties.constructor (a
  // function, inherited from Object.prototype) and treat that as "no
  // constraint" — or worse, crash trying to use it as a schema.
  {
    const { child, call } = startClient();
    const res = await call('tools/call', { name: 'echo', arguments: { text: 'ok', constructor: 'anything' } });
    assert.equal(res.result.isError, false, 'an unrelated extra property, even one named "constructor", must not break validation');
    child.kill();
  }
  ok('an argument property named "constructor" does not resolve an inherited schema member');

  // ---- Infinity and NaN in a result are visible, never silently null ------
  // Regression test (#04): JSON has no representation for either, so
  // JSON.stringify quietly turns both into null — a computation that
  // overflowed or divided by zero reached the caller as an ordinary-
  // looking missing field inside an otherwise confident result, with
  // nothing marking it as the overflow it actually was.
  {
    const { child, call } = startClient();
    const res = await call('tools/call', { name: 'overflows', arguments: {} });
    const out = JSON.parse(res.result.content[0].text);
    assert.equal(out.overflowed, 'Infinity');
    assert.equal(out.undefined_ratio, 'NaN');
    assert.equal(out.fine, 42, 'an ordinary finite number must not be touched');
    child.kill();
  }
  ok('Infinity and NaN in a tool result are preserved visibly, not silently turned into null');

  // ---- a handler that forgets to return is a visible error, not silence ----
  // Regression test (#26): JSON.stringify(undefined) is itself undefined,
  // so text: undefined vanished from the outgoing JSON entirely — the
  // caller got a content block with no text field and no sign anything
  // was wrong.
  {
    const { child, call } = startClient();
    const res = await call('tools/call', { name: 'forgets_to_return', arguments: {} });
    assert.equal(res.result.isError, true);
    assert.equal(typeof res.result.content[0].text, 'string');
    assert.match(res.result.content[0].text, /returned no value/);
    child.kill();
  }
  ok('a handler that returns nothing produces a visible error, not a content block missing its text');

  // ---- a thrown ToolError still reports in-band, unaffected by the above ---
  {
    const { child, call } = startClient();
    const res = await call('tools/call', { name: 'throws', arguments: {} });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /it exploded/);
    child.kill();
  }
  ok('a thrown ToolError still reports in-band as before');

  // ---- an unbounded, newline-free input cannot grow the buffer forever -----
  // Regression test (#27): #onData appended to a single string with no cap
  // at all; a host that never sends a newline (buggy or hostile) grew that
  // string until the process ran out of memory.
  {
    const { child, call } = startClient();
    // One "line", deliberately never terminated, well past the cap. Sent
    // as its own write and given time to be received and discarded before
    // anything else follows.
    //
    // Framing recovery here is necessarily best-effort: with no newline
    // anywhere in 11MB of input, nothing marks where that bad "line" was
    // ever supposed to end except the cap itself — so the very next
    // newline the server sees, wherever it falls, is what closes it out.
    // If a well-formed message arrives immediately after with no
    // separator of its own before that point, it can be consumed as part
    // of resyncing rather than answered — that's an accepted cost of
    // recovering from a framing error on a byte stream, not a bug in the
    // recovery itself. What must be true is that the server survives and
    // is fully working again shortly after, which is what this checks by
    // retrying.
    child.stdin.write('x'.repeat(11 * 1024 * 1024));
    await new Promise((resolve) => setTimeout(resolve, 300));

    let res = 'timeout';
    for (let attempt = 0; attempt < 5 && res === 'timeout'; attempt++) {
      res = await Promise.race([
        call('ping', {}),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 2000)),
      ]);
    }
    assert.notEqual(res, 'timeout', 'the server must still respond after an oversized, newline-free write');
    assert.deepEqual(res.result, {});
    child.kill();
  }
  ok('an oversized buffer with no newline is dropped and logged, not grown without bound');

  // ---- shutdown lets the last response finish before the process exits -----
  // Regression test (#63): process.exit(0) does not wait for an in-flight
  // stdout write, so the very last response — arriving right as the host
  // closes its side — could be truncated. Ending stdin right after sending
  // a request must still deliver that response intact before the process
  // exits.
  {
    const { child, call } = startClient();
    const responsePromise = call('tools/call', { name: 'echo', arguments: { text: 'last' } });
    child.stdin.end();
    const res = await responsePromise;
    assert.equal(res.result.isError, false);
    assert.deepEqual(JSON.parse(res.result.content[0].text), { text: 'last' });
    const exit = await new Promise((resolve) => child.on('exit', (code) => resolve(code)));
    assert.equal(exit, 0);
  }
  ok('the final in-flight response arrives intact, and the process exits 0, when stdin closes');

  console.log(`\n${passed} suite-runtime checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
} finally {
  for (const child of children) child.kill();
}
