# Grid model specs

Prefix `WORLD-GRID`. Design: `grid-design.md`. The problems served are in brackets. `t` is world seconds; event times are hours.

- [x] **WORLD-GRID-001** [1, 2]: `capacityAt(events, t, nominalMW)` shall return `nominalMW × (1 − L)`, where `L` is the sum of the losses at `t` of the `shortfall` and `trip` events in `events`, clamped to [0, 1], ignoring events of any other type.
- [x] **WORLD-GRID-002** [1, 2]: For a shortfall event with `a = atH × 3600`, the loss shall be 0 for `t < a`, rise linearly from `from` to `to` on `[a, a + rampH × 3600)`, equal `to` on the next `holdH × 3600` s, fall linearly from `to` to 0 on the next `recoverH × 3600` s, and be 0 from then on; a zero-length phase shall be skipped.
- [x] **WORLD-GRID-003** [1, 2]: For a trip event, the loss shall be `loss` for `t` in `[atH × 3600, (atH + durH) × 3600)` and 0 otherwise.
- [x] **WORLD-GRID-004** [1]: `steadyDeviation(capMW, loadMW)` shall return `−F0 × max(0, loadMW − capMW) / (D × loadMW)` in Hz, and 0 when `loadMW` is 0.
- [x] **WORLD-GRID-005** [1]: `swing(f, capMW, loadMW, dt)` shall return `f' = F0 + Δss + (f − F0 − Δss) × e^(−dt/τ)` with `τ = 2H / D` and `Δss` from WORLD-GRID-004, and `rocof = (f' − f) / dt`.
- [x] **WORLD-GRID-006** [1]: Given a load at or below capacity, `swing` shall move `f` towards `F0` and never below its starting value when it starts at or below `F0`; given a load 0.1% above capacity with the default `H` and `D`, the steady deviation shall be −200 mHz within 1 mHz.
- [x] **WORLD-GRID-007** [1]: `tierOf(f, previous)` shall return RED when `f − F0 ≤ −0.150` Hz, or when `previous` is RED and `f − F0 ≤ −0.130` Hz; otherwise AMBER when `f − F0 ≤ −0.050` Hz, or when `previous` is AMBER or RED and `f − F0 ≤ −0.030` Hz; otherwise GREEN.
- [x] **WORLD-GRID-008** [1, 2]: The grid functions shall throw a RangeError for a non-finite `t`, `f`, `capMW`, `loadMW` or `nominalMW`, a negative capacity or load, a `dt` that is not a finite number above 0, or a shortfall or trip event with a non-finite `atH`, a loss value outside [0, 1] or a duration that is missing, non-finite or negative.
