# STRATUM handoff brief

The compact version of `docs/plan.md`: concept, stack, contracts, sound plan, packet layout, ladder and tiers. Agents read this first.

```
STRATUM: handoff brief
Deadline: Fri Nov 20 2026, 11:00 PM (assume ET), no extensions. Solo build. Full plan in docs/plan.md.

CONCEPT
A citizen toolkit for the Hollow with one loop: hear, prove, pass on, share fairly.
Three engines:
  WITNESS     change detector + hash-chained ledger, measured value beside official value
  MESH        25-byte authenticated packets carried by sound
  FAIR SHARE  life floors first, then the worst-off, rotate what cannot be split
District 7 (6 levels x 4 sectors) is a simulated test rig.
Real: phone hum tracker, packets, ledger, allocator. Simulated: the district.

STACK
TypeScript, Vite 8, Vitest 5 (pin with npm view). Canvas 2D. Web Audio + AudioWorklet.
ggwave 0.4.0 vendored behind src/audio/modem.ts.
WebCrypto: HMAC-SHA-256, HKDF, SHA-256, ECDSA P-256. IndexedDB.
Optional: @mediapipe/tasks-audio pinned, YAMNet file self-hosted, loaded on demand.
Vercel (static, Hobby plan). No backend. No language model. No network call at run time.

CONTRACTS (src/core/contracts.ts, frozen Saturday)
World {
  t, seed, clock{mode, scale},
  grid{f, rocof, gapMW, tier},
  sectors[24]{level, temp, wetBulb, co2, water{cond, toc, turb, biocide},
              sumpLevel, people, sleepM2, lightDose, foodKcal, stock},
  tunnels{nodes, edges{a, b, passable}}, households[],
  ledger{measured, official}, mesh{inbox, delivered},
  alloc{power, water, food, cooling, pumps, lampHours, medicine, bunks, trialSlots, returnSlots},
  surface{readings, band}
}
witness.observe(kind, where, value, source) | witness.gap(kind)
mesh.send(packet) | mesh.inject(packet)
fairShare(supply, claims[{id, floor, demand, debt}]) -> shares
Adapter { id: 'p01'..'p15', reads, writes, step(world, dt, rng), metric(world) }

SOUND
Hum: 400 Hz, 800 Hz (strongest), weak 1200 and 1600 Hz. Fan noise. All below 1.7 kHz.
Packets: 1875 to 6330 Hz.
echoCancellation, noiseSuppression, autoGainControl = false on every microphone.
Tracker: tone bank on 800 Hz, 2 s window, 0.5 s hop, 30 s calibration,
         report relative deviation, show NO HUM below the signal threshold.

PACKET v3 (25 bytes)
[0]      version | type
[1-2]    minute counter
[3-5]    nonce
[6-9]    tag = HMAC(Ktag, minute)
[10-15]  payload XOR HMAC(Kenc, type | minute | nonce)
[16]     hops left (not covered by the MAC)
[17-24]  MAC = first 8 bytes of HMAC(Kmac, bytes 0-15)
Keys: six generated words -> HKDF -> Ktag, Kenc, Kmac.
Seen-set on (minute, nonce). Display the packet's own time.

LADDER
R0 Sat 22:00  repo, contracts, deploy, spikes T1-T3
R1 Sun 22:00  phone AMBER -> RED from the laptop's hum; one authenticated packet
R2 Mon 22:00  report grid, family board, Shed Ledger, Breath Count, relay, judge mode; tag v0-real
R3 Tue 22:00  District 7 scripted scenario, Directorate/STRATUM switch, phone packets enter the district
R4 Wed 22:00  all 15 adapters on screen, coverage matrix, sound model if T4 passed. FREEZE
R5 Thu        README, write-up, video. Draft submitted Thu night, final Fri before 23:00

TIERS TO CLAIM
Live on real devices: 1 (power), 7, 8, 10 (aid and request).
Modelled in District 7: 2, 3, 4, 5, 6, 9, 11, 12, 13, 14, 15.
Real reports feed 2, 4, 5, 9, 12.
Real data: tracker on ENF-WHU, water detector on GECCO 2018.

FIRST TEN TASKS (today)
 1 Email directors@ and hello@patriothackfest.com: rubric, deadline time and zone,
   platform, AI-tool policy, prizes.
 2 Create the repo with a Vite + TypeScript scaffold and an MIT licence.
   Deploy a hello page to Vercel.
 3 Add CLAUDE.md, the agent files and the typecheck hook. Restart Claude Code once.
 4 Write src/core/contracts.ts and rng.ts. Commit to main.
 5 Emitter page v0: 400 + 800 Hz, a slider for offset, a button for a 0.1 Hz step.
 6 Listener page v0: microphone with processing off -> AudioWorklet -> tone bank -> number on screen.
 7 Run T1 on the Android phone, then the iPhone. Record results in docs/spikes.md.
 8 Load the vendored ggwave. Send and receive a 25-byte payload. Run T2, then T3.
 9 Spawn four logic-builders in worktrees: packet codec and keys, fairShare,
   witness detector, kernel.
10 Choose fallbacks from the spike results before stopping tonight.
```
