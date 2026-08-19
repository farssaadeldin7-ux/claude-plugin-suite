#!/usr/bin/env node
/**
 * Copy the shared MCP runtime into every plugin that ships an MCP server.
 *
 * Plugins install from a .plugin archive with no npm step, so shared code has to be
 * vendored rather than depended on. packages/suite-runtime is the single source of
 * truth; run this after editing it.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'packages', 'suite-runtime');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.js'));

let copied = 0;
for (const id of fs.readdirSync(path.join(root, 'plugins'))) {
  const mcpDir = path.join(root, 'plugins', id, 'mcp');
  if (!fs.existsSync(mcpDir)) continue;
  for (const f of files) {
    fs.copyFileSync(path.join(src, f), path.join(mcpDir, f));
    copied++;
  }
  console.log(`vendored ${files.length} runtime files into plugins/${id}/mcp`);
}
console.log(`${copied} files copied`);
