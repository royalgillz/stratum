---
parent: world-design
prefix: WORLD-EPI
---

# Epidemic model

## Context and design philosophy

The epidemic model spreads a lung sickness through District 7's sectors and draws the two incomplete lists people actually see: the clinic list and residents' breath-count reports. It serves problem 9 (track the real outbreak and get supplies where they are needed). The true count exists only inside the model; the engines see the lists, so the capture-recapture estimate is scored against a truth it never read.

The least model that does this: a stochastic SEIR compartment model per sector, with transmission tied to ventilation through CO2, and each new case landing on each list independently. Integer people, so the lists are honest counts.

## Transmission

Per sector, integer compartments `S, E, I, R` and the number of treated cases `T ≤ I`. Medicine stock per sector is in courses and may be fractional, because shares are divided; only whole courses treat. Within a level, a share `MIX` of contacts are with the rest of the level; there is no mixing between levels (the Directorate controls movement).

- **Force of infection:** `λ = β × ((1 − MIX) × I_s / N_s + MIX × I_level / N_level)` per day, where `I_level` and `N_level` are sums over the level's four sectors, `s` included.
- **Ventilation:** `β = β_REF × min(BETA_CAP, r(co2) / r(CO2_REF))`, where `r(c) = (c − C_OUT) / C_EXHALED` is the rebreathed fraction of Rudnick and Milton, and `CO2_REF` is the air model's fans-on steady state. Poor ventilation raises `β` with the air already breathed by someone else, up to `BETA_CAP` times. `β_REF = R0 × γ`.
- **Step** (one epidemic step `EPI_DT`, one hour): rates are per day and `dt` is in seconds, so each probability uses `dt / 86400`. Every draw uses the compartments at the start of the step. Sectors go in index order 0 to 23, each with: new exposed `Bin(S, 1 − e^(−λ dt / 86400))`; new infectious `Bin(E, 1 − e^(−σ dt / 86400))`; treated recoveries `Bin(T, 1 − e^(−γT dt / 86400))`; untreated recoveries `Bin(I − T, 1 − e^(−γ dt / 86400))`; then the three list draws below. `T = min(I, floor(stock))`, and each treated recovery uses one course of medicine.
- **Seed:** an outbreak event `{ atH, sector, cases }` moves `cases` people from `S` to `I` in that sector at `atH`. Seeded cases are the index cases: they join neither list and are not new infectious cases.

## The two lists

Every new infectious case is one person. It joins the clinic list with probability `pClinic(level) = CLIN_TOP − CLIN_STEP × (level − 1)` (clinics are fewer and further away in the deep levels) and the residents' list with probability `P_REPORT`, independently. For `k` new infectious cases in a sector, three binomials give the same joint result as two draws per case: clinic `n1 = Bin(k, pClinic)`, both `m = Bin(n1, P_REPORT)`, residents `n2 = m + Bin(k − n1, P_REPORT)`. The model adds them to the sector's counts for day `floor(t / 86400)`, so an adapter can take a recent window. An optional `capture` factor (default 1) multiplies every capture probability, so the under-reporting sweep can change capture for one run.

Independence between lists is what Chapman's estimator assumes. It is true here by construction and stated as a limit for the real world.

## Binomial draws

`binomial(n, p, rng)` inverts the binomial CDF from exactly one `rng()` draw `u`: it returns the smallest `k` whose CDF exceeds `u`, or `n` when rounding leaves the CDF at or below `u`. For `p > 0.5` it returns `n − binomial(n, 1 − p)` with the same `u`, so `(1 − p)^n` never underflows. Every step draws seven binomials per sector whatever the values, so the stream position never depends on the outbreak.

## Interface

`createEpidemic(people[]) → state`, `seed(state, sector, cases)`, `epiStep(state, t, co2[], stock[], dt, rng) → { newCases, coursesUsed }` (per sector; `t` is world seconds at the step's start; `newCases` are new infectious cases), `rebreathed(co2)`, `binomial(n, p, rng)`, and the per-sector list counts on the state.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Ventilation link | Rebreathed fraction from CO2 (Rudnick and Milton), capped at `BETA_CAP` | Fixed `β` per level; uncapped scaling; scaling only an airborne share of `β` | Ties problem 9 to problem 3 with a published relation. Rudnick and Milton cover ordinary indoor CO2; fans off would multiply `β` by about 20 without the cap, far outside that evidence |
| Step | One hour | Every kernel step (60 s) | Probabilities per minute are tiny; an hour keeps draws few and the curve unchanged |
| List membership | Independent capture, drawn as three binomials per sector | One draw per case per list; correlated capture | Matches the estimator's assumption with a fixed draw count; correlation is a sweep for later |
| Seeds | Index cases, on no list and outside the true count | Seeds on the lists | The lists and the truth then cover the same people, so neither figure is biased by cases no list could hold |
| Between levels | No mixing | Mixing through stairwells | The Directorate controls movement; an outbreak stays where it is seeded unless a later model moves people |

## Open Questions & Future Decisions

### Deferred
1. Wastewater signal per recycler as an early warning, watched by the Witness detector.
2. Crowding from shift-sharing (problem 6) changing contact rates.
3. Deaths and severity. The model counts infections only.

## References

- S. N. Rudnick and D. K. Milton, "Risk of indoor airborne infection transmission estimated from carbon dioxide concentration", Indoor Air 13, 2003, https://doi.org/10.1034/j.1600-0668.2003.00189.x
- Capture-recapture for under-reported outbreaks: https://wwwnc.cdc.gov/eid/article/21/12/15-0756_article
- `docs/intent/witness/witness-design.md` (Chapman estimator)
