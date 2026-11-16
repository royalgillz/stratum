# STRATUM: rules for every agent

Goal: a solo hackathon entry for Patriot HackFest Fall 2026, track "Life Underground".
Deadline: Fri Nov 20 2026, 11:00 PM (organizers, no time zone given: assume ET). No extensions. Judging on their platform Nov 21-24. AI tools allowed without limit.

Read first: `docs/handoff.md` (compact brief). Read `docs/plan.md` before large changes.
The problem statement is in `docs/problem-statement.md`.

## Product

A citizen toolkit for the Hollow with one loop: hear, prove, pass on, share fairly.

- WITNESS: one change detector and one hash-chained ledger. Measured value beside official value.
- MESH: 25-byte authenticated packets carried by sound.
- FAIR SHARE: life floors first, then the worst-off, rotate what cannot be split.
- District 7 (6 levels x 4 sectors) is a simulated test rig for the three engines.

Real: phone hum tracker, sound packets, ledger, allocator. Simulated: the district.

## Hard rules

- `src/core` has no browser APIs and no randomness except through `rng.ts`.
- Do not change `src/core/contracts.ts` without the human's approval.
- One module per file. An adapter writes only the state it declares in `writes`.
- Every parameter is listed in `docs/params.md` with a source URL or `assumption: true`.
- Every number shown in the UI carries LIVE, REPLAY or SIMULATED.
- Never fake a reading. Below the signal threshold, show NO HUM.
- No new dependency without approval. No language model. No network call at run time.
- Sound: hum and fan noise below 1.7 kHz, packets above 1.875 kHz, microphone processing off.
- Claims in README and UI must match the tiers in `docs/coverage.md`. Never write "solves".
- Breath Count is a decision aid, not a medical device. Classify children under five only.
- Record what agents built and what the human decided in `docs/ai-use.md`.

## Repo layout

```
src/core/        no browser APIs: runs in the phone, the worker and Node
  contracts.ts   World, Engine and Adapter types, frozen Saturday
  rng.ts
  tracker/       tone bank, calibration, tiers
  packet/        v3 codec, keys, seen-set
  witness/       detector, ledger, truth gap
  fairshare/     floors, water-filling, debt rotation
  world/         grid, air-heat, water, tunnels, epidemic, light-food, space, care, surface-return
  adapters/      p01.ts ... p15.ts: reads, writes, metric
src/audio/       worklet, modem.ts (ggwave adapter), loopback
src/phone/       Listen, Report, Breath Count, Family
src/district/    worker, cross-section, emitter, gateway, charts, judge mode
harness/         run.ts, scenarios/, results/
spikes/          throwaway experiments
data/            ENF-WHU subset and GECCO csv, with their licences
docs/            plan, handoff, spikes, params, coverage, limits, ai-use, and LID's intent docs
```

## Commands

These exist once the project is scaffolded:

```
npm run dev
npm test
npm run typecheck
npm run harness -- --seeds 20
npm run build
```

## Done means

Tests pass, typecheck passes, the module's metric appears in harness output,
`docs/params.md` and `docs/coverage.md` are updated, and the summary lists equations, sources and limits.

## Scope

- MUST is rungs 0 to 3 of the ladder in `docs/plan.md`.
- Freeze: Wed Nov 18, 22:00 ET. After the freeze: bugs, copy and performance only.
- Cut list is final: 3D, PixiJS, language models, backend, accounts, maps, Bluetooth, WebRTC, hardware.

## How the two skills divide the work

- LID scope: `src/core/**` only (tracker, packet, witness, fairshare, world, adapters).
  Out of scope: `src/phone`, `src/district`, `src/audio`, `harness`, `spikes`.
- `docs/plan.md` is background. Once approved, `docs/high-level-design.md` and
  `docs/intent/**` are the source of truth.
- In LID scope, the specs decide WHAT must exist. Ponytail decides HOW LITTLE code satisfies them.
- Ponytail level: full. Never ultra during the hackathon.
- Keep intent docs short: HLD one page, each component design one page,
  at most 12 spec lines per component.
- Spec IDs use the component name (TRACK-001, PKT-003, FAIR-002, WIT-004). Each spec lists
  the problem numbers it serves, so `docs/coverage.md` can be built from them.
- `spikes/` is throwaway code: no specs, no tests. Delete it once the decision is recorded
  in `docs/spikes.md`.

## LID
- Mode: Scoped
- Version: 1.3.0

## LID Scope

Paths in scope:
- `src/core/**`

## Linked-Intent Development (MANDATORY)

**Consult the `linked-intent-dev` skill for ALL code changes in scope.** All changes flow through the arrow of intent in one direction:

```
HLD → LLDs → EARS → Tests → Code
```

- **New features and refactors**: full six-phase workflow (HLD check → LLD check/draft → EARS → intent-narrowing edge audit → tests-first → code).
- **Bug fixes**: walk the arrow like any other change — find where behavior diverged from intent and cascade from there. No short-circuit.
- **If unsure**: use the full workflow.

Stop after each phase for user review. **Docs carry current intent, written to be read cold** — write each doc as if authored fresh today, from current intent alone: no narration of how it changed, no meaning that needs the conversation that produced it, no rebuttals to questions only a past discussion raised. Rationale, considered alternatives, and constraints a fresh author would independently write stay; record rejected alternatives and why in the LLD's Decisions & Alternatives table, not as asides in body prose.

**Memory vs. intent.** Before saving durable project knowledge to agent or tool memory, test whether it is project *intent* — would a fresh agent, in any tool, next session, need it to build this system correctly? If yes, record it in the arrow (HLD / LLD / EARS / decision doc), which travels and cascades — not in private, per-tool memory. Knowledge about the user or how they like to work stays in memory.

### Navigation

| What you need | Where to look |
|---|---|
| High-level design | `docs/high-level-design.md` |
| Design tree (sub-HLDs, LLDs, their specs) | `docs/intent/` — one folder per node |
| EARS specs | beside each design doc as `{node}-specs.md` in the node's folder under `docs/intent/` |
| Decision docs | `docs/decisions/` (project-level) and `docs/intent/<segment>/decisions/` |

### Terminology

- **HLD**: High-Level Design — single project-level doc at `docs/high-level-design.md`.
- **LLD**: Low-Level Design — component design doc in `docs/intent/`. Leaf LLDs own EARS; depth-2 (one HLD over flat leaf LLDs) is the default.
- **EARS**: structured one-line requirements in `{node}-specs.md`. Markers: `[x]` implemented, `[ ]` active gap, `[D]` deferred.
- **Arrow segment**: one leaf LLD plus the specs, tests and code citing its EARS IDs. Within-segment cascade is free; across-segment cascade pauses.

### Code annotations

Annotate code and tests with `@spec` comments citing EARS IDs (`// @spec TRACK-001`), at the entry point of the behavior's implementation graph, not on every helper.
