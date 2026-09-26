/**
 * Publish a plugin's skills as MCP prompts.
 *
 * Skills are the plugin's paid instruction material — SKILL.md plus its
 * references/ — written for Claude Code, which loads them natively. Editors
 * with MCP support but no skill concept (VS Code 1.101+, Cursor, Windsurf)
 * surface MCP prompts as slash commands instead, so registering each skill
 * as a prompt is how the same material reaches them from the same server.
 *
 * The split mirrors the tools' licensing exactly:
 *   - prompts/list is open — names and descriptions are the storefront.
 *   - prompts/get is licensed — the skill body only leaves the server for an
 *     active licence, because the .vsix carrying this server is publicly
 *     downloadable from Open VSX and the body is the product.
 *
 * The skills directory is resolved relative to this file: it is vendored
 * into each plugin's mcp/ directory, and both a Claude Code install and the
 * staged VS Code extension put skills/ next to mcp/. No per-plugin path
 * configuration to get wrong.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ToolError } from './mcp-lite.js';

const DEFAULT_SKILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills');

/**
 * The one YAML shape skill frontmatter actually uses: scalar values, plus
 * folded blocks (`>`, `>-`) for the multi-line descriptions. A real YAML
 * parser would be a dependency; this is not a general parser and must not
 * grow into one.
 */
export function parseFrontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(markdown);
  if (!match) return { fields: {}, body: markdown };
  const fields = {};
  const lines = match[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = /^(\w[\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!line) continue;
    const [, key, rest] = line;
    if (rest === '>' || rest === '>-' || rest === '') {
      const folded = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        folded.push(lines[++i].trim());
      }
      if (folded.length > 0 || rest !== '') fields[key] = folded.join(' ');
    } else {
      fields[key] = rest.replace(/^["']|["']$/g, '');
    }
  }
  return { fields, body: markdown.slice(match[0].length) };
}

/** One skill directory → the full text a prompt returns. */
function skillText(skillDir, body) {
  const parts = [body.trim()];
  const refsDir = path.join(skillDir, 'references');
  if (fs.existsSync(refsDir)) {
    // Inlined rather than linked: the skill's own relative links point at
    // files the chat client has never seen.
    for (const ref of fs.readdirSync(refsDir).filter((f) => f.endsWith('.md')).sort()) {
      const content = fs.readFileSync(path.join(refsDir, ref), 'utf8').trim();
      parts.push(`\n\n---\n\nReference: ${ref}\n\n${content}`);
    }
  }
  return parts.join('');
}

/**
 * Register every skill under skillsDir as a licensed prompt.
 * Returns the registered prompt names (for tests and logs).
 */
export function registerSkillPrompts(server, client, { skillsDir = DEFAULT_SKILLS_DIR } = {}) {
  if (!fs.existsSync(skillsDir)) return [];
  const names = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(skillsDir, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const { fields, body } = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'));
    server.prompt(entry.name, {
      description: fields.description || `The ${entry.name} skill.`,
      handler: async () => {
        // Any active paid licence unlocks every skill — plans differ in
        // tool features and quotas, not in which instructions ship. The
        // free tier reports active: true with free: true (that is how the
        // open evaluation tools stay usable without a key), so `active`
        // alone is not the paid check — `free` must be false too.
        const entitlement = await client.entitlement();
        if (!entitlement.active || entitlement.free) {
          throw new ToolError('license_required',
            'This skill is part of the paid plugin. Activate a licence with the license_activate tool, or buy one with start_checkout.',
            { reason: entitlement.reason });
        }
        return {
          description: fields.description,
          messages: [{ role: 'user', content: { type: 'text', text: skillText(skillDir, body) } }],
        };
      },
    });
    names.push(entry.name);
  }
  return names;
}
