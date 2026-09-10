/**
 * Destination specs: length, aspect, safe areas, captions and pacing per
 * platform, ported from the auto-clip skill. Specifications change; the numbers are
 * current-generation defaults and anything load-bearing should be checked
 * before a large batch. The pacing and caption rules move much more slowly
 * than the pixel dimensions.
 * Source: skills/auto-clip/SKILL.md, step 4 (Format for TikTok / Reels / Shorts).
 */

export const SPEC_CAVEAT =
  'Specifications change; treat the numbers as current-generation defaults and check anything ' +
  'load-bearing before a large batch. The pacing and caption rules move much more slowly than the ' +
  'pixel dimensions.';

export const DESTINATIONS = {
  youtube_shorts: {
    label: 'YouTube Shorts',
    length_seconds: { min: 20, max: 60 },
    aspect: '9:16',
    frame: '1080×1920',
    sound_default: 'on',
    payoff_promised_by: '2s',
    group: 'vertical_short_form',
  },
  instagram_reels: {
    label: 'Instagram Reels',
    length_seconds: { min: 20, max: 60 },
    aspect: '9:16',
    frame: '1080×1920',
    sound_default: 'on',
    payoff_promised_by: '2s',
    group: 'vertical_short_form',
  },
  tiktok: {
    label: 'TikTok',
    length_seconds: { min: 20, max: 60 },
    aspect: '9:16',
    frame: '1080×1920',
    sound_default: 'on',
    payoff_promised_by: '2s',
    group: 'vertical_short_form',
  },
  linkedin: {
    label: 'LinkedIn native',
    length_seconds: { min: 45, max: 90 },
    aspect: '1:1 or 4:5',
    frame: '1080×1080 / 1080×1350',
    sound_default: 'off',
    payoff_promised_by: '3s',
    group: 'linkedin',
  },
  x: {
    label: 'X',
    length_seconds: { min: 30, max: 140 },
    aspect: '16:9 or 1:1',
    frame: '1280×720 / 1080×1080',
    sound_default: 'off',
    payoff_promised_by: '3s',
    group: 'x',
  },
  youtube_chapter: {
    label: 'YouTube chapter',
    length_seconds: { min: 180, max: 480 },
    aspect: '16:9',
    frame: '1920×1080',
    sound_default: 'on',
    payoff_promised_by: 'first 15s',
    group: 'youtube_chapter',
  },
};

export const FLOOR_NOTE =
  'The 20-second floor on short-form is not arbitrary. Below it, a clip can be complete but rarely ' +
  'has room for both a promise and a payoff, and completion-rate advantages at very short lengths do ' +
  'not compensate for having said nothing.';

export const GROUP_DETAIL = {
  vertical_short_form: {
    applies_to: 'YouTube Shorts, Instagram Reels, TikTok',
    length:
      '20–60s. The sweet spot for a talking-head clip with one idea is 30–45s. Do not stretch a ' +
      '28-second idea to 55 seconds for the sake of a length target.',
    first_2_seconds:
      'The payoff must be promised, not delivered. A quoted line that sets up a question is the ' +
      'correct opening. What does not work: a logo sting, the host saying the guest\'s name, "welcome ' +
      'back to the show", a slow zoom on someone inhaling.',
    safe_areas:
      'Assume roughly the top 180px and bottom 420px of a 1920px-tall frame are covered by platform ' +
      'UI, and the right 160px by the action rail. TikTok\'s caption block intrudes highest — keep ' +
      'burned-in text out of the bottom 500px there. Faces should sit in the upper-middle third.',
    reframing_risk:
      'A two-shot 16:9 podcast frame does not crop to 9:16 without a decision: either ' +
      'speaker-switched punch-ins, or a stacked two-box layout. Interruption-heavy clips (archetype 5) ' +
      'punish automatic speaker-follow crops, which flip frame mid-syllable. Flag any multi-speaker ' +
      'clip in the cut list so the editor chooses deliberately.',
    captions:
      'Burned in, always. 2–4 words per card, high contrast, no more than two lines. Do not caption ' +
      'filler you have trimmed audibly — desynchronised captions read as broken.',
    pacing:
      'A visual change every 3–5 seconds: punch-in, b-roll, a text card, a cut on a sentence ' +
      'boundary. A static single frame for 45 seconds loses viewers even when the audio is excellent.',
    ending:
      'End on the last word of the payoff. Trailing silence and end cards both cost completion, and ' +
      'completion is the metric these platforms rank on hardest.',
  },
  linkedin: {
    applies_to: 'LinkedIn native',
    length:
      '45–90s. Longer works here than elsewhere in short-form, because the audience arrives with more ' +
      'context and more patience. Beyond 90s, drop-off gets steep.',
    aspect: '4:5 takes the most feed height, 1:1 is safer for reuse. 9:16 is supported but crops in feed preview.',
    sound:
      'Sound is off by default. Captions are not an accessibility nicety here, they are the delivery ' +
      'mechanism. Assume the entire clip is read, not heard.',
    first_line:
      'The post\'s first line does real work. Feed truncation lands around 140 characters with a "see ' +
      'more". The first line is the hook and must not restate the video\'s on-screen title. Never open ' +
      'with "Full episode in bio" or a link — first-line links suppress reach and waste the only line ' +
      'most people read.',
    pacing:
      'Slower than TikTok. A visual change every 6–8 seconds is enough. Aggressive jump-cutting reads ' +
      'as out of place in this feed.',
    what_travels:
      'Practical how-tos (archetype 7), confessions with a lesson (archetype 3), and contrarian ' +
      'claims about work. What does not: anything that needs the viewer to already like the host.',
  },
  x: {
    applies_to: 'X',
    length:
      '30–140s. The hard ceiling for most accounts sits at 2:20; verified tiers allow longer, but a ' +
      'clip over 140s on X is a clip that should have been a Short.',
    aspect: '16:9 works because timeline playback is small and native. 1:1 gains height.',
    sound:
      'Sound off, autoplay on. The clip starts playing before anyone chose to watch it, so the first ' +
      'frame must contain readable text.',
    framing:
      'The quote-post does the framing. This is the one destination where some context can live ' +
      'outside the clip, in your own post text. Do not use this as an excuse to ship a clip that ' +
      'fails the self-contained test — the post text is seen by your followers and the clip travels ' +
      'beyond them.',
    what_travels:
      'Disagreement (archetype 5) and the contrarian claim (archetype 1). Confessions do less well; ' +
      'the room is less generous.',
  },
  youtube_chapter: {
    applies_to: 'YouTube chapter or long-form segment',
    length:
      '3–8 minutes. This is a different product from a clip: a complete argument with a beginning, a ' +
      'development and a conclusion, not a moment.',
    selection:
      'Score chapters on whether the whole segment sustains, not on context-independence of a single ' +
      'line. A chapter may legitimately reference earlier material, because a viewer who clicked a ' +
      'chapter is inside the episode.',
    titling:
      'Use the segment\'s central claim, not a question. Chapter titles are scanned in a list, and ' +
      'questions in a list all look alike.',
    retention_shape:
      'Expect a large drop in the first 30 seconds regardless of quality. Judge a chapter on the ' +
      'slope after the first 30 seconds, not on the initial fall.',
  },
};

export const CROSS_POSTING =
  'Re-export per destination. Do not upload one 9:16 file everywhere. Platform-native re-encoding ' +
  'punishes watermarked and letterboxed uploads, and a TikTok watermark on a Reel is visible to both ' +
  'the algorithm and the audience. Where the same clip goes to more than one destination, change the ' +
  'length to that destination\'s band and rewrite the caption\'s first line — the title can stay.';

export function destinationFor(id) {
  return DESTINATIONS[String(id ?? '').trim().toLowerCase()] ?? null;
}

/**
 * Which destinations' length bands contain a duration. Band membership only —
 * whether the clip suits the destination is a judgement this does not make.
 */
export function destinationFit(seconds) {
  const fits = Object.entries(DESTINATIONS)
    .filter(([, d]) => seconds >= d.length_seconds.min && seconds <= d.length_seconds.max)
    .map(([id, d]) => ({ id, label: d.label, band: `${d.length_seconds.min}–${d.length_seconds.max}s` }));

  return {
    duration_seconds: seconds,
    fits_length_band_of: fits,
    ...(fits.length ? {} : { no_fit_note: 'No destination\'s length band contains this duration.' }),
    ...(seconds < 20 ? { floor_note: FLOOR_NOTE } : {}),
    note:
      'Match natural length to destination rather than stretching or crushing it. A 25-second ' +
      'contrarian claim is a Short — do not pad it to 90 seconds; cut a different segment for LinkedIn.',
  };
}
