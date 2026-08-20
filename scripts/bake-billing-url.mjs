#!/usr/bin/env node
/**
 * Bake the deployed billing service URL into every plugin that ships a tool
 * server, so installed archives work without users setting
 * PLUGIN_SUITE_BILLING_URL themselves.
 *
 *   node scripts/bake-billing-url.mjs https://billing.example.com
 *
 * Rewrites DEFAULT_BILLING_URL in each plugins/<id>/mcp/server.js, then
 * rebuild archives with scripts/build.mjs. The env var still overrides the
 * baked value at runtime.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const url = process.argv[2]?.replace(/\/$/, '');

if (!/^https?:\/\/[^\s]+$/.test(url ?? '')) {
  console.error('usage: node scripts/bake-billing-url.mjs https://billing.example.com');
  process.exit(1);
}

let changed = 0;
for (const id of fs.readdirSync(path.join(root, 'plugins'))) {
  const serverFile = path.join(root, 'plugins', id, 'mcp', 'server.js');
  if (!fs.existsSync(serverFile)) continue;

  const source = fs.readFileSync(serverFile, 'utf8');
  const updated = source.replace(
    /const DEFAULT_BILLING_URL = '[^']*';/,
    `const DEFAULT_BILLING_URL = '${url}';`
  );
  if (updated === source) {
    console.log(`plugins/${id}: already set or no DEFAULT_BILLING_URL found`);
    continue;
  }
  fs.writeFileSync(serverFile, updated);
  console.log(`plugins/${id}: DEFAULT_BILLING_URL -> ${url}`);
  changed++;
}

console.log(`\n${changed} plugin(s) updated. Rebuild archives with: node scripts/build.mjs`);
