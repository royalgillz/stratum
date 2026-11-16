// The step loop: fixed dt, adapters in id order, one rng stream per adapter, write guard.
import type { Adapter, AdapterId, Metric, World } from '../contracts.ts';
import { rng, type Rng } from '../rng.ts';

export class KernelError extends Error {
  adapter: string;
  key?: string;
  t: number;
  constructor(message: string, adapter: string, t: number, key?: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'KernelError';
    this.adapter = adapter;
    this.t = t;
    this.key = key;
  }
}

export interface Kernel {
  world: World;
  step(): void;
  run(worldSeconds: number): void;
  advance(realSeconds: number): number;
  setClock(mode: World['clock']['mode'], scale: number): void;
  metrics(): Partial<Record<AdapterId, Metric>>;
}

const MAX_STEPS_PER_ADVANCE = 600;
const LABELS = ['LIVE', 'REPLAY', 'SIMULATED'];

/** A view of the world that throws on any write outside `allowed` (top-level keys). */
function guard(world: World, allowed: ReadonlySet<string>, id: string): World {
  const bad = (key: string | symbol) => new KernelError(`${id} wrote ${String(key)} without declaring it`, id, world.t, String(key));
  const cache = new WeakMap<object, object>();
  const deep = (o: object, top: string | symbol): object => {
    // shortcut: typed arrays (packet bytes) are returned unguarded, a Proxy breaks their methods; guard them if an adapter writes to one
    if (ArrayBuffer.isView(o)) return o;
    let p = cache.get(o);
    if (!p) {
      p = new Proxy(o, {
        get(t, k, r) {
          const v = Reflect.get(t, k, r);
          return typeof v === 'object' && v !== null ? deep(v, top) : v;
        },
        set() {
          throw bad(top);
        },
        deleteProperty() {
          throw bad(top);
        },
        defineProperty() {
          throw bad(top);
        },
      });
      cache.set(o, p);
    }
    return p;
  };
  return new Proxy(world, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      return typeof v === 'object' && v !== null && !allowed.has(k as string) ? deep(v, k) : v;
    },
    set(t, k, v) {
      if (!allowed.has(k as string)) throw bad(k);
      return Reflect.set(t, k, v);
    },
    deleteProperty(t, k) {
      if (!allowed.has(k as string)) throw bad(k);
      return Reflect.deleteProperty(t, k);
    },
    defineProperty(t, k, d) {
      if (!allowed.has(k as string)) throw bad(k);
      return Reflect.defineProperty(t, k, d);
    },
  });
}

export function createKernel(world: World, adapters: readonly Adapter[], opts: { dt?: number; check?: boolean } = {}): Kernel {
  const dt = opts.dt ?? 60;
  const check = opts.check ?? true;
  // @spec KERN-002
  if (!(Number.isFinite(dt) && dt > 0)) throw new RangeError(`dt must be finite and above 0, got ${dt}`);
  const sorted = [...adapters].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const [i, a] of sorted.entries()) {
    if (i > 0 && sorted[i - 1].id === a.id) throw new RangeError(`duplicate adapter id ${a.id}`);
    for (const k of ['t', 'seed', 'clock'] as const) {
      if (a.writes.includes(k)) throw new RangeError(`${a.id} may not write ${k}`);
    }
  }
  // @spec KERN-003
  const units = sorted.map((a: Adapter) => ({
    a,
    stream: rng(world.seed, a.id) as Rng,
    view: check ? guard(world, new Set<string>(a.writes), a.id) : world,
  }));
  const readOnly = check ? guard(world, new Set(), 'metrics') : world;
  const t0 = world.t;
  let n = 0;
  let owed = 0; // world seconds not yet stepped
  let dead: KernelError | null = null;

  const fail = (e: unknown, id: string): never => {
    dead = e instanceof KernelError ? e : new KernelError(`${id} threw: ${String(e)}`, id, world.t, undefined, e);
    throw dead;
  };
  const alive = () => {
    if (dead) throw dead;
  };

  // @spec KERN-001, KERN-004
  const stepOnce = () => {
    for (const u of units) {
      try {
        u.a.step(u.view, dt, u.stream);
      } catch (e) {
        fail(e, u.a.id);
      }
    }
    n++;
    world.t = t0 + n * dt;
  };

  return {
    world,
    step() {
      alive();
      stepOnce();
    },
    // @spec KERN-006
    run(worldSeconds) {
      alive();
      const q = worldSeconds / dt;
      const steps = Math.round(q);
      if (!(Number.isFinite(q) && q >= 0 && Math.abs(q - steps) < 1e-9)) {
        throw new RangeError(`run duration must be a non-negative multiple of dt, got ${worldSeconds}`);
      }
      for (let i = 0; i < steps; i++) stepOnce();
    },
    // @spec KERN-007
    advance(realSeconds) {
      alive();
      if (!(Number.isFinite(realSeconds) && realSeconds >= 0)) throw new RangeError(`bad realSeconds ${realSeconds}`);
      owed += realSeconds * world.clock.scale;
      const whole = Math.floor(owed / dt);
      owed -= whole * dt; // whole steps beyond the cap are dropped, not owed
      const steps = Math.min(whole, MAX_STEPS_PER_ADVANCE);
      for (let i = 0; i < steps; i++) stepOnce();
      return steps;
    },
    // @spec KERN-008
    setClock(mode, scale) {
      alive();
      if (!(Number.isFinite(scale) && scale > 0 && (mode !== 'realtime' || scale === 1))) {
        throw new RangeError(`bad clock ${mode} ${scale}`);
      }
      world.clock = { mode, scale };
    },
    // @spec KERN-005
    metrics() {
      alive();
      const out: Partial<Record<AdapterId, Metric>> = {};
      for (const u of units) {
        try {
          const m = u.a.metric(readOnly);
          if (!LABELS.includes(m.label) || !Number.isFinite(m.value)) {
            throw new KernelError(`${u.a.id} returned a bad metric`, u.a.id, world.t);
          }
          out[u.a.id] = m;
        } catch (e) {
          fail(e, u.a.id);
        }
      }
      return out;
    },
  };
}
