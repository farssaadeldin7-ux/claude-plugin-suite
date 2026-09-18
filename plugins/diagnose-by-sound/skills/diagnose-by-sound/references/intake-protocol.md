# Intake protocol

Work through these in order. Stop as soon as the field is separated — you are not
filling in a form, you are narrowing a search.

## Tier 1 — the questions that split whole systems

These three carry the most weight in the matcher, and in reality.

### 1. What does it track?

| Test | What it means |
| --- | --- |
| Get to the speed where it happens, shift to neutral and coast | Noise **continues unchanged** → road-speed linked: wheels, tyres, bearings, driveline |
| Same test | Noise **stops or changes with engine speed** → RPM-linked: engine, accessories, belt |
| Stationary, in neutral, rev the engine | Noise **appears** → RPM-linked, confirmed |
| Same speed, uphill vs downhill | Noise only **under load** → engine load, driveline torque, mounts |

Maps to `changes_with`: `speed`, `rpm`, `load`, `none`.

This one test eliminates more candidates than everything else on this page.

### 2. What reproduces it?

Braking, turning left, turning right, over bumps, cold start only, at idle, on full
lock while stationary, only with the air conditioning on, only in reverse, only when
shifting, clutch in, clutch out.

Maps to `occurs_when`. Multiple values are fine and useful.

Pay attention to **negatives** too: "it does *not* happen when braking" is real
evidence. Mention it in your reasoning even though the tool takes positives.

### 3. What does it sound like?

Map their words onto a `character` term from `sound_vocabulary`. Common translations:

| They say | Term |
| --- | --- |
| "like a coin in a tumble dryer" | `rattle` |
| "marbles in a can", "pinking" | `rattle` (under load → detonation) |
| "nails on a chalkboard" | `screech` |
| "metal on metal" | `grind` |
| "like a jet engine spooling" | `hum` or `whine` — ask if it tracks speed or RPM |
| "a dull thud" | `thump` |
| "a clonk" | `clunk` |
| "cards in bicycle spokes" | `click` |
| "an angry bee" | `buzz` |
| "a groan when I turn" | `groan` or `moan` — ask if the engine is running |

## Tier 2 — refinement

### Pitch

`low` (felt in the chest, hard to place), `medium` (most mechanical noise),
`high` (piercing, easy to place).

### Rhythm

`continuous`, `speed_linked`, `rpm_linked`, `intermittent`, `once_per_event`, `random`.

The useful distinction: **once per wheel revolution** points at tyres, bearings and
brakes. **Once per two engine revolutions** points at valvetrain. Ask whether the
repetition rate rises with the wheels or the engine.

### Location

Treat with suspicion. Structure-borne sound travels, and people localise it badly —
which is exactly why the matcher weights location low. Record what they say, but never
let it override the `changes_with` answer.

If they are unsure, `unknown` is a legitimate answer and better than a guess.

## Tier 3 — context

- Make, model, year, mileage
- Drivetrain (FWD / RWD / AWD) — decides whether CV joints or a propshaft are even present
- Manual or automatic — decides whether clutch signatures apply
- When it started, and whether anything happened just before (kerb strike, pothole,
  recent service, wheels off, new tyres, new brakes)
- Whether it is getting worse, and how fast
- Any warning lights

"It started right after the tyres were rotated" is often the whole diagnosis.

## Tests to send someone away to run

When they cannot answer Tier 1 from memory, these are safe for a non-mechanic:

1. **Neutral coast** — at the speed where the noise happens, on a clear straight road,
   shift to neutral and let it coast. Does the noise change?
2. **Neutral rev** — parked, handbrake on, in neutral, raise the revs. Does it appear?
3. **Sway test** — at 60-80 km/h on an empty road, gentle S-curves. Does it get louder
   on one side? (Loads the opposite bearing.)
4. **Full-lock circles** — empty car park, walking pace, full lock both directions,
   then in reverse. Classic CV joint test.
5. **Air conditioning toggle** — on and off at idle, listening for the noise to follow.
6. **Cold-start listen** — first thirty seconds of the next cold start, window down.
7. **Bounce test** — push down hard on each corner and release. Should settle in one
   rebound; a clunk while bouncing is suspension.

Give them one or two at a time, not all seven.

## When to stop asking

Stop when `separation.top_two_gap` is comfortably above 15 and
`evidence_weight_percent` is above 60. Past that point you are collecting detail
rather than resolving ambiguity, and the next move is a physical test, not another
question.
