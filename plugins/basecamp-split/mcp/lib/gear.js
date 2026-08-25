/**
 * The gear taxonomy, ported from references/gear-taxonomy.md: the shared vs
 * personal classification test, the three tags, the typical classification
 * table, the seven-system single-point-of-failure table, splittable items and
 * the duplication audit. Data only — the judgement of whether a particular
 * backup is any good stays with the skill.
 */

export const CLASSIFICATION_TEST = {
  shared_if_all_three_hold: [
    'It serves more than one person at the same time (a tent, a stove, a map).',
    'A second copy adds no capability — only redundancy.',
    'Nobody needs it in their own hands at a moment when they might be separated.',
  ],
  personal_if_any_one_holds: [
    'It is fitted or sized to the body — boots, harness, sleeping bag, waterproofs.',
    'It keeps one person alive on their own if the group splits — headtorch, whistle, personal water bottle, personal warm layer, personal medication.',
    'It is hygiene or comfort — nobody shares a spoon at 4°C and a shared toothbrush is not a saving.',
    'Preference is load-bearing: sleep mats and packs are personal even though they look poolable.',
  ],
  default:
    'Everything else is a judgement call. Default it to personal — a wrongly-personal item costs grams, a wrongly-shared item costs somebody their sleep.',
};

export const TAGS = {
  SHARED: {
    meaning: 'One instance for the whole group',
    rule: 'Exactly one carrier. A second instance is dead weight unless justified',
  },
  'REDUNDANT-SHARED': {
    meaning: 'Deliberately duplicated; the duplication is the backup',
    rule: 'Minimum two instances, in different packs, different people',
  },
  PERSONAL: {
    meaning: 'One per person, never pooled',
    rule: 'One line per person, no exceptions for weight',
  },
};

export const TAG_NOTE = 'Tag every line. A line with no tag is the line that gets forgotten or doubled.';

export const TYPICAL_CLASSIFICATION = [
  { item: 'Tent / tarp / group shelter', tag: 'SHARED', note: 'Splittable — see splittable_items' },
  { item: 'Sleeping bag, mat, pillow', tag: 'PERSONAL', note: 'Temperature rating is individual' },
  { item: 'Stove', tag: 'REDUNDANT-SHARED', note: 'Two minimum for any group past a day trip' },
  { item: 'Fuel', tag: 'SHARED', note: 'Divide across packs; dense and easy to balance' },
  { item: 'Cook pot, lid, windshield', tag: 'SHARED', note: 'One pot per 2–3 people is the practical ratio' },
  { item: 'Eating kit — bowl, spoon, mug', tag: 'PERSONAL', note: null },
  { item: 'Water filter or purifier', tag: 'REDUNDANT-SHARED', note: 'Primary plus a different-method backup' },
  { item: 'Water bottles / bladder', tag: 'PERSONAL', note: 'Group carries no communal water' },
  { item: 'Group first aid kit', tag: 'SHARED', note: 'Plus a personal small kit each' },
  { item: 'Personal medication', tag: 'PERSONAL', note: 'Never pooled, never carried by someone else' },
  { item: 'Map and compass', tag: 'REDUNDANT-SHARED', note: 'Two people minimum, and both must be able to use them' },
  { item: 'GPS / phone navigation', tag: 'SHARED', note: 'Counts as a backup only if it has offline maps and power' },
  { item: 'Satellite messenger / PLB', tag: 'SHARED', note: 'See the communications system row' },
  { item: 'Repair kit', tag: 'SHARED', note: 'The single most commonly forgotten group item' },
  { item: 'Headtorch', tag: 'PERSONAL', note: 'Plus spare batteries, personal' },
  { item: 'Rope, slings, hardware', tag: 'SHARED', note: 'Technical kit is its own plan' },
  { item: 'Trowel, waste bags, sanitiser', tag: 'Mixed', note: 'Trowel SHARED, bags and sanitiser PERSONAL' },
  { item: 'Power bank', tag: 'PERSONAL', note: 'Unless one device is designated group comms' },
];

/**
 * The seven systems. Every row needs a named owner and a stated backup owned
 * by a different person and carried in a different pack. A blank is a blocker.
 */
export const SPOF_SYSTEMS = {
  shelter: {
    label: 'Shelter',
    primary: 'Tents sized to the party',
    acceptable_backup: 'A tarp, a bothy bag, or spare capacity in another tent',
    not_a_backup: '"We\'d squeeze in" with no measured space',
  },
  water_treatment: {
    label: 'Water treatment',
    primary: 'Filter, gravity or squeeze',
    acceptable_backup: 'A different method: chemical tablets, or the ability to boil',
    not_a_backup: 'A second identical filter in the same pack',
  },
  fire_stove: {
    label: 'Fire / stove',
    primary: 'Primary stove and fuel',
    acceptable_backup: 'Second stove, ideally a different fuel type; plus two ignition sources',
    not_a_backup: 'Spare fuel with no second burner',
  },
  navigation: {
    label: 'Navigation',
    primary: 'Paper map and compass, carried by a competent user',
    acceptable_backup: 'A second map set, or a GPS with offline maps and independent power',
    not_a_backup: 'One phone with a signal-dependent app',
  },
  first_aid: {
    label: 'First aid',
    primary: 'Group kit with a named owner who has training',
    acceptable_backup: 'A second person who knows where it is and can use it',
    not_a_backup: 'A kit nobody has opened',
  },
  communications: {
    label: 'Communications',
    primary: 'Satellite messenger or PLB, registered and charged',
    acceptable_backup: 'A charged phone with the local emergency number and a known coverage point',
    not_a_backup: 'A phone on 12% at the trailhead',
  },
  repair: {
    label: 'Repair',
    primary: 'Repair kit: pole splint, tape, cord, needle, buckle, patches, multitool',
    acceptable_backup: 'A second multitool and duct tape wrapped on a pole or bottle',
    not_a_backup: 'Optimism',
  },
};

export const SPOF_RULES = [
  'Primary and backup never share a pack. If one pack goes into a river, the group should lose capability, not a system.',
  'Never split a system so that no single pack can use it. Stove in one pack and the only fuel in another is fine while the group is together and useless the moment it is not. Each subgroup that could plausibly separate needs a working set.',
  'An owner is a person who knows they own it. Assign it out loud, in writing, and confirm it was read. In practice, most missing group gear was assigned to someone who never saw the message.',
  'Competence is part of the check. A compass owned by someone who cannot take a bearing is not a navigation system. Ask.',
];

export const SPLITTABLE_ITEMS = [
  { item: 'Tent', splits_into: 'Inner, fly, poles, pegs', keep_together: 'Poles and pegs with the fly if possible; a fly and poles can be pitched alone' },
  { item: 'Stove system', splits_into: 'Burner, pot set, windshield, fuel', keep_together: 'Burner with one ignition source' },
  { item: 'Food', splits_into: 'Per-meal bags, per-day bags', keep_together: 'Reserve day stays whole and stays with one nominated person' },
  { item: 'Water treatment', splits_into: 'Filter, spare cartridge, chemical backup', keep_together: 'Filter with its own bag; a frozen filter is a dead filter, so it sleeps inside' },
  { item: 'First aid', splits_into: 'Group trauma module, group minor module', keep_together: 'Trauma module with the trained owner' },
  { item: 'Rope', splits_into: 'Rope, hardware', keep_together: 'Rope with someone who can rig it' },
];

export const DUPLICATION_AUDIT = {
  when: 'For each SHARED line where the count exceeds one, ask:',
  questions: [
    'Did somebody decide on this duplicate, or did two people both assume?',
    'What does the second one weigh, and what does it buy?',
    'If it is real redundancy, retag it REDUNDANT-SHARED and put it in another pack.',
    'If not, delete it and tell the owner it is off the list — before they pack it.',
  ],
  rerun: 'Run this audit again 48 hours before departure. Late additions are where duplication comes back.',
};
