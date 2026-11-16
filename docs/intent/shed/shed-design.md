---
parent: high-level-design
prefix: SHED
---

# Shed Ledger

## Context and design philosophy

The hum says **when** the grid is stressed; the Shed Ledger says **who** gets cut. It counts neighbours' power-off reports during past stress events and turns them into each level's odds of being cut at the current tier. It serves problem 1 (which level, not just when) and problem 2 (prove the pattern of who gets cut: the per-level counts are evidence for that pattern, and the claim rests on the hash-chained ledger described under Records, not on this object's memory).

It is a small stateful object. Times come from the caller, there is no randomness and no storage. It prefers "no data yet" to a number with nothing behind it, and a level nobody reports from gets no number at all.

## Stress events

The caller passes every tier the tracker reports, with its time: `tier(nowMs, tier)`, where `nowMs` is Unix milliseconds. Readings without a tier (NO HUM, CALIBRATING) are **not passed**: the ledger keeps the last tier it was given. A cut level loses its hum, so a gap is the normal shape of a cut, not a return to GREEN. The tier before the first call is GREEN. A minute is `floor(nowMs / 60000)`, the same Unix minute packets carry.

- An **AMBER event** opens when the tier rises from GREEN to AMBER or RED.
- A **RED event** opens when the tier rises from GREEN or AMBER to RED.

So a jump from GREEN straight to RED opens one event of each tier, and an event at a tier means "the grid reached at least this tier". A tier that stays the same or falls opens nothing; the ledger always remembers the new tier, so a later rise is judged from it.

**An event lasts while the tier stays at or above its tier, plus 10 minutes.** When the tier falls below the event's tier at minute `d`, the event ends at minute `d + 10`. A rise back before that minute continues the same event (its end is cleared), so a tracker that restarts at GREEN after a NO HUM gap, after `recalibrate()` or after flicker opens nothing new. A rise at or after the end minute opens a new event. Events of one tier therefore never overlap. The event's **window** is the packet minutes `m` with `start ≤ m < end`; an event still at or above its tier has no end yet and is **open**.

Times must not go backwards: a `nowMs` earlier than the previous call's, a non-finite `nowMs`, an unknown tier or an unknown label throws RangeError and changes nothing.

## Reports

`report(packet)` takes a decoded packet (`Decoded` from the packet codec, or any object with its `type`, `payload`, `minute`, `keySet` and `duplicate`). It is stored, and `true` returned, only when its type is OK (0) or REPORT (2), it is not marked `duplicate`, its minute is an integer and payload level is an integer from 1 to 6. Payload flags bit 0 gives the power state (0 = off). Anything else returns `false` and stores nothing. A report's time is the packet's own minute (the sender's clock), not its arrival, so a report relayed late still lands in the right event. The sector is not used: odds are per level.

**Senders.** A sender is the pair (key set id, member byte). Public packets have key set `public`, so their member byte is chosen by the sender (see Deferred 1).

For one level and one event:
- the level is **observed** when at least **3 distinct senders** reported it, power on or off, inside the window;
- the level is **reported without power** when at least 3 distinct senders reported it power off inside the window.

Each sender counts once however many packets it sent. This is "reported without power during the event", not "cut by the event": a level already dark before the stress began is counted too (Deferred 3).

## Odds

`odds(level, tier, nowMs)` for tier AMBER or RED returns `{ p, cuts, events, label }`:

- `events` (e) counts the **closed** events of that tier (`end × 60000 ≤ nowMs`) in which the level is **observed**. An open event is left out, because its outcome is not known yet. An event nobody on the level reported from is left out, because silence is not evidence of "not cut";
- `cuts` (c) counts those in which the level is reported without power, so `c ≤ e`;
- `p = (c + 1) / (e + 2)`, Laplace's rule of succession;
- `label` is the weakest label among the creation label and every accepted call (SIMULATED is weaker than REPLAY, REPLAY weaker than LIVE). `tier` and `report` take an optional label, defaulting to the creation label, so history preloaded for a demo marks every answer it touches.

With `events` 0, `p` is exactly 1/2. The phone and district pages must print "no data yet" in that case, never "50%". The result depends only on the set of accepted reports and the tier sequence, not on the order reports arrive in.

Odds for GREEN are not defined. A level that is not an integer from 1 to 6, a tier other than AMBER or RED, or a non-finite `nowMs` throws RangeError.

## Interface

`createShedLedger({ label })` returns `{ tier(nowMs, tier, label?), report(packet, label?): boolean, odds(level, tier, nowMs) }`. It throws RangeError for a label other than LIVE, REPLAY or SIMULATED, and so do `tier` and `report` when given one.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Records | Own in-memory list of reports and events; the p01/p02 adapter **shall** also log every accepted report through `Witness.observe` (measured chain, source = sender) | Read `World.ledger.measured` back as the only store | `observe` stamps arrival time, but a report belongs to its packet minute, and odds must not depend on arrival order. The chain makes the evidence tamper-evident; this object computes from it |
| What an event is | Rise into at least AMBER, or at least RED, one event list per tier | Any tier change; one event per episode at its highest tier | "At least" matches what the phone knows: from AMBER it cannot know whether RED follows |
| Event length | While at or above the tier, plus 10 min after it falls | Fixed 10 min from the start; open until GREEN | A fixed window missed cuts later in a sustained event, so a longer warning lead time meant fewer counted cuts |
| Readings without a tier | Not passed; last tier kept | Passed as GREEN | The tracker loses the hum exactly when a level is cut; GREEN there opened false events on every return of power |
| Confirmation | 3 distinct senders | 1 report; a share of the level's phones | The plan's rule for public claims; one phone cannot mark a level cut |
| What `e` counts | Closed events in which the level is observed by 3 senders | Every closed event of the tier (the plan's wording) | With fewer than 3 phones a level could never score a cut, so it looked safe; unknown must read as unknown |
| Prior | Laplace, `(c + 1) / (e + 2)` | Raw `c / e` | Defined with no data and never claims 0 or 1 from a few events |
| Power-on reports | Count towards "observed" only | Cancel power-off reports; ignore them | Keeps one rule for cuts; contradiction handling is deferred |
| Label | Weakest of creation label and every accepted input | One label fixed at creation | Simulated history preloaded into a live ledger would otherwise show as LIVE |

## Open Questions & Future Decisions

### Deferred
1. Public reports can be forged by anyone, and one person can send them under three member bytes. Three distinct senders raises the bar but does not prove three people. Until weighting is decided, pages should show family and public reporters apart.
2. Power-on reports during a window do not cancel power-off reports. Revisit if false cut reports appear.
3. A level already without power before an event is counted for it if three of its phones report during the window. Requiring each sender to change from power on to power off is deferred; unannounced cuts with no event at all are not counted anywhere.
4. Reports are kept for the life of the object and nothing persists across restarts; the adapter must replay every tier change and accepted report to rebuild. A cap or a 30-day horizon is needed before a phone runs for weeks.
5. If phones mostly report when their power is off, observed events skew towards cuts and the odds read high. That errs towards warning, not reassurance.

## References

- `docs/plan.md` problems 1 and 2, "The honest claim for problem 2", the cut-odds formula and the public packets rule
- `docs/intent/tracker/tracker-design.md` (tiers, NO HUM, restart at GREEN), `docs/intent/packet/packet-design.md` (payload, duplicate flag), `docs/intent/witness/witness-design.md` (ledger)
- Rule of succession: https://en.wikipedia.org/wiki/Rule_of_succession
