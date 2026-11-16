---
parent: high-level-design
prefix: ADAPT
---

# Adapters

## Problem

Each of the fifteen problems needs one place where District 7's physics meets an engine and a metric is taken, under two policies: the Directorate's and STRATUM's. The comparison is only worth something if both policies face the same supply, the same events and the same seeded streams, and if the Directorate's rules are the ones a reasonable operator would run, not a straw man.

## Approach

One adapter per problem, `p01` to `p15`, in `src/core/adapters`, one module per file. An adapter implements `Adapter` from `contracts.ts`: it declares `reads` and `writes`, steps the world by calling the world models and engines, and returns one labelled `Metric`. The kernel calls adapters in id order with one `rng` stream each and guards their writes.

`createAdapters(policy, script)` builds a fresh set for one run. `policy` is `'directorate'` or `'stratum'`; the script is the scenario's events (see `docs/intent/scenario`). Both policies use the same models, the same supplies and the same seeded stream per adapter; draws stay aligned until a policy changes a drawn quantity (the number of new cases, or which hops are simulated). Only the rule that decides who gets what, who is told, and which figure is believed changes. Every adapter keeps its private state (debts, histories, detectors, relays) in its own closure, created fresh by `createAdapters`, so a run replays from its seed.

**Reuse an engine over adding one.** Every STRATUM mechanism below is an existing engine configured: Fair Share (`allocate`, `rotate`, `nextDebt`), Witness (detector, `observe`, `chapman`, `quorum`), Mesh (`createRelay`). No adapter adds a new allocation or detection rule.

## The two policies

**The Directorate** (the world's stated behaviour, run competently):

| Good or duty | Rule |
| --- | --- |
| Power | When the hum falls to the shed threshold, cut whole sectors, deepest level first (within a level, the highest sector first), until the load fits capacity less a reserve. Restore whole sectors, top level first, as capacity returns. No rotation, no warnings |
| Water | Recyclers need power: piped water reaches powered sectors only, split in proportion to demand |
| Food | Daily deliveries split in proportion to demand across the sectors the farms reach; a level under a farm cut-off gets none |
| Cooling, pump power | The plant's output, scaled by the grid's served fraction, split in proportion to demand among powered sectors |
| Water quality | One grab sample per level each day at 06:00; the lab result is published 24 h later as the official figure. A level is told to stop drinking when a published result is unsafe, until a later published result is safe |
| Outbreak | The official count is the clinic list. Medicine is sent in proportion to each sector's recent clinic cases |
| Messages | With the network down, messages wait for the daily 06:00 bulletin, which delivers every one of them |
| Sleeping space | Each household keeps its own room and sleeps there whatever its shift |
| Care | One clinic at the hub with three couriers, first come, first served; requests wait for the bulletin while the network is down |
| Light | Lamp energy shared equally per person; grow-room seats go to the farm workers |
| Food stores | When deliveries stop, each sector eats the standard ration from its own store; no food moves between levels |
| Surface | The official verdict is `sealed`; it publishes no readings |
| Trials | Its own team from level 1 goes straight to 30 days in the option its verdict names |
| Return | Upper levels first, families whole, at the same daily pace |

**STRATUM** (the toolkit's engines in use):

| Good or duty | Rule |
| --- | --- |
| Power, water, food | Fair Share `allocate`: life floors first, then raise the worst-off. Same trigger, same capacity, same reserve as the Directorate. Farm deliveries are shared over all sectors, a cut-off level included (residents' couriers carry it) |
| Cooling | Fair Share with a floor that cools a refuge room in every sector, people rotating through it |
| Pump power | Fair Share with full floors for critical sections (those whose loss strands a neighbourhood) |
| Water quality | Witness detector on every recycler channel; HOLD WATER for the level after a notify delay. Measured beside official in the ledger |
| Outbreak | Chapman estimate from the clinic list and residents' reports, pooled over the district; medicine follows the estimate by Fair Share. Measured beside official in the ledger |
| Messages | Mesh relay between sectors, along passable tunnels; the daily bulletin still carries what the mesh did not deliver |
| Sleeping space | Rooms pooled per sector and slept in by shift; Fair Share `rotate` of the night shift by debt, households whole |
| Care | Requests over the mesh; Fair Share `rotate` places two pop-up care points by yesterday's requests; RED before AMBER; the same three couriers |
| Light | Fair Share `rotate` of whole 4 h bright sessions by debt; grow rooms count as bright rooms |
| Food stores | Each sector eats its share up to the standard ration and tops up from its store to the floor only; grow rooms grow the crop with the most kcal per kWh |
| Surface | Witness `quorum` over crews' readings gives a band; measured beside official in the ledger |
| Trials | The option the measured band requires, staged 1 h to 30 days with stop rules; volunteers by Fair Share `rotate` lottery, one stage each |
| Return | Fair Share `rotate` of daily slots with debt that starts higher for deeper levels, families whole |

The Directorate's own services (grab samples and their published results, the clinic count, the daily bulletin) keep running under STRATUM. STRATUM adds the residents' tools; it removes nothing.

**The honest claim.** In the Hollow the Directorate holds the breakers. The STRATUM policy shows what the same supply does under the fair rule, whether the rule is adopted under the pressure of the evidence or applied by levels to what they control. Every STRATUM metric is labelled SIMULATED.

## Shared conventions

- **Claim ids:** sector `s` claims as `sectorId(s)`, `s00` to `s23`, so Fair Share's id order is sector order. Every allocation is keyed by claim id: sector `s`'s power is `alloc.power[sectorId(s)]`, never `alloc.power[s]`.
- **Units in `World.alloc`:** power, cooling and pumps in MW; water in L/day; food in kcal/day; medicine in courses/day; lamp-hours in bright person-hours/day; trial slots in volunteers; return slots in people with a slot on the plan's first day. `alloc.bunks` is unused: sleeping space is in `sectors[].sleepM2` and `households[].shift`.
- **Pools:** cooling and pump power come from plants whose output is their nominal capacity times the grid's served fraction (power served over power demanded), so a grid shortfall squeezes them under both policies alike.
- **Labels:** every metric is SIMULATED. Live packets that reach the district are shown as LIVE on the family board but never enter a metric.
- **What sets a number.** Some Directorate figures follow from a stated rule: no warnings (p01 is 0), a daily lab (p04 exposure), a daily bulletin (p07, p08 and p10), clinic capture (p09), one room per household (p06), equal lamp time below the threshold (p11), no food moved between levels (p12), a fixed verdict (p13, p14), strict level order (p15). There the gap between policies shows the mechanism, not a measured gain, and each leaf names what sets its metric.

## Who writes what

The kernel guards writes per top-level `World` key, so adapters that share a key also share a rule: each writes only the sub-fields it owns, and never replaces an object it does not own.

| Sub-field | Owner |
| --- | --- |
| `grid` | p01 |
| `alloc.power`, `alloc.water`, `alloc.food` | p02 |
| `alloc.cooling`; `sectors[].temp`, `wetBulb`, `co2` | p03 |
| `sectors[].water`; ledger entries of kind `water.*` | p04 (ledger only through `Witness.observe`) |
| `alloc.pumps`; `sectors[].sumpLevel`; `tunnels.edges[].passable` | p05 |
| `mesh.inbox` (removes); `mesh.delivered` (appends only) | p07 |
| `mesh.inbox` (appends only) | p08, and the runner's `inject` between steps |
| `alloc.medicine`; `sectors[].stock`; ledger entries of kind `cases*` | p09 (ledger only through `Witness.observe`) |
| `sectors[].sleepM2`; `households[].shift` | p06 (never a household's id, sector or members) |
| `alloc.lampHours`; `sectors[].lightDose` | p11 |
| `sectors[].foodKcal` | p12 |
| `surface.readings` (appends only), `surface.band`; ledger entries of kind `surface.*` | p13 (ledger only through `Witness.observe`) |
| `alloc.trialSlots` | p14 |
| `alloc.returnSlots` | p15 |

## Rung 3 adapters

| Id | Problem | Leaf | Reads | Writes | Metric |
| --- | --- | --- | --- | --- | --- |
| p01 | 1 Warning | power | grid, sectors, alloc | grid | share of cut events warned 10 min ahead |
| p02 | 2 Fair sharing | power | grid, sectors, alloc | alloc | worst-decile served fraction |
| p03 | 3 Heat | livable | sectors, alloc | sectors, alloc | person-hours above 27.5 °C wet-bulb |
| p04 | 4 Water | evidence | sectors | sectors, ledger | person-hours of unsafe water drunk |
| p05 | 5 Tunnels | livable | sectors, alloc, tunnels | sectors, tunnels, alloc | stranded person-hours |
| p07 | 7 Mesh | family | mesh, tunnels, households | mesh | share of messages delivered within 60 min |
| p08 | 8 Families | family | mesh, households | mesh | mean hours until a separated member's status is known |
| p09 | 9 Outbreak | evidence | sectors, alloc | sectors, alloc, ledger | relative error of the case figure acted on |

| Leaf | Folder | Prefix |
| --- | --- | --- |
| Factory and conventions | `adapters/policy` | ADAPT-POLICY |
| p01, p02 | `adapters/power` | ADAPT-POWER |
| p03, p05 | `adapters/livable` | ADAPT-LIVABLE |
| p04, p09 | `adapters/evidence` | ADAPT-EVIDENCE |
| p07, p08 | `adapters/family` | ADAPT-FAMILY |

## Rung 4 adapters

| Id | Problem | Leaf | Reads | Writes | Metric |
| --- | --- | --- | --- | --- | --- |
| p06 | 6 Space | spacecare | sectors, households | sectors, households | sleeping m2 per sleeper (busiest shift) |
| p10 | 10 Care | spacecare | tunnels | (none) | median hours to first care (RED) |
| p11 | 11 Light | lightfood | sectors, alloc, households | sectors, alloc | share of person-days with 4 h of daytime light |
| p12 | 12 Food | lightfood | sectors, alloc | sectors | days the food floor held after a farm cut-off |
| p13 | 13 Surface | surface | surface | surface, ledger | wrong-band rate |
| p14 | 14 Pioneers | surface | surface, households | alloc | protection factor proven over 30 days |
| p15 | 15 Return | surface | households, sectors | alloc | worst level's mean wait |

| Leaf | Folder | Prefix |
| --- | --- | --- |
| p06, p10 | `adapters/spacecare` | ADAPT-SPACECARE |
| p11, p12 | `adapters/lightfood` | ADAPT-LIGHTFOOD |
| p13, p14, p15 | `adapters/surface` | ADAPT-SURFACE |

Every rung 4 adapter does its work at most hourly, daily, per reading round or once per plan, except p10, which checks a short request queue each step, so fifteen adapters stay inside spike T5's budget. p14 computes trial plans from the current verdict, and p15 plans the return once from the households and reception; neither runs moves in world time. Metrics where lower is better: p10, p13, p14, p15; higher is better: p06, p11, p12.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Policy switch | Chosen when adapters are created | A policy field in `World`; a switch mid-run | Fixed per run keeps runs reproducible and comparable; the page runs both policies side by side to switch instantly |
| Directorate baseline | Competent priority and proportional rules, published | No allocation at all; random cuts | A weak baseline would make any gain meaningless. Deepest-first is the world's stated behaviour; the rest is standard practice |
| Same trigger and capacity for both | Yes | Let STRATUM shed earlier | Only the rule of who gets cut differs, so the metric isolates it |
| One metric per adapter | The plan's headline metric | Several metrics per adapter | `Adapter.metric` returns one; secondary metrics are derived by the harness from the final world or wait for a later decision |
| Adapter state | Closures created per run | Everything in `World` | The contract has no fields for detectors, debts or relay counts; a fresh closure per run is reproducible |
| Directorate services under STRATUM | Keep running | Replace them with the toolkit | STRATUM is what residents add. Removing the bulletin or the lab would credit the toolkit with losses the Directorate's own services prevent |
| p03 mechanism | Fair Share refuge floors | The plan's "steer cooling to where it removes the most person-hours" | Floors reuse the engine unchanged; a person-hours optimiser is a new rule. Steering is deferred |
| p04 metric | Person-hours of unsafe water drunk | The plan's "people exposed before the alert" and "false alarms per week" | One number that counts both late alerts and exposure time; false alarms are a deferred secondary metric |
| Rung 4 summaries | Pure functions the page and harness call (`census`, `trialPlan`, `kwhToFeed`) beside one metric | An additive field on `Adapter` for secondary metrics | No contract change; the numbers a judge needs beside each metric are computed from the world and the script |
| p08 metric | Mean hours until a separated member's status is known | The plan's "time until every member has a known status" | The maximum is set by the slowest member, whom the bulletin reaches at the same hour under both policies; the mean shows how many are reached sooner |

## Open Questions & Future Decisions

### Deferred
1. Secondary metrics per problem (floor-breach person-days, Jain index, false alarms per week, infections averted, delivery delay). Rung 4 computes its cost figures (contacts, trial exposure-hours and breaches, lamp energy to feed a person) in the harness from pure functions; an additive field on `Adapter` waits for a decision.
2. p03 steering of cooling to where it removes the most person-hours.
3. The Shed Ledger fed with simulated power reports, so p01 can show each level's cut odds in the district.
4. Ablations (each engine off alone): a third and fourth policy value, once the two-policy comparison runs.

## References

- `docs/plan.md` (mechanisms, anchors and metrics per problem; the honest claim for problem 2)
- `docs/intent/fairshare`, `docs/intent/witness`, `docs/intent/relay`, `docs/intent/world`, `docs/intent/kernel`
