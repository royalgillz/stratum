# Fair Share specs

Prefix `FAIR`. Design: `fairshare-design.md`. The problems served are in brackets.

- [x] **FAIR-001** [2, 3, 5, 11, 12]: When supply `S` is at least the sum of floors, `allocate` shall give each claim `x = max(f, min(d, λ))`, where `λ` is the unique water level making the shares sum to `min(S, Σd)`, computed exactly from the sorted floors and demands.
- [x] **FAIR-002** [2, 12, 15]: If `S` is less than the sum of floors, then `allocate` shall give each claim `f × S / Σf` and return a `breach` holding the shortfall `Σf − S` and the ids of every claim with a floor above 0; when `S` covers all floors, `breach` shall be null.
- [x] **FAIR-003** [2, 3, 12]: If `S` exceeds the sum of demands, then `allocate` shall give every claim its demand and return `S − Σd` as `surplus`.
- [x] **FAIR-004** [2, 3, 5, 6, 10, 11, 12, 14, 15]: `allocate` and `rotate` shall throw a `RangeError` when supply, a floor, a demand or a debt is negative or not finite, or when two claims share an id, and `rotate` shall also throw when supply or a demand is not a whole number.
- [x] **FAIR-005** [2, 12]: If a claim's demand is below its floor, then `allocate` shall treat its demand as equal to its floor and list its id in `adjusted`.
- [x] **FAIR-006** [2, 3, 12]: When claims are empty, `allocate` shall return no shares and `surplus = S` with no breach; when `S` is 0, it shall return all shares 0 with a breach exactly when the sum of floors is above 0.
- [x] **FAIR-007** [2, 3, 5, 6, 11, 12]: `allocate` shall return the same shares for any ordering of the same claims, give equal claims equal shares, and use no randomness.
- [x] **FAIR-008** [2, 3, 5, 12]: For any valid input, `allocate` shall return shares that are non-negative, never above a claim's demand (or floor, if raised), and that sum with `surplus` to `S` within 1e-9 × max(1, S), with no claim adjusted to absorb rounding.
- [x] **FAIR-009** [6, 10, 11, 14, 15]: When `rotate` is called with whole units, claims, and an `Rng`, it shall draw winners one at a time among claims whose demand fits the units left, with weight `1 + debt` per claim and one `rng()` draw per winner, picking the first claim in ascending id order whose running weight total exceeds `rng() × total weight`, skipping claims with demand 0, and shall give each winner its whole demand and each other claim 0.
- [x] **FAIR-010** [6, 10, 11, 14, 15]: `rotate` shall draw randomness only from the `Rng` it is given, return identical results for the same claims and the same `Rng` sequence in any claim order, and stop when no remaining claim fits.
- [x] **FAIR-011** [6, 10, 11, 14, 15]: If the units given to `rotate` are fewer than the sum of floors, then it shall return a `breach` holding the shortfall in units and the ids of unserved claims with a floor above 0.
- [x] **FAIR-012** [2, 6, 10, 11, 14, 15]: `nextDebt` shall return 0 for a claim served in full and `debt + demand − granted` for any other claim, and `fairShare` shall return exactly the `shares` of `allocate`, so it satisfies the `FairShare` type in `contracts.ts`.
