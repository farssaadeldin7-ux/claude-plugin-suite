/**
 * The genre-axis table, ported from
 * skills/five-minute-fluency/references/genre-axes.md.
 *
 * Each genre has a primary skill axis — the dimension along which rating
 * actually moves for most players. Advice off that axis can be entirely
 * correct and still change nothing. The patch_sensitive lists are the items
 * that must be asked from the player or marked [verify] on a sheet; the
 * structural_safe lists survive every patch.
 */

export const GENRES = {
  moba: {
    label: 'MOBA',
    axis: 'Macro and rotations — the map as a clock, not a series of fights. Wave state, '
      + 'objective timers, and where the enemy jungler or roamer is.',
    plateau: 'The player treats the map as a sequence of fights. They can win a lane and still '
      + 'lose, because the lane was never the resource being contested.',
    drill: 'Under 10 minutes: open a replay of one loss. Pause every 60 seconds and answer out '
      + 'loud, before unpausing: (a) what is the next objective timer, (b) where was the enemy '
      + 'jungler last seen, (c) which wave is pushing where. Three pauses is enough. Most players '
      + 'get (b) wrong every time.',
    patch_sensitive: [
      'item costs and build paths',
      'ability numbers',
      'jungle camp and objective timers',
      'respawn timings',
      'any tier list',
    ],
    structural_safe: [
      'wave state',
      'recall timing',
      'the principle that objectives are what fights are for',
      'vision placed before an objective rather than during it',
    ],
  },

  hero_shooter: {
    label: 'Hero shooter',
    axis: 'Ult economy. Ultimates are a currency; the question is never "is mine up" but '
      + '"is mine up and theirs is not".',
    plateau: 'The player spends the ultimate the moment it charges, into a fight it did not need '
      + 'to win, and is then without it for the fight that mattered.',
    drill: 'One full match tracking exactly one enemy player\'s ultimate. Say out loud when you '
      + 'think it is up. Check against reality at the end of each fight. One player, one match — '
      + 'tracking all of them is a later skill.',
    patch_sensitive: [
      'ultimate charge rates and costs',
      'hero kit numbers',
      'cooldowns',
      'role queue and composition rules',
      'hero availability and tiers',
    ],
    structural_safe: [
      'hold the ultimate for a trade',
      'group before contesting',
      'the principle that a fight lost cheaply beats a fight lost expensively',
    ],
  },

  tactical_fps: {
    label: 'Tactical FPS',
    axis: 'Utility and trade discipline. Rounds are won by numbers and information, not by aim.',
    plateau: 'The player wins duels and loses rounds. They take fights where nobody can trade '
      + 'them, and they enter sites without utility because the entry felt available.',
    drill: 'One full match with a single constraint — never take a duel where a teammate cannot '
      + 'trade you within roughly two seconds. Count the violations. Ten in a match is normal at '
      + 'first; the count itself is the training.',
    patch_sensitive: [
      'economy numbers',
      'buy thresholds',
      'agent or operator kits',
      'weapon prices',
      'map pool and map layouts after a rework',
    ],
    structural_safe: [
      'trade spacing',
      'crossfires',
      'playing for information on a lost round',
      'saving as a decision rather than a habit',
    ],
  },

  fighting: {
    label: 'Fighting game',
    axis: 'Neutral and frame data. Which button is safe, what to do on wake-up, and what your '
      + 'opponent is actually allowed to do after their blockstring.',
    plateau: 'Big combos, no defence. Mashes on wake-up, never techs throws, has no idea which of '
      + 'the opponent\'s strings is a true block string and which is a gap.',
    drill: 'Five minutes in training mode with the opponent\'s most common blockstring set to '
      + 'record and looped. Practise the one correct answer — block, tech, or press — until it is '
      + 'reflex. One string, one answer, five minutes.',
    patch_sensitive: [
      'all frame data',
      'damage and scaling',
      'meter and drive-gauge economy',
      'character rankings',
    ],
    structural_safe: [
      'the habit of checking frame data rather than guessing',
      'the concept of a true blockstring',
      'wake-up discipline',
      'throw teching',
    ],
  },

  rts_autobattler: {
    label: 'RTS / auto-battler',
    axis: 'Build order and APU — actions per unit of purpose. Not raw speed. Economy up-time, '
      + 'supply or cap blocks, gold and interest curve, scouting.',
    plateau: 'The player knows one build and abandons it the moment they are pressured, ending '
      + 'with a worse economy than either committing or adapting would have produced.',
    drill: 'Three games executing only the first five minutes of one build correctly, ignoring '
      + 'whether the game is won. Record one number afterwards: seconds spent supply-blocked, or '
      + 'gold left unspent at the end of a round. Drive that number down before adding anything.',
    patch_sensitive: [
      'unit and upgrade costs',
      'interest thresholds',
      'pool odds and shop rates',
      'map or board rotations',
      'any build order sourced from before the current patch',
    ],
    structural_safe: [
      'scouting on a fixed cadence',
      'not floating resources',
      'the principle that a committed plan beats a half-abandoned one',
    ],
  },

  racing: {
    label: 'Racing',
    axis: 'Braking points and line consistency. Lap time is lost in corner entry, and consistency '
      + 'is worth more than a single fast lap.',
    plateau: 'One quick lap and a scattered stint. Brakes too early, coasts, then gets back on '
      + 'the throttle late — the coast is where the time goes.',
    drill: 'Ten laps working one corner only, with a fixed visual braking marker chosen before '
      + 'you start. Ignore the rest of the lap. Target: sector variance under roughly 0.3 seconds '
      + 'across the ten. Consistency first, then move the marker.',
    patch_sensitive: [
      'tyre model and physics changes',
      'balance of performance',
      'fuel and damage settings',
      'setup metas',
      'track surface updates',
    ],
    structural_safe: [
      'fixed braking markers',
      'slow in and fast out',
      'the principle that lap-time variance is the thing to reduce first',
    ],
  },
};

/** What to do when the game is not one of the six. */
export const UNLISTED_GAMES = {
  rule: 'Ask which axis the game most resembles rather than inventing one.',
  mappings: [
    'Extraction shooters lean tactical FPS with an added risk-management axis.',
    'Battle royales lean tactical FPS early and MOBA-style tempo late.',
    'Card games map onto RTS: opener knowledge, resource curve, and committing to a plan.',
  ],
};

/** The pre-send check the reference gives for a finished sheet. */
export const AXIS_CHECK =
  'If none of the three changes sit on the genre\'s primary axis, either the diagnosis is '
  + 'unusual and the sheet should say why, or the sheet has drifted.';

export function genreFor(id) {
  return GENRES[String(id ?? '').trim().toLowerCase()] ?? null;
}
