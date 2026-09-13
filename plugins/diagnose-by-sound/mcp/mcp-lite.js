/**
 * A minimal MCP server over stdio, with no npm dependencies.
 *
 * Plugins are distributed as .plugin archives and installed without an npm
 * install step, so a server that needed node_modules would simply fail to
 * start on the user's machine. This implements the slice of the protocol a
 * tool server actually needs: initialize, tools/list, tools/call, ping.
 *
 * Transport is newline-delimited JSON-RPC 2.0 on stdin/stdout. Nothing may be
 * written to stdout except protocol messages — use logDiagnostic() for
 * anything human-facing, which goes to stderr.
 */

const PROTOCOL_VERSION = '2024-11-05';
// A single JSON-RPC line with no newline yet buffers indefinitely; without a
// cap, a host that never sends one (a bug on its end, or a hostile one) grows
// this without bound until the process runs out of memory. Generous enough
// for any real tool call.
const MAX_BUFFERED_BYTES = 10 * 1024 * 1024;

export function logDiagnostic(...args) {
  console.error('[mcp]', ...args);
}

export class McpServer {
  constructor({ name, version, instructions }) {
    this.info = { name, version };
    this.instructions = instructions;
    this.tools = new Map();
    this.buffer = '';
    this.skippingOversizedLine = false;
    this.pending = 0;
    this.stdinEnded = false;
  }

  /**
   * @param {string} name
   * @param {{description: string, inputSchema: object, handler: Function}} spec
   */
  tool(name, spec) {
    if (!spec?.handler) throw new Error(`Tool "${name}" has no handler`);
    this.tools.set(name, {
      name,
      description: spec.description,
      inputSchema: spec.inputSchema || { type: 'object', properties: {} },
      handler: spec.handler,
    });
    return this;
  }

  start() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => this.#onData(chunk));
    process.stdin.on('error', (err) => logDiagnostic('stdin error:', err.message));
    // A closed stdin means the host is gone; exit rather than linger — but
    // only once every in-flight request has been answered, or a piped batch
    // of calls loses whichever responses were still awaiting slow handlers.
    process.stdin.on('end', () => {
      this.stdinEnded = true;
      this.#maybeExit();
    });
    process.on('uncaughtException', (err) => {
      logDiagnostic('uncaught:', err?.stack || err);
    });
    logDiagnostic(`${this.info.name} v${this.info.version} ready`);
  }

  #onData(chunk) {
    if (this.skippingOversizedLine) {
      // Still discarding the tail of a line that already blew past the
      // cap — an oversized write typically arrives across many chunks, and
      // resetting only once (on the chunk that crossed the threshold)
      // would leave the remaining chunks of that same line to quietly
      // resume normal accumulation. That tail would then still be sitting
      // in the buffer, unterminated, ready to concatenate onto whatever
      // the next real message happens to be and corrupt it. Stay in this
      // mode until the newline that actually ends the bad line shows up.
      const newlineAt = chunk.indexOf('\n');
      if (newlineAt === -1) return;
      this.skippingOversizedLine = false;
      chunk = chunk.slice(newlineAt + 1);
    }
    this.buffer += chunk;
    if (this.buffer.length > MAX_BUFFERED_BYTES) {
      // No complete line has arrived in MAX_BUFFERED_BYTES of input — this
      // is not a message we can ever finish parsing. Say so once and
      // discard it (and whatever remains of it), rather than growing this
      // string without bound until the process is killed for memory use
      // with no diagnostic at all.
      logDiagnostic(`dropped ${this.buffer.length} buffered bytes with no newline (limit ${MAX_BUFFERED_BYTES})`);
      this.buffer = '';
      this.skippingOversizedLine = true;
      return;
    }
    let index;
    while ((index = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (line) this.#handleLine(line);
    }
  }

  async #handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return this.#send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }

    // Notifications carry no id and must never be answered.
    if (message.id === undefined || message.id === null) {
      return;
    }

    if (message.jsonrpc !== '2.0') {
      return this.#send({ jsonrpc: '2.0', id: message.id, error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' } });
    }

    this.pending++;
    try {
      const result = await this.#dispatch(message);
      this.#send({ jsonrpc: '2.0', id: message.id, result });
    } catch (err) {
      this.#send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: err.code ?? -32603, message: err.message || 'Internal error' },
      });
    } finally {
      this.pending--;
      this.#maybeExit();
    }
  }

  #maybeExit() {
    if (!this.stdinEnded || this.pending !== 0) return;
    // Not process.exit(0): on a pipe (the normal stdio transport, and
    // especially on Windows), a stdout write can still be in flight when
    // this runs, and process.exit() does not wait for it — the last
    // response of the session, the one most likely to matter, is exactly
    // what could get truncated. Setting exitCode and letting the event
    // loop drain naturally means Node only exits once that write has
    // actually finished.
    process.exitCode = 0;
  }

  async #dispatch(message) {
    switch (message.method) {
      case 'initialize':
        return {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: this.info,
          ...(this.instructions ? { instructions: this.instructions } : {}),
        };

      case 'ping':
        return {};

      case 'tools/list':
        return {
          tools: [...this.tools.values()].map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        };

      case 'tools/call': {
        const tool = this.tools.get(message.params?.name);
        if (!tool) {
          const err = new Error(`Unknown tool: ${message.params?.name}`);
          err.code = -32602;
          throw err;
        }
        const args = message.params.arguments ?? {};
        // The schema is published in tools/list as a promise to the caller
        // about what a valid call looks like; a caller — or a model —
        // constructing arguments from that promise deserves an error that
        // says which part of it was broken, not whatever a handler happens
        // to do with the wrong shape of input.
        const schemaErrors = validateAgainstSchema(tool.inputSchema, args);
        if (schemaErrors.length > 0) {
          return toolResult(
            { error: 'invalid_arguments', message: `Arguments did not match the tool's schema: ${schemaErrors.join('; ')}` },
            { isError: true }
          );
        }
        try {
          const output = await tool.handler(args);
          return toolResult(output);
        } catch (err) {
          // Tool failures are reported in-band so the model can react to them,
          // rather than as protocol errors that abort the call.
          return toolResult(
            { error: err.code || 'tool_error', message: err.message, ...(err.detail ? { detail: err.detail } : {}) },
            { isError: true }
          );
        }
      }

      default: {
        const err = new Error(`Method not found: ${message.method}`);
        err.code = -32601;
        throw err;
      }
    }
  }

  #send(payload) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }
}

/** Normalise a handler return value into MCP content. */
export function toolResult(output, { isError = false } = {}) {
  // A handler that forgets its own `return` yields undefined here.
  // JSON.stringify(undefined) is itself undefined (not the string
  // "undefined"), so text: undefined would silently vanish from the
  // outgoing JSON — the caller gets a content block with no text field at
  // all, and no indication that anything went wrong. Treat it as the
  // handler bug it almost certainly is, visibly, rather than a quiet gap.
  if (output === undefined) {
    return { content: [{ type: 'text', text: 'Tool handler returned no value.' }], isError: true };
  }
  if (typeof output === 'string') {
    return { content: [{ type: 'text', text: output }], isError };
  }
  try {
    // JSON has no representation for Infinity or NaN — JSON.stringify
    // silently turns either into null, so a computation that overflowed or
    // divided by zero would reach the caller as an ordinary-looking missing
    // field inside an otherwise confident result, with nothing marking it
    // as the overflow it actually was. The replacer swaps them for a
    // visible, self-explaining string instead of losing them to null.
    const replacer = (_key, value) => (
      typeof value === 'number' && !Number.isFinite(value) ? String(value) : value
    );
    return { content: [{ type: 'text', text: JSON.stringify(output, replacer, 2) }], isError };
  } catch (err) {
    // A circular reference or a BigInt, say. The call site already catches
    // this, but toolResult should be safe on its own regardless of where
    // it's called from — nothing about its contract should depend on that.
    return { content: [{ type: 'text', text: `Tool result could not be serialised: ${err.message}` }], isError: true };
  }
}

/** Throw from a tool handler to return a structured, actionable failure. */
export class ToolError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.code = code;
    this.detail = detail ?? null;
  }
}

// ---- inputSchema enforcement ------------------------------------------------
//
// Supports exactly the JSON Schema subset the suite's own tool declarations
// use: object/string/number/integer/boolean/array, required, pattern,
// minLength/maxLength, minimum/maximum, enum, and items for arrays. Not a
// general-purpose validator — enough that a schema published in tools/list
// is actually enforced, not just documentation the server itself ignores.

function jsonTypeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'string' | 'number' | 'boolean' | 'object' | 'undefined'
}

function validateNode(schema, value, path, errors) {
  if (!schema || typeof schema !== 'object') return;

  if (schema.type) {
    const actual = jsonTypeOf(value);
    const matches = schema.type === actual ||
      (schema.type === 'number' && actual === 'number') ||
      (schema.type === 'integer' && actual === 'number' && Number.isInteger(value));
    if (!matches) {
      errors.push(`${path || 'value'}: expected ${schema.type}, got ${actual}`);
      return; // Further constraints on the wrong type would only confuse.
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    }
    if (typeof schema.pattern === 'string') {
      let pattern;
      try {
        pattern = new RegExp(schema.pattern);
      } catch {
        errors.push(`${path}: invalid pattern ${schema.pattern}`);
      }
      if (pattern && !pattern.test(value)) {
        errors.push(`${path}: does not match pattern ${schema.pattern}`);
      }
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${path}: must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`);
  }

  if (jsonTypeOf(value) === 'object' && schema.properties) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`missing required property "${key}"`);
    }
    // Object.hasOwn, not schema.properties[key]: a property named
    // "constructor" or "__proto__" must never resolve an inherited member
    // of the schema object itself and be treated as "no constraint".
    for (const key of Object.keys(value)) {
      if (Object.hasOwn(schema.properties, key)) {
        validateNode(schema.properties[key], value[key], path ? `${path}.${key}` : key, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`unexpected property "${key}"`);
      }
    }
  }

  if (jsonTypeOf(value) === 'array' && schema.items) {
    value.forEach((item, i) => validateNode(schema.items, item, `${path}[${i}]`, errors));
  }
}

/** Returns a list of human-readable errors; empty means the value is valid. */
export function validateAgainstSchema(schema, value) {
  const errors = [];
  validateNode(schema, value, '', errors);
  return errors;
}
