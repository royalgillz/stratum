import { describe, expect, it } from 'vitest';
import type { Claim } from '../contracts.ts';
import { allocate } from '../fairshare/fairshare.ts';
import { createKernel } from '../kernel/kernel.ts';
import { co2Step, coolingDemandMW, RH, tempStep, wetBulb } from '../world/airheat/airheat.ts';
import { changedPaths, livableWorld, PEOPLE, quietScript, setPower } from './livable.fixture.ts';
import { createP03, REFUGE } from './p03.ts';
import { sectorId, type Policy } from './shared.ts';

const demands = Array.from({ length: 24 }, (_, s) => coolingDemandMW(Math.floor(s / 4) + 1, PEOPLE));
const COOL_CAP = demands.reduce((a, b) => a + b, 0);
const claims = (): Claim[] => demands.map((d, s) => ({ id: sectorId(s), floor: REFUGE * d, demand: d, debt: 0 }));
const total = (a: Record<string, number>) => Object.values(a).reduce((x, y) => x + y, 0);

function run(policy: Policy, frac: number, cut: number[] = [], steps = 1, init?: (w: ReturnType<typeof livableWorld>) => void) {
  const w = livableWorld();
  setPower(w, frac, cut);
  init?.(w);
  const k = createKernel(w, [createP03(policy, quietScript())], { check: true });
  for (let i = 0; i < steps; i++) k.step();
  return { w, k };
}

describe('p03 heat', () => {
  it('declares its reads and writes', () => {
    const a = createP03('stratum', quietScript());
    expect(a.id).toBe('p03');
    expect([...a.reads]).toEqual(['sectors', 'alloc']);
    expect([...a.writes]).toEqual(['sectors', 'alloc']);
  });

  // @spec ADAPT-LIVABLE-001
  it('sizes the pool as COOL_CAP from the first step times the grid served fraction', () => {
    expect(total(run('directorate', 1).w.alloc.cooling)).toBeCloseTo(COOL_CAP, 12);
    expect(total(run('directorate', 0.5).w.alloc.cooling)).toBeCloseTo(0.5 * COOL_CAP, 12);
    expect(total(run('stratum', 0.5).w.alloc.cooling)).toBeCloseTo(0.5 * COOL_CAP, 12);
    // COOL_CAP is fixed on the first step: more people later do not grow the pool.
    const { w, k } = run('directorate', 1);
    w.sectors[0].people *= 2;
    w.alloc.power.s00 *= 2;
    k.step();
    expect(total(w.alloc.cooling)).toBeCloseTo(COOL_CAP, 12);
  });

  // @spec ADAPT-LIVABLE-002
  it('Directorate: splits in proportion to demand among powered sectors, capped, cut sectors get 0', () => {
    const half = run('directorate', 0.5).w.alloc.cooling;
    demands.forEach((d, s) => expect(half[sectorId(s)]).toBeCloseTo(0.5 * d, 12));
    const cut = run('directorate', 1, [20, 21, 22, 23]).w.alloc.cooling;
    expect(Object.keys(cut)).toEqual(demands.map((_, s) => sectorId(s)));
    demands.forEach((d, s) => expect(cut[sectorId(s)]).toBeCloseTo(s >= 20 ? 0 : d, 12));
  });

  // @spec ADAPT-LIVABLE-003
  it('STRATUM: alloc.cooling is Fair Share over refuge floors', () => {
    for (const [frac, cut] of [[0.5, []], [1, [20, 21, 22, 23]], [0.1, []]] as const) {
      const pool = (COOL_CAP * (24 * frac - cut.length * frac)) / 24;
      expect(run('stratum', frac, [...cut]).w.alloc.cooling).toEqual(allocate(pool, claims()).shares);
    }
  });

  // @spec ADAPT-LIVABLE-004
  it('steps temp, wet-bulb and CO2 from the main-area cooling fraction and ventilation', () => {
    const T0 = 30;
    const init = (w: ReturnType<typeof livableWorld>) => w.sectors.forEach((x) => (x.temp = T0));
    const d = run('directorate', 0.5, [23], 1, init).w;
    const s = run('stratum', 0.5, [23], 1, init).w;
    const pool = (COOL_CAP * 0.5 * 23) / 24;
    const shares = allocate(pool, claims()).shares;
    for (const i of [0, 9, 22, 23]) {
      const level = Math.floor(i / 4) + 1, dem = demands[i];
      const cD = i === 23 ? 0 : pool / (COOL_CAP - demands[23]);
      const paid = Math.min(shares[sectorId(i)], REFUGE * dem);
      const cS = Math.min(1, Math.max(0, (shares[sectorId(i)] - paid) / ((1 - REFUGE) * dem)));
      const vent = i === 23 ? 0 : 1;
      expect(d.sectors[i].temp).toBeCloseTo(tempStep(T0, level, cD, 60), 12);
      expect(s.sectors[i].temp).toBeCloseTo(tempStep(T0, level, cS, 60), 12);
      expect(s.sectors[i].wetBulb).toBeCloseTo(wetBulb(s.sectors[i].temp, RH), 12);
      expect(d.sectors[i].co2).toBeCloseTo(co2Step(livableWorld().sectors[i].co2, vent, 60).co2, 9);
    }
    // Ventilation is served against the life floor: 0.3 of demand fully ventilates.
    expect(run('directorate', 0.3).w.sectors[0].co2).toBeCloseTo(livableWorld().sectors[0].co2, 9);
  });

  // @spec ADAPT-LIVABLE-005
  it('counts person-hours above 27.5 C wet-bulb, excusing the paid refuge under STRATUM', () => {
    const hot = (w: ReturnType<typeof livableWorld>) => w.sectors.forEach((x, i) => (x.temp = i >= 20 ? 40 : 24));
    const fresh = createP03('directorate', quietScript());
    expect(fresh.metric(livableWorld())).toEqual({ name: 'person-hours above 27.5 C wet-bulb', value: 0, unit: 'person-h', label: 'SIMULATED' });

    const d = run('directorate', 1, [20, 21, 22, 23], 2, hot);
    expect(d.k.metrics().p03!.value).toBeCloseTo(2 * 4 * PEOPLE * (60 / 3600), 9);

    const s = run('stratum', 1, [20, 21, 22, 23], 1, hot);
    const shares = s.w.alloc.cooling;
    const want = [20, 21, 22, 23].reduce((a, i) => {
      const dem = demands[i];
      return a + PEOPLE * (1 - Math.min(shares[sectorId(i)], REFUGE * dem) / dem) * (60 / 3600);
    }, 0);
    const m = s.k.metrics().p03!;
    expect(m.value).toBeCloseTo(want, 9);
    expect(m.value).toBeLessThan(4 * PEOPLE * (60 / 3600));
    expect(m.label).toBe('SIMULATED');
  });

  // @spec ADAPT-LIVABLE-004, ADAPT-LIVABLE-005
  it('STRATUM below the floors: the refuge takes all cooling, and only the paid share is excused', () => {
    const T0 = 40;
    const hot = (w: ReturnType<typeof livableWorld>) => w.sectors.forEach((x, i) => (x.temp = i >= 20 ? T0 : 24));
    const { w, k } = run('stratum', 0.1, [], 1, hot);
    const shares = allocate(0.1 * COOL_CAP, claims()).shares;
    let want = 0;
    for (const i of [20, 21, 22, 23]) {
      expect(shares[sectorId(i)]).toBeLessThan(REFUGE * demands[i]);
      expect(w.sectors[i].temp).toBeCloseTo(tempStep(T0, 6, 0, 60), 12);
      want += PEOPLE * (1 - shares[sectorId(i)] / demands[i]) * (60 / 3600);
    }
    expect(k.metrics().p03!.value).toBeCloseTo(want, 9);
    expect(want).toBeGreaterThan(4 * (1 - REFUGE) * PEOPLE * (60 / 3600));
  });

  // @spec ADAPT-LIVABLE-005
  it('Directorate: partial cooling excuses no one', () => {
    const hot = (w: ReturnType<typeof livableWorld>) => w.sectors.forEach((x, i) => (x.temp = i >= 20 ? 40 : 24));
    expect(run('directorate', 0.5, [], 1, hot).k.metrics().p03!.value).toBeCloseTo(4 * PEOPLE * (60 / 3600), 9);
  });

  // @spec ADAPT-LIVABLE-001
  it('clamps each sector served power at its demand when sizing the pool', () => {
    const { w } = run('stratum', 1, [23], 1, (x) => (x.alloc.power.s00 *= 2));
    expect(total(w.alloc.cooling)).toBeCloseTo(COOL_CAP * (23 / 24), 12);
  });

  it('writes only the sub-fields it owns', () => {
    const w = livableWorld();
    setPower(w, 0.5, [20, 21, 22, 23]);
    for (const v of Object.values(w.alloc)) if (Object.keys(v).length === 0) v.s00 = 1;
    w.sectors.forEach((x) => (x.temp = 35));
    const before = structuredClone(w);
    createKernel(w, [createP03('stratum', quietScript())], { check: true }).step();
    const paths = changedPaths(before, w).filter((p) => p !== 't');
    expect(paths.some((p) => p.startsWith('sectors.'))).toBe(true);
    for (const p of paths) expect(p).toMatch(/^(alloc\.cooling\.s\d\d|sectors\.\d+\.(temp|wetBulb|co2))$/);
  });

  // @spec ADAPT-LIVABLE-010
  it('STRATUM: no sector gets less than its refuge floor while the pool covers the floors', () => {
    for (const frac of [1, 0.6, 0.3, REFUGE]) {
      const a = run('stratum', frac).w.alloc.cooling;
      demands.forEach((d, s) => expect(a[sectorId(s)]).toBeGreaterThanOrEqual(REFUGE * d - 1e-12));
    }
  });
});
