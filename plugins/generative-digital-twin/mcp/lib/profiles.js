import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The local style-profile store. A profile is the deliverable of the whole
 * method — scope, never list, dimensions, anchors, boundary, provenance,
 * baseline and a dated changelog — and it only works as a living document if
 * it is versioned and kept somewhere citable. Stored on the user's machine
 * only; nothing here is sent anywhere.
 *
 * profileFacts() reports what a machine can count about a profile — entry
 * counts against the stated targets, sections present, preamble word budget,
 * never entries missing verbatim from the preamble. Whether an entry is any
 * good is judgement, and stays in the skill.
 */

export const NEVER_TARGET = {
  min: 12,
  max: 20,
  floor: 8,
  rule:
    'Target 12 to 20 never entries. Below eight, output still reads as house-average with a tint. Write each as an ' +
    'imperative prohibition with an observable trigger.',
};

export const ANCHOR_TARGET = {
  min: 3,
  max: 5,
  rule: 'Anchors are the three to five pieces that best represent the profile.',
};

export const PROFILE_SECTIONS =
  'One file, sections in this order: scope (which media, which briefs); never list, first, because it is the ' +
  'operative part; dimensions, each with its extracted value and one corpus example cited by name; anchors; ' +
  'boundary (the near-misses with a sentence each on what is wrong); provenance — corpus size, date range, ' +
  'ownership confirmed, date built; and a dated changelog. Version it: a profile without a version cannot be ' +
  'audited for drift.';

export const PREAMBLE_RULES = {
  min_words: 300,
  max_words: 600,
  order:
    'The never list complete and verbatim; the five to seven highest-weight positive dimensions with their ' +
    'numbers; two short excerpts or descriptions from anchor pieces; then the brief.',
  trim_rule: 'Keep the never list uncut when trimming for length. It does the work; the positive dimensions can be summarised.',
};

function storePath() {
  const base = process.env.XDG_CONFIG_HOME
    || (process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'plugin-suite', 'generative-digital-twin-profiles.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(parsed.profiles) ? parsed.profiles : [];
  } catch {
    return [];
  }
}

function writeAll(profiles) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write-then-rename so a crash mid-write can never truncate the store.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, profiles }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

const countWords = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean).length;

/** Countable facts about a profile, each with the rule it is counted against. */
export function profileFacts(profile) {
  const neverCount = profile.never_list?.length ?? 0;
  const facts = [];

  if (neverCount < NEVER_TARGET.floor) {
    facts.push({ fact: 'never_list_below_eight', count: neverCount, rule: NEVER_TARGET.rule });
  } else if (neverCount < NEVER_TARGET.min || neverCount > NEVER_TARGET.max) {
    facts.push({ fact: 'never_list_outside_target', count: neverCount, rule: NEVER_TARGET.rule });
  }

  const anchorCount = profile.anchors?.length ?? 0;
  if (anchorCount < ANCHOR_TARGET.min || anchorCount > ANCHOR_TARGET.max) {
    facts.push({ fact: 'anchors_outside_target', count: anchorCount, rule: ANCHOR_TARGET.rule });
  }

  for (const section of ['scope', 'boundary', 'provenance']) {
    const value = profile[section];
    if (value === undefined || value === null || (Array.isArray(value) ? value.length === 0 : String(value).trim() === '')) {
      facts.push({ fact: 'section_missing', section, rule: PROFILE_SECTIONS });
    }
  }

  // A fact, not a verdict: an entry with no figure and no prohibition may
  // still be checkable — but most that fail this test are decoration.
  const noFigure = (profile.dimensions ?? [])
    .filter((d) => !/\d/.test(d.entry ?? '') && !/\b(never|no |not )\b/i.test(d.entry ?? ''))
    .map((d) => d.name);
  if (noFigure.length) {
    facts.push({
      fact: 'entries_with_no_number_or_prohibition',
      dimensions: noFigure,
      rule: 'Every entry must be checkable against a draft. Write numbers, ratios, counts and prohibitions.',
    });
  }

  let preamble = null;
  if (profile.preamble) {
    const words = countWords(profile.preamble);
    const missing = (profile.never_list ?? []).filter((entry) => !profile.preamble.includes(entry));
    preamble = {
      words,
      budget: `${PREAMBLE_RULES.min_words}-${PREAMBLE_RULES.max_words}`,
      within_budget: words >= PREAMBLE_RULES.min_words && words <= PREAMBLE_RULES.max_words,
      never_entries_missing_verbatim: missing,
      ...(missing.length ? { rule: 'The preamble carries the never list complete and verbatim. ' + PREAMBLE_RULES.trim_rule } : {}),
    };
  }

  return {
    never_entries: neverCount,
    dimensions: profile.dimensions?.length ?? 0,
    anchors: anchorCount,
    has_baseline: Boolean(profile.baseline && Object.keys(profile.baseline).length),
    facts,
    ...(preamble ? { preamble_check: preamble } : {}),
  };
}

export function saveProfile(input, changeNote) {
  const profiles = readAll();
  const now = new Date().toISOString();
  const existing = input.profile_id ? profiles.find((p) => p.profile_id === input.profile_id) : null;

  const profile = {
    profile_id: existing?.profile_id ?? `prof_${crypto.randomBytes(6).toString('hex')}`,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    name: input.name ?? existing?.name ?? null,
    version: input.version,
    scope: input.scope ?? existing?.scope ?? null,
    never_list: input.never_list ?? existing?.never_list ?? [],
    dimensions: input.dimensions ?? existing?.dimensions ?? [],
    anchors: input.anchors ?? existing?.anchors ?? [],
    boundary: input.boundary ?? existing?.boundary ?? [],
    provenance: input.provenance ?? existing?.provenance ?? null,
    baseline: input.baseline ?? existing?.baseline ?? null,
    preamble: input.preamble ?? existing?.preamble ?? null,
    changelog: [
      ...(existing?.changelog ?? []),
      { date: now.slice(0, 10), version: input.version, note: changeNote ?? (existing ? 'Updated.' : 'Profile created.') },
    ],
  };

  if (existing) {
    profiles[profiles.indexOf(existing)] = profile;
  } else {
    profiles.unshift(profile);
  }
  writeAll(profiles.slice(0, 100));
  return profile;
}

export function getProfile(profileId) {
  return readAll().find((p) => p.profile_id === profileId) ?? null;
}

export function listProfiles() {
  return readAll().map((p) => ({
    profile_id: p.profile_id,
    name: p.name,
    version: p.version,
    never_entries: p.never_list?.length ?? 0,
    dimensions: p.dimensions?.length ?? 0,
    updated_at: p.updated_at,
  }));
}

export const PROFILES_FILE = storePath();
