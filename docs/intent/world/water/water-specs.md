# Water quality model specs

Prefix `WORLD-WATER`. Design: `water-design.md`. The problems served are in brackets.

- [ ] **WORLD-WATER-001** [4]: `outlet(level, t, events, rng)` shall return, for each of conductivity, organic carbon, turbidity and biocide, `max(0, baseline + w × delta + noise)`, summing `w × delta` over contamination events on that level and ignoring events of other types.
- [ ] **WORLD-WATER-002** [4]: For a contamination event with `a = atH × 3600`, `w` shall be `(t − a) / (rampH × 3600)` on `[a, a + rampH × 3600)`, 1 on `[a + rampH × 3600, a + durH × 3600)` and 0 otherwise, with a zero-length ramp skipped.
- [ ] **WORLD-WATER-003** [4]: `outlet` shall draw each channel's noise as `NOISE × baseline × sqrt(−2 ln(1 − u1)) × cos(2π u2)`, with channels in the order cond, toc, turb, biocide and `u1` drawn before `u2`, calling `rng` exactly eight times per call whatever the values.
- [ ] **WORLD-WATER-004** [4]: `tapDelay(sector)` shall return `(PIPE_BASE + PIPE_STEP × sector) × 60` seconds for `sector` 0 to 3.
- [ ] **WORLD-WATER-005** [4]: `unsafe(q)` shall return true exactly when `q.toc > 3` mg/L or `q.biocide < 1` mg/L.
- [ ] **WORLD-WATER-006** [4]: The water functions shall throw a RangeError for a level that is not an integer from 1 to 6, a sector that is not an integer from 0 to 3, a non-finite `t`, or a contamination event with a negative duration, a `rampH` above its `durH`, or a non-finite delta.
