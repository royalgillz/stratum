# Setup: do these in order

Everything in this folder goes into the root of a new, empty git repository.
The folder `.claude` is hidden on most systems; make sure it is copied too.

## 1. Before opening Claude Code

1. Create the repo and copy this folder's contents into its root.
2. Make the hook runnable: `chmod +x .claude/hooks/typecheck.sh`
3. Commit: `git add -A && git commit -m "Starter docs and agent setup"`
4. Email directors@patriothackfest.com and hello@patriothackfest.com.
   Ask for: judging rubric, deadline time and time zone, submission platform,
   AI-tool policy, prize list.

## 2. Inside Claude Code, in the repo

Install the plugins. Send the two Ponytail lines as separate prompts.

```
/plugin marketplace add jszmajda/lid
/plugin install linked-intent-dev@jszmajda-lid
/plugin install arrow-maintenance@jszmajda-lid
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Restart Claude Code once so the agent files are picked up.

## 3. Spikes first

Paste **Prompt 1** from `docs/prompts.md`. Run tests T1, T2 and T3 on your phones.
Write the results into `docs/spikes.md` and choose any fallbacks tonight.

## 4. Then start Linked-Intent Development

Run `/linked-intent-dev`. When it asks:

- Mode: **Scoped**
- Scope: `src/core/**`

It creates its own files under `docs/` and adds a section to `CLAUDE.md`.
Check that the section "How the two skills divide the work" is still there afterwards.

Then paste **Prompt 2** from `docs/prompts.md`.

## What each file is for

| File | Purpose |
| --- | --- |
| `CLAUDE.md` | Rules every agent follows |
| `docs/handoff.md` | Compact brief: concept, contracts, packet, ladder |
| `docs/plan.md` | Full build plan |
| `docs/audit.md` | Why the plan looks this way. For you, not for agents. Local only: git-ignored, not in the repo |
| `docs/problem-statement.md` | The track text |
| `docs/prompts.md` | The prompts to paste, in order |
| `docs/spikes.md` | Spike test results and decisions |
| `docs/params.md` | Every parameter with its source or an assumption flag |
| `docs/coverage.md` | The 15-problem coverage table |
| `docs/limits.md` | Known limits, stated plainly |
| `docs/ai-use.md` | What agents built and what you decided |
| `.claude/agents/` | Two builder agents and six reviewer agents |
| `.claude/settings.json`, `.claude/hooks/typecheck.sh` | Runs the type check after each edit |

## Two things to check yourself

- **Skills inside subagents.** Agent files accept a `skills:` line, but the exact plugin
  skill names were not verified. Run `/skills`, copy the names as listed, and add them to
  `.claude/agents/builders/logic-builder.md` if you want builders to follow LID and Ponytail.
- **Review time.** LID pauses for your review after each phase. If the first two components
  cost more than an hour of review, narrow the scope to `src/core/packet/**` and
  `src/core/fairshare/**`.
