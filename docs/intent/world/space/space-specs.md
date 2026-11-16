# Space model specs

Prefix `WORLD-SPACE`. Design: `space-design.md`. The problems served are in brackets.

- [x] **WORLD-SPACE-001** [6]: `sleepM2(areaM2, sleepers)` shall return `areaM2 / sleepers` when `sleepers` is above 0 and `areaM2` otherwise, and `AREA_M2` shall equal `SLEEP_M2 × PEOPLE`.
- [x] **WORLD-SPACE-002** [6]: `shiftSleepers(members, shifts, weight)` shall return an array of `SHIFTS` numbers whose entry `k` is `weight` times the summed members of the households whose shift is `k`.
- [x] **WORLD-SPACE-003** [6]: `fill(sizes, loads)`, with `loads` an array of `SHIFTS` numbers whose entry 0 is never chosen, shall place each household, in the order given, on the shift with the lowest load among shifts 1 to `SHIFTS − 1`, the lower index on a tie, add its size to a copy of that load, and return the shift of each household without changing `sizes` or `loads`.
- [x] **WORLD-SPACE-004** [6]: `idleM2(areaM2, people, sleepers)` shall return `areaM2 × (1 − sleepers / people)`, and `areaM2` when `people` is 0.
- [x] **WORLD-SPACE-005** [6]: The space functions shall throw a RangeError for a negative or non-finite area, people, sleepers, weight, size or load, for `sleepers` above `people` in `idleM2`, for member and shift arrays of different lengths, a `loads` array whose length is not `SHIFTS`, or for a shift that is not an integer from 0 to `SHIFTS − 1`.
