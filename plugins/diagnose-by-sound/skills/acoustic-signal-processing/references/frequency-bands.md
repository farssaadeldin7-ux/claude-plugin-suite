# Frequency bands and order arithmetic

Every figure here is a band, not a threshold. Consumer microphones, cabin acoustics and
recording apps shift absolute levels and colour the spectrum; what survives is the
*relationships* — what a sound tracks, how its harmonics space, how its rate compares to a
rotation. Use the bands to orient, and the arithmetic to confirm.

## Where the three families live

| Family | Time behaviour | Typical energy | Signature on a spectrogram |
| --- | --- | --- | --- |
| Knock (rod, main bearing) | Periodic impacts tracking crank rate | 100–600 Hz impact energy, felt as much as heard | Evenly spaced vertical stripes; spacing shortens as RPM rises |
| Piston slap | Impacts, worst cold, fades warm | 200–800 Hz | Stripes present at cold idle that thin out with temperature |
| Injector / valvetrain tick | Light impacts at half-crank rate (four-stroke) | 2–8 kHz, sharp | Fine, fast stripes riding above the engine's tonal stack |
| Rattle (heat shield, trim, exhaust hanger) | Irregular impact bursts excited by surface or resonance | 1–8 kHz broadband bursts | Ragged vertical smears over bumps; silent on smooth tarmac |
| Whine — gear (diff, gearbox, power steering) | Continuous tone, load-sensitive | 300 Hz – 3 kHz fundamental | Clean horizontal/sloping line, often with 2–3 harmonics |
| Whine — alternator / accessory | Tone tracking RPM through the pulley ratio | 1–5 kHz | Line that moves with revving in neutral, stationary |
| Wheel bearing | Rough growl or drone tracking road speed | 300–800 Hz, broad rather than pure | Fuzzy band that slopes with speed and loads up in curves |
| Belt squeal / chirp | Tonal squeal (slip) or rhythmic chirp (misalignment) | 1–4 kHz | Intense line appearing at rev changes or with AC engagement |
| Brake squeal | High pure tone during application | 2–10 kHz | Very clean line only while braking |
| Exhaust leak | Puffing/ticking at firing rate, raspy broadband | 100 Hz – 2 kHz | Stripes at firing rate plus wash, loudest cold |
| Wind / road roar (maskers) | Continuous, speed-dependent | Broadband, strongest below 1 kHz | Full-height wash that drowns structure |

## Order arithmetic

A rotating part produces energy at integer multiples ("orders") of its rotation rate.
This is how a spectrogram line or stripe rate gets tied to a specific part:

- **Crank rate**: `RPM / 60` = revolutions per second. 3,000 RPM → 50 Hz.
- **Firing rate** (four-stroke): `RPM / 60 × cylinders / 2`. A four-cylinder at 3,000 RPM
  fires 100 times a second — stripes or a tone at ~100 Hz that tracks revving is
  combustion-related (exhaust pulse, mount transmitting firing shake).
- **Half-crank (camshaft) rate**: `RPM / 120`. Valvetrain ticks count at this rate.
- **Accessory rate**: crank rate × pulley ratio. Alternators typically spin 2–3× crank —
  a whine near 2–3× the crank line is on the accessory belt, not in the block.
- **Wheel rate**: `speed / tyre circumference`. A 2-metre-circumference tyre at
  100 km/h turns ~14 times a second — clicks or thumps at ~14 Hz that track road speed
  and not RPM are at the wheel: tyre flat spot, stone in tread, bent wheel.
- **CV joint**: clicks once per articulation cycle, so the rate tracks wheel speed but
  the sound appears only under steering angle.

Two lines that keep a fixed ratio as everything speeds up are the same source (harmonics).
Two lines that move independently are two sources — treat them as two observations.

## Practical separations

- **Same pitch at 50 km/h in third and fifth gear** → tracks road speed → wheels, tyres,
  driveline. Pitch changes with the gear → engine side.
- **Stripes at idle: count them.** ~12/s on a four-cylinder idling at 700 RPM is
  half-crank (valvetrain); ~23/s is firing rate; ~12 vs ~23 is countable by ear in a
  slowed-down recording.
- **Tone appears revving in neutral, parked** → engine or accessory, never wheels or
  driveline. It disappears when the belt is briefly run off (where safe) → accessory.
- **Growl that loads up steering one way** → wheel bearing on the outside of the curve —
  the classic S-turn test from the main skill.
