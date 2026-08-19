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

export function logDiagnostic(...args) {
  console.error('[mcp]', ...args);
}

export class McpServer {
  constructor({ name, version, instructions }) {
    this.info = { name, version };
    this.instructions = instructions;
    this.tools = new Map();
    this.buffer = '';
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
    // A closed stdin means the host is gone; exit rather than linger.
    process.stdin.on('end', () => process.exit(0));
    process.on('uncaughtException', (err) => {
      logDiagnostic('uncaught:', err?.stack || err);
    });
    logDiagnostic(`${this.info.name} v${this.info.version} ready`);
  }

  #onData(chunk) {
    this.buffer += chunk;
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

    try {
      const result = await this.#dispatch(message);
      this.#send({ jsonrpc: '2.0', id: message.id, result });
    } catch (err) {
      this.#send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: err.code ?? -32603, message: err.message || 'Internal error' },
      });
    }
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
        try {
          const output = await tool.handler(message.params.arguments ?? {});
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
  const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
  return { content: [{ type: 'text', text }], isError };
}

/** Throw from a tool handler to return a structured, actionable failure. */
export class ToolError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.code = code;
    this.detail = detail ?? null;
  }
}
