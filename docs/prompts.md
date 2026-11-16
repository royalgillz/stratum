# Prompts to paste into Claude Code, in order

## Prompt 1: spikes only (Saturday)

```
Read CLAUDE.md, docs/handoff.md, docs/plan.md and docs/problem-statement.md.

Today's goal is rung 0 of the ladder in docs/plan.md, nothing more:
1. Scaffold Vite + TypeScript with an MIT licence, add the npm scripts listed in CLAUDE.md,
   and deploy a hello page to Cloudflare Pages.
2. In spikes/, build the smallest emitter page (400 + 800 Hz tone, offset slider, 0.1 Hz step button)
   and the smallest listener page (microphone with echoCancellation, noiseSuppression and
   autoGainControl off -> AudioWorklet -> tone bank -> number on screen).
3. In spikes/, load the vendored ggwave and send and receive a 25-byte payload.
4. Tell me exactly how to run spike tests T1, T2 and T3 on my phones, using the pass marks
   in docs/spikes.md.

Spikes are outside LID scope. Use ponytail. Do not design or build anything else yet.
Stop when the three spikes are runnable and wait for my results.
```

## Prompt 2: start LID on the core (after the spikes pass)

Run `/linked-intent-dev` first and choose Scoped with `src/core/**`. Then paste:

```
Spike results are in docs/spikes.md. Start Scoped LID for src/core.

Phase 1: draft docs/high-level-design.md from docs/plan.md and docs/handoff.md.
The design decisions are already made there, so do not offer alternative options.
Give me one page to approve.

Components, in this order: tracker, packet, fairshare, witness, kernel.
For tracker and packet only, go on to the component design and the EARS specs, and show me
both components in a single review. Then tests first, then code.

Also write src/core/contracts.ts and src/core/rng.ts from the contracts in docs/handoff.md
and stop for my approval before anything depends on them.

While I review, do not start fairshare, witness or kernel in this session. I will hand those
to logic-builder subagents once contracts.ts is merged to main.
```

## Prompt 3: parallel builders (after contracts.ts is on main)

```
contracts.ts is merged to main. Spawn three logic-builder subagents in parallel, one module each:
1. src/core/fairshare: floors, water-filling, floor-breach rule, debt rotation.
2. src/core/witness: change detector (rolling baseline, residual threshold, m-of-n persistence)
   and the hash-chained ledger with a measured value beside an official value.
3. src/core/kernel: world step loop, two clocks, seeded random streams per module.

Each follows docs/plan.md, writes tests first, and adds its parameters to docs/params.md.
When each finishes, run science-reviewer on it before I merge.
```

## Prompt 4: end of every session

```
Run scope-watchdog and coverage-auditor. Then update docs/ai-use.md with what was built
today, by which agent, and what I decided or changed.
```
