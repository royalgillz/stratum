---
parent: high-level-design
prefix: FAIR
---

# Fair Share

## Context and design philosophy

Fair Share divides a scarce good among claimants by one rule that anyone can check by hand. It serves problems 2, 3, 5, 6, 10, 11, 12, 14 and 15 (power, water, food, cooling, pump power, lamp-hours, medicine, bunks, trial slots, return slots). It is pure computation over a supply and a list of claims; the adapters in `src/core/adapters` choose the good, its unit and the claims.

It prefers stating a shortfall to hiding one. When supply cannot cover everyone's life floor, the result says so and names who is short. It does not decide who holds the breakers; it divides what a level controls.

## The allocation rule (divisible goods)

Each claim has a floor `f` (life minimum), a demand `d` and a debt `b`, all in the good's own unit. With supply `S`:

1. **Floors first.** If `S ≥ Σf`, every claim gets at least its floor.
2. **Water-filling.** The remainder raises the worst-off: `x = max(f, min(d, λ))`, where the water level `λ` is the unique value that makes `Σx = S` (found exactly by sorting the breakpoints `f` and `d`; no iteration). Claims whose demand is reached stop rising; claims whose floor exceeds `λ` keep their floor.
3. **Surplus.** If `S ≥ Σd`, every claim gets its demand and the unspent `S − Σd` is returned as `surplus`.
4. **Floor breach.** If `S < Σf`, no claim can get its floor. Each gets `x = f × S / Σf` (everyone is short by the same fraction) and the result carries a `breach` stating the shortfall `Σf − S` and the ids of the claims below floor. The breach is never silent and never rounded away.

Debt does not change divisible shares: water-filling already equalises, so equal claims get equal shares.

## Debt rotation (indivisible goods)

Lamp-hours, bunks, trial slots and return slots come in whole units that cannot be split, so the rule above cannot serve everyone. Floors still come first, and no claim is ever split: floors and demands are whole units (a family's size, kept together).

- **Units ≥ Σf.** Every claim gets its floor. The lottery then runs over the remaining units, where each claim asks for its remaining demand `d − f` whole or nothing; a winner's share is its full demand. Claims with `d − f = 0` are not drawn.
- **Units < Σf (breach).** Floors cannot all be met, so the lottery decides whose floor is paid: it draws claims with a floor above 0 whose whole floor fits in the units left; a winner's share is its floor and every other claim gets 0. Unserved floor claims are listed in `breach.ids`, with `shortfall = Σf − units`. No floor is part-paid.

The **debt-weighted lottery** draws winners one at a time from the claims whose ask (as above) still fits in the units left. Each remaining claim's weight is `1 + debt`; one `rng()` draw picks the winner. It repeats until nothing fits. The base weight of 1 keeps a claim with no debt in the draw; debt raises its odds, so a claim passed over often is more likely next round. Claims are visited in id order so the same seed gives the same winners whatever order the caller lists them in. The only randomness is the `Rng` the caller passes in, taken from `rng(seed, 'fairshare')` in `rng.ts`.

After each round `nextDebt` updates the memory: a claim served in full resets to 0; otherwise its debt grows by `demand − granted`. A claim whose floor is paid but whose demand is not has `granted < demand` and so gains debt.

## Input validation and edge cases

Both entry points throw `RangeError` (a bug in the caller, not a shortage) when supply is negative or not finite, a claim's `floor`, `demand` or `debt` is negative or not finite, ids are duplicated, or, for the lottery, supply, a floor or a demand is not a whole number. The lottery treats a demand below its floor as equal to the floor.

| Case | Result |
| --- | --- |
| Empty claims | No shares; `surplus = S`; no breach |
| `S = 0` | All shares 0; breach if `Σf > 0`, none otherwise |
| `demand < floor` | Treated as `demand = floor`; the id is listed in `adjusted` so the correction is visible |
| `S > Σd` | Every claim gets its demand; the rest is `surplus` |
| `S = Σf` exactly | Floors met, no breach, no water-filling |
| Ties (equal claims) | Equal shares; divisible rule uses no randomness; id order fixes iteration |
| `Σf = 0` and `S > 0` | Plain water-filling on demand |

Numbers: shares are real numbers computed directly from `λ` (or from `f × S / Σf`), each clamped into `[f, d]`; no claim is adjusted to absorb rounding. `Σshares + surplus = S` holds within 1e-9 × max(1, S). `λ` is null when `S ≥ Σd`, when there is a breach and when there are no claims. "Id order" means ascending UTF-16 code-unit order of the id strings. In the lottery, a claim with nothing to ask for (remaining demand 0) is never drawn, and the pick is the first claim in id order whose running weight total exceeds `rng() × total weight`.

## Interface

- `allocate(supply, claims): AllocationResult` where the result is `{ shares: Allocation, surplus, lambda: number | null, breach: { shortfall, ids } | null, adjusted: string[] }`. `lambda` is null when `S ≥ Σd`, on a breach, or with no claims.
- `fairShare: FairShare = (supply, claims) => allocate(supply, claims).shares`, matching `contracts.ts` so adapters can write `World.alloc` directly.
- `rotate(units, claims, rng): RotationResult` with `{ shares: Allocation, winners: string[], unitsLeft, breach }`; `winners` lists lottery winners in draw order, and `unitsLeft` is what no claim could use.
- `nextDebt(claims, shares): Record<string, number>` returns each claim's new debt for the caller to store.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
| --- | --- | --- | --- |
| Divisible rule | Floors, then water-filling | Proportional to demand | Proportional shares favour the already well supplied; water-filling raises the worst-off first |
| Floor breach | Proportional scaling of floors, stated in `breach` | Cut the lowest-priority claims; first come first served | Needs no ranking of lives; the same fraction short for all, and the shortfall is reported |
| Indivisible goods | Debt-weighted lottery, weight `1 + debt` | Round-robin by id; strict debt-first | A lottery cannot be gamed by id order or timing; the `+1` lets debt-free claims win sometimes; strict debt-first lets one large old debt starve everyone |
| Debt update | Reset when fully served, else add the shortfall | Decay; keep forever | Reset stops a served claim hoarding priority; adding the shortfall makes repeated losers more likely to win |
| Claim size in rotation | Whole claim or nothing | Split families across slots | Families stay together (problems 6, 15) |
| Randomness | Caller passes an `Rng`; none inside the module | Module creates its own stream | Keeps the stream name and seed in the caller's hands, reproducible |
| Breach reporting | Separate `allocate` returning a result object; `fairShare` wraps it | Change `FairShare` to return the result | `contracts.ts` is frozen; the wrapper meets it without a change |
| Bad input | Throw, except demand below floor | Silently clamp everything | Negative or NaN values mean a caller bug; demand below floor is plausible data, so it is corrected and reported |

## Open Questions & Future Decisions

### Deferred
1. Whether the lottery needs a cap on `1 + debt` so a very large debt cannot dominate. Decide when the harness shows starvation or capture.
2. Whether floors for indivisible goods need priority tiers (a child's bunk before an adult's). Out of scope until the human sets a ranking rule.
3. `Allocation` (`contracts.ts`) holds shares only, so the breach statement is not stored in `World.alloc`. Whether the world should keep it is for the kernel design.

## References

- `docs/plan.md` "The formulas the engines use" and "The honest claim for problem 2"
- Max-min fairness and water-filling: D. Bertsekas and R. Gallager, *Data Networks*, 2nd ed., Prentice Hall, 1992, section 6.5
