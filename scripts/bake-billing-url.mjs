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
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2]?.replace(/\/$/, '');

// Deliberately stricter than a general URL check: the value is about to be
// embedded directly inside a single-quoted JS string literal. A bare quote
// or backslash would close that literal early and let anything after it run
// as code the next time a plugin server starts; disallowing them here means
// a malformed argument fails loudly now instead of corrupting 14 files.
if (!url || !/^https?:\/\/[^\s'"`\\]+$/.test(url)) {
  console.error('usage: node scripts/bake-billing-url.mjs https://billing.example.com');
  console.error("the URL may not contain whitespace, quotes or backslashes.");
  process.exit(1);
}

let changed = 0;
for (const id of fs.readdirSync(path.join(root, 'plugins'))) {
  const serverFile = path.join(root, 'plugins', id, 'mcp', 'server.js');
  if (!fs.existsSync(serverFile)) continue;

  const source = fs.readFileSync(serverFile, 'utf8');
  // A replacer *function*, not a string: String.replace() treats a string
  // replacement's own $&, $1, $$, ... as special substitution patterns, so a
  // URL that happens to contain one (perfectly legal in a query string)
  // would silently corrupt the write — a function's return value is used
  // verbatim, with no such reinterpretation.
  const updated = source.replace(
    /const DEFAULT_BILLING_URL = '[^']*';/,
    () => `const DEFAULT_BILLING_URL = '${url}';`
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

if (changed === 0) {
  console.error('\nNo plugin was updated — DEFAULT_BILLING_URL was not found in any plugins/*/mcp/server.js.');
  console.error('That almost certainly means this script and the source have drifted apart; treat this as a failure, not a no-op.');
  process.exit(1);
}
