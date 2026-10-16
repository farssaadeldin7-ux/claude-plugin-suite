#!/usr/bin/env node
/**
 * Generate the committed extension icons in assets/icons/<id>.png.
 *
 * Each plugin gets a 256×256 rounded square: a two-letter monogram from the
 * first and last word of its display name, on a gradient whose hue is
 * derived from the plugin's position in the sorted id list (the 45–95°
 * band is skipped — white text reads badly on olive and yellow).
 *
 * The icons are committed, so neither CI nor the publish workflow runs
 * this; it exists so the icons are reproducible. It renders through a
 * headless Chromium: point CHROME at a headless chromium or
 * headless_shell binary, then run `node scripts/make-icons.mjs`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'icons');
const chrome = process.env.CHROME;
if (!chrome) {
  console.error('make-icons: set CHROME to a headless Chromium binary');
  process.exit(1);
}

export function monogram(displayName) {
  const words = displayName.split(/[\s&-]+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const letter = (w) => w[0].toUpperCase();
  return words.length === 1 ? letter(words[0]) : letter(words[0]) + letter(words.at(-1));
}

const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-icons-'));

plugins.forEach((id, i) => {
  const server = fs.readFileSync(path.join(root, 'plugins', id, 'mcp', 'server.js'), 'utf8');
  const displayName = /const PLUGIN_NAME = '([^']+)';/.exec(server)?.[1] ?? id;
  const text = monogram(displayName);
  const hue = Math.round(95 + (i * 310) / plugins.length) % 360;

  const page = path.join(tmp, `${id}.html`);
  fs.writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden}</style></head>
<body><svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" style="display:block">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},68%,48%)"/>
    <stop offset="1" stop-color="hsl(${(hue + 20) % 360},72%,30%)"/>
  </linearGradient></defs>
  <rect width="256" height="256" rx="56" fill="url(#g)"/>
  <text x="128" y="132" font-family="DejaVu Sans" font-weight="bold"
        font-size="${text.length === 1 ? 140 : 104}" fill="white"
        text-anchor="middle" dominant-baseline="central">${text}</text>
</svg></body></html>`);

  execFileSync(chrome, [
    '--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars',
    `--screenshot=${path.join(outDir, `${id}.png`)}`, '--window-size=256,256',
    '--default-background-color=00000000', `file://${page}`,
  ], { stdio: 'pipe' });
  console.log(`${id.padEnd(34)} ${text.padEnd(3)} hue ${hue}`);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${plugins.length} icons in assets/icons/`);
