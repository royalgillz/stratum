# Light and food model specs

Prefix `WORLD-LIGHTFOOD`. Design: `lightfood-design.md`. The problems served are in brackets. `t` is world seconds; event times are hours.

- [x] **WORLD-LIGHTFOOD-001** [11]: `lampKWh(people)` shall return `people × LAMP_H × SEAT_KW` kWh, and `sessions(kWh)` shall return `floor(kWh / (SEAT_KW × BRIGHT_H) + 1e-9)`.
- [x] **WORLD-LIGHTFOOD-002** [11]: `growSessions(f)` shall return `floor(GROW_SEATS × floor(GROW_LAMP_H / BRIGHT_H) × f + 1e-9)` for a served fraction `f` in [0, 1].
- [x] **WORLD-LIGHTFOOD-003** [11]: `dose(h)` shall return `AMBIENT_MEL × (WAKE_H − h) + BRIGHT_MEL × h` melanopic lux-hours for `h` in `[0, WAKE_H]`, and `BRIGHT_MEL` shall be at least `DAY_MEL`.
- [x] **WORLD-LIGHTFOOD-004** [12]: `kcalPerKWh(crop)` shall return the crop's kcal per kg over its kWh per kg from `CROPS`, `grown(kWh, crop)` shall return `kWh × kcalPerKWh(crop)`, and `kwhToFeed(kcal, crop)` shall return `kcal / kcalPerKWh(crop)`.
- [x] **WORLD-LIGHTFOOD-005** [12]: `bestCrop()` shall return the crop in `CROPS` with the highest kcal per kWh, the first in `CROPS` order on a tie, and `STAPLE` shall name a crop in `CROPS`.
- [x] **WORLD-LIGHTFOOD-006** [12]: `farmCut(events, level, t)` shall return true exactly when a `farm-cut` event on that level has `t` in `[atH × 3600, (atH + durH) × 3600)`, ignoring events of other types.
- [x] **WORLD-LIGHTFOOD-007** [11, 12]: The light and food functions shall throw a RangeError for negative or non-finite people, kWh, kcal or `t`, an `f` outside [0, 1], an `h` outside `[0, WAKE_H]`, a crop not in `CROPS`, a level outside 1 to 6, or a `farm-cut` event with a non-finite `atH` or a negative or non-finite `durH`.
