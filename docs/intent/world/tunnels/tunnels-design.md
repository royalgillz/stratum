---
parent: world-design
prefix: WORLD-TUNNEL
---

# Tunnels and sumps model

## Context and design philosophy

The tunnels model holds District 7's tunnel graph, fills and drains each sector's sump, and says who is cut off from the hub when sections flood. It serves problem 5 (keep tunnels safe to live in and move through, when one flooded section can isolate a neighbourhood) and problem 7 (sound packets hop along the same tunnels).

Graph questions are answered exactly; the hydraulics are the least that make a sump fill when its pumps lose power or a flood arrives. Pure functions, no randomness.

## Graph

Node `s` is sector `s`; node 0 (level 1, sector 0) is the hub: clinic, water point and way out. Each edge is `{ a, b }` with `a` the lower node index. Edges, in this fixed order:

1. Rings and corridors, level 1 to 6: within each level, sector 0 to 1, 1 to 2, 2 to 3; on levels 1 to 3 also 0 to 3, closing a ring (21 edges).
2. Main shaft: sector 0 of each level to sector 0 of the next level down, level 1 to 5 (5 edges).
3. Second stair: sector 2 of level 1 to sector 2 of level 2, and sector 2 of level 2 to sector 2 of level 3 (2 edges).

That is 28 edges. Levels 1 to 3 have two ways out; levels 4 to 6 hang from the main shaft alone, so one flooded section there can strand everyone below it. On the dry graph the critical nodes are the hub, the shaft node of level 3 (node 8, which carries everything below it) and every node of levels 4 to 6 except the last of each corridor. The layout is an assumption that reflects "the deeper you live, the worse it gets".

- `reachable(edges, hub, nodes)`: breadth-first search over passable edges.
- `strandedIfLost(edges, flooded, people, hub)`: for each node, the people of the other nodes that reach the hub while that node is dry and lose that path when it floods, with every other node's flooded state as given. An edge counts as passable when neither end is flooded; the `passable` flags in `edges` are ignored. A node is **critical** when this is above 0. Only paths that exist now count, so people already cut off make no node critical, and a flooded node whose drying would reconnect others is critical; a flooded hub is critical and carries everyone who would reach it dry. Forty-eight searches of 24 nodes; exact.

## Sumps

Each sector has one sump, `sumpLevel` in [0, 1] of capacity `SUMP_CAP` m³.

- **Inflow** (m³/h): seepage `SEEP_TOP + SEEP_STEP × (level − 1)`, plus the inflow of any **flood** event `{ atH, sector, inflowM3h, durH }` on that sector active at `t`, on `[atH × 3600, (atH + durH) × 3600)`. Events of other types are ignored.
- **Outflow** (m³/h): `PUMP_CAP × pumpFrac`, where `pumpFrac` in [0, 1] is the served share of the sector's pump power `PUMP_KW`.
- **Step:** `sumpLevel + (in − out) × dt / 3600 / SUMP_CAP`, clamped to [0, 1].
- **Flooded:** a node floods when its sump reaches 1 and stays flooded until the sump falls below `RECOVER`. An edge is passable when neither end is flooded.

## Interface

`districtTunnels() → World['tunnels']`, `reachable(edges, hub, nodes)`, `strandedIfLost(edges, flooded, people, hub)`, `sumpStep(level, sumpLevel, inflowM3h, pumpFrac, dt)`, `floodInflow(events, sector, t)`, `isFlooded(sumpLevel, wasFlooded)`, and the constants `HUB`, `SUMP_CAP`, `SEEP_TOP`, `SEEP_STEP`, `PUMP_CAP`, `PUMP_KW`, `RECOVER` (adapters import these rather than re-declare them). Every function throws `RangeError` on bad input (WORLD-TUNNEL-008).

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Critical sections | Per node, the people with a path now who lose it when the node floods | Tarjan bridges on edges; counting everyone cut off after removal | Flooding is per sector (the contract's `sumpLevel`), so a node is what is lost. Counting people already cut off would make every node of a stranded region critical and spend pump floors where pumping reconnects no one |
| Hydraulics | One sump per sector, mass balance | Water depth per tunnel edge | One number per sector is what the contract holds and what the pumps act on |
| Recovery | Hysteresis at `RECOVER` | Passable as soon as the sump drops below 1 | Stops a node flickering between flooded and dry every step |
| Topology | Fixed, two exits above, one shaft below | Random graph per seed | A fixed layout makes the critical sections stable and explainable across seeds |

## Open Questions & Future Decisions

### Deferred
1. Forecast time to impassable for display: `timeToLimit` from the air model applies to a linear fill only approximately; a linear forecast `(1 − level) × SUMP_CAP / (in − out)` is used where needed.
2. Detours over the safe graph (ROUTE packets) belong to care delivery in rung 4.

## References

- Graph search: any algorithms text (breadth-first search)
- `docs/plan.md` problem 5; `docs/params.md`
