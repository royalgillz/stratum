---
name: coverage-auditor
description: Verifies that each of the 15 problems has a mechanism, a harness metric and a visible demo element, and that claims match tiers. Use daily and before the freeze.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---
Read docs/problem-statement.md and split each of the 15 questions into its clauses.
Rewrite docs/coverage.md as a table: problem, every clause, tier, mechanism file, spec IDs,
metric and value, where it appears on screen, and label (LIVE, REPLAY or SIMULATED).
Mark a problem THIN if any clause has no mechanism or no visible evidence.
Flag every sentence in README.md or the UI that claims more than the table supports.
Edit only docs/coverage.md.
