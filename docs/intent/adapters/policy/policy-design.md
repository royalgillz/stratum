---
parent: adapters-design
prefix: ADAPT-POLICY
---

# Adapter factory and conventions

## Context and design philosophy

This leaf owns `createAdapters(policy, script)` and the rules every adapter follows. It serves every modelled problem. Its job is to make the Directorate and STRATUM runs differ only by policy: same seed, same script, same streams, same declared writes.

## Factory

`createAdapters(policy, script)` returns the rung 3 adapters (`p01`, `p02`, `p03`, `p04`, `p05`, `p07`, `p08`, `p09`) as fresh objects with fresh private state. It throws a RangeError for a policy other than `'directorate'` or `'stratum'`. The script is validated by the scenario module before it gets here. No world exists yet, so every piece of state that depends on the world (epidemic state, relays, Witness instances and detectors, `COOL_CAP`, histories, flooded flags) is built on the adapter's first `step` from the world passed in. Two calls with the same arguments give adapters that, run by the kernel from the same world and seed, produce identical worlds and metrics.

## Conventions

- **Reads and writes** are exactly the table in `adapters-design.md`, and each adapter changes only the sub-fields it owns there. No adapter writes `t`, `seed` or `clock`.
- **Claims and allocations.** Sector claims are `sectorId(s)`, `s00` to `s23`, with debt 0 in rung 3. An allocation from Fair Share is `allocate(supply, claims).shares`. Every allocation an adapter writes has exactly the keys `s00` to `s23`. Sector `s`'s share is `alloc.<good>[sectorId(s)]`.
- **Served fractions:** every served fraction is `demand > 0 ? min(1, max(0, granted / demand)) : 1`, so rounding never hands a model a fraction outside [0, 1]. For sector `s`, power served is `alloc.power[sectorId(s)]` over `powerDemand(sectors[s].people)`, where `powerDemand(people) = people × BASE_KW / 1000` MW. A sector is fully served when its power is at least `powerDemand × (1 − 1e-9)`, the Fair Share sum tolerance. The grid's served fraction is total power served over total power demanded. Cooling and pump pools are their nominal capacities times the grid's served fraction.
- **Ventilation** is part of the life floor: a sector's ventilation served fraction is the served fraction of `alloc.power[sectorId(s)]` over `lifeFloor(sectors[s].people)`, where `lifeFloor(people) = people × LIFE_KW / 1000` MW.
- **First step.** History starts from the initial world: p01's previous served fractions come from the initial `alloc.power` (all 1), tier history before `t = 0` counts as GREEN, and p05's flooded flags start as `isFlooded(sumpLevel, false)`.
- **Metrics:** finite, labelled SIMULATED, computed from the world and the adapter's own state without changing either. A share is 0 until its denominator is above 0.
- **Randomness:** an adapter draws only from the stream the kernel passes to `step`.

## Interface

- `type Policy = 'directorate' | 'stratum'`
- `createAdapters(policy, script): Adapter[]`
- `sectorId(s)`, `powerDemand(people)`, `lifeFloor(people)`: shared helpers in `adapters/shared.ts`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Factory per run | Fresh closures each call | Module-level singletons | Singletons leak state between runs and break reproducibility across seeds |
| Ventilation in the floor | Fans are fed first from a sector's power | A separate ventilation good | Fans are life support; the floor is where Fair Share protects life |
| Empty shares | 0 until a denominator exists | NaN | The kernel rejects non-finite metrics; 0 is stated in each metric's definition |

## Open Questions & Future Decisions

### Deferred
1. More policy values for ablations (Fair Share only, Witness only, Mesh only).

## References

- `docs/intent/adapters/adapters-design.md`; `docs/intent/kernel/kernel-design.md`; `src/core/contracts.ts`
