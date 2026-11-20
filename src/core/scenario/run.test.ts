// Tests for createRun, tick, inject and runHeadless (docs/intent/scenario, "Runs").
import { describe, expect, it, vi } from 'vitest';
import type { MeshMessage } from '../contracts.ts';
import { createAdapters } from '../adapters/index.ts';
import { createKernel } from '../kernel/kernel.ts';
import { createRun, runHeadless } from './run.ts';
import { sevenDay } from './seven-day.ts';
import type { Script } from './types.ts';
import { varyScript } from './vary.ts';
import { createWorld } from './world.ts';

// Records the options every kernel is created with, passing everything through.
const made = vi.hoisted(() => [] as { dt?: number; check?: boolean }[]);
vi.mock('../kernel/kernel.ts', async (orig) => {
  const m = await orig<typeof import('../kernel/kernel.ts')>();
  return { ...m, createKernel: (w: Parameters<typeof m.createKernel>[0], a: Parameters<typeof m.createKernel>[1], o: Parameters<typeof m.createKernel>[2]) => (made.push({ ...o }), m.createKernel(w, a, o)) };
});

const H = 3600;
const DAY = 86400;
const dayOne: Script = { ...sevenDay, days: 1, acts: sevenDay.acts.filter((a) => a.atH <= 24), events: sevenDay.events.filter((e) => e.atH <= 24) };
/** One day with a real-time act of 90 s at hour 1, then a slow time-lapse at scale 600. */
const acts: Script = {
  ...dayOne,
  acts: [
    { atH: 0, mode: 'timelapse', title: 'a' },
    { atH: 1, mode: 'realtime', title: 'b' },
    { atH: 1 + 90 / H, mode: 'timelapse', scale: 600, title: 'c' },
  ],
};
const live = (bytes = new Uint8Array(25)): MeshMessage => ({
  at: -5, bytes,
  heard: { type: 1, keySet: 'family', minute: 29000000, payload: { member: 0, code: 0, level: 5, sector: 1, flags: 0, value: 0 }, label: 'LIVE' },
});

describe('createRun', () => {
  // @spec SCEN-004
  it('validates the script, varies it by the seed and builds a dt 60 kernel over createWorld and createAdapters of the concrete script, checked unless check is false', () => {
    expect(() => createRun({ ...dayOne, days: 0 }, 1, 'stratum')).toThrow(RangeError);
    expect(() => createRun(dayOne, 1, 'other' as 'stratum')).toThrow(RangeError);
    made.length = 0;
    const run = createRun(dayOne, 7, 'stratum');
    expect(made).toEqual([{ dt: 60, check: true }]);
    createRun(dayOne, 7, 'stratum', { check: false });
    expect(made[1]).toEqual({ dt: 60, check: false });
    const concrete = varyScript(dayOne, 7);
    expect(run.script).toEqual(concrete);
    expect(concrete).not.toEqual(dayOne); // dayOne carries sevenDay's vary bounds
    expect(run.kernel.world).toEqual(createWorld(7, concrete));
    const k = createKernel(createWorld(7, concrete), createAdapters('stratum', concrete));
    run.kernel.run(4 * H);
    k.run(4 * H);
    expect(run.kernel.world).toEqual(k.world);
    expect(run.kernel.metrics()).toEqual(k.metrics());
    run.kernel.step();
    expect(run.kernel.world.t).toBe(4 * H + 60);
  });
});

describe('tick', () => {
  // @spec SCEN-005
  it('sets the clock to the act holding t, then advances at its scale', () => {
    const run = createRun(dayOne, 1, 'directorate');
    run.kernel.setClock('realtime', 1);
    for (const bad of [Number.NaN, Infinity, -1]) expect(() => run.tick(bad)).toThrow(RangeError);
    expect(run.kernel.world.t).toBe(0);
    expect(run.kernel.world.clock).toEqual({ mode: 'realtime', scale: 1 });
    expect(run.tick(1)).toBe(60); // back to the time-lapse act: one real second is an hour
    expect(run.kernel.world.clock).toEqual({ mode: 'timelapse', scale: 3600 });
    expect(run.kernel.world.t).toBe(H);
    expect(run.act()).toBe(dayOne.acts[0]);
    expect(run.tick(1000)).toBe(600); // kernel.advance's per-call cap
    run.kernel.setClock('timelapse', 60);
    run.tick(1);
    expect(run.kernel.world.clock).toEqual({ mode: 'timelapse', scale: 3600 });
  });

  // @spec SCEN-005
  it('runs at most the per-call cap of steps toward the next act, switching only once there', () => {
    const far: Script = { ...acts, acts: [{ atH: 0, mode: 'timelapse', title: 'a' }, { atH: 20, mode: 'realtime', title: 'b' }, { atH: 20 + 90 / H, mode: 'timelapse', title: 'c' }] };
    const run = createRun(far, 1, 'directorate', { check: false });
    const w = run.kernel.world;
    expect(run.tick(100)).toBe(600);
    expect(w.t).toBe(10 * H);
    expect(w.clock).toEqual({ mode: 'timelapse', scale: 3600 });
    expect(run.tick(100)).toBe(600);
    expect(w.t).toBe(20 * H);
    expect(w.clock).toEqual({ mode: 'realtime', scale: 1 });
  });

  // @spec SCEN-005
  it('stops a tick at the next act start, switches the clock and drops the rest, so no act is skipped', () => {
    const run = createRun(acts, 1, 'directorate');
    const w = run.kernel.world;
    expect(run.tick(2)).toBe(60); // two hours asked, one hour to the real-time act
    expect(w.t).toBe(H);
    expect(w.clock).toEqual({ mode: 'realtime', scale: 1 });
    expect(run.act()).toBe(acts.acts[1]);
    expect(run.tick(30)).toBe(0); // 30 s owed
    expect(run.tick(30)).toBe(1);
    expect(w.t).toBe(H + 60);
    expect(run.tick(30)).toBe(1); // reaches 3690 s: one whole step to 3720 s, then the slow time-lapse
    expect(w.t).toBe(H + 120);
    expect(w.clock).toEqual({ mode: 'timelapse', scale: 600 });
    expect(run.act()).toBe(acts.acts[2]);
    expect(run.tick(1)).toBe(10);
  });

  // @spec SCEN-005
  it('takes no step at or past the end of the script and reports done', () => {
    const run = createRun(dayOne, 1, 'directorate');
    expect(run.done()).toBe(false);
    while (!run.done()) run.tick(10);
    expect(run.kernel.world.t).toBe(DAY); // a big last tick is clamped to the end
    const t = run.kernel.world.t;
    expect(run.tick(10)).toBe(0);
    expect(run.kernel.world.t).toBe(t);
    expect(run.done()).toBe(true);
    const exact = createRun(dayOne, 1, 'directorate', { check: false });
    exact.kernel.run(DAY);
    expect(exact.done()).toBe(true);
    expect(exact.tick(10)).toBe(0);
    expect(exact.kernel.world.t).toBe(DAY);
  });
});

describe('inject', () => {
  // @spec SCEN-006
  it('appends a 25-byte LIVE message at world.t and rejects anything else, changing nothing', () => {
    const run = createRun(dayOne, 1, 'stratum');
    run.kernel.run(H);
    const inbox = run.kernel.world.mesh.inbox;
    const before = [...inbox];
    const m = live();
    run.inject(m);
    expect(inbox).toHaveLength(before.length + 1);
    expect(inbox.at(-1)).toMatchObject({ at: H, bytes: m.bytes, heard: m.heard });
    const bad: unknown[] = [
      live(new Uint8Array(24)), live(new Uint8Array(26)), { at: 0, bytes: new Uint8Array(25) },
      { ...live(), heard: { ...live().heard!, label: 'SIMULATED' } }, { ...live(), heard: { ...live().heard!, label: 'REPLAY' } },
      { ...live(), bytes: Array(25).fill(0) }, null,
    ];
    for (const x of bad) expect(() => run.inject(x as MeshMessage)).toThrow(RangeError);
    expect(inbox).toHaveLength(before.length + 1);
  });
});

describe('runHeadless', () => {
  // @spec SCEN-007
  it('rejects a sampleEvery that is not a positive multiple of 60 dividing the run', () => {
    for (const s of [0, -3600, 90, 3630, 7 * H, Number.NaN, Infinity]) expect(() => runHeadless(dayOne, 1, 'stratum', { sampleEvery: s, check: false })).toThrow(RangeError);
  });

  // @spec SCEN-007
  it('samples every adapter metric at 0 and after every sampleEvery seconds to the end', () => {
    const { series, world } = runHeadless(dayOne, 4, 'stratum', { sampleEvery: 6 * H });
    expect(world.t).toBe(DAY);
    expect(Object.keys(series)).toEqual(Array.from({ length: 15 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`));
    const run = createRun(dayOne, 4, 'stratum');
    const want = [run.kernel.metrics()];
    for (let i = 0; i < 4; i++) (run.kernel.run(6 * H), want.push(run.kernel.metrics()));
    for (const [id, s] of Object.entries(series)) {
      const m = want[0]![id as 'p01']!;
      expect(s).toEqual({ name: m.name, unit: m.unit, label: m.label, t: [0, 6 * H, 12 * H, 18 * H, DAY], value: want.map((x) => x[id as 'p01']!.value) });
    }
    expect(world).toEqual(run.kernel.world);
    expect(runHeadless(dayOne, 4, 'stratum').series.p01!.t).toHaveLength(25);
    runHeadless(dayOne, 4, 'stratum', { sampleEvery: DAY, check: undefined });
    expect(made.at(-1)).toEqual({ dt: 60, check: true });
  }, 60_000);

  // @spec SCEN-004, SCEN-007
  it('passes a per-adapter policy map through createRun to createAdapters', () => {
    const per = { p13: 'directorate', p07: 'directorate' } as const;
    const run = createRun(dayOne, 5, 'stratum', { per });
    const k = createKernel(createWorld(5, run.script), createAdapters('stratum', run.script, per));
    run.kernel.run(6 * H);
    k.run(6 * H);
    expect(run.kernel.world).toEqual(k.world);
    expect(run.kernel.world.surface.band).not.toBe('unknown'); // p13 under the Directorate posts its verdict
    const a = runHeadless(dayOne, 5, 'stratum', { per, check: false });
    const b = runHeadless(dayOne, 5, 'stratum', { check: false });
    expect(a.series.p07!.value).not.toEqual(b.series.p07!.value); // messages wait for the bulletin
    expect(a.series.p02).toEqual(b.series.p02);
    expect(() => runHeadless(dayOne, 5, 'stratum', { per: { p99: 'stratum' } as never })).toThrow(RangeError);
  }, 60_000);

  // @spec SCEN-008
  it('returns identical series and worlds on every call, checked or not', () => {
    for (const p of ['directorate', 'stratum'] as const) {
      const a = runHeadless(dayOne, 9, p);
      expect(runHeadless(dayOne, 9, p)).toEqual(a);
      expect(runHeadless(dayOne, 9, p, { check: false })).toEqual(a);
    }
  }, 60_000);
});
