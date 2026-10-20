#!/usr/bin/env node
/**
 * Stage each plugin as an MCPB bundle for the official MCP Registry, and
 * optionally package it into a .mcpb (a zip with a manifest.json).
 *
 *   node scripts/build-mcpb.mjs                    # stage all 14 into dist/mcpb/<id>/
 *   node scripts/build-mcpb.mjs trail-split        # just one
 *   node scripts/build-mcpb.mjs --package          # stage, zip, hash → dist/mcpb/*.mcpb
 *
 * What ships: the plugin's whole mcp/ directory (zero npm dependencies, so
 * bundling the files is the entire install) plus a manifest.json in the
 * MCPB format (manifest_version 0.3) that tells any MCPB-aware host how to
 * run the server. Skills ship too, served by the bundled server as
 * licensed MCP prompts.
 *
 * --package also writes dist/mcpb/<id>.server.json — the registry listing
 * that publish-mcp-registry.yml submits, pointing at the bundle on this
 * repository's GitHub release and pinned by its SHA-256.
 *
 * The staged server gets the production billing URL baked in, same as the
 * .plugin archives (override with BILLING_URL=... for a test build).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'dist', 'mcpb');

export const AUTHOR = 'Code Studio';
export const SITE_URL = 'https://www.codestudioplugin.com';
export const REPO_URL = 'https://github.com/farssaadeldin7-ux/claude-plugin-suite';
export const REGISTRY_NAMESPACE = 'io.github.farssaadeldin7-ux';
export const SERVER_JSON_SCHEMA = 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json';
const DEFAULT_BILLING_URL = 'https://billing.codestudioplugin.com';

const args = process.argv.slice(2);
const doPackage = args.includes('--package');
const only = args.filter((a) => !a.startsWith('--'));

// Same guard as bake-billing-url.mjs: the value lands inside a
// single-quoted JS string literal in the staged server.
const billingUrl = (process.env.BILLING_URL || DEFAULT_BILLING_URL).replace(/\/$/, '');
if (!/^https?:\/\/[^\s'"`\\]+$/.test(billingUrl)) {
  console.error(`build-mcpb: refusing billing URL ${JSON.stringify(billingUrl)}`);
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

// The registry caps descriptions at 100 characters. Prefer the first whole
// sentence; otherwise cut at a word boundary.
export function shortDescription(text) {
  const whole = text.trim().replace(/\s+/g, ' ');
  if (whole.length <= 100) return whole;
  const sentence = whole.split(/(?<=\.)\s/)[0];
  if (sentence.length <= 100) return sentence;
  return `${whole.slice(0, 97).replace(/\s+\S*$/, '')}...`;
}

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
  fs.copyFileSync(path.join(pluginDir, 'README.md'), path.join(stage, 'README.md'));

  const description = shortDescription(manifest.description);
  const mcpbManifest = {
    manifest_version: '0.3',
    name: id,
    display_name: displayName,
    version: manifest.version,
    description,
    author: { name: AUTHOR, url: SITE_URL },
    homepage: SITE_URL,
    server: {
      type: 'node',
      entry_point: 'mcp/server.js',
      mcp_config: {
        command: 'node',
        // eslint-disable-next-line no-template-curly-in-string -- MCPB
        // hosts substitute ${__dirname} with the install directory.
        args: ['${__dirname}/mcp/server.js'],
      },
    },
  };
  fs.writeFileSync(path.join(stage, 'manifest.json'), `${JSON.stringify(mcpbManifest, null, 2)}\n`);
  return { stage, version: manifest.version, displayName, description };
}

export function serverJson(id, { version, description, sha256 }) {
  return {
    $schema: SERVER_JSON_SCHEMA,
    name: `${REGISTRY_NAMESPACE}/${id}`,
    description,
    repository: { url: REPO_URL, source: 'github' },
    version,
    packages: [
      {
        registryType: 'mcpb',
        identifier: `${REPO_URL}/releases/download/mcpb-v${version}/${id}.mcpb`,
        version,
        fileSha256: sha256,
        transport: { type: 'stdio' },
      },
    ],
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => only.length === 0 || only.includes(n));
  if (plugins.length === 0) {
    console.error(`build-mcpb: no plugins match ${JSON.stringify(only)}`);
    process.exit(1);
  }

  for (const id of plugins) {
    const { stage, version, description } = stagePlugin(id);
    if (doPackage) {
      const bundle = path.join(outRoot, `${id}.mcpb`);
      fs.rmSync(bundle, { force: true }); // zip appends to an existing archive
      execFileSync('zip', ['-r', '-X', '-q', bundle, '.'], { cwd: stage });
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(bundle)).digest('hex');
      fs.writeFileSync(
        path.join(outRoot, `${id}.server.json`),
        `${JSON.stringify(serverJson(id, { version, description, sha256 }), null, 2)}\n`
      );
      console.log(`${id.padEnd(34)} ${version}  ${(fs.statSync(bundle).size / 1024).toFixed(1)} kB  ${sha256.slice(0, 12)}…`);
    } else {
      console.log(`${id.padEnd(34)} ${version}  staged`);
    }
  }
  console.log(`\n${plugins.length} bundle${plugins.length === 1 ? '' : 's'} in dist/mcpb/ (billing: ${billingUrl})`);
}
