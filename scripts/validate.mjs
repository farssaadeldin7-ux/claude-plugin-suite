#!/usr/bin/env node
/**
 * Structural validation for the whole marketplace. No dependencies.
 *
 *   node scripts/validate.mjs
 *
 * Exits non-zero on any error, so it can gate CI.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { err(`${path.relative(root, p)}: invalid JSON — ${e.message}`); return null; }
};

// ---- marketplace ---------------------------------------------------------
const marketplacePath = path.join(root, '.claude-plugin', 'marketplace.json');
const marketplace = readJson(marketplacePath);
if (!marketplace) process.exit(1);

for (const field of ['name', 'owner', 'plugins']) {
  if (!marketplace[field]) err(`marketplace.json: missing "${field}"`);
}

const listed = (marketplace.plugins || []).map((p) => p.source.replace(/^\.\/plugins\//, ''));
const onDisk = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name).sort();

for (const id of listed) {
  if (!onDisk.includes(id)) err(`marketplace.json lists "${id}" but plugins/${id} does not exist`);
}
for (const id of onDisk) {
  if (!listed.includes(id)) err(`plugins/${id} exists but is not listed in marketplace.json`);
}

// ---- frontmatter ---------------------------------------------------------
function frontmatter(text, rel) {
  if (!text.startsWith('---\n')) { err(`${rel}: missing YAML frontmatter`); return null; }
  const end = text.indexOf('\n---', 3);
  if (end === -1) { err(`${rel}: unterminated frontmatter`); return null; }
  const block = text.slice(4, end);
  const out = {};
  let key = null;
  for (const line of block.split('\n')) {
    const m = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(line);
    if (m && !line.startsWith(' ')) { key = m[1]; out[key] = m[2]; }
    else if (key && line.startsWith(' ')) { out[key] = `${out[key]} ${line.trim()}`.trim(); }
  }
  return out;
}

const BANNED = ['unlock', 'supercharge', 'game-changing', 'game changing', 'seamless',
  'delve', 'fast-paced world', 'revolutionise', 'revolutionize', 'cutting-edge'];

let skillCount = 0;
for (const id of onDisk) {
  const dir = path.join(root, 'plugins', id);
  const manifestPath = path.join(dir, '.claude-plugin', 'plugin.json');

  if (!fs.existsSync(manifestPath)) { err(`plugins/${id}: no .claude-plugin/plugin.json`); continue; }
  const manifest = readJson(manifestPath);
  if (manifest) {
    if (manifest.name !== id) err(`plugins/${id}: plugin.json name "${manifest.name}" != directory name`);
    for (const f of ['version', 'description', 'author']) {
      if (!manifest[f]) err(`plugins/${id}: plugin.json missing "${f}"`);
    }
    if (manifest.description && manifest.description.length > 400) {
      warn(`plugins/${id}: description is ${manifest.description.length} chars, consider trimming`);
    }
  }

  if (!fs.existsSync(path.join(dir, 'README.md'))) err(`plugins/${id}: no README.md`);

  const mcpPath = path.join(dir, '.mcp.json');
  if (fs.existsSync(mcpPath)) {
    const mcp = readJson(mcpPath);
    for (const [name, cfg] of Object.entries(mcp?.mcpServers || {})) {
      const args = cfg.args || [];
      for (const a of args) {
        const local = a.replace('${CLAUDE_PLUGIN_ROOT}', dir);
        if (local.includes('/') && !fs.existsSync(local)) {
          err(`plugins/${id}: .mcp.json server "${name}" points at missing file ${a}`);
        }
      }
    }
  }

  const skillsDir = path.join(dir, 'skills');
  if (!fs.existsSync(skillsDir)) { err(`plugins/${id}: no skills/ directory`); continue; }

  for (const skill of fs.readdirSync(skillsDir)) {
    const skillMd = path.join(skillsDir, skill, 'SKILL.md');
    const rel = path.relative(root, skillMd);
    if (!fs.existsSync(skillMd)) { err(`${rel}: missing`); continue; }
    skillCount++;

    const text = fs.readFileSync(skillMd, 'utf8');
    const fm = frontmatter(text, rel);
    if (fm) {
      if (fm.name !== skill) err(`${rel}: frontmatter name "${fm.name}" != directory "${skill}"`);
      if (!fm.description) err(`${rel}: frontmatter has no description`);
      else if (fm.description.length < 120) warn(`${rel}: description is short (${fm.description.length} chars) and may not match reliably`);
    }

    const lower = text.toLowerCase();
    for (const word of BANNED) {
      if (lower.includes(word)) warn(`${rel}: contains banned term "${word}"`);
    }
    if (/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(text)) warn(`${rel}: contains emoji`);

    // every referenced reference file must exist
    const refsDir = path.join(skillsDir, skill, 'references');
    for (const m of text.matchAll(/references\/([\w.-]+\.md)/g)) {
      if (!fs.existsSync(path.join(refsDir, m[1]))) {
        err(`${rel}: points at references/${m[1]} which does not exist`);
      }
    }
    // and every reference file should be pointed at
    if (fs.existsSync(refsDir)) {
      for (const f of fs.readdirSync(refsDir)) {
        if (!text.includes(f)) warn(`${rel}: references/${f} is never referenced from SKILL.md`);
      }
    }
  }
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${onDisk.length} plugins, ${skillCount} skills, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
