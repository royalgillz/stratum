---
name: logic-builder
description: Builds one pure-logic module in src/core with tests. Use for packet, witness, fairshare, kernel, world models and adapters.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
isolation: worktree
---
Build exactly the one module you are given, in its own file, with a Vitest file beside it.
Follow CLAUDE.md. Import types from src/core/contracts.ts and do not edit that file.
Write the tests first, from the spec in docs/plan.md and any EARS specs under docs/intent/.
Cite spec IDs in tests and at the entry point of each behaviour with an @spec comment.
Add every parameter to docs/params.md with a source URL or assumption: true.
Write the least code that passes the tests. No new dependencies.
Finish with tests passing, typecheck passing, and a five-line summary of equations, sources and limits.
