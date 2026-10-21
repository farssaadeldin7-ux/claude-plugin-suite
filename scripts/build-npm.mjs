#!/usr/bin/env node
/**
 * Stage each plugin as a publishable npm package.
 *
 *   node scripts/build-npm.mjs                    # stage all 14 into dist/npm/<id>/
 *   node scripts/build-npm.mjs trail-split        # just one
 *
 * What ships: the plugin's whole mcp/ directory (zero npm dependencies, so
 * there is nothing to install or build) plus skills/, with a manifest that
 * makes the package runnable as `npx @farseman/<id>` — the server already
 * carries a shebang — and that carries the mcpName the MCP Registry's npm
 * ownership check looks for. The README is the package's listing page on
 * npmjs.com, so it gets the same site banner as the Open VSX copies; the
 * repo source stays banner-free.
 *
 * The staged server gets the production billing URL baked in, same as the
 * other builders (override with BILLING_URL=... for a test build).
 * Publishing itself is publish-npm.yml's job.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'dist', 'npm');

export const NPM_SCOPE = '@farseman';
export const SITE_URL = 'https://www.codestudioplugin.com';
export const REPO_URL = 'https://github.com/farssaadeldin7-ux/claude-plugin-suite';
export const REGISTRY_NAMESPACE = 'io.github.farssaadeldin7-ux';
const DEFAULT_BILLING_URL = 'https://billing.codestudioplugin.com';

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));

// Same guard as bake-billing-url.mjs: the value lands inside a
// single-quoted JS string literal in the staged server.
const billingUrl = (process.env.BILLING_URL || DEFAULT_BILLING_URL).replace(/\/$/, '');
if (!/^https?:\/\/[^\s'"`\\]+$/.test(billingUrl)) {
  console.error(`build-npm: refusing billing URL ${JSON.stringify(billingUrl)}`);
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

  // The skills ship too, served by the bundled server as licensed MCP
  // prompts. skills/ must sit next to mcp/ — that is where
  // skill-prompts.js resolves them.
  const skillsDir = path.join(pluginDir, 'skills');
  if (fs.existsSync(skillsDir)) copyDir(skillsDir, path.join(stage, 'skills'));

  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'));

  // The README is the package's listing page on npmjs.com — the banner
  // routes readers to the site, same as the Open VSX staging.
  const readme = fs.readFileSync(path.join(pluginDir, 'README.md'), 'utf8');
  const banner = [
    `> Part of the fourteen-plugin **[Code Studio](${SITE_URL})** suite.`,
    `> Licences and pricing: **[codestudioplugin.com/pricing](${SITE_URL}/pricing)**`,
    '',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(stage, 'README.md'), banner + readme);

  const pkg = {
    name: `${NPM_SCOPE}/${id}`,
    version: manifest.version,
    description: manifest.description,
    keywords: [...(manifest.keywords ?? []), 'mcp', 'mcp-server', 'modelcontextprotocol'],
    license: 'SEE LICENSE IN LICENSE',
    type: 'module',
    // The server carries a shebang, so `npx @farseman/<id>` just runs it.
    bin: { [id]: 'mcp/server.js' },
    // The MCP Registry's npm ownership check: this value must match the
    // registry server name for npm-backed listings.
    mcpName: `${REGISTRY_NAMESPACE}/${id}`,
    engines: { node: '>=20.6' },
    repository: { type: 'git', url: `git+${REPO_URL}.git`, directory: `plugins/${id}` },
    homepage: SITE_URL,
    bugs: { url: `${REPO_URL}/issues` },
    publishConfig: { access: 'public' },
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
    console.error(`build-npm: no plugins match ${JSON.stringify(only)}`);
    process.exit(1);
  }

  for (const id of plugins) {
    const { version } = stagePlugin(id);
    console.log(`${NPM_SCOPE}/${id.padEnd(34)} ${version}  staged`);
  }
  console.log(`\n${plugins.length} package${plugins.length === 1 ? '' : 's'} in dist/npm/ (billing: ${billingUrl})`);
}
