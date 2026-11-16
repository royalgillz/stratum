---
parent: high-level-design
prefix: SCEN
---

# Scenario and runner

## Context and design philosophy

A scenario is a script of District 7's week: what goes wrong and when, and how fast the screen should play it. The runner turns a script, a seed and a policy into a run, either interactive (the district page, at the two clocks' pace) or headless (the harness, flat out). It serves every modelled problem and the rung 3 gate: a scripted seven-day scenario runs end to end under either policy, and a phone's OK appears in the district.

A script is data, not code. Events reach the world only through the adapters, which read the script's events as pure functions of world time. The runner writes `World` only through `inject`, which puts a decoded live packet into `mesh.inbox` between steps, and through the kernel's `setClock`. The same script, seed and policy replay exactly.

## Script

`{ name, days, demo, acts, events }`, times in hours from the start. Hour 0 is midnight at the start of day 1, so a daily rule at 06:00 acts at hours 6, 30, 54 and so on. `days` is a positive integer.

- `demo`: the household the district page's gateway speaks for, `{ id, level, sector, members }`, with `sector` 0 to 3 within `level` (the packet payload's mapping). Its id is the key set id the gateway gives the family's keys, so a real OK lands on it.
- `acts`: `{ atH, mode, scale?, title }`, in rising order, the first at 0. `realtime` means scale 1; `timelapse` takes a scale (default 3600). The title is the caption on screen.
- `events`, each with `type` and `atH`. Every field listed is required:

| Type | Fields | Read by |
| --- | --- | --- |
| `shortfall` | `from, to, rampH, holdH, recoverH` | p01, p02 (grid capacity) |
| `trip` | `loss, durH` | p01, p02 |
| `contamination` | `level, rampH, durH, delta { cond, toc, turb, biocide }`, with `rampH ≤ durH` | p04 |
| `flood` | `sector` (0 to 23), `inflowM3h, durH` | p05 |
| `outbreak` | `sector` (0 to 23), `cases` | p09 |
| `separate` | `away`; at most one per script | p08 |
| `network-down` | `durH` | p07 |

`validateScript` checks everything before a run and throws a RangeError naming the first bad field.

## The seven-day script

`src/core/scenario/seven-day.ts` exports the script as a typed constant. Values are tuned in the harness; the shape is fixed:

| Hour | Event | Act |
| --- | --- | --- |
| 0 | network down for 168 h | time-lapse: "The network is down" |
| 2 | families separated, 30% of members away | |
| 6 | outbreak seeded at level 6: 10 cases in each of sectors 20 to 23 | |
| 30 | slow shortfall: loss 4% to 8% over 4 h, hold 6 h, recover 2 h | |
| 52 | level 5 recycler contaminated, 30 min ramp, 12 h | |
| 60 | fast shortfall: loss 4.75% to 5.45% over 75 s, hold 2 h, recover 1 h | real time for 90 s: "The hum sags: under a minute of warning, too short to count" |
| 84 | plant trip: 5.8% lost for 3 h | real time from 83.99 h for 2 min: "A plant trip gives no warning" |
| 100 | shortfall: loss 5% to 10% over 1 h, hold 12 h, recover 2 h | |
| 101 | flood at level 6 sector 2 (sector 22), 15 m³/h for 10 h | |

A time-lapse act follows each real-time act. The 30-day run is this script with `days` set to 30.

**Expected results**, from the parameters (the harness reports the measured ones):

- *p01.* Only the hour-30 shortfall is warned (about 27 min of AMBER before the shed). The hour-60 shed lands under a minute after AMBER, the trip gives none, and the hour-100 loss starts above the AMBER point and sheds about 3 min later. The grid is GREEN in the step before the trip. Under STRATUM every sector is trimmed at each of the four sheds, so p01 is about 24 of 96 cut events (0.25); under the Directorate it is 0 by rule.
- *p05.* Under the Directorate, sector 22 is cut during the hour-100 shortfall, its sump floods near hour 110, and sectors 22 and 23 are stranded until power returns and the sump drains. Under STRATUM sector 22 is critical (its loss strands sector 23), keeps full pumps and does not flood.
- *p09.* About 25 to 75 new infectious cases in seven days and over 200 in 30 days. Few people are on both lists in seven days, so p09's result comes from the 30-day run.

## Initial world

`createWorld(seed, script)` builds District 7 at hour 0: `t` 0, the seed, the first act's clock, the grid at 400 Hz and GREEN with `gapMW` the capacity margin, 24 sectors of 500 people settled at their cooled temperature and ventilated CO2, baseline water, sumps at `SUMP_START`, medicine stock `MED_START`, `sleepM2` at `SLEEP_M2`, the tunnel graph from `districtTunnels()`, every sector at full power in `alloc.power` (keys `s00` to `s23`), empty ledger and mesh, and `surface` with no readings and band `unknown`.

Households: for sector `s` from 0 to 23 and `n` from 0 to `HH_PER_SECTOR − 1`, the household `h<s>-<n>` (no zero padding, so `h5-0`), in sector `s` at level `floor(s / 4) + 1`, with `2 + floor(u × 5)` members from one draw of `rng(seed, 'world')`, and shift `n mod 3`. Then the demo household: its id, `level`, `Household.sector = (level − 1) × 4 + demo.sector` (17 for the default), its members and shift 0. The `world` stream is used only here, so it never shifts an adapter's draws.

## Runs

- `createRun(script, seed, policy, { check? })` validates the script, builds the world, the adapters (`createAdapters(policy, script)`) and a kernel with dt 60 s. It returns `{ kernel, act(), tick(realSeconds), inject(message), done() }`.
- `tick(realSeconds)` sets the kernel clock to the act holding `world.t` (if it differs). When `world.t + realSeconds × scale` would reach the next act's start, it instead runs whole steps until `world.t` is at or past that start, switches the clock, and drops the rest of that tick's time, so no act is skipped. Otherwise it calls `kernel.advance`. Once `world.t` reaches the script's end it takes no step and returns 0. A run can overshoot the end by the steps of its last tick.
- `inject(message)` accepts a message with 25 bytes and a `heard` labelled LIVE, sets `at` to `world.t` and appends it to `world.mesh.inbox`; anything else throws a RangeError. A run with injected packets is no longer reproducible from its seed alone.
- `runHeadless(script, seed, policy, { sampleEvery = 3600, check = true })` runs the whole script with `kernel.run`, sampling `kernel.metrics()` at 0 and after every `sampleEvery` world seconds, and returns `{ series, world }`, where `series` maps each adapter id to `{ name, unit, label, t[], value[] }`. `sampleEvery` must be a positive multiple of 60 that divides `days × 86400`. The harness calls it for 20 seeds and both policies.

**The switch.** The district page runs both policies side by side from the same seed and script and shows one, so switching is instant and both stay at the same world time. A live packet is injected into both.

## Interface

`validateScript(script)`, `createWorld(seed, script)`, `createRun(script, seed, policy, opts)`, `runHeadless(script, seed, policy, opts)`, `sevenDay`, and the types `Script`, `Act`, `ScenarioEvent`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| How events reach the world | Adapters read the script's events by world time | The runner writes event effects between steps; an events field in `World` | Effects stay inside guarded adapter writes; no contract change; works with `advance`, which runs many steps per call |
| Script format | Typed constant, hours | JSON file; world seconds | Typed data is checked by the compiler; hours are readable; still no logic in the file |
| Live packets | `inject` into `mesh.inbox` between steps | A live adapter; a gateway inside core | Decoding is async and lives on the page; one small write keeps the kernel's rules intact |
| Act clock | Set at each tick; a tick stops at the next act's start | Exact switch inside `advance`; let a tick run past an act | The clock only paces the run, but a dropped frame must not skip a 90 s real-time act |
| Policy switch on the page | Two runs side by side | Restart on switch | Instant, and both runs show the same moment |
| Samples | Every world hour | Every step | 168 samples per metric per week is enough for charts and keeps harness output small |
| Plant trip size | 5.8% of nominal | A larger trip | It sheds within one step with no warning and keeps the hum inside the tracker band, so a phone shows RED, not NO HUM |
| Outbreak seed | 40 cases at hour 6 on level 6 | 5 cases at hour 72 | A smaller, later seed gives a handful of cases in seven days, too few for capture-recapture |
| Flood | Sector 22 during the hour-100 shortfall | A flood on a sector both policies keep powered | Puts the flood where the pump rule decides the outcome |

## Open Questions & Future Decisions

### Deferred
1. Stress scenarios (falsified official numbers, farm cut-off, a longer network cut) as more scripts.
2. Recording injected packets so a live run can be replayed.
3. Scenario editor: on the cut list.

## References

- `docs/plan.md` (two clocks, scripted acts, judge mode); `docs/intent/kernel/kernel-design.md`; `docs/intent/adapters/adapters-design.md`; `docs/spikes.md` T5
