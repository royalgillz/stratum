---
parent: world-design
prefix: WORLD-SURFACE
---

# Surface and return model

## Context and design philosophy

The surface and return model holds the true air on the surface, the readings crews send down (some falsified), the protection a measured level requires, how staged trials of that protection end, and how many people a day can go back up. It serves problem 13 (prove whether the surface is safe), problem 14 (which option works, who goes first) and problem 15 (plan the move). Nobody can measure the real surface from inside a simulation; this model only lets the engines be scored against a truth they never read.

The least model that does it: three gases at fixed true levels per scripted campaign, uniform noise on each reading, falsified crews that report a fixed fraction of the truth, OSHA protection-factor logic with NIOSH limits, a deterministic trial outcome, and one throughput limit. Pure functions; only `crewRead` draws.

## Truth and readings

A `surface` event `{ atH, co, o3, so2, crews, falsified, bias }` sets the true concentrations (ppm) from `atH` until a later `surface` event. `surfaceAt(events, t)` returns the latest such event with `atH × 3600 ≤ t`, or null.

`crewRead(event, t, rng)` returns one `SurfaceReading` per crew and gas: crews `c1` to `c<crews>` in order, gases `co`, `o3`, `so2` in order, one draw each. A reading is `truth × k × (1 + CREW_NOISE × (2u − 1))`, where `k` is `bias` for crews `c1` to `c<falsified>` and 1 for the rest. Readings are taken every `READ_EVERY` hours from `atH`.

## Required protection and band

- **Hazard ratio:** `HR = max over gases of concentration / REL`, with `REL` the NIOSH recommended exposure limit of each gas.
- **Required protection factor:** `required(conc) = HR`, raised to at least `APF_SEALED` (10,000) when any gas is at or above its NIOSH IDLH value, because an atmosphere immediately dangerous to life calls for supplied-air protection whatever the ratio. It is also raised to at least `APF_SEALED` when carbon monoxide is above its REL: no air-purifying cartridge is approved for carbon monoxide (NIOSH lists only supplied-air respirators above its REL), and pressure-demand supplied air is the only supplied-air entry in `OPTIONS`.
- **Band** from the required factor `r`: `open` (r ≤ 1), `mask` (r ≤ 50), `suit` (r ≤ 1,000), `sealed` (r ≤ 10,000), `closed` (above). `bandOf(conc)` returns it. With these gases and limits `suit` cannot occur: ozone and sulfur dioxide reach their IDLH at exactly 50 times their REL, and carbon monoxide above its REL needs supplied air, so no required factor falls between 50 and 1,000; the band is kept for gases added later. `World.surface.band` also takes `unknown` when no verdict exists.
- **Option:** `OPTIONS` lists the assigned protection factors in rising order: none 1, half mask 10, full facepiece 50, powered full facepiece 1,000, pressure-demand supplied air 10,000. `optionFor(r)` is the first with factor at least `r`, or null above 10,000. Mapping suits, domes and outposts onto these factors is an assumption.

## Trials

`trialPlan(startR, trueR, staged)` walks options from `optionFor(startR)`. Each option runs its stages in order: `STAGES` (1 h, 24 h, 168 h, 720 h) when `staged`, else the 720 h stage alone, each with `TRIAL_N` people. A stage **breaches** when `trueR` is above the option's factor; a breach is seen at the first hourly check, so a breached stage costs `TRIAL_N × 1` person-hours, ends that option and moves to the next one. A stage that holds costs `TRIAL_N ×` its hours. The first option whose 720 h stage holds is **verified**. The plan returns `{ verified, exposureH, breaches, stages }`: `stages` lists the stages run, in order, as `{ factor, hours, breached }` (hours 1 for a breached stage), and `verified` is the verified option's factor, or 0 when no option holds. With no option for `startR` the plan is `{ verified: 0, exposureH: 0, breaches: 0, stages: [] }`. The outcome is deterministic: an option fails exactly when it protects less than the surface requires. So in this model staging never lowers exposure-hours: a breach is seen in the first hour whatever the stage. Its real value, catching harm that shows only after longer exposure, is not modelled.

## Return

`returnPerDay(shafts) = min(SHAFT_PPH × SHAFT_H × shafts, RECEPTION_PD)` people a day: a shaft lifts 21,400 people a day, so surface reception, not the shaft, sets the pace.

## Interface

`surfaceAt`, `crewRead`, `required`, `bandOf`, `optionFor`, `trialPlan`, `returnPerDay` and the constants `GASES`, `REL`, `IDLH`, `OPTIONS`, `APF_SEALED`, `CREW_NOISE`, `READ_EVERY`, `STAGES`, `TRIAL_N`, `SHAFT_PPH`, `SHAFT_H`, `RECEPTION_PD` (all in `docs/params.md`).

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Verdict | A band from the required protection factor | Safe or unsafe | The plan's answer: a measured band, not yes or no |
| Long-term limit | NIOSH REL per gas | IDLH only | IDLH marks immediate danger; living there needs the long-term limit |
| Falsified crews | Report a fixed fraction of the truth | Random lies | A coordinated lie is the hard case for a quorum; a stated bias is checkable |
| Trial outcome | Fails exactly when protection is below the true need | Draw each volunteer's real fit factor | No sourced fit-factor distribution; the deterministic rule isolates what staging buys |
| Return pace | The smaller of shaft and reception | Shaft throughput alone | The plan's result: reception is the real limit |
| Carbon monoxide | Above its REL, only supplied air counts | The same protection factors for every gas | Air-purifying respirators do not filter carbon monoxide |

## Open Questions & Future Decisions

### Deferred
1. Truth that changes within a campaign (the surface healing over time).
2. A sourced spread of real fit factors, so a trial can fail by chance.
3. Several shafts and a reception figure per district.

## References

- NIOSH IDLH values: https://www.cdc.gov/niosh/idlh/intridl4.html ; NIOSH Pocket Guide RELs (carbon monoxide, ozone, sulfur dioxide): https://www.cdc.gov/niosh/npg/
- OSHA assigned protection factors: https://obis.osha.gov/dte/library/respirators/presentation/slide33.html ; IDLH atmospheres need supplied air: https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.134
- Shaft throughput: `docs/params.md`; `docs/plan.md` problems 13 to 15
