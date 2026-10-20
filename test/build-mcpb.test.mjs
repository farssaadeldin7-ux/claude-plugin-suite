/**
 * The MCPB staging must produce, for every plugin, a bundle any MCPB-aware
 * host can run: a manifest.json in the 0.3 format whose entry point exists,
 * the whole tool server minus its dev-only tests, the production billing
 * URL baked into the staged copy, and skills next to mcp/ where the prompt
 * runtime resolves them. Packaging one plugin end to end also pins the
 * registry listing: a server.json in the account's GitHub namespace whose
 * SHA-256 matches the actual bundle.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { stagePlugin, shortDescription, REGISTRY_NAMESPACE, REPO_URL } from '../scripts/build-mcpb.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

assert.equal(plugins.length, 14, 'the suite ships fourteen plugins');

const BILLING = 'https://billing.test.example';

for (const id of plugins) {
  const { stage, version, description } = stagePlugin(id, { billing: BILLING });

  const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, '0.3');
  assert.equal(manifest.name, id);
  assert.equal(manifest.version, version);
  assert.ok(description.length <= 100, `${id}: registry description fits the 100-character cap`);
  assert.equal(manifest.description, description);
  assert.equal(manifest.server.type, 'node');
  assert.ok(fs.existsSync(path.join(stage, manifest.server.entry_point)),
    `${id}: the manifest's entry point exists in the bundle`);
  assert.deepEqual(manifest.server.mcp_config.args, ['${__dirname}/mcp/server.js'],
    `${id}: the host-substituted launch path matches the entry point`);

  const staged = fs.readFileSync(path.join(stage, 'mcp', 'server.js'), 'utf8');
  assert.ok(staged.includes(`const DEFAULT_BILLING_URL = '${BILLING}';`),
    `${id}: staged server has the billing URL baked in`);
  assert.ok(!fs.existsSync(path.join(stage, 'mcp', 'test')), `${id}: dev-only tests do not ship`);
  assert.ok(fs.existsSync(path.join(stage, 'mcp', 'skill-prompts.js')), `${id}: the prompt runtime ships`);
  assert.ok(fs.existsSync(path.join(stage, 'skills')), `${id}: skills ship next to mcp/`);
  assert.ok(fs.existsSync(path.join(stage, 'LICENSE')), `${id}: LICENSE ships`);
}

// Package one plugin end to end and pin the registry listing against the
// actual bundle bytes.
execFileSync(process.execPath, [path.join(root, 'scripts', 'build-mcpb.mjs'), '--package', 'trail-split'], {
  stdio: 'pipe',
});
const bundle = path.join(root, 'dist', 'mcpb', 'trail-split.mcpb');
const listing = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'mcpb', 'trail-split.server.json'), 'utf8'));
assert.equal(listing.name, `${REGISTRY_NAMESPACE}/trail-split`);
assert.ok(listing.description.length <= 100);
assert.equal(listing.repository.url, REPO_URL);
const pkg = listing.packages[0];
assert.equal(pkg.registryType, 'mcpb');
assert.ok(pkg.identifier.startsWith(`${REPO_URL}/releases/download/mcpb-v${listing.version}/`),
  'the listing points at this repository\'s release');
assert.ok(pkg.identifier.endsWith('.mcpb'), 'the artifact URL carries the .mcpb extension the registry requires');
assert.deepEqual(pkg.transport, { type: 'stdio' });
const sha = crypto.createHash('sha256').update(fs.readFileSync(bundle)).digest('hex');
assert.equal(pkg.fileSha256, sha, 'the listing\'s hash matches the actual bundle');

// The description helper never exceeds the cap, even on pathological input.
assert.ok(shortDescription('x'.repeat(300)).length <= 100);
assert.equal(shortDescription('Short and sweet.'), 'Short and sweet.');

console.log(`ok - ${plugins.length} plugins stage as MCPB bundles; trail-split packages with a valid registry listing`);
