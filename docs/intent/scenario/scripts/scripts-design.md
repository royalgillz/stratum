---
parent: scenario-design
prefix: SCEN-SCRIPT
---

# Scripts: seed variation, the Level 5 act, the stress week

## Context and design philosophy

A fixed script makes every seed face the same week, so results that draw nothing (power, heat, tunnels) come out identical on every seed and have no interval. A comparison that only ever shows STRATUM winning is also less believable than one that shows where it loses. This leaf owns three things: how a seed varies the script, the act in which the demo family's level goes dark, and a stress week built to make STRATUM's numbers rise above zero and lose on at least one problem. It serves every modelled problem.

The rule: vary what goes wrong, never what the screen promises. Acts and the events they show stay exactly where they are; everything else moves within stated bounds. Same seed, same concrete script, same run.

## Seed variation

`varyScript(script, seed)` returns the concrete script. It draws only from `rng(seed, 'script')`, a stream used nowhere else, before any world or adapter exists, so it never shifts another module's draws.

For each event in script order it draws exactly three numbers `u1, u2, u3`, whether or not the event is fixed, so one event's flag never shifts another's draws. With `script.vary = { shiftH, scale }`, an event without `fixed: true` becomes:

- `atH + (2u1 − 1) × shiftH`, clamped to `[0, days × 24]`;
- each size field times `1 + (2u2 − 1) × scale`;
- each duration field times `1 + (2u3 − 1) × scale`.

| Type | Size fields | Duration fields |
| --- | --- | --- |
| `shortfall` | `from`, `to` | `rampH`, `holdH`, `recoverH` |
| `trip` | `loss` | `durH` |
| `contamination` | every field of `delta` | `rampH`, `durH` |
| `flood` | `inflowM3h` | `durH` |
| `outbreak` | `cases`, rounded to a whole number | |
| `separate` | `away` | |
| `network-down` | | `durH` |
| `farm-cut` | | `durH` |
| `care` | `red`, `amber` | `durH` |
| `surface` | `co`, `o3`, `so2`, `bias` | |

One factor per event keeps a shortfall's `from` below its `to` and a contamination's `rampH` within its `durH`. Fractions (`from`, `to`, `loss`, `away`) are clamped to [0, 1]. Levels, sectors, crew counts and falsified counts never change. Fixed events, `name`, `days`, `demo`, `acts` and `vary` are copied unchanged, and without `vary` the concrete script equals the script. The result passes `validateScript`.

**The page keeps its timing.** Acts never move, and every event a real-time act shows is fixed, so the district page plays each act on its event. The page and the harness read event times from `run.script`, the concrete script.

## Level 5 goes dark

The seven-day script's deep shortfall (fixed) ramps loss from 4% to 30% at 2% an hour from hour 64. Deepest-first cuts one more sector each time the load no longer fits, and leaves 17 sectors lit once loss passes 27.1%, so sector 17, the demo family's, goes dark in the step at 75:35. The real-time act "Level 5 goes dark: deepest first" runs from hour 75.55 for 4 minutes, so the cut lands about two minutes in and the silence holds for about two. Under STRATUM the same supply leaves every sector about 72% of its demand: the side-by-side shows level 5 dark under one rule and lit under the other.

## Fan stops

The seven-day script lists three ventilation-fan failures in `fanStops`, not in `events`: hour 40 on level 6 for 3 h, hour 101 on level 4 for 4 h (across the 06:00 bulletin at hour 102), hour 140 on level 2 for 2 h. Only p01's air figure reads them (`docs/intent/adapters/power`), and `varyScript` keeps them as written, so they move no other number. The stress week has none.

## The stress week

`stressWeek` is a seven-day script, `vary: { shiftH: 1, scale: 0.2 }`, the same demo household, one time-lapse act "A week below the floor":

| Hour | Event | Fixed |
| --- | --- | --- |
| 0 | network down for 168 h | yes |
| 0 | farm cut-off on levels 3, 4, 5 and 6 for 168 h (four events) | yes |
| 0 | care requests: 12 RED and 24 AMBER a day for 168 h | |
| 6 | outbreak seeded at level 6: 10 cases in each of sectors 20 to 23 | yes |
| 12 | shortfall below every life floor: loss 10% to 80% over 2 h, hold 24 h, recover 2 h | yes |
| 14 | flood at level 4 sector 1 (sector 13), 20 m³/h for 18 h | |
| 24 | surface campaign: truth CO 1,500, O3 2, SO2 20 ppm (band `sealed`), 5 crews, `c1` to `c3` falsified at 1% of the truth | yes |

**Expected results.** During the hold, supply is 21% of demand on every seed (the shortfall is fixed), below the 30% life floor: Fair Share breaches every floor equally and the cooling pool cannot pay the refuge floors, so STRATUM's heat result rises above 0. With four levels cut off, the district's deliveries cover about 37% of everyone's floor; STRATUM's stores hold the floor for about five days and then everyone breaches, while under the Directorate the four cut levels breach after about three days and the others never do. Three lying crews out of five carry the quorum: STRATUM's verdict is `open` against a true `sealed` and its wrong-band rate is near 1, while the Directorate's fixed `sealed` is right (0). STRATUM's trials start without protection and breach four times before supplied air holds, so its p14 is no lighter than the Directorate's 10,000.

## Interface

`varyScript(script, seed)`, `stressWeek`, and on the types: `Script.vary?: { shiftH: number; scale: number }`, an optional `fixed?: boolean` on every event (only `true` holds an event fixed), the event types `farm-cut`, `care` and `surface`, and `Script.fanStops?: FanStop[]` (`atH`, `level`, `durH`).

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Where variation lives | The runner derives the script from the seed | Noise inside each model; random scripts from a generator | Models stay deterministic and testable alone; one function, one stream, one table of bounds |
| Bounds | ±1 h, ±20% | Wider | Wider bounds move the flood off the late shortfall and the slow shortfall's warning under 10 minutes, which changes what the script is for |
| Draws per event | Three, always | Draws only for varied events | Marking an event fixed must not change the others |
| Demo events | Fixed | Varied with the acts moved to match | The page's acts and the video must show the same beat on every seed |
| Stress losses | A falsified-crew majority, supply below every floor, a four-level farm cut-off | Falsified official figures | These need no change to rung 3 adapters, and each loss follows from a stated rule |
| Stress shortfall | Fixed | Varied like the rest | Varied by 20%, its loss could stop short of the floor line (70.9%), and the stated result would not hold on every seed |

## Open Questions & Future Decisions

### Deferred
1. Falsified official water and case figures as a stress event, which would change the rung 3 evidence adapters.
2. Parameter sweeps (humidity, leakage, falsified share, lamp budget) as a harness grid over these scripts.

## References

- `docs/intent/scenario/scenario-design.md`; `docs/plan.md` (Evidence: stress cases and results against us; demo script); `docs/intent/adapters/power/power-design.md` (deepest first)
