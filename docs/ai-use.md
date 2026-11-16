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
