/**
 * The npm staging must produce, for every plugin, a directory npm can
 * publish without surprises: a manifest whose bin target exists and starts
 * with a shebang (that is what makes `npx @farseman/<id>` work), the
 * mcpName the MCP Registry's npm ownership check requires, the whole tool
 * server minus its dev-only tests, the production billing URL baked into
 * the staged copy while the repo source keeps the placeholder, and the
 * site banner on the staged README only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stagePlugin, NPM_SCOPE, SITE_URL, REGISTRY_NAMESPACE } from '../scripts/build-npm.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

assert.equal(plugins.length, 14, 'the suite ships fourteen plugins');

const BILLING = 'https://billing.test.example';

for (const id of plugins) {
  const { stage, version } = stagePlugin(id, { billing: BILLING });

  const pkg = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
  assert.equal(pkg.name, `${NPM_SCOPE}/${id}`);
  assert.equal(pkg.version, version);
  assert.equal(pkg.type, 'module', 'mcp/*.js are ES modules and resolve type from this manifest');
  assert.equal(pkg.mcpName, `${REGISTRY_NAMESPACE}/${id}`,
    `${id}: carries the MCP Registry ownership marker`);
  assert.equal(pkg.publishConfig.access, 'public', `${id}: scoped packages must opt in to public`);
  assert.ok(pkg.keywords.includes('mcp-server'), `${id}: findable by the keyword people search`);

  const binTarget = pkg.bin[id];
  const binSource = fs.readFileSync(path.join(stage, binTarget), 'utf8');
  assert.ok(binSource.startsWith('#!/usr/bin/env node'),
    `${id}: the bin target keeps its shebang, so npx can run it`);
  assert.ok(binSource.includes(`const DEFAULT_BILLING_URL = '${BILLING}';`),
    `${id}: staged server has the billing URL baked in`);
  const source = fs.readFileSync(path.join(root, 'plugins', id, 'mcp', 'server.js'), 'utf8');
  assert.ok(!source.includes(BILLING), `${id}: baking must not touch the repo source`);

  assert.ok(!fs.existsSync(path.join(stage, 'mcp', 'test')), `${id}: dev-only tests do not ship`);
  assert.ok(fs.existsSync(path.join(stage, 'mcp', 'skill-prompts.js')), `${id}: the prompt runtime ships`);
  assert.ok(fs.existsSync(path.join(stage, 'skills')), `${id}: skills ship next to mcp/`);
  assert.ok(fs.existsSync(path.join(stage, 'LICENSE')), `${id}: LICENSE ships`);

  const stagedReadme = fs.readFileSync(path.join(stage, 'README.md'), 'utf8');
  assert.ok(stagedReadme.startsWith('> Part of the fourteen-plugin'),
    `${id}: staged README opens with the site banner`);
  assert.ok(stagedReadme.includes(`${SITE_URL}/pricing`), `${id}: banner links to pricing`);
  const sourceReadme = fs.readFileSync(path.join(root, 'plugins', id, 'README.md'), 'utf8');
  assert.ok(!sourceReadme.includes('Part of the fourteen-plugin'), `${id}: banner must not touch the repo README`);
}

console.log(`ok - ${plugins.length} plugins stage as publishable npm packages`);
