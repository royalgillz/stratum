# Kernel specs

Prefix `KERN`. Design: `kernel-design.md`. The problems served are in brackets.

- [ ] **KERN-001** [all]: On each step, the kernel shall call every adapter exactly once, in ascending `id` order whatever the order supplied, with the fixed step `dt` in world seconds, and then set `world.t` to `t0 + n × dt` after `n` steps; an empty adapter list shall still advance `t`.
- [ ] **KERN-002** [all]: When a kernel is created, it shall reject duplicate adapter ids, a `dt` that is not finite and above 0, and any adapter whose `writes` include `t`, `seed` or `clock`.
- [ ] **KERN-003** [all]: The kernel shall create one stream per adapter as `rng(world.seed, adapter.id)` when the kernel is created and pass that same stream on every step, so that adding or removing another adapter leaves an adapter's draws unchanged.
- [ ] **KERN-004** [all]: While checked mode is on, if an adapter assigns to, deletes from or mutates (at any depth) a World key not in its `writes`, then the kernel shall throw a `KernelError` naming the adapter, the key and the world time, and every later call on that kernel shall throw as well; the same shall hold when `step` or `metric` throws, with the original error as `cause`.
- [ ] **KERN-005** [all]: When `metrics()` is called, the kernel shall return each adapter's `metric(world)` keyed by id, computed on a read-only view, and shall throw a `KernelError` if a metric has a label other than LIVE, REPLAY or SIMULATED or a non-finite value.
- [ ] **KERN-006** [all]: Given the same seed, adapter set, `dt` and duration, `run` shall produce an identical final World and identical metrics, with no wall-clock reads.
- [ ] **KERN-007** [all]: When `advance(realSeconds)` is called, the kernel shall add `realSeconds × world.clock.scale` to a balance of owed world seconds, run as many whole steps as the balance covers up to a per-call cap, keep the remainder, drop the excess over the cap, and return the number of steps taken.
- [ ] **KERN-008** [all]: When `setClock(mode, scale)` is called, the kernel shall reject `realtime` with a scale other than 1 and any scale that is not finite and above 0, and otherwise update `world.clock` for the next `advance` without changing `world.t` or the owed balance.
- [ ] **KERN-009** [all]: Running 30 simulated days at the default `dt` with 15 trivial adapters and checked mode on shall take under 1 s of kernel overhead on a laptop in Node.
- [ ] **KERN-010** [all]: Given the same seed and stream name, `rng` shall return the same sequence on every call and every runtime.
- [ ] **KERN-011** [all]: Given a different stream name or a different seed, `rng` shall return an independent sequence, so draws from one stream never change another's.
- [ ] **KERN-012** [all]: Every value `rng` returns shall be in [0, 1) with a mean near 0.5 over many draws.
