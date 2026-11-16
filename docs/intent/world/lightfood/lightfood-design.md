---
parent: world-design
prefix: WORLD-LIGHTFOOD
---

# Light and food model

## Context and design philosophy

The light and food model turns lamp energy into bright sessions and melanopic light dose, and lamp energy in grow rooms into food. It serves problem 11 (track and treat what life without sunlight does) and problem 12 (grow and share a neighbourhood's own food). Both goods come from the same lamps: a grow room is a bright room, and light is a utility the Directorate sells.

The least model that gives the plan's metrics an honest value: daily energy budgets, whole bright sessions of a fixed length, a fixed ambient light level, and crops counted only by calories per kWh. It must also show the plain result that lamps cannot replace the farms. Pure functions, no randomness.

## Light

- **Threshold.** A person meets the daytime recommendation on a day when they spend at least `BRIGHT_H` hours at `BRIGHT_MEL` melanopic lux or more (at least `DAY_MEL`, 250 lux melanopic EDI). The rest of the `WAKE_H` waking hours are at `AMBIENT_MEL`. Evening and sleep thresholds are not modelled.
- **Lamp budget.** A sector's bright lamps get `lampKWh(people) = people × LAMP_H × SEAT_KW` kWh per day at full power: enough for `LAMP_H` bright hours per person if spread evenly.
- **Sessions.** One bright session seats one person for `BRIGHT_H` hours and costs `SEAT_KW × BRIGHT_H` kWh. `sessions(kWh) = floor(kWh / (SEAT_KW × BRIGHT_H) + 1e-9)`; the 1e-9 keeps a rounding error from losing a whole session.
- **Grow rooms.** Each sector has one grow room with `GROW_SEATS` seats under lamps that run `GROW_LAMP_H` hours a day at `GROW_MEL`, assumed at least 250 lux melanopic (white or blue-rich grow LEDs). At served fraction `f` of the sector's power, it seats `growSessions(f) = floor(GROW_SEATS × floor(GROW_LAMP_H / BRIGHT_H) × f + 1e-9)` sessions a day at no extra lamp energy.
- **Dose.** A person with `h` bright hours in a day gets `dose(h) = AMBIENT_MEL × (WAKE_H − h) + BRIGHT_MEL × h` melanopic lux-hours, with `h` in `[0, WAKE_H]`.

## Food

- **Crops.** Each crop in `CROPS` has an energy cost under lamps (kWh per kg) and a food value (kcal per kg). `kcalPerKWh(crop) = kcalPerKg / kWhPerKg`. `bestCrop()` is the crop with the most kcal per kWh (first in `CROPS` order on a tie). `STAPLE` is the central farms' crop.
- **Growing.** A grow room draws `GROW_KW` while its lamps run. `grown(kWh, crop) = kWh × kcalPerKWh(crop)` kcal.
- **What lamps cannot do.** `kwhToFeed(kcal, crop) = kcal / kcalPerKWh(crop)`: the lamp energy one person's daily ration needs. At the food floor it is about 210 kWh with lettuce and over 400 kWh with grain, against a 1 kW base load per person. Grow rooms buy hours, not independence (`docs/limits.md`).
- **Farm cut-off.** A `farm-cut` event `{ atH, level, durH }` stops the central farms' deliveries to every sector of that level on `[atH × 3600, (atH + durH) × 3600)`. `farmCut(events, level, t)` says whether one is active. Events of other types are ignored.
- **Stock.** A sector starts with `STOCK_DAYS` days of the standard ration in store.

## Interface

`lampKWh(people)`, `sessions(kWh)`, `growSessions(f)`, `dose(h)`, `kcalPerKWh(crop)`, `bestCrop()`, `grown(kWh, crop)`, `kwhToFeed(kcal, crop)`, `farmCut(events, level, t)`, and the constants `WAKE_H`, `AMBIENT_MEL`, `BRIGHT_MEL`, `DAY_MEL`, `BRIGHT_H`, `SEAT_KW`, `LAMP_H`, `GROW_SEATS`, `GROW_LAMP_H`, `GROW_KW`, `CROPS`, `STAPLE`, `STOCK_DAYS` (all in `docs/params.md`).

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Daytime threshold | A whole session of `BRIGHT_H` hours at 250 lux melanopic or more | Cumulative lux-hours; 250 lux for every waking hour | Brown et al. recommend 250 lux through the day. One 4 h session is a weaker test (an assumption), but it is a level, not a sum, it is checkable, and it is what a rotation can hand out |
| Grow rooms as bright rooms | Seats in the grow room, no extra energy | Separate bright rooms only | The plan's mechanism; grow lamps are assumed to exceed the threshold (`GROW_MEL`) |
| Crops | Two sourced crops, chosen by kcal per kWh | A nutrition model; potatoes or other unsourced crops | Only these two have a cited energy cost. Nutrition is out of scope and stated in the limits |
| Farm cut-off | Per level | Per sector; the whole district | A level is the neighbourhood of problem 12; a district-wide cut is several events |

## Open Questions & Future Decisions

### Deferred
1. Evening (under 10 lux) and sleep (under 1 lux) thresholds, and a sleep log from the phone.
2. A third crop with a cited energy cost (a tuber), which would change `bestCrop()`.

## References

- Daytime 250 lux melanopic EDI: Brown et al. 2022, PLoS Biology, https://doi.org/10.1371/journal.pbio.3001571
- Crop energy costs: `docs/params.md` (Ritchie; review PMC11961353); `docs/plan.md` problems 11 and 12, "Results that go against us"
