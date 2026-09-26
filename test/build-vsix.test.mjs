/**
 * The Open VSX staging must produce, for every plugin, a directory vsce can
 * package without surprises: a manifest with the fields vsce validates, an
 * extension entry whose provider id matches the contributed one, the whole
 * tool server minus its dev-only tests, and the production billing URL baked
 * into the staged copy while the repo source keeps the placeholder.
 *
 * Staging is offline by design; packaging itself (npx @vscode/vsce) needs
 * network and is exercised by the publish workflow, not here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stagePlugin, PUBLISHER, ENGINES_VSCODE } from '../scripts/build-vsix.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

assert.equal(plugins.length, 14, 'the suite ships fourteen plugins');

const BILLING = 'https://billing.test.example';

for (const id of plugins) {
  const { stage, version, displayName } = stagePlugin(id, { billing: BILLING });

  const pkg = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
  assert.equal(pkg.name, id);
  assert.equal(pkg.publisher, PUBLISHER);
  assert.equal(pkg.version, version);
  assert.equal(pkg.engines.vscode, ENGINES_VSCODE);
  assert.equal(pkg.main, './extension.cjs');
  assert.equal(pkg.type, 'module', 'mcp/*.js are ES modules and resolve type from this manifest');
  assert.ok(pkg.description && pkg.description.length > 10, `${id}: description comes from plugin.json`);

  const providerId = pkg.contributes.mcpServerDefinitionProviders[0].id;
  assert.equal(providerId, `${id}.mcp-servers`);
  assert.deepEqual(pkg.activationEvents, [`onMcpServerDefinitionProvider:${providerId}`]);

  const entry = fs.readFileSync(path.join(stage, 'extension.cjs'), 'utf8');
  assert.ok(entry.includes(`registerMcpServerDefinitionProvider('${providerId}'`),
    `${id}: the entry registers the same provider id the manifest contributes`);
  assert.ok(entry.includes(`'${displayName.replace(/'/g, "\\'")}'`), `${id}: server label is the display name`);
  assert.ok(!entry.includes('__PLUGIN_'), `${id}: no template token survives`);

  const staged = fs.readFileSync(path.join(stage, 'mcp', 'server.js'), 'utf8');
  assert.ok(staged.includes(`const DEFAULT_BILLING_URL = '${BILLING}';`),
    `${id}: staged server has the billing URL baked in`);
  const source = fs.readFileSync(path.join(root, 'plugins', id, 'mcp', 'server.js'), 'utf8');
  assert.ok(!source.includes(BILLING), `${id}: baking must not touch the repo source`);

  assert.ok(!fs.existsSync(path.join(stage, 'mcp', 'test')), `${id}: dev-only tests do not ship`);
  assert.ok(fs.existsSync(path.join(stage, 'mcp', 'mcp-lite.js')), `${id}: runtime ships`);
  assert.ok(fs.existsSync(path.join(stage, 'LICENSE')), `${id}: LICENSE ships`);
  assert.ok(fs.existsSync(path.join(stage, 'README.md')), `${id}: README ships`);
}

// Extension names must be valid vsce names: lowercase, no spaces.
for (const id of plugins) {
  assert.match(id, /^[a-z0-9][a-z0-9-]*$/, `${id}: valid extension name`);
}

console.log(`ok - ${plugins.length} plugins stage as publishable VS Code extensions`);
