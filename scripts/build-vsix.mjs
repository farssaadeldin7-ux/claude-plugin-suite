#!/usr/bin/env node
/**
 * Stage each plugin as a VS Code extension for Open VSX, and optionally
 * package it into a .vsix.
 *
 *   node scripts/build-vsix.mjs                    # stage all 14 into dist/vsix/<id>/
 *   node scripts/build-vsix.mjs trail-split        # just one
 *   node scripts/build-vsix.mjs --package          # stage, then run vsce → dist/vsix/*.vsix
 *
 * What ships: a thin extension.cjs that registers the plugin's MCP tool
 * server with VS Code's MCP server definition provider API (VS Code 1.102+),
 * plus the plugin's whole mcp/ directory (zero npm dependencies, so bundling
 * the files is the entire install). Skills are a Claude Code concept and are
 * not part of the extension.
 *
 * The staged server gets the production billing URL baked in, same as the
 * .plugin archives (override with BILLING_URL=... for a test build).
 * Packaging shells out to `npx @vscode/vsce`, which needs network — CI does
 * that; staging alone is fully offline and is what the tests exercise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'dist', 'vsix');

export const PUBLISHER = 'code-studio';
export const ENGINES_VSCODE = '^1.102.0';
const DEFAULT_BILLING_URL = 'https://billing.codestudioplugin.com';

const args = process.argv.slice(2);
const doPackage = args.includes('--package');
const only = args.filter((a) => !a.startsWith('--'));

// Same guard as bake-billing-url.mjs: the value lands inside a
// single-quoted JS string literal in the staged server.
const billingUrl = (process.env.BILLING_URL || DEFAULT_BILLING_URL).replace(/\/$/, '');
if (!/^https?:\/\/[^\s'"`\\]+$/.test(billingUrl)) {
  console.error(`build-vsix: refusing billing URL ${JSON.stringify(billingUrl)}`);
  process.exit(1);
}

const copyDir = (from, to, { exclude = [] } = {}) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, { exclude });
    else fs.copyFileSync(src, dst);
  }
};

export function stagePlugin(id, { billing = billingUrl } = {}) {
  const pluginDir = path.join(root, 'plugins', id);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8')
  );
  const serverSource = fs.readFileSync(path.join(pluginDir, 'mcp', 'server.js'), 'utf8');
  const displayName = /const PLUGIN_NAME = '([^']+)';/.exec(serverSource)?.[1] ?? manifest.name;

  const stage = path.join(outRoot, id);
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });

  // The bundled server, minus dev-only tests, with the billing URL baked.
  // Replacer function, not string: see bake-billing-url.mjs for why.
  copyDir(path.join(pluginDir, 'mcp'), path.join(stage, 'mcp'), { exclude: ['test'] });
  fs.writeFileSync(
    path.join(stage, 'mcp', 'server.js'),
    serverSource.replace(/const DEFAULT_BILLING_URL = '[^']*';/, () => `const DEFAULT_BILLING_URL = '${billing}';`)
  );

  // Extension entry. It is CommonJS (.cjs) while the staged package.json
  // says "type": "module" — that combination is deliberate: VS Code loads
  // the entry with require(), while the mcp/*.js files are ES modules and
  // resolve their module type from the nearest package.json.
  const template = fs.readFileSync(path.join(root, 'packages', 'vsix-template', 'extension.cjs'), 'utf8');
  fs.writeFileSync(
    path.join(stage, 'extension.cjs'),
    template
      .replaceAll('__PLUGIN_ID__', id)
      .replaceAll('__PLUGIN_NAME__', displayName.replace(/'/g, "\\'"))
      .replaceAll('__VERSION__', manifest.version)
  );

  // The skills ship too, served by the bundled server as licensed MCP
  // prompts (VS Code surfaces them as slash commands). skills/ must sit
  // next to mcp/ — that is where skill-prompts.js resolves them.
  const skillsDir = path.join(pluginDir, 'skills');
  if (fs.existsSync(skillsDir)) copyDir(skillsDir, path.join(stage, 'skills'));

  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'));
  fs.copyFileSync(path.join(pluginDir, 'README.md'), path.join(stage, 'README.md'));

  const pkg = {
    name: id,
    displayName,
    version: manifest.version,
    publisher: PUBLISHER,
    description: manifest.description,
    keywords: manifest.keywords,
    categories: ['AI', 'Chat', 'Other'],
    license: 'SEE LICENSE IN LICENSE',
    type: 'module',
    main: './extension.cjs',
    engines: { vscode: ENGINES_VSCODE },
    activationEvents: [`onMcpServerDefinitionProvider:${id}.mcp-servers`],
    contributes: {
      mcpServerDefinitionProviders: [
        { id: `${id}.mcp-servers`, label: `${displayName} MCP server` },
      ],
    },
    repository: { type: 'git', url: 'https://github.com/farssaadeldin7-ux/claude-plugin-suite' },
  };
  fs.writeFileSync(path.join(stage, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  return { stage, version: manifest.version, displayName };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => only.length === 0 || only.includes(n));
  if (plugins.length === 0) {
    console.error(`build-vsix: no plugins match ${JSON.stringify(only)}`);
    process.exit(1);
  }

  for (const id of plugins) {
    const { stage, version } = stagePlugin(id);
    if (doPackage) {
      const vsix = path.join(outRoot, `${id}-${version}.vsix`);
      execFileSync('npx', ['--yes', '@vscode/vsce', 'package', '--out', vsix], {
        cwd: stage, stdio: 'inherit',
      });
      console.log(`${id.padEnd(34)} ${version}  ${(fs.statSync(vsix).size / 1024).toFixed(1)} kB`);
    } else {
      console.log(`${id.padEnd(34)} ${version}  staged`);
    }
  }
  console.log(`\n${plugins.length} extension${plugins.length === 1 ? '' : 's'} in dist/vsix/ (billing: ${billingUrl})`);
}
