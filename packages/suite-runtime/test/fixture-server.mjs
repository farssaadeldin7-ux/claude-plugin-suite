#!/usr/bin/env node
/**
 * A minimal MCP server used only by mcp-lite.test.mjs. Not shipped in any
 * plugin — its tools exist purely to exercise mcp-lite.js's own behaviour
 * (schema enforcement, malformed-handler-return handling) independent of
 * any real plugin's business logic.
 */
import { McpServer, ToolError } from '../mcp-lite.js';

const server = new McpServer({ name: 'fixture', version: '0.0.0' });

server.tool('echo', {
  description: 'Echoes a required, pattern-constrained string.',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string', pattern: '^[a-z]+$', minLength: 1, maxLength: 10 } },
    required: ['text'],
  },
  handler: async ({ text }) => ({ text }),
});

server.tool('bounded_number', {
  description: 'Takes a number with a declared range.',
  inputSchema: {
    type: 'object',
    properties: { n: { type: 'number', minimum: 0, maximum: 10 } },
    required: ['n'],
  },
  handler: async ({ n }) => ({ n }),
});

server.tool('overflows', {
  description: 'A handler whose result carries Infinity and NaN — simulates a runaway computation.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({ overflowed: 1e308 * 10, undefined_ratio: 0 / 0, fine: 42 }),
});

server.tool('forgets_to_return', {
  description: 'A handler that never returns anything — simulates a bug.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => { /* deliberately no return */ },
});

server.tool('throws', {
  description: 'A handler that throws a ToolError.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => { throw new ToolError('boom', 'it exploded'); },
});

server.start();
