---
parent: high-level-design
prefix: TRACK
---

# Tracker

## Context and design philosophy

The tracker turns raw audio samples into a statement about the grid: how far its frequency has moved from normal, and whether that is a warning. It serves problem 1 (warn before power cuts out). It is pure computation over sample blocks. The audio adapter (`src/audio`) feeds it from the microphone and the ENF-WHU harness feeds it from files, and both get the same numbers.

It prefers saying nothing to saying something wrong. Whenever the estimate is not trustworthy it reports NO HUM, never a frequency.

## Estimator

The sample rate is fixed when the tracker is created. The hop is `round(0.5 × rate)` samples and the window is `2 × rate` samples. The first reading comes once a full window has arrived, then one per hop, and the readings do not depend on how the samples were split into blocks.

For each reading, the tracker applies a Hann window and searches the tone band `h × (f0 ± w)`:

1. **Coarse bank:** Goertzel power every 0.25 Hz across the band, plus a 2 Hz guard zone beyond each edge.
2. **Fine bank:** Goertzel power every 0.02 Hz across ±0.16 Hz around the coarse peak.
3. **Interpolation:** a parabola through the log power of the fine peak and its two neighbours. The vertex offset is clamped to ±0.5 bins, and a flat top counts as offset 0.

The tone frequency divided by `h` is the grid frequency. **Signal-to-noise** is the fine peak power over the median power of the coarse-bank bins lying more than 1 Hz (tone frequency) from the coarse peak, in dB. Those bins are outside the Hann main lobe, so the figure measures noise, not the peak's own skirt. The band must therefore be at least ±3 Hz in tone frequency.

**A reading is NO HUM** when any of these holds:
- signal-to-noise is below 13 dB;
- any value is not finite (for example, digital silence);
- the coarse peak lies in a guard zone (the tone is outside the band).

A tone just outside the band leaks into it, and its strongest in-band bin is not necessarily the outermost one; only searching beyond the edge tells "near the edge" from "outside".

| Parameter | Phone (in-world grid) | ENF-WHU replay | Source |
| --- | --- | --- | --- |
| Nominal grid frequency `f0` | 400 Hz | 50 Hz | Design choice / dataset |
| Harmonic tracked `h` | 2 (800 Hz) | 2 (100 Hz) | Spike T1 / assumption |
| Band half-width `w`, grid terms | 2.5 Hz (tone ±5 Hz) | 1.5 Hz (tone ±3 Hz) | Assumption, ≥ ±3 Hz tone |
| NO HUM threshold | 13 dB | same | Spike T1: noise alone 6–7 dB, hum 33–59 dB |

## States

| State | Meaning |
| --- | --- |
| `NO_HUM` | This reading is not trustworthy. No frequency, deviation or tier |
| `CALIBRATING` | Hum present; no reference yet. Frequency is reported, deviation and tier are not |
| `LIVE` | Hum present and reference set. Frequency, deviation and tier are reported |

**After NO HUM:**
- The first 4 hum readings are skipped for calibration, smoothing and tiers, because their windows still overlap the gap. This also applies at start.
- A gap during calibration keeps the readings already counted.
- A gap during LIVE keeps the reference but clears the smoothing buffer, the 10 s fall history and both hold timers. When hum returns, the tier starts again at GREEN.

**Calibration.** Each device's audio clock is off by tens of ppm (spike T1 measured about −13 mHz at 400 Hz), so the tracker reports deviation from a reference, not absolute frequency. After 60 counted readings (30 s), the reference is their median and the state becomes LIVE. `recalibrate()` clears the reference and every derived buffer and timer, then returns to CALIBRATING (or NO HUM, if the next reading is one).

## Deviation and tiers

Deviation is the median of the last 5 usable frequency estimates minus the reference, in mHz. Until 5 exist, it is the median of those available. The **10 s fall** is the highest deviation among the last 20 readings minus the current deviation, using whatever history exists.

| From | Condition, held for | To |
| --- | --- | --- |
| any | deviation ≤ −150 mHz, 2 readings | RED |
| GREEN | deviation ≤ −50 mHz or fall ≥ 50 mHz, 2 readings | AMBER |
| RED | deviation > −130 mHz, 20 readings (10 s) | AMBER |
| AMBER | deviation > −30 mHz and fall < 50 mHz, 20 readings (10 s) | GREEN |

LIVE begins at GREEN. A reading that breaks a condition resets that condition's count. Only negative deviation can raise a tier: a grid running fast has surplus, which is not a warning.

The 20 mHz gap between entering and leaving, plus the 10 s hold, keeps the tier steady on room noise, which reached about ±15 mHz after smoothing at 1 m. All thresholds are design choices, listed in `docs/params.md` as assumptions.

## Interface

`createTracker({ sampleRate, f0, h, w, label })` returns an object with:

- `push(samples)`, which returns the readings completed by those samples (possibly none);
- `recalibrate()`.

A reading holds:
- `t`: seconds of audio received up to the end of its window;
- `state`;
- `snrDb`;
- `f` in Hz (not NO HUM);
- `deviationMHz` and `tier` (LIVE only, and not on the 4 readings skipped after a gap);
- `label`: LIVE from a microphone, REPLAY from a file, SIMULATED from the district's loopback.

The reading that completes calibration is itself reported LIVE.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Tone to track | Second harmonic, `h = 2` | Fundamental | Spike T1 passed on 800 Hz; it is the strongest component of the emitter's hum |
| Peak finder | Goertzel coarse + fine bank, log-parabolic interpolation | FFT with zero padding | Under 0.5 mHz error on synthetic tones, 57 ms per estimate on a laptop, no FFT code to own |
| Noise floor | Median of coarse bins beyond 1 Hz of the peak | Median of the whole coarse bank (as in the spike) | The whole bank counts the peak's own main lobe; at ±1 Hz bands a clean tone read 6.8 dB, i.e. NO HUM |
| Calibration statistic | Median of 60 readings | Mean | A median ignores outlier readings caused by a door or a voice |
| Smoothing | Median of last 5 | Median of 9 or 17; none | 5 meets both T1 marks (ramp within 4 mHz, step half-way in 2.7 s); 17 misses the 3 s step mark |
| Tier inputs | Smoothed deviation plus 10 s fall | Per-reading rate of change | Per-reading rate of change is dominated by the ±15 mHz room noise |
| Sample rate | Fixed at creation | Per push | One audio clock path per tracker; a rate change means a new device path and a new calibration |

## Open Questions & Future Decisions

### Deferred
1. Whether ENF-WHU clips need `h = 1`, 2 or 3. Decide when the harness scores the first clips.
2. Whether NO HUM after a LIVE stretch should show as its own "hum lost" state on the phone (a cut, or the phone moved). This is UI, outside `src/core`.

## References

- `docs/spikes.md` T1 results and decisions; `spikes/tonebank.ts` (prototype estimator)
- ENF-WHU dataset: https://github.com/ghua-ac/ENF-WHU-Dataset
