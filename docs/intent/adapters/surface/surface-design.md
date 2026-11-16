---
parent: adapters-design
prefix: ADAPT-SURFACE
---

# Surface adapters: p13 surface truth, p14 pioneers, p15 return

## Context and design philosophy

`p13` collects crews' readings of the surface air and states a verdict as an exposure band; `p14` turns the verdict into the protection to trial and the people who trial it; `p15` plans who goes back up first. They serve problems 13, 14 and 15: the way up reuses Witness (ledger, quorum) and Fair Share (`rotate`) rather than a new engine. The surface itself is simulated and its truth comes from the script; the engines never read it, only the scoring does.

## p13: surface truth

**Rounds.** A campaign is a `surface` event. Its reading rounds fall at `atH` and every `READ_EVERY` hours after, until a later campaign starts. A round is processed in the first step at or after its time, with its own campaign and its own time as the reading time, so a campaign that starts between steps loses no round. For each round:

- *Directorate (under both policies):* the official verdict is `sealed`, "the air up there would kill you in minutes", observed as `('surface.band', 'surface', band index, 'official')`. Under the Directorate `surface.band` is `sealed` from the first step.
- *STRATUM:* the crews read (`crewRead`), each reading is appended to `surface.readings` and observed as `('surface.<gas>', 'surface', ppm, 'crew:<crew>')`, a hash-chained entry with source `crew:<crew>` (signing happens on real packets, not in the simulation). The verdict is `bandOf` of the three `quorum` medians over the current campaign's readings, or `unknown` when any gas has no quorum. It is written to `surface.band` and, when known, observed as `('surface.band', 'surface', band index, 'estimate:quorum')`, so `gap('surface.band')` shows measured against official. Band indices: open 0, mask 1, suit 2, sealed 3, closed 4.

`p13` makes one Witness on its first step, as `p04` and `p09` do. The ledger digest that anyone can compare is Witness's `digest()`; the district shows it, and a real phone can send it as a LEDGER_HEAD packet.

**Metric:** "wrong-band rate", unit `share`: the rounds whose verdict after the round differs from `bandOf` of the truth, over all rounds; `unknown` counts as wrong; 0 before the first round.

*What sets this number.* Under the Directorate, whether the truth is `sealed`: its verdict never changes. Under STRATUM, how many crews lie: one liar in five does not move a median, but a majority does, and then the quorum is confidently wrong. The rate counts an over-cautious verdict the same as an unsafe one. In the seven-day week both policies' numbers are set by the scripted truth: the Directorate's fixed `sealed` against a true `mask` gives 1 on every seed, and four honest crews in five always agree on `mask`.

## p14: pioneers

**Plan.** At a campaign's first round, and after any later round whose known band differs from the band of the last plan, `p14` plans again: `trialPlan(startR, trueR, staged)`, with `trueR = required(truth)`. An `unknown` band keeps the last plan; a new campaign drops the old one.

- *Directorate:* `startR` follows its verdict (`sealed`, so `APF_SEALED`), and its team goes straight to a 30-day stay (`staged` false). The team is the first `TRIAL_N` tracked households of level 1, its own staff, one volunteer each.
- *STRATUM:* `startR = required` of the quorum medians (no plan until a band is known), staged 1 h, 24 h, 7 days, 30 days, stopping on a breach and stepping up one option. For each entry of `plan.stages`, in order, `TRIAL_N` volunteers are drawn by `rotate(TRIAL_N, claims, rng)` among tracked households not yet drawn in this plan (one claim each: its id, floor 0, demand 1, debt 0): a lottery, and the exposure cap is one stage per person.

**Writes.** `alloc.trialSlots[sectorId(s)]`: the volunteers from sector `s` in the current plan.

**Metric:** "protection factor proven over 30 days", unit `APF`: the factor of the option the plan verifies, or `NO_PROOF` (100,000, above every option) while there is no plan or no option holds: nothing has been proven. Lower means lighter protection: masks can go to millions, sealed outposts cannot.

*What sets this number.* The verdict that picks the first option. The cost sits beside it: `trialPlan` also returns the exposure-hours and breaches, which the harness reports. In this model staging never lowers exposure-hours: when the first option holds it costs 7,304 against 5,760 person-hours at eight people per stage, and a failing option costs one hour either way, since a breach is seen at the first hourly check. Its real value, catching harm that shows only after longer exposure, is not modelled.

## p15: return

**Plan.** On its first step `p15` plans the return of District 7 for the day the surface opens, with `returnPerDay(1)` people a day (one shaft, surface reception the limit). A tracked household of sector `s` stands for `d_h = round(w_s × members)` people, and a day holds `u = max(largest d_h, returnPerDay(1))` people, so the daily limit holds in people every day. Households go whole. `p15` never reads the surface: it plans once, from the households and reception.

- *Directorate:* upper levels first: households in order of level, then list order; each day takes them in that order while the next fits.
- *STRATUM:* each day, `rotate(u, claims, rng)` among households not yet placed (its id, floor 0, demand `d_h`, debt), with each household's debt starting at `d_h × (level − 1)`, so the deepest levels are likeliest to go first, and growing by `nextDebt` each day it waits.

**Writes.** `alloc.returnSlots[sectorId(s)]`: the people of sector `s` with a slot on the first day (the summed `d_h` of its households placed that day).

**Metric:** "worst level's mean wait", unit `days`: over levels, the largest people-weighted (`d_h`) mean of the day index of each tracked household's slot (0 for the first day).

*What sets this number.* Reception, not the shaft, sets the length of the move (about 24 days for 12,000 people). The rule sets who waits: upper levels first makes level 6 wait to the end. No level's mean can fall below the district's mean wait (about 12 days), and any rule that mixes levels beats a strict level order on this metric, so it rewards mixing, not depth priority. The harness reports each level's mean wait beside it, so the depth priority stays visible.

## Interface

`createP13`, `createP14`, `createP15` (`policy, script`). The adapter `createP14` returns also has `plan()`: the current `trialPlan` result, or null, so the harness can report its exposure-hours and breaches.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Directorate verdict | Fixed at `sealed` | Its own measured readings | The world's stated position; the Directorate publishes no readings |
| Crews under the Directorate | None | Crews under both | Crews are residents using the toolkit; the Directorate's verdict stays under both policies |
| No quorum | `unknown`, counted wrong | Keep the last verdict | A verdict nobody can back must not pass as one |
| p14 metric | Protection factor proven over 30 days | The plan's "exposure-hours to a 30-day verdict" | A direct trial of an option that cannot fail always costs fewer hours; what staging and the measured band buy is a lighter proven option. Hours and breaches are reported beside it |
| Directorate trial | Its staff, straight to 30 days in the option its verdict names | No trials at all | A trial it would run is a fair baseline; no trial gives no number |
| Trials and the return in time | Plans: trials from the current verdict, the return once at the start | Running them in world time | A 30-day trial and a 24-day move cannot finish in a 7-day run |
| Who goes first on the return | Lottery with debt from depth | Strict deepest first | Debt gives the deep levels priority without making anyone's turn fixed by address |
| Return slots | Fixed by reception, same under both | More slots under STRATUM | Same supply, different rule |
| Return pace in people | Each household stands for `d_h` people | Tracked members at the district-wide ratio | The reception limit then holds on every day, not only on average |
| p14 with nothing proven | `NO_PROOF`, above every option | 0 | Reaching no verdict must not score as the lightest protection |
| A band turning `unknown` | Keep the last plan | Drop it | A round without quorum proves nothing new; dropping the plan would make the metric flicker |

## Open Questions & Future Decisions

### Deferred
1. The ledger digest broadcast over the simulated mesh, and the share of people who receive it.
2. Real crews' readings as packets from the room.
3. Health-based exclusions from trials, which need a ranking rule the human has not set.
4. Readings needed to decide (problem 13) and the total length of the return (problem 15), as figures beside the metrics.
5. Unsafe-verdict rounds (a band below the truth) beside the wrong-band rate.

## References

- `docs/intent/world/surface`; `docs/intent/witness` (`quorum`, ledger, `digest`); `docs/intent/fairshare` (`rotate`, `nextDebt`); `docs/plan.md` problems 13 to 15
