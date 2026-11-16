# Changelog

Every decision and change, dated, newest first. **Decided by** says who made the call: the human, or an agent (to be confirmed by the human).

## 2026-11-16

### Decisions
- Decided by the human, three new rules:
  - no em-dashes anywhere (now enforced by `npm run check`);
  - no AI or Claude trailers in commits or pull requests;
  - every UI change is tested with Playwright on desktop, laptop, tablet, phone and Galaxy Z Fold 6 viewports, folded and open.
- Decided by the human, overnight work while the human sleeps:
  - LID stops are skipped and every call is logged under open questions;
  - additive-only changes to `contracts.ts` are allowed, each logged;
  - the scope is rung 2, then the start of rung 3.
- Approved by the human: fairshare, witness and kernel designs and specs (FAIR, WIT and KERN, 001 to 012 each), with these choices:
  - witness computes SHA-256 synchronously in its own code, so `observe` stays synchronous;
  - witness takes an injected clock;
  - measured or official is decided by whether `source` starts with `official`;
  - the LEDGER_HEAD digest covers the measured chain only;
  - `gap(kind)` averages over places, with a per-place view added when the district needs it;
  - the fairshare lottery weight is 1 + debt with no cap, and debt resets to 0 when fully served;
  - no floor priority tiers for indivisible goods;
  - the kernel uses dt = 60 s and stops hard on a write violation;
  - the write guard may be off for the harness only if KERN-009's 1 s budget is missed.
  - None of these needs a change to `contracts.ts`.
- Approved by the human (2026-11-16): witness design and specs written in `docs/intent/witness/`. `observe` stays synchronous by using an own pure-TypeScript SHA-256 instead of `crypto.subtle`; time is injected through `createWitness({ now })`; two chains (measured, official) routed by `source`; the LEDGER_HEAD digest is the measured head only.
- Decided by the human, the GitHub repo:
  - the repo is public;
  - `docs/audit.md` stays local only (git-ignored);
  - Vercel deploys from the repo, and CI is a required check on `main`.
- Decided by the human: start the fairshare, witness and kernel builders in parallel. Each brings its design and specs back for one combined review before writing code.
- Decided by the human: keep the DANGER exit as it is. Ten seconds of normal readings clears both DANGER and WARNING.
- Confirmed by the human: every agent call in the 2026-11-15 open questions, namely:
  - the eight Phase 4 resolutions;
  - even-count medians take the upper middle value;
  - the 8 kHz decimation in the phone's audio path;
  - `spikes/` is deleted once the rung 1 phone test passes.

### Changes
- 2026-11-16: Ledger screen review fixes (agent): the explanation now says each number estimates the chance of a cut in the next event at that tier, starting from an even guess, so 33% over "0 cuts in 1 observed event" no longer reads as a contradiction; "no data yet" is muted and normal weight so real percentages stand out; the table moved into `ledgerView`, whose vitest test feeds a real ledger GREEN, RED, NO HUM, GREEN plus three power-off reports and checks the 67% cells, the "(now)" column and the report counts. Open question "Ledger screen" 5 corrected: the phone's own report counts when its mic hears it.
- 2026-11-16: Ledger tab built (`src/phone/screens/ledger.ts`, agent): an in-memory Shed Ledger fed by tiered readings and decoded packets shows each level's LIVE odds of being cut at AMBER and RED as a percentage with "c cuts in e observed events", or "no data yet"; the current tier's column is marked "(now)"; an empty state before listening; family and public report counts shown apart; the screen says the ledger resets on reload. Tests: `oddsCell` and `ledgerView` in vitest, `e2e/ledger.spec.ts` on six viewports. Judgement calls: open questions "Ledger screen" 1 to 5.
- Phone page split into tabs (Listen, Report, Family; Care and Ledger hidden until built). Shared services live in `src/phone/app.ts`; each screen is a module in `src/phone/screens/` that talks to the others only through app events. Tabs follow the WAI-ARIA pattern (arrow keys, `aria-selected`) and the address remembers the screen. Playwright now checks every tab on all six viewports.
- Shed Ledger review fixes (agent, LID stops waived): an event now lasts while its tier holds plus 10 minutes after it falls, and a rise back within those 10 minutes continues it (SHED-002, new SHED-011), so a tracker restarting at GREEN after a NO HUM gap opens no false event; readings without a tier are no longer passed as GREEN. `events` counts only closed events in which 3 distinct senders reported the level, power on or off (SHED-004 to SHED-007), so a level with too few phones reads "no data yet" instead of looking safe. `tier` and `report` take an optional label and `odds` returns the weakest (new SHED-012). Design wording: "evidence", not "proof"; the adapter shall log accepted reports through `Witness.observe`; "reported without power", not "cut by the event". Tests added for AMBER to RED opening a RED event only, and for the tier being kept when no event opens. Open questions Shed 2, 6 and 7 updated, Shed 9 to 12 added.
- Shed Ledger (`src/core/shed/`, agent build, LID stops waived): design and specs in `docs/intent/shed/`, SHED-001 to SHED-010 with 10 tests, all `[x]`. Cut odds `(c + 1) / (e + 2)` per level and tier from power-off REPORT and OK packets, 3 distinct senders inside a 10-minute window. HLD component table, `docs/params.md`, `docs/coverage.md` (rows 1 and 2) and `docs/limits.md` updated. No change to `contracts.ts`. Judgement calls are open questions below (Shed 1 to 8).
- Relay (`src/core/relay/relay.ts`, branch `rung2/relay`): design and specs in `docs/intent/relay/` (RELAY-001 to RELAY-009, all `[x]`), 9 tests. Store-and-forward decisions for packet v3: forwards verified packets and other families' `unknown-tag` packets of types 0 to 3, one send per message identity, byte 16 lowered by one, 3 s back-off slots, cancel on a second copy, grid alerts gated by the tracker. `MAX_HOPS` and `SEEN_MAX` are now exported from `codec.ts`. Relay rows added to `docs/params.md`, `docs/coverage.md` (problems 1, 7, 8), `docs/limits.md` and the HLD component table. Agent decisions, see open questions 9 to 16. Multi-hop delivery is not yet scored in the harness (SIMULATED, to do).
- Relay review fixes (agent): RELAY-007 now says the grid-alert rule applies to no other packet, with a test that OK and foreign type-0 packets are relayed under LIVE GREEN and CALIBRATING. Design, `docs/limits.md`, `docs/params.md` and open questions 9 to 13 now state the junk amplification, the hops-0 replay attack, the NO_HUM leg of the grid-alert rule and the unmeasured slot margin. No code change.
- Commit history rewritten and force-pushed with the human's order, to remove the AI attribution trailer from all 19 commits that had one. File contents are unchanged (tree hash verified). Branch protection was relaxed only for that push and then restored.
- Playwright 1.65.1 added (approved by the human) with six viewport projects, `npm run e2e`, `e2e/phone.spec.ts` (layout, family, word errors, microphone path) and a CI `e2e` job. Locally 30/30 pass; 5 needed a retry because the Windows preview server stalls under load.
- Vercel auto-deploy from GitHub is connected; pushes to `main` deploy.
- Public repo at https://github.com/royalgillz/stratum. The first CI run passed on GitHub: 30 tests, check and build.
- Branch protection on `main`:
  - the CI job `checks` is required for pull requests;
  - force-push and deletion are blocked;
  - admins may still push directly.
- Vercel to GitHub auto-deploy is not connected yet: Vercel's GitHub App needs access to the repo. Deploys continue with `npx vercel deploy --prod --yes`.
- Builders started in separate worktrees for fairshare, witness and kernel (design and specs only, pending review).
- Fairshare `rotate` serves floors first (agent decision, enforcing the human-approved HLD rule "never breach a floor while supply covers all floors"): units at or above the sum of floors pay every floor, then run the debt-weighted lottery on remaining demand; below it, whole floors are drawn by lottery and the rest are listed in the breach. FAIR-004, FAIR-009 to FAIR-011 reworded; floors must be whole units in `rotate`.
- Fairshare tests and code (`src/core/fairshare/`): FAIR-001 to FAIR-012 implemented and marked [x]. Human approved the design and answered: no cap on lottery weight, debt resets to 0 when fully served, no floor priority tiers, the adapter stores debt. Phase 4 tightened the specs: no rounding absorber, id order defined, lottery pick rule and zero-demand skip stated, Bertsekas and Gallager citation added.
- Approved by the human (2026-11-16): fairshare design and specs drafted in `docs/intent/fairshare/` (FAIR-001 to FAIR-012). `allocate` returns a breach-bearing result and `fairShare` wraps it to fit `contracts.ts`. Three Fair Share parameters added to `docs/params.md`.
- Kernel (`src/core/kernel`): design and specs approved by the human (dt 60 s, dies hard on any violation, 600-step cap per advance, harness may run unchecked if KERN-009 is missed). Tests and code written: KERN-001 to KERN-012 implemented; `@spec KERN-010` to `KERN-012` added to `rng.ts` and its tests. 30 simulated days with 15 adapters and the guard on: 229 ms.
- Witness built (`src/core/witness/`, 25 tests, WIT-001 to WIT-012 marked `[x]`). Phase 4 tightened the specs: even-count medians take the upper middle value, `tStart` is the earliest exceeding reading among the last five, `direction` and `peakZ` are defined, the quorum and Chapman return shapes are fixed, and "latest" means last appended.
- Git history rewritten before the first push, to remove `docs/audit.md` from every commit; commit hashes changed. A bundle of the old history is kept outside the repo.

## 2026-11-15

### Decisions
- Approved by the human: tracker and packet component designs and specs (`docs/intent/tracker`, `docs/intent/packet`), including:
  - tier thresholds: AMBER at −50 mHz or a 50 mHz fall in 10 s, RED at −150 mHz, 10 s to leave;
  - which key set each packet type uses: OK family only; NEED, REPORT and CODEBOOK family or public; alerts, routes and ledger heads public only;
  - public phrase `stratum public channel` and MAX_HOPS = 4;
  - BIP-39 English as the 2,048-word list.
- Decided by the human: keep this changelog; add a GitHub CI pipeline with checks.
- Decided by the human: LID stops are waived while the human is away. The agent continues through edge audit, tests and code for tracker and packet, and logs every judgement call under "Open questions for the human" below.
- Decided by an agent, fixes from the edge-case probe:
  - tracker: noise floor excludes the peak's main lobe; ENF-WHU band widened to ±1.5 Hz; silence and an out-of-band peak report NO HUM;
  - packet: full 32-bit minute bound into every HMAC; 24 h `stale` limit; seen-set keyed by key set.
- Approved by the human: HLD with three tenets; `src/core/contracts.ts`; `src/core/rng.ts`.
- Decided by the human, spike results (`docs/spikes.md`):
  - T1 passes at 30 cm, so the phone sits within about 30 cm of the hum source;
  - T2 and T3 pass, so no fallbacks;
  - Android-only.
- Decided by the human: deadline is Fri Nov 20, 11:00 PM (organizers). AI tools allowed without limit.

### Changes
- **Rung 1 phone page** at https://stratum-nine-swart.vercel.app/src/phone/ (`src/phone`, `src/audio`, outside LID scope). Not yet tried on a real phone.
  - **Family:** create one (six words from secure random bytes) or join one by typing the words.
  - **Listen:** tier with an icon and text, deviation labelled LIVE, NO HUM, and calibration progress.
  - **Report:** sends an OK to the family with level, sector and power state.
  - **Inbox:** shows each message's own send time and duplicate counts.
  - **Audio:** one microphone stream feeds both the tracker and the packet decoder. Tracker readings are ignored while the phone transmits. The tracker runs on an 8 kHz decimated copy of the audio (agent decision, open question 5).
  - **Tests:** `src/audio/audio.test.ts` passes a real OK packet through ggwave in 128-sample microphone blocks, and checks that decimated 48 kHz hum still drives the tracker to RED.
- **Tracker implemented** (`src/core/tracker/tonebank.ts`, `tracker.ts`): TRACK-001 to TRACK-012 all `[x]`, with 12 tests on synthetic hum.
  - About 67 ms per reading at 48 kHz on the laptop.
  - Found during testing: a tone just outside the band leaked in at the in-band edge with 80 dB signal-to-noise, which would have caused a false RED. Fix: the coarse bank now searches a 2 Hz guard zone beyond each edge, and a peak there means NO HUM. TRACK-004 and the design are updated to match.
- **Packet implemented** (`src/core/packet/keys.ts`, `codec.ts`): PKT-001 to PKT-012 all `[x]`, with 13 tests. The tests recompute HKDF and HMAC independently, cover the 45-day counter wrap, and cover seen-set eviction past 4,096.
- Phase 4 (finding specs that could be read two ways) resolved eight items; see "Open questions for the human".
- `scripts/check.mjs` and `npm run check`. It fails on:
  - a dangling `@spec`;
  - an `[x]` spec with no test;
  - a browser API or `Math.random` in `src/core`.
- `.github/workflows/ci.yml`: typecheck, test, check and build on push to main and on pull requests.
- `src/core/packet/wordlist.ts`: BIP-39 English (MIT), SHA-256 `2f5eed53…dbda`, verified 2,048 unique words.
- LID set up in Scoped mode (`src/core/**`). Added `docs/high-level-design.md` and the tracker and packet designs and specs.
- `docs/params.md`: tracker and packet parameters, all marked as assumptions. `docs/limits.md`: the 30 cm tracking limit, phone clock skew, and the 24 h message age limit.
- Spike tooling: CSV log export on the listener and emitter pages (replacing screenshots, which disturbed the measurement); 5-minute log.
- Deadline updated in `CLAUDE.md`, `docs/handoff.md` and `docs/plan.md`.

## 2026-11-14

### Decisions
- Decided by the human: host on Vercel instead of Cloudflare Pages.

### Changes
- Scaffold: Vite 8.3.8, TypeScript 7.0.2, Vitest 5.1.0, MIT licence; ggwave 0.4.0 vendored, unmodified.
- Spikes: emitter, listener (tone bank) and packets pages. Deployed to https://stratum-nine-swart.vercel.app.

## Open questions for the human

- Orchestrator, 2026-11-16 night: added breath, shed and relay rows and diagram edges to the approved HLD (additive only, no existing row changed). Confirm.

The 2026-11-15 calls below were all confirmed on 2026-11-16 and are kept for the record. New calls are under "Open since 2026-11-16".
Items 1 to 8 (from 2026-11-15) were all confirmed on 2026-11-16 and are kept for the record. Items 9 on are open.

1. **Phase 4 resolutions**, now in the specs and designs:
   - the tracker label may also be SIMULATED (district loopback);
   - the 4 readings skipped after a gap carry `f` but no deviation or tier;
   - the reading that completes calibration is itself LIVE;
   - the packet sector is the sector within the level (0–3), mapped to `World.sectors` as (level − 1) × 4 + sector;
   - the encoder checks only field ranges, and decode alone enforces which key set a type may use;
   - the caller names family key set ids, and the public set's id is `public`;
   - `timesHeard` counts the first hearing;
   - word bits are read most-significant first, and a word count other than six is an error.
2. **Out-of-band guard zone** (TRACK-004): a 2 Hz guard zone searched beyond each band edge replaces the "outermost bin" rule, which missed tones just outside the band.
3. **RED to GREEN timing**: the AMBER exit counter also counts readings taken while still RED. A jump from −200 mHz straight to 0 mHz therefore shows RED, then AMBER, then GREEN one reading apart, after 10 s. Keep this, or restart the 10 s AMBER hold when AMBER is entered?
4. **Even-length medians** (2 or 4 smoothing estimates, 60 calibration readings) take the upper middle value. Fine, or average the two middle values?
5. **Phone CPU**: a reading costs about 67 ms at 48 kHz on the laptop, so perhaps 200–300 ms on a phone, inside the 500 ms hop. Recommendation: the audio adapter (`src/audio`, outside LID scope) decimates to 8 kHz before the tracker, which is about 6× cheaper and still well above 800 Hz. Alternatively, run the tracker in a Worker.
6. **Silence**: NO_HUM readings caused by digital silence carry `snrDb` = NaN. The phone UI must not print it.
7. **GitHub**: create the repo? Public or private? `docs/audit.md` says "for you, not for agents" and would become public. After that:
   - connect Vercel to the repo for automatic deploys (CD);
   - make the CI check required on `main`.
8. **`spikes/`**: the estimator now lives in `src/core/tracker`. Keep the spike pages deployed until the phone page replaces them at rung 1, then delete them.

### Open since 2026-11-16

1. **Shed: what a stress event is.** An AMBER event opens when the tier rises from GREEN to AMBER or RED, a RED event when it rises to RED. A GREEN to RED jump opens one of each, so AMBER odds mean "AMBER or worse". Alternative: one event per episode at its highest tier.
2. **Shed: event length.** An event lasts while its tier holds, plus 10 minutes after the tier falls below it; a rise back within those 10 minutes continues the same event. A report counts for the event when its packet minute is inside that window. One parameter, an assumption. An event whose phones never send another tier (stuck app, phone moved) stays open and is left out of the odds.
3. **Shed: sender identity.** A sender is (key set id, member byte). Public reports carry a self-chosen member byte, so one person can pose as three senders. Weigh family reports above public ones?
4. **Shed: open events are left out of the odds** until their 10-minute window ends, so the odds shown during a live event come from past events only.
5. **Shed: report time is the packet's own minute** (sender's clock), not arrival time, and odds do not depend on arrival order. Relies on the codec's 2-minute future and 24-hour stale limits.
6. **Shed: power-on reports only count towards "observed"**; they do not cancel power-off reports. Sector is not used (odds are per level).
7. **Shed: own records, not `Witness.observe`.** `observe` stamps arrival time and runs the change detector, and the odds need the packet minute and arrival-order independence. The p01 or p02 adapter shall log each accepted report through `observe` (measured chain, source = sender), so the problem 2 claim rests on the hash chain. HLD tenet "reuse an engine" is bent here; please confirm.
8. **Shed: HLD edited** to add the `shed` row to the component table and two diagram edges (tracker and packet into shed). No `contracts.ts` change. Reports are kept without a cap (marked as a `shortcut:` in the code).
9. **Shed: `events` counts only observed events.** The plan says e counts stress events at that tier; the ledger counts only closed events in which 3 distinct senders reported the level, power on or off. Otherwise a level with fewer than 3 phones could never score a cut and looked safest. If phones mostly report when their power is off, observed events skew towards cuts and the odds read high (errs towards warning). Keep, or add a separate `observed` count beside the plan's e?
10. **Shed: readings without a tier are not passed to the ledger** (it keeps the last tier). The phone adapter must follow this. App restarts lose the ledger: nothing persists, and rebuilding means replaying every tier change and accepted report. Add storage?
11. **Shed: a level already without power before an event counts for it** ("reported without power during the event"). Requiring each sender to change from power on to power off is deferred.
12. **Shed: labels.** `tier` and `report` take an optional label and `odds` returns the weakest label among all accepted inputs (not only those for the queried level). Pages should also show family and public reporters apart until weighting (Shed 3) is decided; the ledger does not split them yet.
9. **relay: forward other families' packets unverified.** A relay forwards any packet the decoder rejects only as `unknown-tag` with type 0 to 3, without checking its MAC, so family messages cross strangers' phones (problem 8). Cost: anyone can make relays spend air time on well-formed junk, bounded per identity only (one send per phone, 4 hops). An attacker mints unlimited fresh identities, and honest relays carry each up to 4 hops of rooms beyond the attacker's speaker; byte 16 is not under the MAC, so a second attacker can reset hops. No rate limit on unverified forwards was added. The alternative (relay only what the phone can verify) is junk-proof but carries family messages only between members of the same family. Keep?
10. **relay: identity is all 25 bytes except byte 16**, not (minute, nonce, tag), so a forged copy with a bad MAC cannot be heard first and suppress the real message. Two different messages are never merged. A replay of the real bytes with byte 16 set to 0 still suppresses (see 12).
11. **relay: back-off is 4 slots of 3 s** (`floor(rng() x 4) x 3000 ms`, so 0 to 9 s), slotted so a later relay hears an earlier one's whole packet. That holds only while air time plus decode latency stays under 3 s; air time is 2 to 3 s and decode latency is unmeasured. Measure both in the one-hop demo, then perhaps raise the slot to 3.5 to 4 s. Both values are assumptions, to be tuned in the multi-hop simulation.
12. **relay: any second copy cancels a pending send**, whatever its hops left, and a copy heard at or after the send time does not cancel. A message first heard with hops 0 is counted, so a later copy with more hops is not relayed either. A hostile phone can use this on purpose: replay a real message at once with byte 16 = 0, no key needed, and every relay that hears the replay first stays silent. Not patched: letting a hops-0 hearing not count only moves the attack to a hops-1 replay, which still cancels the real relay. Recorded in `docs/limits.md`.
13. **relay: grid alert rule.** CALIBRATING and the LIVE readings without a tier (just after a gap) do not count as "agrees", so the alert is not relayed then. The rule is checked once, at the first hearing, not again at send time. NO_HUM relays the alert, so a forged alert (public keys are published) crosses every phone that hears no hum, including every phone during a cut; `docs/limits.md` now says so.
14. **relay: `own(bytes)`** lets the phone register a packet it sent, so it never relays its own echo. The phone page must call it after each send.
15. **relay: forgetting.** The relay keeps 4,096 identities, least recently heard evicted first (same as the packet seen-set); an evicted message heard again within its 24 h age is relayed again.
16. **relay: contracts and packet exports.** No change to `contracts.ts`. `codec.ts` now exports its constants (`VERSION`, `MAX_HOPS`, `FUTURE_MIN`, `STALE_MIN`, `SEEN_MAX`) so the relay reuses MAX_HOPS and the seen-set size; values are unchanged. A `relay` row was added to the HLD component table.
1. **Ledger screen: one ledger per page load, created when the page opens** (label LIVE). Tiers are passed only from readings that carry one, with `Date.now()` held monotonic (the ledger throws on time going backwards). Packets heard before listening starts cannot exist (one mic stream), so nothing is lost there.
2. **Ledger screen: the table is hidden until listening starts**, even though the ledger object exists; there is nothing to show before the microphone opens. The Playwright table test therefore only sees "no data yet" cells; the percentage cells are covered by the `ledgerView` vitest test and wrap inside fixed-width columns (not rendered on the 369 px fold cover by any e2e test).
3. **Ledger screen: the "(now)" column follows `app.lastReading.tier`**: GREEN, NO HUM and calibrating highlight nothing. Under NO HUM the ledger still holds the last tier, as the design says, but the table does not mark it.
4. **Ledger screen: family and public report counts are shown apart** (design Deferred 1), as totals of accepted reports, not per level or per event. The odds themselves still mix both.
5. **Ledger screen: a report this phone sends counts when its own microphone decodes the chirp**, which it usually does: microphone processing is off and the decoder has not seen its own packet, so the phone becomes one of the 3 senders for its level and "from your family" goes up by one. If the chirp is missed, it does not count. Keep it, count every own report on send, or drop the echo (match the sent bytes, or register them with relay `own(bytes)` once that is wired)?
