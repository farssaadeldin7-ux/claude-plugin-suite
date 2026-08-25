---
name: acoustic-signal-processing
description: >
  This skill should be used when a vehicle noise is buried in background sound and needs to be
  isolated before it can be diagnosed — a recording muddied by wind, road roar, music or
  conversation, several noises happening at once, "listen to this clip and tell me what you
  hear", or a rattle, whine or knock that only stands out sometimes. It covers capture
  technique, elimination tests that silence everything except the suspect, reading a
  spectrogram, and translating the isolated signal into the diagnose vocabulary.
metadata:
  version: "0.1.0"
---

# Acoustic Signal Processing

Separate the mechanical signal from everything else, then hand the clean observation to
`diagnose`.

Most failed noise diagnoses fail before the diagnosis starts: the person is describing a
mixture — wind, tyres, music, two faults at once — and the description matches nothing
cleanly. The discipline here is subtraction. Remove sources one at a time until the noise
of interest is the loudest thing left, and only then characterise it.

## Recognise the three families first

Rattles, whines and knocks behave differently in both time and frequency, and telling the
families apart is the fastest first cut. The full band-by-band detail is in
`references/frequency-bands.md`:

- **Rattle** — trains of short broadband impacts. Excited by surface, not by any single
  rotation rate; goes silent on smooth tarmac. Loose things rattle; worn things knock.
- **Whine** — a tone with pitch. It has one defining property to establish: what the pitch
  *tracks* — road speed, engine RPM, or a pump that runs regardless.
- **Knock** — periodic low impacts whose rate tracks a rotation. The rate is the clue:
  every crank revolution, half-crank (four-stroke firing), once per wheel revolution, or
  once per CV-joint articulation in a turn.

## Capture technique

Garbage capture cannot be filtered into a good signal afterwards. For any recording:

1. **Kill the maskers before recording**: HVAC fan off, radio off, windows up, phone out of
   the wind. Wind across the mic is the loudest thing in most owner recordings and it is
   pure broadband masking.
2. **Record the contrast, not just the noise.** Ten seconds without the noise, then the
   noise, in one clip. The difference is the signal; a clip that is all noise has no
   baseline to subtract.
3. **Get the mic near the suspect.** Sound level falls fast with distance in an engine bay.
   Cabin, engine bay and each wheel arch are different recordings, not one.
4. **Capture the behaviour that identifies it**: a steady hold at the RPM or speed where it
   is loudest, plus a slow sweep through it, beats a random drive.

## The elimination protocol

The ordered subtraction sequence — which system each test silences, and what remaining
noise then means — is in `references/isolation-protocol.md`. The spine of it:

1. **Stationary vs moving** splits the field in half before anything else.
2. **Neutral coast** at the speed where it happens: still there means road-speed linked
   (wheels, tyres, driveline); gone means engine or load side.
3. **Rev in neutral, stationary**: reproduces RPM-linked sources with the whole road side
   silent.
4. **Load one system at a time**: brakes lightly, full-lock turns both ways, AC compressor
   on and off, accessories by briefly running without the serpentine belt where safe.
5. **Probe physically** when the area is known: mechanic's stethoscope on bearings and
   pumps, a long screwdriver as a probe, chassis ears for road tests. Never probe anything
   rotating — the physical safety rules in the diagnose-by-sound skill (its
   safety-and-limits reference) apply in full.

Each test that silences the noise names the system that contains it. Two eliminations
usually beat any amount of careful listening to the mixture.

## Reading a spectrogram

Any free spectrogram app turns a phone clip into something inspectable. Three shapes cover
most of what matters:

- **Vertical stripes** — impacts. Regularly spaced stripes are a knock; count stripes per
  second and compare against engine and wheel rotation rates. Irregular bursts over bumps
  are a rattle.
- **Horizontal or sloping lines** — a whine. A line that slopes with vehicle speed is on
  the road side; one that follows RPM as you rev is on the engine side. Parallel stacked
  lines are harmonics of one source, not several sources.
- **Full-height wash** — broadband masking: wind, road roar, mic handling. If wash
  dominates, fix the capture; do not interpret through it.

The frequency-to-order arithmetic — matching a line or stripe rate to crank speed, wheel
speed, or a specific accessory ratio — is worked through in
`references/frequency-bands.md`. Treat all figures there as bands, not thresholds: phone
microphones and car interiors shift absolute levels, but the *relationships* (what the
sound tracks, how components space) survive.

## Hand off cleanly

The output of this skill is the input to `diagnose`: the isolated noise described in the
controlled vocabulary — `character`, `pitch`, `rhythm`, `occurs_when`, `location`,
`changes_with` — with the maskers gone from the description. State what was eliminated as
well as what was observed ("still there coasting in neutral, gone on smooth tarmac") —
elimination results map straight onto `changes_with` and `occurs_when` terms and are worth
more than adjectives.

If two distinct noises survive isolation, run `diagnose` twice with two clean
observations. One mixed observation matching nothing is the failure mode this skill exists
to prevent.

## Limits

- A phone clip supports the diagnosis; it does not replace the elimination drive. When the
  spectrogram and the elimination tests disagree, trust the tests.
- No absolute level read from a consumer mic means anything. Louder-than-last-week from
  the same phone in the same mount is meaningful; "it measures 74 dB" is not.
- If the noise cannot be reproduced under controlled conditions, say so and stop —
  characterising a memory of a noise produces confident nonsense.

## References

- `references/frequency-bands.md` — where rattles, whines and knocks sit in frequency and
  time, and the order arithmetic that ties a spectrogram line to a rotating part
- `references/isolation-protocol.md` — the elimination sequence in full: each test, what it
  silences, and what a result rules in or out
