#!/usr/bin/env node
/**
 * Package each plugin as a distributable .plugin archive (a zip) into dist/.
 *
 *   node scripts/build.mjs            # all plugins
 *   node scripts/build.mjs ghost-post-preview
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

const only = process.argv.slice(2);
const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => only.length === 0 || only.includes(n));

for (const id of plugins) {
  const dir = path.join(root, 'plugins', id);
  const version = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const out = path.join(dist, `${id}-${version}.plugin`);
  fs.rmSync(out, { force: true });
  execFileSync('zip', ['-qr', out, '.', '-x', '*.DS_Store', '-x', '__MACOSX/*'], { cwd: dir });
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`${id.padEnd(34)} ${version}  ${kb} kB`);
}
console.log(`\n${plugins.length} archives in dist/`);
