#!/usr/bin/env node
/**
 * skill-prompts.js publishes a plugin's skills as MCP prompts. What must
 * hold, and is checked here over real stdio against fixture-skill-server.mjs:
 *
 *   - prompts/list is open and carries the frontmatter description with a
 *     folded (`>-`) block flattened to one line.
 *   - prompts/get refuses the free tier — the free entitlement reports
 *     active: true, so a gate on `active` alone leaks the paid material
 *     (that was the first cut's actual bug).
 *   - prompts/get on a paid licence returns the SKILL.md body without its
 *     frontmatter, with every references/*.md inlined.
 *   - a server with no skills directory advertises no prompts capability.
 *
 *   node packages/suite-runtime/test/skill-prompts.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseFrontmatter } from '../skill-prompts.js';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixture-skill-server.mjs');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };
const children = [];

function startClient(env) {
  const child = spawn(process.execPath, [fixturePath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  children.push(child);
  let buf = '';
  const pending = new Map();
  let nextId = 1;
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const resolve = pending.get(msg.id);
      if (resolve) { pending.delete(msg.id); resolve(msg); }
    }
  });
  const call = (method, params) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  return { child, call };
}

// ---- a skills tree like a real plugin's -----------------------------------
const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
fs.mkdirSync(path.join(skillsDir, 'folded', 'references'), { recursive: true });
fs.writeFileSync(path.join(skillsDir, 'folded', 'SKILL.md'), [
  '---',
  'name: folded',
  'description: >-',
  '  Use this when splitting things',
  '  across a group.',
  'metadata:',
  '  version: 1',
  '---',
  '# The method',
  '',
  'Weigh everything first.',
  '',
].join('\n'));
fs.writeFileSync(path.join(skillsDir, 'folded', 'references', 'tables.md'), '| gear | kg |\n| ---- | -- |\n');
fs.mkdirSync(path.join(skillsDir, 'plain'));
fs.writeFileSync(path.join(skillsDir, 'plain', 'SKILL.md'), '---\nname: plain\ndescription: One line.\n---\nBody only.\n');
// A stray file (not a skill directory) must be ignored, not crash the scan.
fs.writeFileSync(path.join(skillsDir, 'notes.txt'), 'not a skill');

try {
  // ---- parseFrontmatter, directly ------------------------------------------
  {
    const folded = parseFrontmatter(fs.readFileSync(path.join(skillsDir, 'folded', 'SKILL.md'), 'utf8'));
    assert.equal(folded.fields.description, 'Use this when splitting things across a group.');
    assert.equal(folded.fields.name, 'folded');
    assert.ok(folded.body.startsWith('# The method'), 'body starts after the frontmatter');
    assert.ok(!folded.body.includes('---\nname:'), 'frontmatter does not leak into the body');
    const bare = parseFrontmatter('No frontmatter at all.\n');
    assert.deepEqual(bare.fields, {});
    assert.equal(bare.body, 'No frontmatter at all.\n');
  }
  ok('frontmatter parsing: folded description flattens, body excludes the block');

  // ---- open list, gated get -------------------------------------------------
  const free = startClient({ FIXTURE_SKILLS_DIR: skillsDir, FIXTURE_ENTITLEMENT: 'free' });
  {
    const init = await free.call('initialize', {});
    assert.deepEqual(init.result.capabilities.prompts, { listChanged: false });

    const list = await free.call('prompts/list', {});
    const names = list.result.prompts.map((p) => p.name).sort();
    assert.deepEqual(names, ['folded', 'plain']);
    const desc = list.result.prompts.find((p) => p.name === 'folded').description;
    assert.equal(desc, 'Use this when splitting things across a group.');
    ok('prompts/list is open and carries the flattened description');

    const got = await free.call('prompts/get', { name: 'folded' });
    assert.ok(got.error, 'the free tier must not receive the skill body');
    assert.equal(got.error.code, 'license_required');
    assert.ok(!JSON.stringify(got).includes('Weigh everything'), 'no fragment of the body leaks in the refusal');
    ok('prompts/get refuses the free tier even though it reports active: true');

    const unknown = await free.call('prompts/get', { name: 'nope' });
    assert.equal(unknown.error.code, -32602);
    ok('an unknown prompt is a -32602, matching unknown tools');
  }
  free.child.kill();

  // ---- the paid path --------------------------------------------------------
  const paid = startClient({ FIXTURE_SKILLS_DIR: skillsDir, FIXTURE_ENTITLEMENT: 'paid' });
  {
    await paid.call('initialize', {});
    const got = await paid.call('prompts/get', { name: 'folded' });
    assert.ok(!got.error, `paid get must succeed: ${JSON.stringify(got.error)}`);
    const text = got.result.messages[0].content.text;
    assert.ok(text.includes('Weigh everything first.'), 'the body ships');
    assert.ok(text.includes('| gear | kg |'), 'references are inlined');
    assert.ok(text.includes('Reference: tables.md'), 'each reference is labelled');
    assert.ok(!text.includes('description: >-'), 'frontmatter does not ship');
    assert.equal(got.result.messages[0].role, 'user');
  }
  ok('a paid licence receives the body with references inlined, frontmatter stripped');
  paid.child.kill();

  // ---- no skills directory, no prompts capability ---------------------------
  const bare = startClient({ FIXTURE_SKILLS_DIR: path.join(skillsDir, 'does-not-exist') });
  {
    const init = await bare.call('initialize', {});
    assert.equal(init.result.capabilities.prompts, undefined,
      'a server with nothing registered must not advertise prompts');
    const list = await bare.call('prompts/list', {});
    assert.deepEqual(list.result.prompts, []);
  }
  ok('a missing skills directory registers nothing and advertises nothing');
  bare.child.kill();

  console.log(`\n${passed} skill-prompts checks passed`);
} finally {
  for (const child of children) child.kill();
  fs.rmSync(skillsDir, { recursive: true, force: true });
}
