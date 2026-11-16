---
parent: world-design
prefix: WORLD-CARE
---

# Care delivery model

## Context and design philosophy

The care delivery model makes the sick children whose Breath Count gives RED or AMBER, and says how long a courier takes to reach them through the tunnels. It serves problem 10 (get basic care to people who cannot reach a clinic). The phone's Breath Count is real (`docs/intent/breath`); the requests it would send from District 7, and the couriers who answer them, are simulated.

The least model that gives the metric an honest value: a scripted rate of requests drawn up front, routes counted in tunnel hops over the passable graph (the tunnels model's `hopsFrom`), and fixed minutes per hop and per visit. No illness course, no medicine stock.

## Requests

A `care` event `{ atH, durH, red, amber }` makes `red` RED and `amber` AMBER requests per day on `[atH × 3600, (atH + durH) × 3600)`.

`careRequests(events, rng)` draws every request of the script at once, so the draws never depend on what a policy does later. For each `care` event in script order, it makes `round(red × durH / 24)` RED requests, then `round(amber × durH / 24)` AMBER ones. Each request takes exactly two draws: its time `atH × 3600 + u × durH × 3600` and its sector `floor(u × 24)`. The result is sorted by time, ties kept in draw order, as `{ t, cls, sector }` with `cls` `'RED'` or `'AMBER'`. Events of other types are ignored.

## Couriers

A courier walks `HOP_MIN` minutes per tunnel hop and spends `VISIT_MIN` minutes with the child.

- `firstCareMin(hops) = hops × HOP_MIN`: from dispatch to the courier's arrival.
- `busyMin(hops) = 2 × hops × HOP_MIN + VISIT_MIN`: from dispatch to the courier's return.

Hops come from `hopsFrom(edges, node, nodes)` in the tunnels model, over passable edges only, so a courier's route bends round a flooded section, and a child behind one cannot be reached until it drains.

## Interface

`careRequests(events, rng)`, `firstCareMin(hops)`, `busyMin(hops)` and the constants `HOP_MIN`, `VISIT_MIN` (both in `docs/params.md`).

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Where requests come from | Scripted rates | Children drawn from the epidemic model | The epidemic is p09's private state and counts adults too; coupling would change problem 9's draws |
| When requests are drawn | All at the first step | One draw per step | Both policies then face the same children at the same times, whatever extra draws one policy makes |
| Distance | Tunnel hops at fixed minutes | Metres and walking speeds | The graph is in hops; minutes per hop is one stated assumption |

## Open Questions & Future Decisions

### Deferred
1. Couriers carrying medicine from p09's stock, for the plan's "stock-out days in deep levels".
2. Requests from real NEED packets (code `0x10`, `0x11`) decoded in the room.

## References

- `docs/intent/breath/breath-design.md` (RED, AMBER and the NEED codes); `docs/intent/world/tunnels/tunnels-design.md` (`hopsFrom`); `docs/plan.md` problem 10
