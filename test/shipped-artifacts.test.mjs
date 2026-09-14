#!/usr/bin/env node
/**
 * What the customer actually receives.
 *
 * `scripts/bake-billing-url.mjs` rewrites the placeholder billing host into
 * the vendored runtime before `scripts/build.mjs` packs the archives. It is a
 * manual step, and a manual step before a release is a step that gets skipped:
 * an archive built without it points every licence check at
 * billing.example.com, which resolves to nothing, so every paid tool in every
 * plugin fails for every customer — and the build is green, because nothing
 * looks at what came out.
 *
 * This unpacks each built archive and reads it as a customer's machine would.
 *
 *   node test/shipped-artifacts.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

// One list, shared with the boot-time environment gate, so a placeholder the
// gate refuses cannot still be shipped inside an archive — and so adding a
// new placeholder to the documentation updates both at once. The first
// version of this test knew only about example.com while the repository also
// used yourdomain.com, including in .env.example.
const { isPlaceholderHost } = await import('../services/billing/lib/env.js');
/** Anything that should never reach a customer's disk. */
const FORBIDDEN = [
  [/\bsk_(live|test)_[A-Za-z0-9]{10,}/, 'a Stripe secret key'],
  [/\bwhsec_[A-Za-z0-9+/=]{16,}/, 'a Stripe webhook signing secret'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\bPS-[A-Z]{2,4}(-[A-Z2-9]{4,5}){3,4}\b/, 'a licence key'],
];

try {
  // Build from scratch so this reads what the release would ship, not
  // whatever happens to be left in dist/ from an earlier run.
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'ignore' });

  const dist = path.join(root, 'dist');
  const archives = fs.readdirSync(dist).filter((f) => f.endsWith('.plugin'));
  assert.ok(archives.length > 0, 'the build produced no archives, so nothing below examined anything');

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shipped-'));
  let filesRead = 0;
  const placeholderIn = [];
  const secretsIn = [];
  const hosts = new Set();

  for (const archive of archives) {
    const into = path.join(work, archive.replace(/\.plugin$/, ''));
    fs.mkdirSync(into, { recursive: true });
    execFileSync('unzip', ['-q', path.join(dist, archive), '-d', into], { stdio: 'ignore' });

    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const abs = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(abs) : [abs];
    });
    for (const file of walk(into)) {
      if (!/\.(js|mjs|json|md|txt|ya?ml)$/.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      filesRead += 1;
      const where = `${archive}:${path.relative(into, file)}`;
      // Only mcp/server.js carries an actual shipped default: that is where
      // DEFAULT_BILLING_URL lives and the only place bake-billing-url.mjs
      // writes. license-client.js permanently contains the literal string
      // "billing.example.com" as PLACEHOLDER_BILLING_URL — a sentinel it
      // compares its configured default against to report
      // billing_not_configured (see mcp-lite.js's own defect #53 fix) — by
      // design, in every build, baked or not. Flagging it as a shipped
      // placeholder would mean this check could never pass, ever. A README's
      // example override command is documentation, not a default a customer's
      // install actually uses, so it is not checked here either.
      const isServerDefault = /(^|\/)mcp\/server\.js$/.test(path.relative(into, file));
      if (isServerDefault) {
        for (const match of text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
          if (isPlaceholderHost(match[1])) { placeholderIn.push(`${where} → ${match[1]}`); break; }
        }
      }
      for (const [pattern, what] of FORBIDDEN) {
        if (pattern.test(text)) secretsIn.push(`${where} contains ${what}`);
      }
      for (const match of text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) hosts.add(match[1]);
    }
  }
  fs.rmSync(work, { recursive: true, force: true });

  assert.ok(filesRead > 0, 'no readable file was found inside any archive — the probe read nothing');

  assert.deepEqual(secretsIn, [], `\na secret is inside a shipped archive:\n  ${secretsIn.join('\n  ')}\n`);
  ok(`${archives.length} archives, ${filesRead} files: no Stripe key, webhook secret, private key or licence key ships to a customer`);

  // The placeholder is only acceptable before a release. Treat its presence as
  // a failure when the release is being cut, and as a loud note otherwise, so
  // a development build does not have to bake a URL to pass.
  const releasing = process.env.RELEASE === '1' || process.env.GITHUB_REF_TYPE === 'tag';
  if (placeholderIn.length > 0) {
    assert.ok(!releasing,
      `\n${placeholderIn.length} shipped file(s) still point at a placeholder host. `
      + `Run: node scripts/bake-billing-url.mjs https://<your billing host>\n  ${placeholderIn.slice(0, 5).join('\n  ')}\n`);
    console.log(`  note  ${placeholderIn.length} file(s) still carry a placeholder host; `
      + 'that is expected before bake-billing-url.mjs has run, and fails the build when RELEASE=1.');
  }
  ok(placeholderIn.length === 0
    ? 'every archive points at a real billing host'
    : 'the placeholder host is accounted for, and blocks a tagged release');

  // Say what was actually baked, so a release log records it.
  const external = [...hosts].filter((h) => !/^(localhost|127\.0\.0\.1)$/.test(h)).sort();
  const realHosts = external.filter((h) => !isPlaceholderHost(h));
  console.log(`  hosts referenced by the shipped archives: ${external.join(', ') || '(none)'}`);
  console.log(`  of those, real hosts: ${realHosts.join(', ') || '(none — nothing is baked yet)'}`);
  assert.ok(external.length > 0, 'no host at all appears in the archives — the licence client cannot reach anything');
  ok('the shipped host list is recorded in the build log');

  console.log(`\n${passed} shipped-artifact checks passed`);
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exitCode = 1;
}
