---
parent: world-design
prefix: WORLD-GRID
---

# Grid model

## Context and design philosophy

The grid model turns supply and load into the frequency of the hum. It serves problem 1 (the hum is the warning) and problem 2 (when supply is short, someone is cut). The district page plays the hum from it and a real phone tracker hears it, so the model must sag slowly in a slow shortfall and collapse at once in a plant trip, the plan's "a sudden plant trip gives no warning".

It is the least model that does both: one aggregate swing equation with load damping. There is no governor reserve: capacity is what the plants can give, and the shortfall is load above capacity. Pure functions, no randomness.

## Capacity over time

Plant capacity is the nominal capacity times one minus the summed loss of the scenario's `shortfall` and `trip` events at world time `t` (seconds), clamped to [0, 1]. Events of other types are ignored. Every phase is a half-open interval in seconds:

- **shortfall** `{ atH, from, to, rampH, holdH, recoverH }`, all fields required: with `a = atH × 3600`, the loss rises linearly from `from` to `to` on `[a, a + rampH × 3600)`, equals `to` for the next `holdH × 3600` s, falls linearly to 0 over the next `recoverH × 3600` s, and is 0 before and after. A zero-length phase is skipped. Nominal capacity is `CAP_MARGIN` times full demand, so a loss below `1 − 1/CAP_MARGIN` (about 4.76%) is silent: capacity still covers the load.
- **trip** `{ atH, loss, durH }`: loss `loss` on `[atH × 3600, (atH + durH) × 3600)`, then 0.

Times in events are hours, `t` is seconds. `capacityAt(events, t, nominalMW)` is a pure function, so the emitter can ask for capacity between kernel steps.

## Frequency

With `f0` = 400 Hz, inertia constant `H` and load damping `D` (per unit load change per unit frequency change), the aggregate swing equation is

`(2H / f0) × df/dt = (min(cap, load) − load × (1 + D × (f − f0) / f0)) / load`

Below capacity the plants follow the load and `f` returns to `f0`. Above it, `f` falls until the load's own damping balances the shortfall:

- steady deviation `Δss = −f0 × max(0, load − cap) / (D × load)`, in Hz;
- time constant `τ = 2H / D`;
- exact update `f' = f0 + Δss + (f − f0 − Δss) × e^(−dt/τ)`, and `rocof = (f' − f) / dt`.

With `H` = 4 s and `D` = 2, `τ` is 4 s and a 0.1% shortfall gives −200 mHz. A shortfall that grows over an hour sags the hum over that hour; a trip moves it within seconds, faster than any warning. `gapMW = cap − load` (negative is a shortfall).

The model is linear and is used only inside the tracker band (±2.5 Hz). A shortfall above 1.25% of load drives `Δss` beyond −2.5 Hz, where a listening phone loses the tone and shows NO HUM. The seven-day plant trip leaves about 1.1% of load unserved (−2.2 Hz), so a phone shows RED until the shed lands.

## Tier

`tierOf(f, previous)` mirrors the phone tracker's thresholds on deviation `f − f0`: RED at or below −150 mHz; a RED stays RED down to −130 mHz; AMBER at or below −50 mHz; an AMBER or RED falls to AMBER while at or below −30 mHz; otherwise GREEN. The tracker's hold times and fall trigger act on seconds and are not modelled at a 60 s step.

## Interface

`capacityAt(events, t, nominalMW)`, `steadyDeviation(capMW, loadMW)`, `swing(f, capMW, loadMW, dt) → { f, rocof }`, `tierOf(f, previous)`. The constants `F0`, `H`, `D` are exported for the emitter.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Model | One aggregate swing equation with load damping | Multi-machine model; governor droop and reserve | Gives slow sag and fast collapse with two parameters. Reserve is folded into the capacity margin |
| Integration | Exact exponential solution | Euler sub-steps | Stable at dt 60 s and at audio frame rate with the same code |
| Events | Loss fractions of nominal capacity, piecewise linear | Absolute MW; scripted frequency traces | Fractions survive a change of district size. Frequency always follows from supply and load, never from a script |
| Tier | Thresholds and hysteresis from the tracker | Separate thresholds for the model | The district tier and the phone tier must mean the same thing |

## Open Questions & Future Decisions

### Deferred
1. A demand profile over the day. Load is constant per served sector in rung 3.
2. Noise on `f`. The live phone already hears real room noise; the harness does not need it.

## References

- Aggregate swing equation and load damping: P. Kundur, *Power System Stability and Control*, McGraw-Hill, 1994, chapters 3 and 11
- `docs/intent/tracker/tracker-design.md` (tiers); `docs/plan.md` (two clocks, results that go against us)
