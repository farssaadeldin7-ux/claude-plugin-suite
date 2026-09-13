#!/usr/bin/env node
/**
 * Invariant test for direct tool registrations in plugin MCP servers.
 *
 *   node test/tool-properties.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

function collectToolBlocks(relPath) {
  const lines = fs.readFileSync(path.join(root, relPath), 'utf8').split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = line.match(/^(\s*)server\.tool\(\s*'([^']+)'/);
    if (start) {
      assert.equal(current, null, `${relPath}:${i + 1} starts a new tool block before the previous one ended`);
      current = {
        indent: start[1],
        name: start[2],
        line: i + 1,
        lines: [line],
      };
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
    if (line === `${current.indent}});`) {
      blocks.push(current);
      current = null;
    }
  }

  assert.equal(current, null, `${relPath}:${current?.line} has an unterminated tool block`);
  return blocks;
}

try {
  const toolFiles = fs.readdirSync(path.join(root, 'plugins'))
    .map((id) => path.join('plugins', id, 'mcp', 'server.js'))
    .filter((relPath) => fs.existsSync(path.join(root, relPath)))
    .sort();

  let total = 0;
  for (const relPath of toolFiles) {
    const blocks = collectToolBlocks(relPath);
    assert.ok(blocks.length > 0, `${relPath} should register at least one tool`);
    total += blocks.length;
    for (const block of blocks) {
      const prefix = `${block.indent}  `;
      const missing = ['description', 'inputSchema', 'handler']
        .filter((property) => !block.lines.some((line) => line.startsWith(`${prefix}${property}:`)));
      assert.deepEqual(
        missing,
        [],
        `${relPath}:${block.line} tool "${block.name}" is missing ${missing.join(', ')}`
      );
    }
  }

  assert.ok(total > 0, 'the probe should enumerate at least one registered tool');
  ok('every direct plugin tool registration declares description, inputSchema and handler');

  console.log(`\n${passed} tool-property checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
