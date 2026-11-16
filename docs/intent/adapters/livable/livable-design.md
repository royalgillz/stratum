---
parent: adapters-design
prefix: ADAPT-LIVABLE
---

# Livable adapters: p03 heat, p05 tunnels

## Context and design philosophy

`p03` divides cooling and steps heat and air; `p05` divides pump power and steps sumps and tunnels. They serve problem 3 (keep the lower levels livable), problem 5 (keep tunnels safe to live in and move through) and, through CO2, problems 1 and 9. Both divide a pooled plant that shrinks with the grid, and both reuse Fair Share with a floor that encodes what must not fail: a cool refuge in every sector, and pumps at the sections whose loss strands a neighbourhood.

## p03: cooling, heat and air

**Cooling pool.** `COOL_CAP` is the district's full cooling demand (sum of `coolingDemandMW`), computed on the first step. The pool each step is `COOL_CAP × grid served fraction`.

- *Directorate:* split in proportion to cooling demand among sectors with power above 0, each capped at its demand. A cut sector gets none.
- *STRATUM:* `allocate(pool, claims).shares` with demand the sector's cooling demand and floor `REFUGE` times it. The floor cools a refuge room that holds a share `REFUGE` of the sector's people; people rotate through it so everyone gets the same share of cool hours.

**Step.** Each unit of cooling is spent once. Under STRATUM the refuge takes its share first: `refugePaid = min(alloc.cooling[sectorId(s)], REFUGE × demand)` holds `refugePaid / demand` of the people at the setpoint, and the main area, holding the other `1 − REFUGE` of the people, gets cooling fraction `c = max(0, alloc − refugePaid) / ((1 − REFUGE) × demand)`. Under the Directorate there is no refuge and `c = alloc / demand`. Every fraction is clamped as in the policy conventions. Set `temp` by `tempStep` with `c` (so `temp` is the main area's temperature), `wetBulb` by `wetBulb(temp, RH)`, and `co2` by `co2Step` with the ventilation served fraction.

**Metric:** "person-hours above 27.5 C wet-bulb", unit `person-h`, summed over steps and sectors where the main area's wet-bulb is above 27.5 °C: people times `dt / 3600` under the Directorate, and people times `(1 − refugePaid / demand)` times `dt / 3600` under STRATUM. A refuge only excuses people while its floor is paid, and the cooling that pays it never also cools the main area.

*What sets this number.* The fixed 70% humidity: at constant moisture the uncooled deep levels stay below 27.5 °C wet-bulb and the metric is 0 under both policies (`docs/limits.md`).

## p05: pumps, sumps and tunnels

**Pump pool.** Each sector's pumps draw `PUMP_KW`. The pool is `24 × PUMP_KW / 1000 × grid served fraction` MW.

- *Directorate:* split in proportion to demand among sectors with power above 0, each capped at its demand.
- *STRATUM:* `allocate(pool, claims).shares` with demand the sector's pump power and a floor equal to that demand for **critical** sectors and 0 for the rest. A sector is critical when `strandedIfLost(world.tunnels.edges, flooded, people, HUB)` is above 0: its flooding would cut off people who reach the hub now, or its drying would reconnect them. Criticality uses the flooded flags held at the start of the step, before this step's sump update. Pump power goes first where its loss would cut off others.

**Step.** For each sector: `pumpFrac` is the served fraction of `alloc.pumps[sectorId(s)]` over its pump demand, new `sumpLevel` by `sumpStep` with the flood inflow of the script's flood events, flooded state by `isFlooded`, then every tunnel edge passable when neither end is flooded.

**Metric:** "stranded person-hours", unit `person-h`: each step, the people of every sector with no passable path to the hub (a flooded sector has none, unless it is the hub, which strands everyone when flooded), times `dt / 3600`, summed.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Cooling and pumps as pools | Plants scaled by the grid's served fraction | Part of each sector's power allocation | Keeps one allocation per good and lets both policies face the same squeeze; the cost is stated in `docs/limits.md` |
| Refuge rooms | A share of people held cool, rotated, paid first from the sector's cooling | Separate rooms as extra sectors; the whole allocation cooling the whole sector plus a refuge discount | Gives the person-hours effect with one parameter and spends each MW once; rotation changes who, not how many |
| Pump floors | Full floor for critical sectors | Rank by people isolated per kW and fill greedily | Fair Share with floors gives the same priority with the existing engine |
| Criticality | Recomputed each step from the flooded flags, counting only paths that exist now | Fixed at the start; counting people already cut off | A flood elsewhere can make a new section critical; pumping a node inside a region already cut off reconnects no one |
| Stranded | No path to the hub | No path to any neighbour | The hub holds the clinic, water point and way out; losing it is what isolation means |

## Open Questions & Future Decisions

### Deferred
1. A wet-bulb stop-work limit of 32.5 °C as a second threshold.
2. Mobile pumps moved to a flooding section.
3. Detour routes for couriers over the passable graph (rung 4, p10).

## References

- `docs/intent/world/airheat/airheat-design.md`; `docs/intent/world/tunnels/tunnels-design.md`; `docs/intent/fairshare/fairshare-design.md`
