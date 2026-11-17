---
parent: adapters-design
prefix: ADAPT-LIGHTFOOD
---

# Light and food adapters: p11 light, p12 food

## Context and design philosophy

`p11` turns each sector's lamp energy into bright sessions and scores how many people get enough daytime light; `p12` keeps each sector's food store, decides what people eat when the farms stop, and scores how long the food floor holds. They serve problem 11 (track and treat life without sunlight) and problem 12 (grow and share a neighbourhood's own food). Both policies get the same lamp energy, the same grow rooms and the same deliveries; only the rule for who gets the light and how the food is shared differs.

**Power.** Lamps and grow lamps run on the sector's power. Once an hour (`t mod 3600 = 0`) each adapter records each sector's power served fraction (ADAPT-POLICY-006); a day's fraction `f_s` is the mean of that day's samples. At 00:00 the daily decision runs first, on the day just ended; that step's sample belongs to the next day. A dark sector gets no lamp light and grows nothing.

## p11: light

At 00:00 each day after the first (`t > 0`), for the day that just ended, per sector:

- *Directorate:* lamp energy is shared equally per person, so everyone gets `h = LAMP_H × f_s` bright hours. Everyone meets the daytime threshold when `h ≥ BRIGHT_H`. Otherwise only the farm workers do: grow rooms are farm workplaces, and their `growSessions(f_s)` seats go to the same workers each day.
- *STRATUM:* the energy buys whole sessions, and the grow room adds its seats: `n = sessions(lampKWh(people) × f_s) + growSessions(f_s)`. `rotate(floor(n / w_s), claims, rng)` hands the sessions to whole households (one claim each: its id, floor 0, demand its members, its debt), debts update by `nextDebt`, so a household passed over today is likelier tomorrow. The share meeting the threshold is `min(1, w_s × winners' members / people)`.

**Writes.** `alloc.lampHours[sectorId(s)]`: lamp person-hours that day, grow seats included under STRATUM only (`h × people` under the Directorate, `n × BRIGHT_H` under STRATUM), so the two policies' figures are not comparable. `sectors[].lightDose`: the mean melanopic dose per person: under the Directorate the people-weighted mean of `dose(h)` for residents and `dose(h + BRIGHT_H)` for farm workers; under STRATUM `share × dose(BRIGHT_H) + (1 − share) × dose(0)`.

**Metric:** "share of person-days with 4 h of daytime light", unit `share`: over the completed days, people meeting the threshold over all people, summed over sectors and days; 0 before the first day ends. No step falls at the end of the run, so its last day is not scored.

*What sets this number.* The lamp budget `LAMP_H` against the session length `BRIGHT_H`. Spread evenly, two hours each reaches nobody's four, so under the Directorate only the farm workers meet it (about 0.2); whole sessions in turn reach most people each day at the same kWh. If `LAMP_H` reached `BRIGHT_H`, both policies would score 1. The mean dose is almost the same under both: the gain is in who crosses the threshold, not in total light.

## p12: food

**Store.** On its first step `p12` gives each sector `STOCK_DAYS × FOOD_SUPPLY × people` kcal in `sectors[].foodKcal`. Each hourly sample adds `grown(GROW_KW × GROW_LAMP_H / 24 × f, crop)` to the sector's grown food, with `crop` the farms' `STAPLE` under the Directorate and `bestCrop()` under STRATUM.

**Each day at 00:00** (`t = 0` included), a sector's arrivals are that day's delivery, `alloc.food[sectorId(s)]` at that step (kcal for one day, from `p02`), plus what it grew since the last 00:00. Deliveries come once a day, so a cut-off that starts after 00:00 stops the next day's delivery. Then:

- *Directorate:* each sector eats the standard ration `FOOD_SUPPLY` per person from its arrivals and its own store, as far as they go. Nothing moves between sectors: the Directorate controls movement between levels.
- *STRATUM:* `p02` has already shared the deliveries across the district with the food floor (OFFER and NEED), so a cut-off level gets its share through residents' couriers. Each sector eats its arrivals up to the standard ration and stores the rest; when that is below the floor, it tops up from its own store to the floor, as far as the store goes.

The store keeps what was not eaten. A sector **breaches** the floor on a day when it eats less than `FOOD_FLOOR` per person (with a relative tolerance of 1e-9). The standard ration is `FOOD_SUPPLY` (2,300 kcal), what the farms deliver per person; `FOOD_DEMAND` (2,500), which `p02` scores against, is what people would eat with no limit.

**Metric:** "days the food floor held after a farm cut-off", unit `days`: from the first daily decision that a `farm-cut` event covers (the first missed delivery), the time until the first daily decision in which any sector breaches, or until now if none has; 0 before the cut-off and in a script without one that stops a delivery.

*What sets this number.* The store (`STOCK_DAYS`) and the gap between the standard ration and the floor. Grow rooms add little: at the floor, one person needs about 210 kWh of lamp energy a day even with the best crop (`kwhToFeed`), so lamps cannot replace the farms. Sharing at the floor lowers everyone else's ration to 2,100 kcal while a level is cut off; that cost is stated, not hidden. The Directorate moves no food between levels, which sets its number. STRATUM assumes residents' couriers can carry food into a level the farms cannot reach; without that the two policies tie.

## Interface

`createP11(policy, script)`, `createP12(policy, script)`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Directorate light rule | Equal bright time per person | Lamps sold to who pays; upper levels first | Equal per person is the fairest-looking utility rule, so the comparison isolates spreading against rotating |
| Lamp sessions | `rotate` of whole 4 h sessions by household | `allocate` of hours | Light is a threshold good: hours spread below the threshold help nobody |
| Day of light | Scored at the end of the day with the power it had | Decided at 00:00 with the power then | A cut during the day removes that day's lamps; scoring after the fact is exact and cheap |
| Who shares food | `p02`, across the whole district by the floor rule; `p12` keeps only the stores | Pooling a second time in `p12`; one level's own stock only | One allocation per good, so `p02`'s served fraction and what people eat agree. A level alone cannot cover a cut-off; OFFER and NEED between levels is the plan's mechanism |
| Directorate grow seats | Farm workers meet the threshold | Count nobody under grow lamps | The seats exist under both policies; only who sits in them changes |
| Daily deliveries | Read once, at 00:00 | Hourly samples of the delivery rate | Farms deliver daily; the metric starts at the first missed delivery, so where a cut-off starts within the day does not move it by a day |
| Directorate food | Standard ration from each sector's own store | No store; rationing to the floor | Stores and a standard ration are what a central farm system runs; the Directorate does not move food between levels |
| Food metric | Days the floor held after the cut-off | Person-days below the floor | The plan's metric. Days are censored at the end of the run, and the harness reports the cost to other levels beside it |

## Open Questions & Future Decisions

### Deferred
1. Evening and sleep light thresholds, and the phone's sleep log.
2. Real OFFER and NEED packets from the room as food transfers.
3. Person-days below the floor as a secondary metric.
4. A harness sweep of `LAMP_H` (1 to 4 h), to show the Directorate's light result is set by that parameter.

## References

- `docs/intent/world/lightfood`; `docs/intent/fairshare`; `docs/intent/adapters/power` (food deliveries, farm cut-off); `docs/plan.md` problems 11 and 12
