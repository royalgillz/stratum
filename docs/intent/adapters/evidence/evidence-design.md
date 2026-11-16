---
parent: adapters-design
prefix: ADAPT-EVIDENCE
---

# Evidence adapters: p04 water, p09 outbreak

## Context and design philosophy

`p04` and `p09` are where the Witness engine proves something: that the water went bad before the taps did, and that the real outbreak is larger than the official count. They serve problem 4 (catch bad water before people drink it) and problem 9 (track the real outbreak and get supplies where they are needed). Under both policies the Directorate publishes its official figures into the ledger; under STRATUM the residents' measured figures sit beside them, so `gap(kind)` is the gap between the residents' figure and the official one.

**Witness instances.** On its first step each of p04 and p09 makes one `createWitness({ now: () => world.t, ledger: world.ledger })`. Two instances can share the chains, because `observe` reads each chain's head from the arrays.

## p04: water

**Step.** For each level, draw the recycler outlet quality with `outlet(level, t, events, rng)` and keep a history long enough for the longest tap delay. Set each sector's `water` to its level's outlet quality from `tapDelay(sector)` ago (the baseline before the history is that long).

**Alerts.**
- *Directorate (under both policies):* at 06:00 each day (`t mod 86400 = 21600`), take one grab sample of each level's outlet. Its result is published 24 h later as the official figure. A published unsafe result puts the level on official hold; a later published safe result lifts it.
- *STRATUM:* p04 makes its own `createDetector()` on its first step and pushes each level's four channels every step as `push('water.<channel>', 'L<level>', t, value)`, with channels cond, toc, turb and biocide. The detector writes nothing to the ledger. When an event opens on any channel of a level, a detector hold applies to that level from `tDetect + NOTIFY` until every event on that level has closed, plus the longest tap delay, so water already in the pipes is not drunk. Residents still hear official notices, so a level is on hold when the detector hold or the official hold applies. Detection takes a few minutes and the shortest pipe takes 60, so while `NOTIFY` stays under about 55 min the exact hold start does not change the metric.

**Ledger.** Each published grab result is observed as `('water.toc', 'L<level>', sample organic carbon, 'official')` at publication, under both policies. Every whole hour under STRATUM, `observe('water.toc', 'L<level>', outlet organic carbon, 'sensor:L<level>')`. The Directorate's figure is not false; it is a day late, and the gap shows by how much.

**Metric:** "person-hours of unsafe water drunk", unit `person-h`: each step, the people of every sector whose tap water is `unsafe` and whose level is not on hold, times `dt / 3600`, summed.

*What sets this number.* Under the Directorate, the 24 h lab turnaround against 60 to 120 min of pipe travel makes exposure certain; the gap shows the mechanism, not a measured gain.

## p09: outbreak

**Step**, in this order within one kernel step:
1. `seed` the sector of every outbreak event due in `[t, t + dt)`.
2. If `t mod 86400 = 0` (00:00, `t = 0` included), hand out medicine.
3. If `t mod 3600 = 0`, run `epiStep(state, t, co2, stock, 3600, rng)` with each sector's current `co2` and `stock`, and subtract the courses used from each stock.
4. If `t mod 86400 = 0`, write the day's ledger entries.

**Medicine.** At 00:00 of day `d` (`d = t / 86400`), the case window is days `d − CASE_WINDOW` to `d − 1` inclusive. `MED_SUPPLY` courses plus any held over are handed out:
- *Directorate:* in proportion to each sector's clinic-list cases (`n1`) in the window. With no clinic cases in the window, nothing is sent and the courses are held over.
- *STRATUM:* the district estimate `N = chapman(n1, n2, m).n` from the window's district totals; each sector's demand is `N × n2_s / n2_district`, its share of the residents' list, which has equal capture everywhere (the clinic list `n1` when `n2_district` is 0, which is the union `n1 + n2 − m` because then `m` is 0 too, and 0 for all when that is empty too); `allocate(courses, claims).shares` with floor 0; the surplus is held over.

The day's shares are written to `alloc.medicine` and added to each sector's `stock`.

**Cumulative figures.** `n1_cum`, `n2_cum` and `m_cum` are the counts summed over all sectors and all days since `t = 0`, read when used. The cumulative Chapman estimate is `chapman(n1_cum, n2_cum, m_cum).n`. `true` is the cumulative number of new infectious cases from `epiStep` (E to I); seeded index cases are on no list and outside `true`.

**Ledger.** Each day, under both policies, `observe('cases', 'district', n1_cum, 'official')`. Under STRATUM also `observe('cases', 'district', cumulative Chapman estimate, 'estimate:capture-recapture')` and `observe('cases.both', 'district', m_cum, 'estimate:capture-recapture')`, so the harness can flag days with fewer than 7 people on both lists, where the estimate is noise.

**Metric:** "case-count relative error", unit `ratio`: `|figure − true| / max(1, true)` at the current step, where `figure` is `n1_cum` under the Directorate and the cumulative Chapman estimate under STRATUM.

*What sets this number.* The clinic capture (0.6 at level 1 to 0.2 at level 6) sets the Directorate's error. The seven-day outbreak is small, so the harness takes p09's result from the 30-day run.

## Interface

`createP04(policy, script)` and `createP09(policy, script)` return an `Adapter` with fresh private state. `handOut(policy, courses, n1[], n2[], m[]) → { shares, held }` is p09's medicine rule as a pure function of the case-window counts per sector. Constants `NOTIFY`, `MED_SUPPLY` and `CASE_WINDOW` are in `docs/params.md`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Detector input | `createDetector()` per adapter, fed every step; ledger hourly | `Witness.observe` every step | `observe` writes the ledger, and a minute ledger holds over a million entries in 30 days; the detector needs no ledger |
| Directorate water | Daily grab sample, 24 h lab turnaround | No testing; continuous official sensors | Lab sampling is real utility practice; no testing would be a straw man |
| Hold end | All events closed plus the longest tap delay | Lift at detector close | Water already in the pipes is still bad |
| Pooled Chapman | One district estimate | Per-level estimates | The residents' list has equal capture everywhere, which keeps the pooled estimate unbiased under unequal clinic access; per-level counts are too small early on |
| STRATUM medicine shares | Each sector's share of the residents' list | Share of the union of both lists | The union's capture is 0.8 at level 1 and 0.6 at level 6, so it would under-serve deep sectors |
| STRATUM water hold | Detector hold or official hold | Detector hold only | Residents still hear the Directorate's notices |
| p09 truth | New infectious cases from E to I, seeds excluded | Seeds included | Seeds can be on no list, so counting them would bias both figures against a truth no list could reach |
| Medicine as divisible | Fractional courses in stock, whole courses treat | `rotate` of whole courses | Proportional and Fair Share shares then compare directly |
| p09 metric | Error of the figure each policy acts on | Infections averted | The estimate is the mechanism and is checkable; infections averted depend on assumed treatment effects and are a deferred secondary metric |

## Open Questions & Future Decisions

### Deferred
1. Wastewater signal per recycler through the detector, for days of lead.
2. Residents' "water looks wrong" reports from real packets, clustered per level.
3. False alarms per week and infections averted as secondary metrics.

## References

- `docs/intent/witness/witness-design.md` (detector, ledger, `chapman`); `docs/intent/world/water/water-design.md`; `docs/intent/world/epidemic/epidemic-design.md`
- Capture-recapture with one list of equal catchability: https://wwwnc.cdc.gov/eid/article/21/12/15-0756_article
