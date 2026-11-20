---
parent: high-level-design
prefix: SCEN
---

# Scenario and runner

## Context and design philosophy

A scenario is a script of District 7's week: what goes wrong and when, and how fast the screen should play it. The runner turns a script, a seed and a policy into a run, either interactive (the district page, at the two clocks' pace) or headless (the harness, flat out). It serves every modelled problem and the rung 3 gate: a scripted seven-day scenario runs end to end under either policy, and a phone's OK appears in the district.

A script is data, not code. The runner derives each run's concrete script from the seed (`docs/intent/scenario/scripts`), so seeds differ in the timing and size of what goes wrong while acts and demo events stay where the screen shows them. Events reach the world only through the adapters, which read the script's events as pure functions of world time. The runner writes `World` only through `inject`, which puts a decoded live packet into `mesh.inbox` between steps, and through the kernel's `setClock`. The same script, seed and policy replay exactly.

## Script

`{ name, days, demo, acts, events, vary? }`, times in hours from the start. Hour 0 is midnight at the start of day 1, so a daily rule at 06:00 acts at hours 6, 30, 54 and so on. `days` is a positive integer.

- `demo`: the household the district page's gateway speaks for, `{ id, level, sector, members }`, with `sector` 0 to 3 within `level` (the packet payload's mapping). Its id is the key set id the gateway gives the family's keys, so a real OK lands on it.
- `acts`: `{ atH, mode, scale?, title }`, in rising order, the first at 0. `realtime` means scale 1; `timelapse` takes a scale (default 3600). The title is the caption on screen.
- `vary`: optional bounds `{ shiftH, scale }` for seed variation (`docs/intent/scenario/scripts`). Without it the concrete script equals the script.
- `events`, each with `type`, `atH` and an optional `fixed` flag; `fixed: true` keeps it exactly as written under seed variation. Every other field listed is required:

| Type | Fields | Read by |
| --- | --- | --- |
| `shortfall` | `from, to, rampH, holdH, recoverH` | p01, p02 (grid capacity) |
| `trip` | `loss, durH` | p01, p02 |
| `contamination` | `level, rampH, durH, delta { cond, toc, turb, biocide }`, with `rampH ≤ durH` | p04 |
| `flood` | `sector` (0 to 23), `inflowM3h, durH` | p05 |
| `outbreak` | `sector` (0 to 23), `cases` | p09 |
| `separate` | `away`; at most one per script | p08 |
| `network-down` | `durH` | p07, p10 |
| `farm-cut` | `level, durH` | p02, p12 |
| `care` | `durH, red, amber` (requests per day) | p10 |
| `surface` | `co, o3, so2` (ppm), `crews, falsified, bias` | p13, p14 |

`validateScript` checks everything before a run and throws a RangeError naming the first bad field.

## The seven-day script

`src/core/scenario/seven-day.ts` exports the script as a typed constant. Values are tuned in the harness; the shape is fixed:

| Hour | Event | Act |
| --- | --- | --- |
| 0 | network down for 168 h | time-lapse: "The network is down" |
| 2 | families separated, 30% of members away | |
| 6 | outbreak seeded at level 6: 10 cases in each of sectors 20 to 23 | |
| 24 | farm cut-off: level 4's deliveries stop for 144 h | |
| 24 | care requests: 6 RED and 12 AMBER a day for 144 h | |
| 30 | slow shortfall: loss 4% to 8% over 4 h, hold 6 h, recover 2 h | |
| 52 | level 5 recycler contaminated, 30 min ramp, 12 h | |
| 60 | fast shortfall: loss 4.75% to 5.45% over 75 s, hold 2 h, recover 1 h | real time for 90 s: "The hum sags: under a minute of warning, too short to count" |
| 64 | deep shortfall: loss 4% to 30% over 13 h, hold 3 h, recover 3 h | real time from 75.55 h for 4 min: "Level 5 goes dark: deepest first" |
| 84 | plant trip: 5.8% lost for 3 h | real time from 83.99 h for 2 min: "A plant trip gives no warning" |
| 100 | shortfall: loss 5% to 10% over 1 h, hold 12 h, recover 2 h | |
| 101 | flood at level 6 sector 2 (sector 22), 15 m³/h for 10 h | |
| 120 | surface campaign: 5 crews every 6 h, crew `c1` falsified at 2% of the truth; truth CO 20, O3 0.4, SO2 1 ppm (band `mask`) | |

The network cut, the outbreak seeds, the hour-60 shortfall, the trip, the deep shortfall and the flood are `fixed`; the rest vary with the seed within `vary: { shiftH: 1, scale: 0.2 }`. A time-lapse act follows each real-time act. The 30-day run is this script with `days` set to 30.

**Expected results**, from the parameters (the harness reports the measured ones):

- *p01.* The hour-30 shortfall and the deep shortfall are warned (about 27 and 13 min of AMBER before their first shed). The hour-60 shed lands under a minute after AMBER, the trip gives none, and the hour-100 loss starts above the AMBER point and sheds about 3 min later. The grid is GREEN in the step before the trip. Under STRATUM every sector is trimmed at each of the five sheds, so p01 is about 48 of 120 cut events (0.40); under the Directorate it is 0 by rule.
- *Level 5 goes dark.* Once the deep shortfall passes 27.1% loss, deepest-first leaves 17 sectors lit, so sector 17 (the demo family's, level 5 sector 1) is cut in the step at 75:35, inside the real-time act. Its hum falls silent there. Under STRATUM every sector keeps about 72% of its demand, above its life floor, and nothing goes dark. After the first shed the hum stays GREEN under both policies: shedding keeps load under capacity, so the hum warns when stress begins, not of each deeper cut.
- *p02.* Level 4, cut off from the farms, sets the Directorate's worst decile: it gets no food deliveries for most of the week. Under STRATUM the deliveries are shared across the district, so every sector gets about 77% of its food demand while the cut-off lasts.
- *p05.* Under the Directorate, sector 22 is cut during the hour-100 shortfall, its sump floods near hour 110, and sectors 22 and 23 are stranded until power returns and the sump drains. Under STRATUM sector 22 is critical (its loss strands sector 23), keeps full pumps and does not flood.
- *p09.* About 25 to 75 new infectious cases in seven days and over 200 in 30 days. Few people are on both lists in seven days, so p09's result comes from the 30-day run.
- *p06.* 2.0 m² under the Directorate; close to 6 under STRATUM, per sleeper in the busiest shift (living space stays 2.0 under both).
- *p10.* Many hours under the Directorate (the bulletin); about an hour under STRATUM when the mesh reaches a care point, longer for requests it drops.
- *p11.* About 0.2 under the Directorate (the grow rooms' farm workers; two lamp hours each reach nobody's four); about 0.7 under STRATUM, less in dark sectors.
- *p12.* About 3 days under the Directorate (level 4's store runs out three days after its first missed delivery); under STRATUM the floor holds to the end of the run (censored), with every level eating at the floor while the cut-off lasts.
- *p13.* 0 under STRATUM on every seed (four honest crews in five always agree on `mask`); the Directorate's 1 follows from its fixed verdict and the chosen truth. Both are set by the script.
- *p14.* 10,000 under the Directorate (supplied air proven); 10 under STRATUM (a half mask proven), on every seed, again set by the chosen truth. Both are `NO_PROOF` before the campaign.
- *p15.* About 21 days under the Directorate (level 6 waits for the rest); about 12 to 16 under STRATUM: no level's mean can fall below the district's mean wait, about 12 days.
- *p03.* Under STRATUM the deep shortfall leaves the main areas about 63% of their cooling, so deep levels may pass the wet-bulb limit and STRATUM's heat result may be above 0.

## Initial world

`createWorld(seed, script)` builds District 7 at hour 0: `t` 0, the seed, the first act's clock, the grid at 400 Hz and GREEN with `gapMW` the capacity margin, 24 sectors of 500 people settled at their cooled temperature and ventilated CO2, baseline water, sumps at `SUMP_START`, medicine stock `MED_START`, `sleepM2` at `SLEEP_M2`, the tunnel graph from `districtTunnels()`, every sector at full power in `alloc.power` (keys `s00` to `s23`), empty ledger and mesh, and `surface` with no readings and band `unknown`.

Households: for sector `s` from 0 to 23 and `n` from 0 to `HH_PER_SECTOR − 1`, the household `h<s>-<n>` (no zero padding, so `h5-0`), in sector `s` at level `floor(s / 4) + 1`, with `2 + floor(u × 5)` members from one draw of `rng(seed, 'world')`, and shift `n mod 3`. Then the demo household: its id, `level`, `Household.sector = (level − 1) × 4 + demo.sector` (17 for the default), its members and shift 0. The `world` stream is used only here, so it never shifts an adapter's draws.

## Runs

- `createRun(script, seed, policy, { check?, per? })` validates the script, derives the concrete script `varyScript(script, seed)`, builds the world and the adapters (`createAdapters(policy, concrete, per)`, where `per` is the optional per-adapter policy map of `adapters/policy`) from it, and a kernel with dt 60 s. It returns `{ kernel, script, act(), tick(realSeconds), inject(message), done() }`, where `script` is the concrete script: the page and the harness read event times from it, never from the script they passed in.
- `tick(realSeconds)` sets the kernel clock to the act holding `world.t` (if it differs). When `world.t + realSeconds × scale` would reach the next act's start, it instead runs whole steps until `world.t` is at or past that start (at most the kernel's per-call cap of 600, so a tab resumed after a stall does not freeze; the next tick goes on toward the start), switches the clock, and drops the rest of that tick's time, so no act is skipped. Otherwise it calls `kernel.advance`. A bad `realSeconds` (not finite, or below 0) throws a RangeError before anything changes. The kernel's owed balance (under one step of world time) carries across the switch, so the first step of a real-time act can come early and a 90 s act lasts between about 60 and 120 real seconds; that is accepted. Once `world.t` reaches the script's end it takes no step and returns 0. A run can overshoot the end by the steps of its last tick.
- `inject(message)` accepts a message with 25 bytes and a `heard` labelled LIVE, sets `at` to `world.t` and appends it to `world.mesh.inbox`; anything else throws a RangeError. A run with injected packets is no longer reproducible from its seed alone.
- `runHeadless(script, seed, policy, { sampleEvery = 3600, check = true, per })` builds its run with `createRun` (passing `check` and `per` through) and runs the whole script with `kernel.run`, sampling `kernel.metrics()` at 0 and after every `sampleEvery` world seconds, and returns `{ series, world }`, where `series` maps each adapter id to `{ name, unit, label, t[], value[] }`. `sampleEvery` must be a positive multiple of 60 that divides `days × 86400`. The harness calls it for 20 seeds and both policies, and with `per` for the ablations.

**The switch.** The district page runs both policies side by side from the same seed and script and shows one, so switching is instant and both stay at the same world time. A live packet is injected into both.

## Interface

`validateScript(script)`, `createWorld(seed, script)`, `createRun(script, seed, policy, opts)`, `runHeadless(script, seed, policy, opts)`, `sevenDay`, and the types `Script`, `Act`, `ScenarioEvent`. Seed variation (`varyScript`) and the stress week (`stressWeek`) are in `docs/intent/scenario/scripts`.

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
| Level 5 dark | A slow, deep shortfall that deepest-first carries down to sector 17 | A trip big enough to cut level 5 at once; a scripted cut of level 5 | The rule, not the script, cuts level 5; its first shed is warned, and the hum stays inside the tracker band |
| Farm cut-off | One level, from hour 24 to the end | The whole district | Gives the Directorate's store time to run out inside the week while other levels can share |
| Surface truth | Band `mask`, one crew in five falsified | A healed surface | A truth neither side's claim matches; one liar shows the quorum holding |

## Open Questions & Future Decisions

### Deferred
1. More stress scripts: falsified official numbers (published water and case figures), a longer network cut.
2. Recording injected packets so a live run can be replayed.
3. Scenario editor: on the cut list.

## References

- `docs/plan.md` (two clocks, scripted acts, judge mode); `docs/intent/kernel/kernel-design.md`; `docs/intent/adapters/adapters-design.md`; `docs/spikes.md` T5
