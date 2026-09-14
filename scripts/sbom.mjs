#!/usr/bin/env node
/**
 * A CycloneDX SBOM for the suite, and the assertion that keeps it true.
 *
 * The suite has no third-party runtime dependency: every import in every
 * shipped file resolves to a `node:` builtin or to a file in this repository.
 * That is worth a document — a customer's procurement will ask — and it is
 * worth a check, because the property is one `npm install` away from being
 * false, and an SBOM nobody verifies is a claim rather than a bill.
 *
 *   node scripts/sbom.mjs            # write sbom.cdx.json, report
 *   node scripts/sbom.mjs --check    # verify only, write nothing
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean);
const code = tracked.filter((f) => /\.(js|mjs)$/.test(f));
if (code.length === 0) {
  console.error('sbom: found no JavaScript to examine. Nothing below would mean anything.');
  process.exit(1);
}

// Every module specifier that is neither a builtin nor a relative path.
const external = new Map();
for (const rel of code) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  // Only real module syntax, anchored to the start of a line. A loose
  // `from '...'` pattern also matches an apostrophe inside a comment — it
  // reported "nothing was // compared" as a dependency of this very suite,
  // which is the shape of a scanner nobody trusts a week later.
  const specifiers = [
    ...text.matchAll(/^[ \t]*import\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"\n]+)['"]/gm),
    ...text.matchAll(/^[ \t]*export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"\n]+)['"]/gm),
    ...text.matchAll(/\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/g),
    ...text.matchAll(/\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g),
  ].map((m) => m[1]);
  for (const spec of specifiers) {
    if (spec.startsWith('node:') || spec.startsWith('.') || spec.startsWith('/')) continue;
    // A bare URL in a dynamic import is a file of ours, resolved at runtime.
    if (spec.startsWith('file:') || spec.startsWith('data:')) continue;
    const seen = external.get(spec) ?? [];
    seen.push(rel);
    external.set(spec, seen);
  }
}

// A package.json's mere existence isn't evidence of a dependency — every
// plugin and the billing service now carry one purely to declare
// "type": "module" (Node treats a bare .js file as CommonJS without one,
// or without the syntax-detection heuristic that's unflagged only from
// Node 22.7). Only one that actually lists something under dependencies,
// devDependencies, peerDependencies or optionalDependencies counts. A
// package-lock.json is a different matter: nothing produces one without
// an install that put something in it, so its presence alone still counts.
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const manifests = tracked
  .filter((f) => /(^|\/)package(-lock)?\.json$/.test(f))
  .filter((f) => {
    if (/package-lock\.json$/.test(f)) return true;
    const pkg = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
    return DEP_FIELDS.some((key) => pkg[key] && Object.keys(pkg[key]).length > 0);
  });

if (external.size > 0 || manifests.length > 0) {
  console.error('sbom: the suite is no longer dependency-free.');
  for (const [spec, where] of external) console.error(`  - ${spec} imported by ${where.join(', ')}`);
  for (const m of manifests) console.error(`  - ${m} is tracked`);
  console.error('\nThat is allowed, but this script and docs/ARCHITECTURE.md both state the opposite.');
  console.error('Add the dependencies to the SBOM below, record their licences, and update the claim.');
  process.exit(1);
}

const licence = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').split('\n')[0].trim();
// marketplace.json's version lives at metadata.version, not on a per-plugin
// entry — each entry in `plugins` is just { source, category }. Reading
// plugins[0].version would always be undefined and silently fall through to
// the hardcoded default below, masking any real version bump.
const version = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'))
  ?.metadata?.version ?? '0.1.0';

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: 'claude-plugin-suite',
      version,
      licenses: [{ license: { name: licence } }],
      description: 'Fourteen domain-expert plugins and the licensing service they share.',
    },
    properties: [
      { name: 'files:javascript', value: String(code.length) },
      { name: 'dependencies:runtime', value: '0' },
      { name: 'dependencies:development', value: '0' },
      { name: 'runtime', value: 'Node.js standard library only' },
    ],
  },
  // An empty components list is the finding, not an omission: there is no
  // third-party code to attribute, so there is no NOTICE obligation beyond
  // this repository's own licence.
  components: [],
};

if (checkOnly) {
  console.log(`sbom: ${code.length} JavaScript files, 0 third-party dependencies, 0 package manifests.`);
  console.log('Nothing to attribute beyond this repository\'s own terms.');
  process.exit(0);
}

fs.writeFileSync(path.join(root, 'sbom.cdx.json'), `${JSON.stringify(sbom, null, 2)}\n`);
console.log(`sbom: wrote sbom.cdx.json — ${code.length} JavaScript files, 0 third-party dependencies.`);
console.log(`Licence of the whole: ${licence}`);
console.log('No copyleft exposure and no NOTICE obligation: nothing third-party is redistributed.');
