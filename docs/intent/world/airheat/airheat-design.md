---
parent: world-design
prefix: WORLD-AIR
---

# Air and heat model

## Context and design philosophy

The air and heat model gives each sector a temperature, a wet-bulb temperature and a CO2 level, and the time left before each crosses its limit. It serves problem 3 (keep the lower levels livable: person-hours above 27.5 °C wet-bulb), problem 1 (warn before the air cuts out: time to limit) and problem 9 (ventilation drives infection through the rebreathed fraction).

Each quantity relaxes towards a target set by depth, cooling and ventilation. That is the least model that makes deep levels hot without cooling, makes CO2 climb after fans stop, and gives a time-to-limit a reader can check by hand. Pure functions, no randomness.

## Heat

- **Uncooled temperature** of a level: rock temperature at level 1 plus a gradient per level, plus a fixed internal gain from people and equipment: `U(level) = ROCK_TOP + ROCK_STEP × (level − 1) + GAIN`.
- **Cooling demand** of a sector, in MW: `COOL_KW × people × max(0, U − SETPOINT) / 1000`. A level whose uncooled temperature is at or below the setpoint needs no cooling.
- **Target temperature** with cooling served fraction `c` in [0, 1]: `U − (U − SETPOINT) × c` when `U > SETPOINT`, else `U`.
- **Step:** exact relaxation of the dry-bulb temperature towards the target with time constant `TAU_HEAT_S` (21,600 s, six hours).
- **Wet-bulb** from dry-bulb `T` and a fixed relative humidity `RH`, by Stull's empirical formula (valid for 5% to 99% humidity and −20 °C to 50 °C). Holding `RH` at 70% as air warms assumes wet rock and seepage keep the air near saturation, so moisture rises with temperature. At constant moisture, uncooled deep levels would stay below 27.5 °C wet-bulb, so this assumption decides whether p03 counts any person-hours (`docs/limits.md`).

## Air

- **CO2 target**: `C_OUT + 1e6 × G / (Q × v)` ppm, where `G` is CO2 exhaled per person (L/s), `Q` the design fresh-air rate per person (L/s), and `v = max(LEAK, ventilation served fraction)`. Fans fully served give `CO2_REF = C_OUT + 1e6 × G / Q`, computed in code (about 940 ppm) and exported for the epidemic model; fans off leave only leakage and the target is over 10,000 ppm.
- **Step:** exact relaxation towards that target with time constant `VOL_L / (Q × v)` seconds, where `VOL_L` is the air volume per person in litres (30,000 L, so 50 min with fans on). With fans off the time constant is many hours, so a cut gives hours, not minutes, before CO2 reaches its limit.

## Time to limit

`timeToLimit(x, target, tau, limit)` is the time in seconds for a quantity relaxing from `x` towards `target` to reach an upper `limit`: 0 if `x ≥ limit`, `Infinity` if `target ≤ limit`, otherwise `tau × ln((target − x) / (target − limit))`. For wet-bulb, the limit is first turned into the dry-bulb temperature whose wet-bulb is 27.5 °C at the model's humidity (found once by bisection), because wet-bulb rises with dry-bulb at fixed humidity. The CO2 limit (5000 ppm) is an 8 h exposure limit, not an instant threshold, so the readout says "time until CO2 passes the 8 h exposure limit". The district page is the only consumer of `timeToLimit`; no rung 3 metric uses it.

## Interface

`uncooledTemp(level)`, `coolingDemandMW(level, people)`, `tempStep(T, level, coolFrac, dt)`, `wetBulb(T, rh)`, `co2Step(c, ventFrac, dt) → { co2, tau }`, `timeToLimit(x, target, tau, limit)`, `dryBulbLimit()`, `CO2_REF`, and every constant above by its name in `docs/params.md` (`RH`, `WB_LIMIT`, `C_OUT`, `CO2_LIMIT` and the rest), so adapters and the epidemic model never restate one.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Heat | First-order relaxation to a depth and cooling target | Full heat balance with rock conduction, latent heat, airflow | Gives depth gradient, cooling effect and lag with five parameters, all assumptions anyway |
| Humidity | Fixed relative humidity | Moisture balance per sector; fixed moisture content | Wet-bulb needs humidity; a moisture model doubles the parameters for no new metric. The harness sweeps `RH` (50%, 70%, 90%) because the p03 result depends on it |
| Wet-bulb | Stull 2011 formula | Psychrometric iteration | One published closed form, accurate to about 0.3 °C in range |
| CO2 | Well-mixed box per sector | Zones within a sector | One box gives the fan-stop time to limit the plan needs |
| Units in code | Base units (`VOL_L` in litres, `TAU_HEAT_S` in seconds) | m³ and hours with conversions at each use | One unit per quantity removes a factor-of-1000 or 3600 slip |

## Open Questions & Future Decisions

### Deferred
1. Heat from served power (equipment off during a cut cools a sector slightly). Ignored: it errs towards more heat during a cut.
2. Refuge rooms are modelled in the p03 adapter as a share of people held at the setpoint while their cooling floor is paid, not as separate boxes.

## References

- R. Stull, "Wet-Bulb Temperature from Relative Humidity and Air Temperature", J. Appl. Meteor. Climatol. 50, 2011, https://doi.org/10.1175/JAMC-D-11-0143.1
- CO2 generation per person: Persily and de Jonge, Indoor Air 27, 2017, https://doi.org/10.1111/ina.12383
- Wet-bulb limit 27.5 °C for working areas: South African deep-mine thermal-stress practice (`docs/plan.md`); source URL still to add, so `docs/params.md` marks it an assumption
- `docs/params.md` (all constants)
