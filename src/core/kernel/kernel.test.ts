import { describe, expect, it } from 'vitest';
import type { Adapter, AdapterId, World } from '../contracts.ts';
import { rng } from '../rng.ts';
import { createKernel, KernelError } from './kernel.ts';

function makeWorld(seed = 1): World {
  const alloc = { power: {}, water: {}, food: {}, cooling: {}, pumps: {}, lampHours: {}, medicine: {}, bunks: {}, trialSlots: {}, returnSlots: {} };
  return {
    t: 0,
    seed,
    clock: { mode: 'realtime', scale: 1 },
    grid: { f: 400, rocof: 0, gapMW: 0, tier: 'GREEN' },
    sectors: [],
    tunnels: { nodes: 0, edges: [] },
    households: [],
    ledger: { measured: [], official: [] },
    mesh: { inbox: [], delivered: [] },
    alloc,
    surface: { readings: [], band: '' },
  };
}

const id = (n: number) => `p${String(n).padStart(2, '0')}` as AdapterId;

function stub(n: number, over: Partial<Adapter> = {}): Adapter {
  return {
    id: id(n),
    reads: [],
    writes: [],
    step: () => {},
    metric: () => ({ name: `m${n}`, value: n, unit: 'u', label: 'SIMULATED' }),
    ...over,
  };
}

describe('kernel', () => {
  // @spec KERN-001
  it('steps every adapter once per step in id order with dt, and computes t', () => {
    const w = makeWorld();
    w.t = 1000;
    const log: string[] = [];
    const rec = (n: number) => stub(n, { step: (wd, dt) => void log.push(`${id(n)}:${dt}:${wd.t}`) });
    const k = createKernel(w, [rec(3), rec(1), rec(2)]);
    k.step();
    k.step();
    expect(log).toEqual(['p01:60:1000', 'p02:60:1000', 'p03:60:1000', 'p01:60:1060', 'p02:60:1060', 'p03:60:1060']);
    expect(w.t).toBe(1120);
    const empty = createKernel(makeWorld(), [], { dt: 0.1 });
    empty.run(0.3);
    expect(empty.world.t).toBe(0 + 3 * 0.1);
  });

  // @spec KERN-002
  it('rejects duplicate ids, a bad dt, and writes to kernel-owned keys', () => {
    expect(() => createKernel(makeWorld(), [stub(1), stub(1)])).toThrow(RangeError);
    for (const dt of [0, -1, NaN, Infinity]) expect(() => createKernel(makeWorld(), [], { dt })).toThrow(RangeError);
    for (const key of ['t', 'seed', 'clock'] as const) {
      expect(() => createKernel(makeWorld(), [stub(1, { writes: [key] })])).toThrow(RangeError);
    }
  });

  // @spec KERN-003
  it('gives each adapter its own persistent stream named by id', () => {
    const run = (ns: number[]) => {
      const out: Record<number, number[]> = {};
      const mk = (n: number) => stub(n, { step: (_w, _dt, r) => void (out[n] ??= []).push(r()) });
      createKernel(makeWorld(7), ns.map(mk)).run(180);
      return out;
    };
    const solo = run([1]);
    const pair = run([1, 2]);
    expect(pair[1]).toEqual(solo[1]);
    const direct = rng(7, 'p01');
    expect(solo[1]).toEqual([direct(), direct(), direct()]);
    expect(pair[2]).not.toEqual(pair[1]);
  });

  // @spec KERN-004
  it('throws KernelError on an undeclared write and then stays dead', () => {
    const w = makeWorld();
    const bad = stub(1, { writes: ['sectors'], step: (wd) => void (wd.grid.f = 1) });
    const k = createKernel(w, [bad]);
    let err: unknown;
    try {
      k.step();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(KernelError);
    expect(err).toMatchObject({ adapter: 'p01', key: 'grid', t: 0 });
    for (const call of [() => k.step(), () => k.run(60), () => k.advance(1), () => k.setClock('realtime', 1), () => k.metrics()]) {
      expect(call).toThrow(err as Error);
    }
  });

  // @spec KERN-004
  it('catches deletes, array mutation, writes to t, and a throwing step; allows declared writes', () => {
    const run = (step: Adapter['step'], writes: Adapter['writes'] = []) =>
      createKernel(makeWorld(), [stub(1, { writes, step })]).step();
    expect(() => run((wd) => void wd.households.push({ id: 'h', members: 1, level: 1, sector: 0, shift: 0 }))).toThrow(KernelError);
    expect(() => run((wd) => void delete (wd.grid as Partial<World['grid']>).f)).toThrow(KernelError);
    expect(() => run((wd) => void (wd.t = 5))).toThrow(KernelError);
    expect(() => run((wd) => void (wd.grid.f = 1), ['grid'])).not.toThrow();
    const boom = new Error('boom');
    try {
      run(() => {
        throw boom;
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(KernelError);
      expect((e as KernelError).cause).toBe(boom);
    }
    const unchecked = createKernel(makeWorld(), [stub(1, { step: (wd) => void (wd.grid.f = 1) })], { check: false });
    expect(() => unchecked.step()).not.toThrow();
  });

  // @spec KERN-005
  it('collects metrics by id on a read-only view and rejects bad metrics', () => {
    const k = createKernel(makeWorld(), [stub(2), stub(1)]);
    expect(k.metrics()).toEqual({
      p01: { name: 'm1', value: 1, unit: 'u', label: 'SIMULATED' },
      p02: { name: 'm2', value: 2, unit: 'u', label: 'SIMULATED' },
    });
    expect(createKernel(makeWorld(), []).metrics()).toEqual({});
    const badLabel = stub(1, { metric: () => ({ name: 'x', value: 1, unit: 'u', label: 'REAL' as never }) });
    expect(() => createKernel(makeWorld(), [badLabel]).metrics()).toThrow(KernelError);
    const nan = stub(1, { metric: () => ({ name: 'x', value: NaN, unit: 'u', label: 'LIVE' }) });
    expect(() => createKernel(makeWorld(), [nan]).metrics()).toThrow(KernelError);
    const mutator = stub(1, { metric: (wd) => ((wd.grid.f = 0), { name: 'x', value: 1, unit: 'u', label: 'LIVE' }) });
    expect(() => createKernel(makeWorld(), [mutator]).metrics()).toThrow(KernelError);
  });

  // @spec KERN-006
  it('replays bit for bit and validates run durations', () => {
    const walker = (n: number) =>
      stub(n, { writes: ['grid'], step: (wd, dt, r) => void (wd.grid.f += (r() - 0.5) * dt * 1e-3) });
    const once = () => {
      const k = createKernel(makeWorld(42), [walker(1), walker(2)]);
      k.run(3600);
      return JSON.stringify([k.world, k.metrics()]);
    };
    expect(once()).toBe(once());
    const k = createKernel(makeWorld(), [stub(1)]);
    for (const d of [61, -60, NaN, Infinity]) expect(() => k.run(d)).toThrow(RangeError);
    k.run(0);
    expect(k.world.t).toBe(0);
    k.run(120);
    expect(k.world.t).toBe(120);
  });

  // @spec KERN-007
  it('advance converts real time to whole steps with a carried remainder and a cap', () => {
    const w = makeWorld();
    const k = createKernel(w, []);
    expect(k.advance(30)).toBe(0);
    expect(k.advance(30)).toBe(1);
    expect(k.advance(0)).toBe(0);
    expect(() => k.advance(-1)).toThrow(RangeError);
    expect(() => k.advance(NaN)).toThrow(RangeError);
    expect(w.t).toBe(60);
    k.setClock('timelapse', 3600);
    expect(k.advance(1)).toBe(60);
    expect(k.advance(1000)).toBe(600);
    expect(w.t).toBe(60 + 60 * 60 + 600 * 60);
    expect(k.advance(0)).toBe(0); // the excess was dropped, nothing is owed
  });

  // @spec KERN-008
  it('setClock validates and keeps t and the owed balance', () => {
    const w = makeWorld();
    const k = createKernel(w, []);
    expect(() => k.setClock('realtime', 2)).toThrow(RangeError);
    for (const s of [0, -1, NaN, Infinity]) expect(() => k.setClock('timelapse', s)).toThrow(RangeError);
    expect(w.clock).toEqual({ mode: 'realtime', scale: 1 });
    k.advance(30);
    k.setClock('timelapse', 960);
    expect(w.clock).toEqual({ mode: 'timelapse', scale: 960 });
    expect(w.t).toBe(0);
    expect(k.advance(1 / 32)).toBe(1); // the carried 30 s plus 30 s completes a step
    k.setClock('realtime', 1);
    expect(w.clock.mode).toBe('realtime');
    expect(w.t).toBe(60);
  });

  // @spec KERN-009
  it('runs 30 simulated days with 15 adapters and the guard on in under 1 s', () => {
    const k = createKernel(makeWorld(), Array.from({ length: 15 }, (_, i) => stub(i + 1, { writes: ['grid'], step: (wd) => void (wd.grid.f = wd.grid.f) })));
    const t0 = performance.now();
    k.run(30 * 86400);
    const ms = performance.now() - t0;
    console.log(`KERN-009: 30 days in ${ms.toFixed(0)} ms`);
    expect(k.world.t).toBe(30 * 86400);
    expect(ms).toBeLessThan(1000);
  });
});
