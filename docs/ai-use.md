# Record of AI use

This project was built by one person using Claude Code with subagents.
This file records who did what, so the answer is ready for the organizers and the judges.

## What the human did

- Chose the concept, the mechanisms and their sources.
- Wrote or approved the contracts in `src/core/contracts.ts`.
- Ran every spike test on real devices and recorded the results.
- Reviewed and merged each module. Decided every cut.

## Tools

- Claude Code, with the Linked-Intent Development and Ponytail plugins.
- Subagents defined in `.claude/agents/`.

## Log

| Date | Module or file | Built by | Human specified | Human tested or changed |
| --- | --- | --- | --- | --- |
| Nov 14 | Scaffold (Vite 8.3.8, Vitest 5.1.0, TypeScript 7.0.2), MIT licence, vendored ggwave 0.4.0 | Claude Code (main session) | Prompt 1: rung 0 scaffold | |
| Nov 14 | Hosting | Human decision | Vercel instead of Cloudflare Pages | |
| Nov 14 | `spikes/` emitter, listener (tone bank), packets (ggwave + HKDF check) | Claude Code (main session) | Prompt 1: spikes T1 to T3 | Runs T1 to T3 on phones |
| Nov 15 | Log export on the listener and the emitter; analysis of exported logs | Claude Code (main session) | Asked for text export instead of screenshots | Ran T1 to T3 (three sessions), chose to run the 30 cm diagnostic, confirmed the five spike decisions in `docs/spikes.md` |
| Nov 15 | Scoped LID: HLD, contracts.ts, rng.ts; tracker and packet designs, specs, tests and code; scripts/check.mjs; CI; CHANGELOG.md | Claude Code (main session), one probe subagent for edge cases | Prompt 2; approved HLD, contracts, rng, both designs and specs, the four design decisions; asked for changelog and CI; waived LID stops while away | Review open questions in CHANGELOG.md |
| Nov 16 | Shed Ledger (`src/core/shed`): design, specs SHED-001 to SHED-012, tests and code, then review fixes (event length, observed levels, labels) | Claude Code (workflow subagent) | Plan's cut-odds formula and 3-sender rule; waived LID stops overnight | Review Shed open questions in CHANGELOG.md |
| Nov 16 | Family board (`src/phone/screens/family.ts`) and its review fixes | Claude Code subagents (build, review, fix) | Problem 8 spec: rows per member, 30 min staleness, local nicknames | Open calls in CHANGELOG.md |
| Nov 16 | Phone report grid (`src/phone/screens/report.ts`) and codebook (`src/phone/codebook.ts`), with review fixes | Claude Code (workflow subagents: builder, reviewer, fixer) | Overnight scope (rung 2): the citizen button grid; key-set rules from the approved packet design | Review open questions 9 to 12 in CHANGELOG.md |
