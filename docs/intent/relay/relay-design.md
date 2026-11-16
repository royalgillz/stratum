---
parent: high-level-design
prefix: RELAY
---

# Relay

## Context and design philosophy

Relay is the store-and-forward half of the Mesh engine. A phone that hears a packet v3 may send the same bytes again a few seconds later, one hop further, so a message can cross a level without any network. It serves problems 7 (organize without the network) and 8 (reconnect families), and problem 1 by carrying grid alerts. The live demo shows one hop; multi-hop reach is SIMULATED.

It is pure decision logic. The caller supplies the received bytes, the decoder's result for those same bytes, the latest tracker reading, the current time and an `Rng`. The relay returns actions: send these bytes at this time, or cancel a send it asked for earlier. It never reads a clock, opens audio or sets a timer.

It prefers silence to noise. Sound is a shared channel that carries about one packet every 3 s, so every needless rebroadcast delays someone else's message.

## Which packets are relayed

A relay must carry packets of families it does not belong to, or a family's OK beacon reaches only phones of the same family, which defeats problem 8. The decoder rejects those packets as `unknown-tag`. Because the decoder checks length, version and age before the tag, an `unknown-tag` result already means 25 bytes, version 3 and a minute within 2 minutes ahead and 24 hours behind.

A packet is **forwardable** when its decode result is:
- verified (any type the decoder accepts), or
- rejected as `unknown-tag` with type 0 to 3 (byte 0, low 4 bits, in the clear). Types 4 to 7 are public only, and every phone holds the public keys, so an `unknown-tag` alert is forged; types 8 to 15 are undefined.

Every other rejection (`length`, `version`, `future`, `stale`, `mac`, `type`) is ignored: no action, not counted.

**Trade-off.** The relay forwards foreign packets without checking their MAC, because it cannot. Anyone can make it spend air time on well-formed junk with a random tag and type 0 to 3. That cost is bounded: each relay sends any one identity at most once, and the hops byte is clamped to 4, so a forged packet travels at most 4 hops. A jammer with a speaker can block the channel anyway. The alternative, relaying only packets the phone can verify, is immune to junk but carries family messages only between members of the same family. Altered bytes are never accepted by a receiver: the family's own decoder still checks the MAC.

## Identity, counting and suppression

A packet's **identity** is its 25 bytes with byte 16 set to 0. Copies of one message differ only in byte 16, so they share an identity. A forged copy with a different MAC or payload has another identity, so it cannot pre-empt the real message by being heard first. The relay keeps a count per identity for the 4,096 most recently heard identities, evicting the least recently heard first (the packet seen-set size). Every forwardable hearing counts, whether or not it leads to a send.

- **First hearing.** If hops left (byte 16 clamped to MAX_HOPS = 4) is above 0 and the grid-alert rule allows it, return `send`: the same bytes with byte 16 set to clamped hops minus 1, at `now + slot × 3000 ms`, where `slot = floor(rng() × 4)`. The `Rng` is drawn once, only when a send is scheduled.
- **Later hearings.** Never schedule again: a relay that has heard a message twice stays silent. If a send is pending (its time is later than now), return `cancel` with its identity, because neighbours have just heard a copy. A copy heard at or after the send time is too late to cancel.
- **Own packets.** `own(bytes)` registers a packet this phone originated, so an echo of it is never relayed back.

Back-off slots are as long as one packet's air time (2 to 3 s), so a relay in a later slot hears an earlier relay's whole packet before its own slot starts; two relays that pick the same slot collide.

## Grid alerts (problem 1)

A verified GRID_ALERT is relayed only when the latest tracker reading agrees (state LIVE with tier AMBER or RED) or hears no hum (state NO_HUM). It is not relayed while CALIBRATING, on a LIVE reading without a tier (the readings skipped after a gap), or at GREEN. The rule is checked once, at the first hearing.

## Interface

- `createRelay(rng: Rng)` returns `{ hear, own }`.
- `hear(bytes, decoded: Decoded | Reject, tracker: { state, tier? }, nowMs) → RelayAction | null`, where `RelayAction` is `{ id, send: Uint8Array(25), atMs }` or `{ cancel: id }`, and `id` is the identity as lower-case hex.
- `own(bytes)`: counts one hearing of the identity without scheduling a send; throws RangeError unless `bytes` has 25 bytes.
- `hear` throws RangeError when `nowMs` is not finite or `rng()` returns a value outside [0, 1).

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Foreign packets | Forward unverified packets that decode as `unknown-tag`, type 0 to 3 | Forward only packets the phone can verify | Family messages must cross strangers' phones (problem 8); junk is bounded by one send per identity and 4 hops |
| Identity | All bytes except byte 16 | (minute, nonce, tag) | A forged copy with the same (minute, nonce, tag) and a bad MAC would otherwise suppress the real message |
| Suppression | Count every forwardable hearing; cancel on the second | Cancel only on a copy with as many hops left | Neighbours already hold the identity and will not relay a later copy, so the extra hops would not travel |
| Back-off | 4 slots of 3 s, one `rng()` draw | Continuous uniform delay | With a continuous delay a relay can start before an earlier relay's packet ends, so it neither hears nor suppresses it |
| Timers | Return send and cancel actions with absolute times | Keep a queue and poll it | Phones use timers and the simulation uses an event queue; both handle absolute times |
| Alert check | At first hearing, CALIBRATING does not agree | Re-check at send time; treat CALIBRATING as no hum | A calibrating phone hears hum but cannot judge it, so it does not vouch for the alert |
| Own packets | Caller registers them with `own` | Let the originator relay its own echo | Saves one packet of air time per message |

## Open Questions & Future Decisions

### Deferred
1. Slot length and count (3 s, 4 slots) are assumptions; tune them in the multi-hop simulation against delivery fraction and delay.
2. An identity evicted from the 4,096-entry set is relayed again if heard again within its 24-hour age; acceptable while traffic stays near one packet per 3 s.

## References

- `docs/intent/packet/packet-design.md` (layout, decode order, MAX_HOPS); `docs/intent/tracker/tracker-design.md` (states and tiers)
- `docs/plan.md` § Packet v3 (relay silent after hearing twice; grid alert rule); `docs/limits.md` § Sound messages
- Counter-based broadcast suppression: Ni, Tseng, Chen and Sheu, "The broadcast storm problem in a mobile ad hoc network", MobiCom 1999, https://doi.org/10.1145/313451.313525
