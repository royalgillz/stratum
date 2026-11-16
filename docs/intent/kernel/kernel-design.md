---
parent: high-level-design
prefix: KERN
---

# Kernel

## Context and design philosophy

The kernel advances District 7's `World` through time by calling the problem adapters (`p01` to `p15`) in a fixed order, and collects each adapter's labelled `Metric`. It serves every modelled problem. It owns time, randomness and the write boundary, so an adapter cannot read the wall clock, draw from a shared random stream, or change state it did not declare. It lives in `src/core/kernel`, uses no browser APIs, and everything it produces is SIMULATED.

It prefers failing loudly to continuing with a world nobody can reproduce. Any violation stops the run.

## Step loop

The world time step `dt` is fixed at creation (default 60 s). One step:

1. Visit adapters in ascending `id` order, whatever order the caller listed them in. Each sees the writes of the adapters before it in the same step (no double buffering), so the result depends only on the ids.
2. Call `adapter.step(world, dt, stream)` once.
3. Set `world.t = t0 + n × dt`, where `n` is the number of steps taken. `t` is computed, not accumulated, so it never drifts. Adapters see `t` as of the start of the step.

Only the kernel writes `t`. Argument errors (`dt`, `run`, `advance`, `setClock`) throw a `RangeError` and leave the kernel untouched; only adapter faults kill it. An empty adapter list is valid: time advances and there are no metrics.

## Two clocks

`World.clock` says how fast world time runs against real time: `scale` world seconds per real second. `realtime` means scale 1, `timelapse` means scale 3600 (one simulated hour per real second, from `docs/plan.md`). The audio clock is always real time and lives outside `src/core`; the kernel never sees it.

- **Interactive driver:** `advance(realSeconds)` adds `realSeconds × scale` to an owed-time balance held in the kernel, runs as many whole steps as the balance covers, and keeps the remainder. A cap on steps per call stops a stalled tab from triggering a huge catch-up; the excess is dropped.
- **Harness:** `run(worldSeconds)` runs flat out with no clock at all.
- **Changing the clock mid-run:** `setClock(mode, scale)` takes effect from the next `advance`. The owed balance is in world seconds, so nothing jumps and no step is repeated or skipped. A scripted act changes the mode this way.

## Randomness

The kernel creates one stream per adapter, `rng(world.seed, adapter.id)`, once, and passes the same stream on every step. Streams are independent, so adding or removing an adapter never shifts another's draws. The rng's state lives in the kernel, not in `World`.

## Write enforcement

`writes` names top-level `World` keys. In checked mode (default), the kernel hands each adapter a guarded view of the world that throws on any assignment, deletion or array mutation, at any depth, under a key not in that adapter's `writes`. `t`, `seed` and `clock` are kernel-owned: an adapter declaring them is rejected at creation. Two adapters may declare the same key; the fixed order makes that deterministic.

On a violation the kernel throws a `KernelError` naming the adapter, the key and the world time, and the kernel is dead: further calls throw the same error, because the world is partly updated and cannot be trusted. The same applies if `step` or `metric` throws; the original error is the `cause`. `reads` is documentation, not enforced.

## Metrics

`metrics()` calls each adapter's `metric(world)` in id order, on a read-only view, and returns the results keyed by adapter id. A metric whose `label` is not LIVE, REPLAY or SIMULATED, or whose `value` is not finite, is a violation. On a dead kernel it throws the original error. The kernel does not cache; calling it twice gives the same answer.

## Reproducibility and speed

The same seed, adapter set, `dt` and duration give the same final `World` and metrics, bit for bit: fixed order, per-id streams, computed `t`, no clock reads. This holds for `run` and `step`; `advance` depends on the caller's real-time gaps, so it is reproducible only given the same gaps.

Spike T5 needs 30 simulated days (43,200 steps at 60 s) in under 10 s with all adapters, about 230 µs per step. The kernel's own share (ordering, streams, guard) is budgeted at 10 %, measured with trivial adapters, guard on. If the guard puts the kernel over that budget, the harness may run with checked mode off; tests and the live app always keep it on.

## Interface

- `createKernel(world, adapters, { dt?, check? })` returns a `Kernel`. Rejects duplicate ids, non-finite or non-positive `dt`, and adapters whose `writes` include `t`, `seed` or `clock`.
- `kernel.step()`: one step.
- `kernel.run(worldSeconds)`: steps until that much world time has passed. The duration must be a non-negative multiple of `dt`.
- `kernel.advance(realSeconds)`: returns the number of steps taken.
- `kernel.setClock(mode, scale)`: `realtime` requires scale 1; `timelapse` requires a finite scale above 0.
- `kernel.metrics()`: `Partial<Record<AdapterId, Metric>>`.
- `kernel.world`: the live `World`.
- `KernelError`: `{ adapter, key?, t, cause? }`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Adapter order | Ascending id | Caller's array order; dependency graph | Order is part of the result, so it must not depend on import order. A dependency graph is machinery for 15 adapters that can be numbered |
| Time step | Fixed 60 s | Variable; per-adapter | A fixed step makes runs replayable and keeps `dt` out of the random draws. 60 s fits the T5 budget |
| Same-step visibility | Sequential, later sees earlier | Double-buffered world | A copy of the world per step costs more than the budget allows; fixed order already makes it deterministic |
| `t` update | `t0 + n × dt` | `t += dt` | Repeated addition drifts and breaks bit-for-bit comparisons across run lengths |
| Streams | One per adapter id, persistent | One shared stream; new stream per step | Matches `rng.ts`; adding an adapter must not change another's numbers |
| Write guard | Deep proxy, throws | Snapshot and diff after each step; trust adapters | Throwing points at the offending line. Diff needs a copy of the world per adapter per step |
| After a violation | Kernel stays dead | Skip the adapter and go on | A half-applied step makes the result unreproducible and the evidence worthless |
| Catch-up in `advance` | Capped, excess dropped | Unbounded | A stalled tab must not freeze the UI on resume |

## Open Questions & Future Decisions

### Deferred
1. Whether `reads` should be enforced, once any adapter reads a key it does not declare.
2. Pause and resume with a saved state: needs the rng state exported, which `rng.ts` does not offer. Not needed for the demo.
3. Per-key rather than per-top-level-key `writes` (for example `alloc.power`), if two adapters collide in practice.
4. Whether `dt` should be adjustable per scenario; one adapter's physics may want a finer step.

## References

- `docs/plan.md` (Two clocks); `docs/spikes.md` T5; `src/core/contracts.ts`; `src/core/rng.ts`
