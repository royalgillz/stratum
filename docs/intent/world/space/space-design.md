---
parent: world-design
prefix: WORLD-SPACE
---

# Space model

## Context and design philosophy

The space model says how much sleeping floor each sleeper has, how many people sleep in each shift, and how much sleeping floor stands empty while its household is awake. It serves problem 6 (find or make space, or share it). The space a sector has is fixed; what changes is who sleeps in it when.

The least model that gives an honest value: one pooled sleeping area per sector, three sleep shifts, and households that sleep whole. The gain from shift sharing is arithmetic and is stated as such; the census of idle space is what "finding" space means here. Pure functions, no randomness.

## Sleeping area

- Each sector has `AREA_M2` m² of sleeping floor, `SLEEP_M2 × PEOPLE` (2.0 m² for each of 500 people), below the Sphere minimum of `SPHERE_M2` (3.5 m²) per person.
- There are `SHIFTS` (3) sleep shifts of eight hours. Shift 0 is the night shift, in step with the district's lamp day.
- `sleepM2(areaM2, sleepers)`: `areaM2 / sleepers`, or `areaM2` when nobody sleeps.
- `shiftSleepers(members, shifts, weight)`: given the tracked households of one sector (their member counts and shifts) and the weight each tracked member carries (`docs/intent/adapters/policy`), the people asleep in each shift: `weight × Σ members` of the households on that shift, as an array of `SHIFTS` numbers.
- `fill(sizes, loads)`: places households, in the order given, one at a time on the shift with the lowest load among shifts 1 to `SHIFTS − 1` (the lower index on a tie), adding each size to that load. It returns the shift of each household. Shift 0 is filled by the caller. `loads` has `SHIFTS` entries, entry 0 is never chosen, and neither input is changed.
- `idleM2(areaM2, people, sleepers)`: under one room per household, the sleeping floor whose household is awake during a shift, `areaM2 × (1 − sleepers / people)`. This is the occupancy census: floor that is assigned but empty.

## Interface

`sleepM2`, `shiftSleepers`, `fill`, `idleM2` and the constants `AREA_M2`, `SPHERE_M2`, `SHIFTS` (all in `docs/params.md`).

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Unit of space | One pooled sleeping area per sector | Rooms per household with sizes | The contract holds one `sleepM2` per sector; room sizes would be invented detail |
| Shifts | Three of eight hours | Two shifts; free schedules | Submarine bunk sharing uses three; three keeps the arithmetic plain |
| Who sleeps when | Whole households | Individuals | Families stay together (problem 6, and Fair Share's whole-claim rule) |
| Contact cost | Stated by the census (households sharing a sleeping space per day), not fed into the epidemic | Raise the epidemic's contact rate | Coupling would change problem 9's results by an unsourced factor; the cost is reported, not hidden |

## Open Questions & Future Decisions

### Deferred
1. Peak power load by shift, which needs a load profile over the day in the grid model.
2. Feeding shift sharing into the epidemic's contact rate, once a sourced factor exists.
3. Making space (converting idle work rooms), beyond sharing what exists.

## References

- Sphere minimum covered living space, 3.5 m² per person: https://spherestandards.org/handbook/
- `docs/plan.md` problem 6
