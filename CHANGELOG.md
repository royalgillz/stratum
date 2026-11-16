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
- 2026-11-16: Breath Count review fixes by an agent (`src/core/care/breath.ts`, `docs/intent/breath/`), BREATH-007 to BREATH-011 reworded, still 12 specs:
  - danger signs: only the five named fields count, and only the value `true` (a wider form object gave a false RED);
  - new `cough` input (cough or difficult breathing): without it the result is `NOT_ASSESSED` and no request, as the chart counts breaths only if cough;
  - a full count with a gap over 3 median intervals (missed taps) gives RECOUNT with a new card, instead of a false GREEN;
  - the disclaimer and `docs/limits.md` say that only breathing and five of the chart's eleven danger signs are checked;
  - source corrected: the old link (NBK143752) is chapter 4 of WHO's 2008 *Manual for the health care of children in humanitarian emergencies*, not the community chart. Params, design and plan now cite the WHO/UNICEF chart booklet, https://iris.who.int/handle/10665/44398 ;
  - problem 9 claim dropped from the design, specs and `docs/coverage.md` until a case-report format exists. New parameter: missed-tap gap (assumption).
- 2026-11-16: Breath Count classifier built by an agent (`src/core/care/breath.ts`, design and specs in `docs/intent/breath/`): BREATH-001 to BREATH-012 implemented and marked [x], 12 tests. Full 60 s count only (no extrapolation), 250 ms tap debounce, recount outside 10 to 120 per minute, under 2 months referred, no classification at 60 months or more, NEED codes 0x10 (RED) and 0x11 (AMBER). Six Breath Count rows in `docs/params.md`; problems 9 and 10 in `docs/coverage.md`. No change to `contracts.ts` or the packet codec. Judgement calls are open questions below.
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

### Open (2026-11-16)

1. **breath**: infants under 2 months get `REFER_YOUNG` ("too young for this aid"), not a classification. The cited chart booklet covers 2 months up to 5 years only, so it holds no young-infant threshold. The WHO 2008 humanitarian emergencies manual (chapter 4, NBK143752, the link cited before the review fix) may hold the 60 per minute threshold but was not read (it sits behind a browser check). This holds even with a danger sign, and no medicine request is offered. Add the 60 threshold once you can cite the young-infant chart?
2. **breath**: a count stopped before 60 s gives no rate and a RECOUNT card (no extrapolation). A danger sign still gives RED at once, with rate null and request value 0.
3. **breath**: a tap less than 250 ms after the last counted tap is dropped as a double tap and reported in `ignoredTaps`. Taps at 60 s or later are left out silently.
4. **breath**: without a danger sign, a full-count rate under 10 or over 120 gives RECOUNT ("if you get the same count, take the child to a health worker"). Over 120 could instead give AMBER, the safer colour. Which?
5. **breath**: at 60 months or more the result has no classification, even with a danger sign; the card only says the aid is for children under five. Should that card also say to see a health worker when a danger sign is ticked?
6. **breath**: NEED payload codes 0x10 (RED, urgent referral and medicine) and 0x11 (AMBER, fast breathing, medicine), with 0x10 to 0x1F reserved for care. `value` is the rate, or 0 with no full count. The age is not sent, so problem 9 cannot split cases by age yet.
7. **breath**: card texts (now including the missed-taps and not-assessed cards, and the longer disclaimer) are plain language written by an agent, hold no digits (the phone shows the rate beside its label), and have not been reviewed by a clinician. The disclaimer is fixed text in `breath.ts`. Please read them.
8. **breath**: bad input (negative or non-finite age or elapsed time, taps out of order, negative or after the elapsed time) throws `RangeError` rather than returning a card, treating it as a phone bug.
9. **breath**: the module lives in `src/core/care/` as instructed, while `CLAUDE.md` lists care under `src/core/world/`. The HLD component table has no Breath Count row yet; it was not edited because the HLD is human-approved. `contracts.ts` is unchanged.
10. **breath** (review fix): the danger-sign check reads only the five named fields and counts only the value `true`. A string such as "yes" from a form is therefore not a sign; the phone must pass booleans.
11. **breath** (review fix): a full count with a gap over 3 times the median tap interval (from 0 to the first tap, between taps, or from the last tap to 60 s) gives RECOUNT with the missed-taps card. The factor 3 is an assumption. Irregular breathing with a long pause also gives a recount, which is the safe failure; evenly spread missed taps are not caught (stated in `docs/limits.md`).
12. **breath** (review fix): new required `cough` input (cough or difficult breathing), as the chart counts breaths only if cough. Without it, and with no danger sign, the result is `NOT_ASSESSED` (rate still reported) and no medicine request. The phone page must add this question.
13. **breath** (review fix): only five of the chart's eleven danger signs are asked. The disclaimer and `docs/limits.md` now say so. Add the other six (cough 21 days or more, diarrhoea 14 days or more, blood in stool, fever 7 days or more, red on MUAC strap, swelling of both feet)?
14. **breath** (review fix): problem 9 is no longer claimed (design, specs, `docs/coverage.md` row 9). Before medicine requests can be case reports, decide which key set care NEEDs use (a family key hides them from an outbreak aggregator; the public key lets anyone read and forge them and broadcasts a sick child's level and sector) and how one child's recounts and re-sends (each with a new nonce) are merged so they are not counted twice.
15. **breath** (review fix): `contracts.ts` is still unchanged; `BreathInput`, `BreathClass` and `CARDS` live in `breath.ts`, and their changes (new `cough` field, `NOT_ASSESSED`, two new cards) break no other caller since nothing imports the module yet.

### Confirmed

The calls below (from 2026-11-15) were all confirmed on 2026-11-16 and are kept for the record.

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
