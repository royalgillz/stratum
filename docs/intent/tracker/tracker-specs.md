# Tracker specs

Prefix `TRACK`. Design: `tracker-design.md`. The problems served are in brackets.

- [ ] **TRACK-001** [1]: For each reading, the tracker shall estimate the grid frequency as the strongest tone in the band `h × (f0 ± w)` over the window, divided by `h`, using a Hann window, a 0.25 Hz coarse Goertzel bank, a 0.02 Hz fine bank around the coarse peak, and a parabola on log power whose vertex offset is clamped to ±0.5 bins.
- [ ] **TRACK-002** [1]: The tracker shall take sample rate, nominal grid frequency `f0`, harmonic `h`, band half-width `w` and a label (LIVE or REPLAY) at creation, with defaults `f0` 400 Hz, `h` 2 and `w` 2.5 Hz, and shall reject a configuration whose band is narrower than ±3 Hz in tone frequency.
- [ ] **TRACK-003** [1]: The tracker shall emit its first reading once 2 s of samples have arrived and then one reading every `round(0.5 × sampleRate)` samples, with identical readings however the samples are split into pushes.
- [ ] **TRACK-004** [1]: If a reading's signal-to-noise (fine peak power over the median power of coarse bins more than 1 Hz of tone frequency from the coarse peak) is below 13 dB, or any computed value is not finite, or the coarse peak is in an outermost bin of the band, then the tracker shall emit that reading as NO_HUM with no frequency, deviation or tier.
- [ ] **TRACK-005** [1]: After start and after every NO_HUM reading, the tracker shall exclude the next 4 hum readings from calibration, smoothing and tiers.
- [ ] **TRACK-006** [1]: While CALIBRATING, the tracker shall keep the hum readings already counted across NO_HUM gaps, and when 60 have been counted it shall set the reference to their median and enter LIVE at tier GREEN.
- [ ] **TRACK-007** [1]: While LIVE, the tracker shall report deviation in mHz as the median of the last 5 usable frequency estimates (or of those available, if fewer) minus the reference.
- [ ] **TRACK-008** [1]: While LIVE, the tracker shall enter RED from any tier after 2 consecutive readings with deviation ≤ −150 mHz, and enter AMBER from GREEN after 2 consecutive readings with deviation ≤ −50 mHz or a fall of at least 50 mHz (highest deviation among the last 20 readings minus the current deviation); positive deviation shall never raise a tier.
- [ ] **TRACK-009** [1]: While LIVE, the tracker shall leave RED for AMBER only after 20 consecutive readings with deviation > −130 mHz, and leave AMBER for GREEN only after 20 consecutive readings with deviation > −30 mHz and a fall below 50 mHz.
- [ ] **TRACK-010** [1]: When a NO_HUM reading occurs while LIVE, the tracker shall keep the reference, clear the smoothing buffer, the fall history and the tier counters, and restart at tier GREEN when hum returns.
- [ ] **TRACK-011** [1]: When recalibrate is requested, the tracker shall discard the reference, counted calibration readings, smoothing buffer, fall history, tier and tier counters, and return to CALIBRATING.
- [ ] **TRACK-012** [1]: Each reading shall carry `t` (seconds of audio received up to the end of its window), its state, its signal-to-noise in dB, the configured label, `f` unless NO_HUM, and `deviationMHz` and `tier` only while LIVE.
