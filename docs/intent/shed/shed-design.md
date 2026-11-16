---
parent: high-level-design
prefix: SHED
---

# Shed Ledger

## Context and design philosophy

The hum says **when** the grid is stressed; the Shed Ledger says **who** gets cut. It counts neighbours' power-off reports during past stress events and turns them into each level's odds of being cut at the current tier. It serves problem 1 (which level, not just when) and problem 2 (prove the pattern of who gets cut: the cut counts per level are that proof).

It is a small stateful object. Times come from the caller, there is no randomness and no storage. It prefers "no data yet" to a number with nothing behind it.

## Stress events

The caller passes every tier the tracker reports, with its time: `tier(nowMs, tier)`, where `nowMs` is Unix milliseconds and readings without a tier are passed as GREEN. The tier before the first call is GREEN. An event's **minute** is `floor(nowMs / 60000)`, the same Unix minute packets carry.

- An **AMBER event** opens when the tier rises from GREEN to AMBER or RED.
- A **RED event** opens when the tier rises from GREEN or AMBER to RED.

So a jump from GREEN straight to RED opens one event of each tier, and an event at a tier means "the grid reached at least this tier". A tier that stays the same or falls opens nothing. A rise less than 10 minutes after the previous event **of the same tier** opens nothing, so a tier flickering across a threshold counts once; the ledger still remembers the new tier, so a later rise is judged from it. Times must not go backwards: a `nowMs` earlier than the previous call's, a non-finite `nowMs` or an unknown tier throws RangeError and changes nothing.

## Cut reports

`report(packet)` takes a decoded packet (`Decoded` from the packet codec, or any object with its `type`, `payload`, `minute`, `keySet` and `duplicate`). It is stored as cut evidence, and `true` returned, only when:

- its type is OK (0) or REPORT (2);
- it is not marked `duplicate`;
- payload flags bit 0 is 0 (power off);
- its minute is an integer;
- payload level is an integer from 1 to 6.

Anything else returns `false` and stores nothing. The report's time is the packet's own minute (the sender's clock), not its arrival, so a report relayed late still lands in the right event. The sector is not used: odds are per level.

**Senders.** A sender is the pair (key set id, member byte). A family key set names a family, and the member byte names the phone within it. Public packets have key set `public`, so their member byte is chosen by the sender (see Open Questions).

**A confirmed cut.** A level counts as **cut during an event** when at least **3 distinct senders** reported it power off with a packet minute `m` where `event minute ≤ m < event minute + 10`. Each sender counts once per level per event however many packets it sent. Because events of one tier start at least 10 minutes apart, their windows never overlap, so a level is cut at most once per event and `c ≤ e`.

**Duplicates and replays.** The codec already rejects packets more than 2 minutes ahead or 24 hours old and marks a repeat of a (key set, minute, nonce) it has seen as `duplicate`; the ledger drops those. A replay that slips past the codec (its seen-set forgot it) still carries its original minute and sender, so it can only repeat a sender already counted for that event, and it can never fall into a newer event's window.

## Odds

`odds(level, tier, nowMs)` for tier AMBER or RED returns `{ p, cuts, events, label }`:

- `events` (e) counts the events of that tier whose 10-minute window has ended: `(event minute + 10) × 60000 ≤ nowMs`. An open event is left out, because its outcome is not known yet and counting it would pull the odds down;
- `cuts` (c) counts those events in which the level is cut;
- `p = (c + 1) / (e + 2)`, Laplace's rule of succession;
- `label` is the label given at creation (LIVE, REPLAY or SIMULATED).

With no closed event, `p` is exactly 1/2 and `events` is 0. The phone and district pages must print "no data yet" in that case, never "50%". The result depends only on the set of accepted reports and the tier sequence, not on the order reports arrive in, so a report relayed after its window ended still counts once it arrives.

Odds for GREEN are not defined. A level that is not an integer from 1 to 6, a tier other than AMBER or RED, or a non-finite `nowMs` throws RangeError.

## Interface

`createShedLedger({ label })` returns `{ tier(nowMs, tier), report(packet): boolean, odds(level, tier, nowMs) }`. It throws RangeError for a label other than LIVE, REPLAY or SIMULATED.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Records | Own in-memory list of accepted reports and event minutes | Write each report through `Witness.observe` and read `World.ledger.measured` back | `observe` stamps arrival time from `now()`, but a cut belongs to the packet's own minute; its detector would run on 0/1 power values; and odds must not depend on arrival order. The adapter may still log accepted reports through `observe` for the tamper-evident chain |
| What an event is | Rise into at least AMBER, or at least RED, one event list per tier | Any tier change; one event per episode at its highest tier | "At least" matches what the phone knows at the moment: from AMBER it cannot know whether RED follows. A direct GREEN to RED jump is still an AMBER-or-worse event |
| Minimum gap | 10 minutes per tier, equal to the cut window | No gap; a separate gap parameter | Equal values keep windows apart, which guarantees `c ≤ e`, with one parameter instead of two |
| Cut window | Packet minutes `[event, event + 10)` | Window measured in arrival time; open until the tier returns to GREEN | Packet time survives relay delay; a fixed window gives every event the same chance to collect reports |
| Confirmation | 3 distinct senders | 1 report; a share of the level's phones | The plan's rule for public claims; one phone cannot mark a level cut; the ledger does not know how many phones a level has |
| Sender identity | (key set id, member byte) | Key set id alone | Two phones of one family are two witnesses; key set alone would merge them |
| Open events | Left out of `e` until their window ends | Counted at once | Counting an event before its reports can arrive biases the odds down |
| Prior | Laplace, `(c + 1) / (e + 2)` | Raw `c / e` | Defined with no data and never claims 0 or 1 from a few events |
| Power-on reports | Ignored | Subtract them; require a majority | Keeps one rule; contradiction handling is an open question |

## Open Questions & Future Decisions

### Deferred
1. Public reports can be forged by anyone, and one person can send them under three member bytes. Three distinct senders raises the bar but does not prove three people. Decide whether to weigh family reports above public ones once real reports arrive.
2. Power-on reports during a window do not cancel power-off reports. Revisit if false cut reports appear.
3. Cuts with no stress event before them are not counted anywhere: the ledger estimates odds given stress, not unannounced cuts.
4. Reports are kept for the life of the object. A cap or a 30-day horizon is needed before a phone runs for weeks.

## References

- `docs/plan.md` problems 1 and 2, "The honest claim for problem 2", the cut-odds formula and the public packets rule
- `docs/intent/tracker/tracker-design.md` (tiers), `docs/intent/packet/packet-design.md` (payload, duplicate flag), `docs/intent/witness/witness-design.md` (ledger)
- Rule of succession: https://en.wikipedia.org/wiki/Rule_of_succession
