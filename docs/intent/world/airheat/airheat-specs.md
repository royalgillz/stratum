# Air and heat model specs

Prefix `WORLD-AIR`. Design: `airheat-design.md`. The problems served are in brackets. Temperatures in °C, CO2 in ppm, times in seconds.

- [ ] **WORLD-AIR-001** [3]: `uncooledTemp(level)` shall return `ROCK_TOP + ROCK_STEP × (level − 1) + GAIN`, and `coolingDemandMW(level, people)` shall return `COOL_KW × people × max(0, uncooledTemp(level) − SETPOINT) / 1000`.
- [ ] **WORLD-AIR-002** [3]: `tempStep(T, level, coolFrac, dt)` shall relax `T` exactly towards `U − (U − SETPOINT) × coolFrac` when `U = uncooledTemp(level)` is above `SETPOINT`, and towards `U` otherwise, with time constant `TAU_HEAT_S` seconds.
- [ ] **WORLD-AIR-003** [3]: `wetBulb(T, rh)` shall return Stull's 2011 wet-bulb temperature for dry-bulb `T` and relative humidity `rh` in percent, within 0.05 °C of the published formula.
- [ ] **WORLD-AIR-004** [1, 9]: `co2Step(c, ventFrac, dt)` shall relax `c` exactly towards `C_OUT + 1e6 × G / (Q × v)` with time constant `VOL_L / (Q × v)` seconds, where `v = max(LEAK, ventFrac)`, `G` and `Q` are in L/s and `VOL_L` in litres, and return the new value and the time constant used; the module shall export `CO2_REF = C_OUT + 1e6 × G / Q`.
- [ ] **WORLD-AIR-005** [1, 3]: `timeToLimit(x, target, tau, limit)` shall return 0 when `x ≥ limit`, `Infinity` when `target ≤ limit`, and otherwise `tau × ln((target − x) / (target − limit))`.
- [ ] **WORLD-AIR-006** [1, 3]: `dryBulbLimit()` shall return the dry-bulb temperature at which `wetBulb` at the model humidity equals the 27.5 °C wet-bulb limit, within 0.01 °C.
- [ ] **WORLD-AIR-007** [3]: With full cooling, a sector shall settle at `SETPOINT` (or at `U` where `U` is lower); with no cooling, a level-6 sector shall settle above the dry-bulb limit of WORLD-AIR-006 under the default parameters.
- [ ] **WORLD-AIR-008** [1, 3, 9]: The air and heat functions shall throw a RangeError for a non-finite input, a level that is not an integer from 1 to 6, a served fraction outside [0, 1], `rh` outside [5, 99], or a non-positive `dt` or `tau`.
