# High-Level Design: STRATUM core (`src/core`)

The design covers `src/core/**`. The phone page, district page, audio adapters and harness import this core and are outside the arrow. Background and sources: `docs/plan.md`, `docs/handoff.md`.

## Problem

People in the Hollow cannot see a blackout coming, cannot trust the Directorate's numbers, lose the network on command, and are rationed by people who always cut the deep levels first. A tool for them must hear real signals, keep evidence nobody can quietly rewrite, pass messages without infrastructure, and divide scarce supplies by a rule anyone can check.

## Approach

One loop: **hear → prove → pass on → share fairly**, run by three engines over one simulated test district:

- **Witness**: one change detector plus one hash-chained ledger that stores each disputed quantity twice, measured and official. The gap is a metric.
- **Mesh**: one 25-byte authenticated packet (v3) carried by sound, with store-and-forward relay.
- **Fair Share**: one allocation rule for every scarce good: life floors first, then raise the worst-off (water-filling), and rotate what cannot be split through a debt memory.
- **Tracker** feeds Witness with the grid hum: a tone bank on the 800 Hz component gives relative deviation after calibration, then a tier.
- **Air watch** hears a fan stop on the same microphone: a steady fan-band level that is 6 dB down for most of 3 s raises FAN STOPPED (LIVE), the half of problem 1 a phone can hear.
- **Kernel** steps District 7 (6 levels × 4 sectors) so the engines can be scored against the Directorate's policy, one adapter per problem, all fifteen. Everything it produces is labelled SIMULATED.

## Target users

Residents with a phone (hear, report, check on family), the people who run a level's shared loads and stock (allocate), and judges reading the evidence (scores on real data, seeded comparisons).

## Goals

- The same core code runs on the phone, in the district worker and in Node, so what is scored is what is demoed.
- The tracker reports deviation within 5 mHz on a clean signal (spike T1 at 30 cm) and says NO HUM rather than guess.
- The air watch notices a fan stop within 5 s and raises no alert over 5 minutes of fan noise and speech (spike T4 pass mark).
- Packets authenticate, cannot be replayed as fresh, and hide which family sent them.
- Fair Share never breaches a floor while supply covers all floors, and states the breach when it cannot.
- Every simulated run is reproducible from its seed, and different seeds face different weeks: the seed varies when and how hard things go wrong, within stated bounds, never the acts the screen shows.
- Each district result is published with the cases where STRATUM loses, from a stress week built to find them.

## Non-goals

No browser APIs, network, storage or randomness outside `rng.ts` in `src/core`. No language model. No claim that the core can seize breakers or prove the surface safe. No per-agent epidemic or 3D. No movement of people between sectors: space and the return change sleep times and plans, not homes.

## Tenets

- **Honest over impressive.** When a result could be shown more strongly or more truthfully, show the truthful one: NO HUM, wide intervals, and published results that go against us.
- **Reuse an engine over adding one.** A new problem is configured from Witness, Mesh and Fair Share before any new mechanism is written.
- **Reproducible over realistic.** Prefer a simpler model that replays exactly from a seed over a richer one that does not.

## System design

```mermaid
flowchart LR
  C[contracts.ts<br/>World, Engine, Adapter types] --- K
  R[rng.ts<br/>seeded streams] --> K[kernel<br/>step loop, two clocks]
  T[tracker<br/>tone bank, calibration, tiers] --> W[witness<br/>detector, ledger, gap]
  P[packet<br/>v3 codec, keys, seen-set] --> W
  T --> S[shed<br/>cut odds per level]
  P --> S
  P --> RL[relay<br/>store and forward, one hop live]
  P --> TL[tally<br/>heard reports by type and place]
  T --> RL
  B[breath<br/>WHO breath count aid] --> P
  K --> A[adapters p01..p15<br/>reads, writes, metric]
  A --> W
  A --> F[fairshare<br/>floors, water-filling, debt]
  A --> P
  A --> RL
  A --> WM[world models<br/>grid, air, water, tunnels, epidemic,<br/>light and food, space, care, surface]
  SC[scenario<br/>script, runner, policy switch] --> K
  SC --> A
  G[district page gateway<br/>outside core: decoded live packets] -->|inject| SC
  M[phone microphone<br/>outside core: fan-band level] --> AW[air watch<br/>fan running, stopped]
```

| Component | Folder | Spec prefix | Serves problems |
| --- | --- | --- | --- |
| tracker | `src/core/tracker` | TRACK | 1 |
| packet | `src/core/packet` | PKT | 7, 8, and all reports |
| fairshare | `src/core/fairshare` | FAIR | 2, 3, 5, 6, 10, 11, 12, 14, 15 |
| witness | `src/core/witness` | WIT | 1, 4, 9, 13 |
| relay | `src/core/relay` | RELAY | 1 (grid alerts), 7, 8 |
| kernel | `src/core/kernel` | KERN | all modelled problems |
| shed | `src/core/shed` | SHED | 1, 2 |
| breath | `src/core/care` | BREATH | 10 |
| air watch (fan stop) | `src/core/air` | AIR-FAN | 1 |
| tally (heard reports) | `src/core/tally` | TALLY | 2, 4, 5, 9 |
| world models (sub-HLD: grid, air and heat, water, tunnels, epidemic, light and food, space, care delivery, surface and return) | `src/core/world` | WORLD | 1 to 7, 9 to 15 |
| adapters (sub-HLD: policy, power, livable, evidence, family, space and care, light and food, surface) | `src/core/adapters` | ADAPT | 1 to 15 |
| scenario and runner (with the scripts leaf: seed variation, the Level 5 act, the stress week) | `src/core/scenario` | SCEN | all modelled problems |

`contracts.ts` is the boundary every component compiles against. It changes only by an explicit design decision.

## Key design decisions

| Decision | Why | Alternative not taken |
| --- | --- | --- |
| Track the 800 Hz second harmonic, report deviation relative to a calibration | Phone microphones hear 800 Hz well; relative deviation cancels each device's clock offset (about ±13 mHz measured) | Absolute frequency: wrong by the device's clock error |
| 5-reading median over 0.5 s readings; calibration starts only once a full 2 s window holds the hum | Spike T1: median keeps the ramp within 4 mHz and still shows a 0.1 Hz step in 2.7 s | Longer smoothing: misses the 3 s step mark |
| Packet: HKDF keys from six generated words; tag, encrypted payload and 8-byte MAC in 25 bytes | Fits ggwave's 2–3 s budget; tag rotates every minute so listeners cannot follow a family | Signatures per packet: too many bytes |
| Fair Share as leximin water-filling with floors | One explainable rule for all goods; proportional scaling when floors cannot all be met | Proportional to demand: favours the already-supplied |
| One seeded generator, separate named stream per module | Adding a module does not change other modules' draws | `Math.random`: runs are not reproducible |
| Fan stop from a band level with a percentile baseline | Speech only adds energy, so a low percentile ignores it; no model file or dependency | YAMNet sound model: a download and a dependency for a yes/no question |
| The seed varies the script, not the models | Results that draw nothing still get honest seed intervals; models stay testable alone | A fixed script: four problems give one number on every seed |

## Success metrics

Tracker error in mHz and NO HUM accuracy on ENF-WHU clips (REPLAY). Packet success at 1 m and 3 m (LIVE). One metric per problem against the Directorate policy over 20 seeds, each seed varying the script (SIMULATED), for the seven-day week and the stress week. Secondary cost figures (contacts from shift sharing, trial exposure-hours and breaches, lamp energy to feed a person) are computed beside them. Detector precision and recall on GECCO 2018 (REPLAY). Broken if: a floor is breached while supply covers all floors, a replayed packet shows as fresh, a seed fails to reproduce its run, or the stress week shows STRATUM losing nowhere.

## References

`docs/plan.md` (mechanisms, formulas, sources), `docs/handoff.md` (contracts, packet layout), `docs/spikes.md` (T1–T3 results), `docs/params.md` (every parameter and its source), `docs/limits.md`.
