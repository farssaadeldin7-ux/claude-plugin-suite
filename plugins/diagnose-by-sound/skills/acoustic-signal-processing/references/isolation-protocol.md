# The isolation protocol

Subtraction, in order. Each test silences a set of sources; whether the noise survives the
test is one bit of hard evidence. Run the cheap tests first, record the result of every
test (including the ones that changed nothing), and stop as soon as one system is left.

Safety first, always: handbrake and wheel chocks for stationary running, no loose
clothing near a running engine, no probing anything that rotates, jack stands — never a
jack alone — under a raised car. The main skill's `references/safety-and-limits.md` is not
optional reading.

## Stage 1 — cost nothing, sitting in the car

| Test | Silences | If the noise survives |
| --- | --- | --- |
| Engine off, key on, sit quietly | Everything mechanical | Electrical (fuel pump prime, relays) or interior trim settling |
| Idle, parked, HVAC off, radio off | Road, wind, tyres, driveline | Engine, accessories, exhaust |
| Rev slowly to ~3,000 in neutral, parked | Whole road side, still | RPM-linked: engine internals, accessories, exhaust |
| HVAC fan through its speeds | — (adds one source at a time) | Rate follows fan speed → blower motor or debris in the box |
| AC compressor on/off at idle | — | Appears with AC → compressor, clutch, or belt under the extra load |

If the noise is fully reproducible parked, stay parked — the road adds maskers and risk
for no information.

## Stage 2 — moving, one variable at a time

| Test | What it separates | Reading |
| --- | --- | --- |
| Neutral coast through the speed where it happens | Road-speed side from engine side | Unchanged coasting → wheels, tyres, driveline, suspension. Gone → engine or load |
| Same road speed in two gears | Confirms the coast result | Pitch follows speed → road side. Pitch follows RPM → engine side |
| Smooth tarmac vs coarse chip vs bumps | Excitation | Only on rough surface → rattle (loose component). Steady on all surfaces → rotating source |
| Gentle S-turns at steady speed | Wheel bearings, CV joints | Louder loading left, quieter loading right (or the reverse) → bearing on the loaded side. Clicking only at angle → CV joint |
| Light brake drag at speed | Brakes vs everything else | Changes with light pedal → pads, rotors, shields |
| Throttle on / off at steady speed | Load-linked driveline | Clunk or boom only on load reversal → mounts, U-joints, diff lash |
| Windows up vs cracked | Wind masking and buffeting | Large change → aeroacoustic, not mechanical |

## Stage 3 — physical probing, area known

- **Mechanic's stethoscope** on the housing of each suspect in turn — alternator, tensioner,
  idler, water pump, power steering pump. Bearings roar through the probe long before they
  are loud in the bay. Probe housings only, never the pulley or belt.
- **Long screwdriver, tip on the component, handle to the ear cartilage** — the traditional
  stethoscope. Same rules.
- **Chassis ears** (clamp-on remote microphones) for noises that only appear on the road:
  one channel per suspect corner, switch between them while driving the reproduction
  condition.
- **Belt-off test** where the engine can safely run briefly without the serpentine belt:
  noise gone → it is in a driven accessory, and the stethoscope round then picks which one.
  Minutes only — no water pump means no cooling on most engines.
- **Rattle hunt, car static**: engine off, press and shake heat shields, exhaust hangers,
  trim panels, roof bars. A hand that stops the noise found the noise.

## Recording the result

Write down every test and its outcome in elimination form — "survives neutral coast",
"gone on smooth tarmac", "unchanged with AC" — because these map directly onto the
`diagnose` vocabulary: coast results feed `changes_with`, surface and manoeuvre results
feed `occurs_when`, and probe results feed `location`. A finding that a test *didn't*
change the noise is evidence too, and worth passing along; it is what kills lookalike
candidates in the ranking.
