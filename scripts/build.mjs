#!/usr/bin/env node
/**
 * Package each plugin as a distributable .plugin archive (a zip) into dist/.
 *
 *   node scripts/build.mjs            # all plugins
 *   node scripts/build.mjs ghost-post-preview
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

const only = process.argv.slice(2);
const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => only.length === 0 || only.includes(n));

// Every README links to the repository LICENSE, so it has to actually be in
// the archive a customer unzips — not just present in the git checkout that
// built it.
const licenseSrc = path.join(root, 'LICENSE');

// Zipping the whole plugin directory picks up anything a developer happens
// to have lying around in it, not just what's meant to ship: a stray local
// .env with real secrets, an accidental node_modules, this repo's own
// dev-only test files. Exclude by pattern rather than trusting nothing
// unwanted will ever be dropped into a plugin directory.
const EXCLUDES = ['*.DS_Store', '__MACOSX/*', '.env', '.env.*', 'node_modules/*', 'mcp/test/*'];

for (const id of plugins) {
  const dir = path.join(root, 'plugins', id);
  const version = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const out = path.join(dist, `${id}-${version}.plugin`);
  fs.rmSync(out, { force: true });
  const excludeArgs = EXCLUDES.flatMap((pattern) => ['-x', pattern]);
  execFileSync('zip', ['-qr', out, '.', ...excludeArgs], { cwd: dir });
  execFileSync('zip', ['-qj', out, licenseSrc]); // -j: store at the archive root, not under LICENSE/LICENSE
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`${id.padEnd(34)} ${version}  ${kb} kB`);
}
console.log(`\n${plugins.length} archives in dist/`);
