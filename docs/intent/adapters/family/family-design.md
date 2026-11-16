---
parent: adapters-design
prefix: ADAPT-FAMILY
---

# Family adapters: p07 mesh delivery, p08 family board

## Context and design philosophy

`p07` carries messages through District 7 with the network down; `p08` splits families across levels, has the separated members send OK beacons, and keeps the family board. They serve problem 7 (organize and call for help without the network) and problem 8 (reconnect families split across levels). They are also the path by which a real phone's OK reaches the district: the district page's gateway decodes the packet and hands it to the scenario runner, which puts it in `World.mesh.inbox`; `p07` delivers it and the family board shows it as LIVE.

The relay logic is the real code: every simulated hop runs `createRelay` from `src/core/relay`. Only the air between phones is simulated.

## Messages in World

A `MeshMessage` is `{ at, bytes, heard? }`. `heard` is what a receiver learned from the packet: type, key set id, the packet's own minute, the payload fields and a label. The gateway sets it from the codec's `Decoded` with label LIVE; `p08` sets it for simulated beacons with label SIMULATED. Routing needs `heard`, because the simulation cannot run the asynchronous codec inside a step.

- **Destination:** the home sector (`Household.sector`, 0 to 23) of the household whose id equals `heard.keySet`.
- **Origin:** `(heard.payload.level − 1) × 4 + heard.payload.sector`, because the payload's sector is 0 to 3 within its level.
- **Minute:** `heard.minute` is the packet's full Unix minute for LIVE and the world minute `floor(at / 60)` for SIMULATED. The two never mix: the board formats each by its label and orders messages by `at` only.

## Order within a step

The kernel runs `p07` before `p08`. So `p07` processes the inbox left by earlier steps: a beacon `p08` queues in the step at `t` is taken in the step at `t + dt`, a lag of one step. The network-down test uses each message's own `at`: the network is down at `at` when some `network-down` event has `at` in `[atH × 3600, (atH + durH) × 3600)`.

## p07: delivery

Each step, `p07` takes every message from `mesh.inbox`:

- without `heard`, or with no household of that id: dropped, not counted;
- label LIVE: delivered at once, unchanged (heard at the gateway, in the room), under both policies;
- network up at `at`: delivered at once;
- network down at `at`, *Directorate:* held for the bulletin;
- network down at `at`, *STRATUM:* the hop simulation below; a message it does not deliver is held for the bulletin.

**Bulletin.** The Directorate's daily 06:00 bulletin runs under both policies. In the step that holds 06:00, `p07` delivers every message it holds, with `at` set to that 06:00. In the first step whose `t` is outside every network-down interval, it delivers every message still held, with `at` set to that step's `t`.

Delivered messages are appended to `mesh.delivered`, which is append-only and never drained during a run.

**Hop simulation.** One relay per sector node, created on the first step with the adapter's stream. The origin registers the message bytes with `own` and transmits them at the message's `at`. Each transmission carries its own bytes: the message bytes for the origin (byte 16 = 4 hops), and for a relay the `send` bytes its `hear` returned, in which the relay has already lowered the hop count. A transmission from a node at time `T` seconds reaches each neighbour along a passable tunnel edge, in edge order, with probability `P_HOP` (one draw each). A neighbour it reaches calls `hear(tx.bytes, { reject: 'unknown-tag' }, { state: 'NO_HUM' }, (T + AIR) × 1000)`: a stranger cannot verify a family's packet, so it relays it as the relay design intends. A returned `send` schedules that node's transmission at `atMs / 1000` seconds; a `cancel` removes it. Events run in time order, ties in the order they were scheduled. The message is delivered when its destination node first hears it, with `at` set to that time; a message whose origin is its destination is delivered at once. When no events remain, an undelivered message goes to the bulletin. The whole cascade of one message runs when it is taken from the inbox; messages do not collide on air. A delivery can therefore carry an `at` up to one step after `world.t`; the board shows it from that step.

**Metric:** "messages delivered within 60 min", unit `share`: simulated messages delivered no later than `DELIVER_WINDOW` after their original `at`, over all simulated messages taken.

*What sets this number.* Under the Directorate, the bulletin hour: only messages sent in the hour before 06:00 arrive within 60 min. Under STRATUM, the 4-hop limit and `P_HOP`.

## p08: families

**Separation.** In the step that holds the script's `separate` event, `p08` walks `world.households` in order, skipping the demo household, and for each member 1 to `members − 1` draws exactly four numbers: away (`u < away`), a level (index `floor(u × 5)` into the other five levels in ascending order), a sector (`floor(u × 4)`), and a first-beacon delay (`u × FIRST_WINDOW`). The level, sector and delay are used only when the member is away. Member 0 stays home with the board.

**Beacons.** Each away member sends its first OK at the separation time plus its delay, then every `BEACON_EVERY`. In each step, `p08` appends to `mesh.inbox` every beacon due in `[t, t + dt)`, with `at` its due time: 25 random bytes (25 draws) with byte 0 set to version 3, type OK and byte 16 set to 4, and `heard` naming the household, the member, the member's level and sector, the world minute, and label SIMULATED.

**Known status.** A separated member is known once a delivered SIMULATED OK of their household and member number has `at` at or after the separation. `p08` keeps a cursor into `mesh.delivered` and reads only the entries added since its last step.

**Metric:** "mean hours until status known", unit `h`: the separated members' unknown time summed over steps since the separation (unknown members times `dt / 3600`), over the number of separated members; 0 before the separation. Once everyone is known it is the mean time from separation to a known status.

*What sets this number.* The bulletin reaches every member at the first 06:00 after their beacon under both policies, so the gap comes from the members the mesh reaches sooner.

**Board.** `familyBoard(world)` returns, per household and member, the latest delivered OK (by `at`) with its minute, level, sector and label, in one pass over `mesh.delivered`, outside the step loop. The district page draws it; a real phone's OK shows there as LIVE.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Decoded fields in World | Optional `heard` on `MeshMessage` | Synchronous decoder in core; a side table passed to adapters | Decoding is async WebCrypto; an additive optional field keeps the evidence in `World` where every adapter and the page can read it |
| Relay in the simulation | The real `createRelay` per node | A probability of delivery per level pair | Scores the code that ships; suppression and hop limits act as they do on phones |
| Acoustic graph | Passable tunnel edges, one node per sector, one hop from sector to sector | Phones as individual nodes | One node per sector is the resolution of the world; floods cut sound paths too. A hop assumes phones at every sector boundary, since real sound reaches a few metres (`docs/limits.md`) |
| Bulletin | Runs under both policies | Bulletin under the Directorate only | The bulletin is the Directorate's service; dropping it under STRATUM would score the toolkit for its absence |
| p08 metric | Mean hours until status known | The plan's "time until every member has a known status"; share known | The slowest member waits for the bulletin under both policies, so the maximum hides who the mesh reached; a share known saturates once the bulletin has run |
| Live packets | Delivered at once, outside the metrics | Routed through the simulation | The phone was heard in the room; mixing LIVE into a SIMULATED metric would blur labels |
| Separation | Random away members, four draws per member | Scripted list of who is where; draws only for away members | Seeds vary who is separated; a fixed draw count keeps streams aligned |
| Minute of a simulated beacon | World minute, formatted by label | A simulated Unix epoch | The board never compares minutes across labels |

## Open Questions & Future Decisions

### Deferred
1. Air collisions between messages, and stairwell battery relays (roadmap hardware).
2. Couriers carrying stored messages between levels.
3. NEED and REPORT packets from simulated residents for problems 2, 4, 5 and 12.

## References

- `docs/intent/relay/relay-design.md`; `docs/intent/packet/packet-design.md` (layout, payload); `docs/intent/world/tunnels/tunnels-design.md`
- Red Cross "safe and well" tracing (plan, problem 8)
