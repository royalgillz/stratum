---
parent: world-design
prefix: WORLD-WATER
---

# Water quality model

## Context and design philosophy

The water model gives each level's recycler an outlet quality on four channels (conductivity, total organic carbon, turbidity, iodine biocide) and gives each sector's tap the outlet quality of some minutes earlier. It serves problem 4: the in-line detector watches the outlet, people drink at the tap, and the pipe travel time between the two is the window in which a HOLD WATER alert can arrive before anyone drinks.

The least model with that window: a noisy baseline, a scripted contamination at one recycler, and a fixed travel delay per sector. The four channels follow ISS practice. GECCO shares conductivity, turbidity and a chlorine biocide channel but has no organic carbon, so the detector runs on the GECCO channels it shares.

## Outlet quality

Each channel is `baseline + w(t) × delta + noise`, clamped at 0:

- **Baseline** per channel: a constant from `docs/params.md`.
- **Noise:** Gaussian with standard deviation `NOISE` times the baseline, drawn by the Box-Muller transform `sqrt(−2 ln(1 − u1)) × cos(2π u2)`. Using `1 − u1` keeps the logarithm finite, since `rng()` can return 0. Channels draw in the order cond, toc, turb, biocide, `u1` then `u2` each: exactly eight draws per call, so the stream position never depends on the values.
- **Contamination** event `{ atH, level, rampH, durH, delta }` on one level's recycler, with `rampH ≤ durH`: with `a = atH × 3600`, weight `w` is `(t − a) / (rampH × 3600)` on `[a, a + rampH × 3600)`, 1 on `[a + rampH × 3600, a + durH × 3600)`, and 0 otherwise. A zero ramp is a step to 1 at `a`. `delta` gives the change per channel (organic carbon, conductivity and turbidity up, biocide down, because organics consume iodine). Events on the same level add.

## Tap quality

The tap in sector `sector` (0 to 3 within its level) receives its level's outlet water after `tapDelay(sector) = (PIPE_BASE + PIPE_STEP × sector)` minutes. The adapter keeps each level's outlet history and reads the value that left the recycler `tapDelay` ago; before the run has that much history, the tap holds the baseline.

## Unsafe water

`unsafe(q)` is true when organic carbon is above the ISS potable limit of 3 mg/L, or iodine is below its 1 mg/L biocidal minimum, where microbial control is lost (`docs/params.md`). Conductivity and turbidity feed the detector but set no limit of their own.

## Interface

`outlet(level, t, events, rng) → WaterQuality` (contamination events only; others are ignored), `tapDelay(sector)` in seconds, `unsafe(q)`, `BASELINE`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Channels | Conductivity, organic carbon, turbidity, iodine | Chlorine decay alone | A closed recycling loop is watched like the ISS. GECCO shares three channel types (conductivity, turbidity, a chlorine biocide), not organic carbon |
| Distribution | Fixed delay per sector | Hydraulic network with mixing | The delay is the quantity the alert must beat; mixing adds parameters and no new metric |
| Noise | Gaussian, fixed draw count | Values from GECCO replayed | Replay would score the simulation on the data the detector is scored on; fixed draws keep streams aligned |
| Unsafe test | Organic carbon and biocide limits with sources | Any channel outside a band | Only those two have published limits here |

## Open Questions & Future Decisions

### Deferred
1. Residents' "water looks wrong" reports as a second signal, clustered per level.
2. Slow drift of a recycler (a membrane wearing out) rather than a step contamination.

## References

- ISS water monitoring: https://ntrs.nasa.gov/api/citations/20170001718/downloads/20170001718.pdf
- GECCO 2018 drinking-water data: https://zenodo.org/records/3884398
- `docs/intent/witness/witness-design.md` (detector)
