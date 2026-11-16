---
parent: adapters-design
prefix: ADAPT-POWER
---

# Power adapters: p01 warning, p02 fair sharing

## Context and design philosophy

`p01` runs the grid and scores the warning; `p02` decides who gets power, water and food and scores how the worst-off fare. They serve problem 1 (warn before power cuts out) and problem 2 (share power, water and food fairly). The hum says **when**; the policy decides **who**. Both policies see the same capacity, the same trigger and the same reserve, so the metrics measure the rule and nothing else.

## p01: grid and warning

Each step, in this order:

1. **Cut events.** For each sector, compare its power in `alloc.power[sectorId(s)]` (written by `p02` in the previous step) with the power one step earlier. A sector going from fully served (at least `powerDemand × (1 − 1e-9)`) to not fully served is a cut event at time `t − dt`, when the allocation was made.
2. **Warned or not.** Under STRATUM, a cut event is warned when the tier has been AMBER or RED without a break since at least `WARN_LEAD` before the cut. Under the Directorate no event is warned: the Directorate gives no warnings and residents have no tracker.
3. **Grid.** Capacity from `capacityAt(script events, t, NOMINAL)`, load as the sum of `alloc.power`, then `swing` and `tierOf` from the grid model. Write `grid.f`, `grid.rocof`, `grid.tier` and `grid.gapMW = capacity − load`.

`DEMAND_MW` is the district's full power demand, the sum of `powerDemand(sectors[s].people)` over sectors. `NOMINAL` is `CAP_MARGIN × DEMAND_MW`. A slow shortfall sags the hum through AMBER and RED for many minutes before the shed; a trip drops it past the shed threshold within one step, so its cut events are never warned. Both outcomes are reported.

**Metric:** "cuts warned 10 min ahead", the share of cut events that were warned, unit `share`.

*What sets this number.* Under the Directorate it is 0 by rule. Under STRATUM a cut is warned only when the loss ramps slower than about 2.7% of nominal capacity per hour (AMBER at about 4.79% loss, the shed at about 5.24%, ten minutes apart), so the script's ramp rates set it. In the seven-day script the hour-30 and hour-64 shortfalls are warned. The real-time act "The hum sags" shows the hum falling, but its shed lands under a minute later, too short to count.

## p02: power, water and food

**Shedding.** Shedding starts in a step where `grid.f ≤ F0 − SHED_HZ` and stops in a step where capacity covers the full demand with the reserve: `capacity ≥ DEMAND_MW × (1 + RESERVE)`. While shedding, the power to hand out is `target = capacity / (1 + RESERVE)`; otherwise every sector gets its full demand.

**Power while shedding.**
- *Directorate:* starting from the sectors served in the previous step, cut whole sectors in shed order (level 6 first, within a level sector 3 first) until the served load fits `target`; then restore cut sectors in the reverse order whenever a whole sector fits what is left. A sector gets its full demand or 0.
- *STRATUM:* `allocate(target, claims).shares` with floor `lifeFloor` and demand `powerDemand` per sector. Every sector keeps its life floor while `target` covers the sum of floors.

**Water.** Supply is `RECYCLE_LPD × people × grid served fraction` L/day. Directorate: split in proportion to demand among sectors with power above 0. STRATUM: `allocate(...).shares` with floor `WATER_FLOOR` and demand `WATER_DEMAND` per person per day.

**Food.** The central farms deliver `FOOD_SUPPLY` kcal per person per day to the sectors they reach. While a `farm-cut` event is active on a level (`farmCut`), the farms cannot reach it and the supply shrinks by its people. Directorate: split in proportion to demand among reached sectors; a cut-off level gets 0, since the Directorate moves no food between levels. STRATUM: `allocate(...).shares` over all 24 sectors with floor `FOOD_FLOOR` and demand `FOOD_DEMAND` per person per day, so a cut-off level gets its share: residents' couriers carry it in (OFFER and NEED, an assumption). What each sector then eats, and its store, is `p12`'s (`docs/intent/adapters/lightfood`).

**Metric:** "worst-decile served fraction", unit `share`. For each sector and good, the cumulative served fraction is granted over demanded, summed over steps. A sector's score is the mean of its three goods. Sort sectors by score, rising; the metric is the person-weighted mean score of the worst-off 10% of people, taking a fraction of the last sector needed to reach exactly 10%. Under a farm cut-off the Directorate's cut-off level gets no food, which can set its worst decile. It draws nothing, so it varies with the script and parameters, not the seed.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Who sheds | Same trigger and target for both policies | STRATUM sheds earlier on the AMBER tier | The comparison isolates the rule of who is cut |
| Directorate order | Deepest first, fixed, whole sectors | Random or rotating cuts | The world text states deepest first; breakers act on whole feeders |
| STRATUM power | `allocate`: floors, then water-filling | `rotate` of whole feeders | Floors keep fans, pumps and medical loads in every sector; sharing below demand is what a level does with its own loads |
| Water and power | Directorate pipes water only to powered sectors | Water independent of power | Pumps and recyclers need power; this is the physical reason deep cuts also take water |
| Food under a farm cut-off | STRATUM shares deliveries over all sectors | Leave the cut-off level out of the food term; pool food again in `p12` | One allocation per good; leaving the level out would hide its hunger from problem 2 |
| Metric | Mean of three goods, worst 10% of people | Minimum over goods; Jain index | Readable as "the worst-off got this share"; the others are deferred secondary metrics |
| Warning under the Directorate | None counted | Credit the hum anyway | Without the toolkit nobody reads the hum, and the Directorate announces nothing |

## Open Questions & Future Decisions

### Deferred
1. Floor-breach person-days and the Jain index as secondary metrics.
2. Debt rotation of whole feeders, if partial sector supply proves unrealistic for some loads.
3. Mesh GRID_ALERT packets to sectors that have lost the hum, and the Shed Ledger's cut odds.

## References

- `docs/intent/world/grid/grid-design.md`; `docs/intent/fairshare/fairshare-design.md`; `docs/plan.md` problems 1 and 2
