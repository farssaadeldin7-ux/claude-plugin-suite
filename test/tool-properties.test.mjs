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

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function matchBrace(source, openIndex) {
  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  throw new Error(`Unterminated tool spec object starting at line ${lineOf(source, openIndex)}`);
}

function topLevelKeys(objectSource) {
  const keys = new Set();
  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < objectSource.length; i++) {
    const ch = objectSource[i];
    const next = objectSource[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      continue;
    }

    if (depth !== 1 || !/[A-Za-z_$]/.test(ch)) continue;
    const rest = objectSource.slice(i);
    const match = rest.match(/^([A-Za-z_$][\w$]*)\s*:/);
    if (!match) continue;
    keys.add(match[1]);
    i += match[0].length - 1;
  }

  return keys;
}

function collectToolBlocks(relPath) {
  const source = fs.readFileSync(path.join(root, relPath), 'utf8');
  const blocks = [];
  const toolStart = /server\.tool\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*,/g;

  for (const match of source.matchAll(toolStart)) {
    const objectStart = source.indexOf('{', match.index + match[0].length);
    assert.notEqual(objectStart, -1, `${relPath}:${lineOf(source, match.index)} has no tool spec object`);
    const objectEnd = matchBrace(source, objectStart);
    blocks.push({
      line: lineOf(source, match.index),
      name: match[2],
      keys: topLevelKeys(source.slice(objectStart, objectEnd + 1)),
    });
  }

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
      const missing = ['description', 'inputSchema', 'handler']
        .filter((property) => !block.keys.has(property));
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
