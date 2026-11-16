---
parent: adapters-design
prefix: ADAPT-SPACECARE
---

# Space and care adapters: p06 space, p10 care delivery

## Context and design philosophy

`p06` decides when each household sleeps and scores the sleeping floor each sleeper has; `p10` answers sick children's care requests with couriers and scores how long a RED child waits for care. They serve problem 6 (find, make or share space) and problem 10 (basic care for people who cannot reach a clinic). Both turn an indivisible good into turns with Fair Share's `rotate`: the good sleep shift, and the places where pop-up care points stand.

## p06: sleeping space

**Tracked households.** Each sector's tracked households stand for all its people, each tracked member for `weight(world, s)` people (`docs/intent/adapters/policy`).

- *Directorate:* every household keeps its own room and sleeps there whatever its shift, so the sleeping floor per person is `sleepM2(AREA_M2, people)`, the whole area when nobody is left. `households[].shift` is left as it is.
- *STRATUM:* each sector's rooms are pooled and slept in by shift. At 00:00 each day (`t = 0` included), for each sector: the good shift (shift 0, the night) holds `floor(Σ tracked members / SHIFTS)` tracked members; `rotate(that, claims, rng)` gives it out with one claim per household (`id` the household id, floor 0, demand its members, its debt), so a household sleeps whole or not at all on it. The other households go to shifts 1 and 2 by `fill` from empty loads, in household order. Debts start at 0, update by `nextDebt` and are kept per household, so the household passed over today is more likely to get the night tomorrow.

**Writes.** `sectors[].sleepM2` at each 00:00 (`sleepM2(AREA_M2, people)` under the Directorate and for a sector with no tracked households; under STRATUM `sleepM2(AREA_M2, sleepers)` for the shift with the most sleepers by `shiftSleepers`), and under STRATUM `households[].shift`. `p06` never changes a household's id, sector or members, so `p07`'s household map stays valid.

**Metric:** "sleeping m2 per sleeper (busiest shift)", unit `m2`: the person-weighted mean of `sectors[].sleepM2`. It is not living space: Sphere's 3.5 m² is covered living space per person at all times, and that stays 2.0 under both policies.

*What sets this number.* Under the Directorate it is 2.0 by the area; under STRATUM it is close to three times that, less what whole households cost in balance. The gain is arithmetic. The cost is reported beside it: `census(world, policy)` gives, per sector and shift, the people asleep, the floor assigned but empty under one room per household, and the number of households that sleep in the same space each day (1 under the Directorate, up to 3 under STRATUM, which raises contacts).

## p10: care delivery

**Requests.** On its first step, before any other draw, `p10` draws the whole run's requests with `careRequests(script.events, rng)`, so both policies face the same children.

**Reaching the service.** A request sent while the network is up arrives at once. While it is down:
- *Directorate:* it waits for the 06:00 bulletin of `p07`, or the end of the network cut if that comes first.
- *STRATUM:* it travels over the mesh and arrives at once when its sector has a passable path of at most `MAX_HOPS` (4) hops to the nearest care point and every hop succeeds, each with probability `P_HOP`, as in `p07`. Reach is decided once, when the request is sent; otherwise it waits as under the Directorate.

**Care points and couriers.**
- *Directorate:* the hub clinic (node 0) with `COURIERS` couriers.
- *STRATUM:* the hub with one courier, plus `POPUP` pop-up points with one courier each, so staff is equal. At 00:00 each day, `rotate(POPUP, claims, rng)` places them, with one claim per level (`id` `L<level>`, floor 0, demand 1, debt the requests from that level that reached the service in the previous 24 h): weight follows need. A level's pop-up stands at its node `(level − 1) × 4 + 1`. Courier 0 stays at the hub; couriers 1 and 2 take the winning levels in rising level order. A busy courier moves when its busy time ends, at no travel cost. At 00:00 the pop-ups are placed first, then arrivals decided, then requests dispatched.

**Dispatch.** Each step, waiting requests are taken in order: by arrival at the service under the Directorate; RED before AMBER, then by arrival, under STRATUM (triage). Each goes to the free courier with the fewest passable hops (`hopsFrom` over `tunnels.edges`), lower courier index on a tie; first care comes `firstCareMin(hops)` after the later of the step's start and the request's arrival and the courier is busy for `busyMin(hops)`. A request no free courier can reach keeps waiting, and later requests may go first.

**Metric:** "median hours to first care (RED)", unit `h`: the median, over RED requests sent so far, of the time from the request to first care, counting a RED request still waiting at its wait so far (a lower bound). The upper middle on an even count; 0 before the first RED request.

*What sets this number.* With the network down, the bulletin: up to a day of waiting under the Directorate. The pop-up points and triage shorten the walk and the queue. The Directorate's figure is set by its bulletin rule.

## Interface

`createP06(policy, script)`, `createP10(policy, script)`; `census(world, policy)` reads the world only.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Directorate space rule | One room per household, kept | Shift sharing ordered by the Directorate | The world as stated: families packed into rooms meant for one. It is the status quo, not a weak rule |
| Good shift | The night, given by `rotate` with debt | Fixed shifts; all shifts equal | People prefer the night; rotation shares it, and debt stops one household always losing |
| Space metric | Sleeping m² per sleeper in the busiest shift | Share of people above 3.5 m² | The plan's metric. It is sleeping floor, not Sphere living space; the census carries the cost |
| Courier order under STRATUM | Triage, then first come | `rotate` of each courier visit | Sending RED first is the care rule; a lottery between waiting children adds chance and no fairness. `rotate` decides where care points stand |
| Directorate care | One clinic, first come, first served | Couriers that never leave the clinic | A competent clinic with couriers; the bulletin delay is the Directorate's own network rule |
| Equal staff | Three couriers under both | More couriers under STRATUM | The comparison measures where they stand and in what order they go |
| Mesh reach for care | `P_HOP` per hop, as in `p07` | Lossless within 4 hops | The same toolkit must not be lossy in one adapter and perfect in another |

## Open Questions & Future Decisions

### Deferred
1. Peak power load by shift, and the contact cost fed into the epidemic.
2. Couriers carrying medicine stock; stock-out days in deep levels.
3. Real NEED packets from the room as requests.

## References

- `docs/intent/world/space`, `docs/intent/world/care`, `docs/intent/world/tunnels`; `docs/intent/fairshare` (`rotate`, `nextDebt`); `docs/intent/adapters/family` (the bulletin)
