---
parent: high-level-design
prefix: WORLD
---

# World models

## Problem

District 7 must produce the signals the three engines hear (a sagging hum, rising heat and CO2, bad water, filling sumps, an outbreak) and must show what changes when the engines act. The models are a test rig, not a forecast. Everything they produce is SIMULATED.

## Approach

Each model is a set of pure functions in `src/core/world`, one module per model. A model takes plain numbers (and an `Rng` when it draws) and returns plain numbers. It never reads or writes `World`: only the adapters in `src/core/adapters` call the models and write the results, so the kernel's write guard still covers every change. The emitter on the district page may call the grid functions directly to pace the hum in real time.

Each model is the least physics that gives the plan's metric an honest, checkable value:

| Model | Folder | Prefix | Drives | Serves problems |
| --- | --- | --- | --- | --- |
| grid | `world/grid` | WORLD-GRID | `World.grid`: frequency from supply minus load, tier, capacity over time | 1, 2 |
| air and heat | `world/airheat` | WORLD-AIR | sector temperature, wet-bulb, CO2, time to a limit | 1, 3, 9 |
| water quality | `world/water` | WORLD-WATER | recycler outlet and tap quality per sector | 4 |
| tunnels and sumps | `world/tunnels` | WORLD-TUNNEL | sump levels, passable tunnels, who is cut off | 5, 7 |
| epidemic | `world/epidemic` | WORLD-EPI | infections per sector, the two case lists | 9 |

Rung 4 adds light and food, space, care delivery and surface models under the same rules.

## District 7

- 6 levels by 4 sectors. Level 1 is the top, level 6 the deepest. Sector index `s = (level − 1) × 4 + sector`, with `sector` 0 to 3 within the level (the packet payload's mapping).
- 500 people per sector, 12,000 in all. People do not move between sectors in rung 3.
- Deeper is hotter (rock temperature rises with depth) and seeps more water.
- Tunnel node `s` is sector `s`. The hub (clinic, water point, way out) is node 0, level 1 sector 0.

## Shared rules

- **Determinism.** A model draws only from the `Rng` it is given. Same inputs and same draws give the same outputs on every runtime.
- **Exact steps.** A quantity that relaxes towards a target uses the exact exponential update `x' = target + (x − target) × e^(−dt/τ)`, so any `dt` is stable and the emitter (dt about 20 ms) and the kernel (dt 60 s) agree.
- **Parameters.** Every constant is a row in `docs/params.md` with a source URL or `assumption: true`. Constants live in one place per model, never inline in adapters.
- **Validation.** Functions throw `RangeError` for non-finite or out-of-range inputs: a bad input is a caller bug, not a state of the world.
- **Events.** A model function that takes the script's events reads only its own event types (grid: `shortfall` and `trip`; tunnels: `flood`; water: `contamination`) and ignores the rest. Adapters pass the whole event list.
- **Seeds and uncertainty.** The grid, heat and tunnel models draw nothing, and neither do the power, cooling and pump rules. So p01, p02, p03 and p05 vary only with the script and the parameters, not with the seed. Their uncertainty comes from parameter sweeps (humidity, leakage, ramp rate, flood size), and the harness shows them without seed intervals. The grid's time constant (4 s) is far below the 60 s step, so every kernel step is at steady state: grid inertia changes only the emitter's real-time hum.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Where physics lives | Pure functions called by adapters | World models as kernel stages; adapters own their physics | The kernel steps adapters only, so the write guard covers every change. Pure functions can be tested alone and reused by the emitter |
| Model state | Held in `World` where the contract has a field, otherwise in the adapter that owns it | New `World` fields per model | `contracts.ts` changes only additively and with approval. Adapter state is rebuilt each run, so reproducibility holds |
| Resolution | Sector-level compartments | Per-person agents | The plan cuts per-agent models; sector compartments run 30 days well inside spike T5 |
| Stepping | Exact exponential relaxation | Euler steps | Euler at dt 60 s is unstable for the grid (time constant about 4 s) |

## Open Questions & Future Decisions

### Deferred
1. Movement of people between sectors (shifts, refuge, the return). Rung 4 space and return models decide it.
2. Calibrating any model against real data. Only the water detector and the tracker are scored on real data; the models stay labelled SIMULATED.

## References

- `docs/plan.md` (mechanisms per problem, two clocks); `docs/intent/kernel/kernel-design.md` (step loop, write guard)
- `docs/params.md`, `docs/limits.md`
