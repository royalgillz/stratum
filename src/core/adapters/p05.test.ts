import { describe, expect, it } from 'vitest';
import type { Adapter, Claim, World } from '../contracts.ts';
import { allocate } from '../fairshare/fairshare.ts';
import { createKernel } from '../kernel/kernel.ts';
import type { Script } from '../scenario/types.ts';
import { sevenDay } from '../scenario/seven-day.ts';
import { HUB, PUMP_KW, strandedIfLost, sumpStep } from '../world/tunnels/tunnels.ts';
import { changedPaths, livableWorld, PEOPLE, quietScript, setPower } from './livable.fixture.ts';
import { createP03 } from './p03.ts';
import { createP05 } from './p05.ts';
import { lifeFloor, sectorId, type Policy } from './shared.ts';

const D = PUMP_KW / 1000;
const ids = Array.from({ length: 24 }, (_, s) => sectorId(s));
const H = 60 / 3600;

function run(policy: Policy, frac: number, cut: number[] = [], steps = 1, init?: (w: World) => void, script: Script = quietScript()) {
  const w = livableWorld();
  setPower(w, frac, cut);
  init?.(w);
  const k = createKernel(w, [createP05(policy, script)], { check: true });
  for (let i = 0; i < steps; i++) k.step();
  return { w, k };
}

const passable = (w: World, s: number) => w.tunnels.edges.filter((e) => e.a === s || e.b === s).map((e) => e.passable);

describe('p05 tunnels', () => {
  it('declares its reads and writes', () => {
    const a = createP05('stratum', quietScript());
    expect(a.id).toBe('p05');
    expect([...a.reads]).toEqual(['sectors', 'alloc', 'tunnels']);
    expect([...a.writes]).toEqual(['sectors', 'tunnels', 'alloc']);
  });

  // @spec ADAPT-LIVABLE-006
  it('Directorate: pool is 24 pumps times the grid served fraction, split among powered sectors, capped', () => {
    const full = run('directorate', 1).w.alloc.pumps;
    expect(Object.keys(full)).toEqual(ids);
    ids.forEach((id) => expect(full[id]).toBeCloseTo(D, 12));
    const half = run('directorate', 0.5).w.alloc.pumps;
    ids.forEach((id) => expect(half[id]).toBeCloseTo(D / 2, 12));
    const cut = run('directorate', 1, [20, 21, 22, 23]).w.alloc.pumps;
    ids.forEach((id, s) => expect(cut[id]).toBeCloseTo(s >= 20 ? 0 : D, 12));
  });

  const people = Array<number>(24).fill(PEOPLE);
  const claimsFor = (flooded: boolean[]): Claim[] => {
    const lost = strandedIfLost(livableWorld().tunnels.edges, flooded, people, HUB);
    return ids.map((id, s) => ({ id, floor: lost[s] > 0 ? D : 0, demand: D, debt: 0 }));
  };
  const dry = Array<boolean>(24).fill(false);
  const wet21 = dry.map((_, s) => s === 21);

  // @spec ADAPT-LIVABLE-007
  it('STRATUM: Fair Share with full floors for critical sectors, from the flooded flags at the step start', () => {
    const a = run('stratum', 0.5).w.alloc.pumps;
    expect(a).toEqual(allocate(24 * D * 0.5, claimsFor(dry)).shares);
    expect(a.s22).toBeCloseTo(D, 12); // its loss strands sector 23
    expect(a.s23).toBeLessThan(D);

    // Sector 21 flooded at the start: 22 and 23 are cut off already, so neither 20 nor 22 is critical.
    const b = run('stratum', 0.5, [], 1, (w) => (w.sectors[21].sumpLevel = 1)).w.alloc.pumps;
    expect(b).toEqual(allocate(24 * D * 0.5, claimsFor(wet21)).shares);
    expect(b.s22).toBeLessThan(D);
  });

  // @spec ADAPT-LIVABLE-007
  it('STRATUM: criticality ignores a flood that arrives during the step', () => {
    const flood = quietScript([{ type: 'flood', atH: 0, sector: 21, inflowM3h: 50, durH: 1 }]);
    const { w } = run('stratum', 0.5, [], 1, (x) => (x.sectors[21].sumpLevel = 0.9999), flood);
    expect(w.sectors[21].sumpLevel).toBe(1);
    expect(w.alloc.pumps.s22).toBeCloseTo(D, 12); // 21 was dry at the step start, so 22 was critical
  });

  // @spec ADAPT-LIVABLE-007
  it('STRATUM: a draining sector stays flooded by hysteresis for the next step', () => {
    const { w } = run('stratum', 0.5, [], 2, (x) => (x.sectors[21].sumpLevel = 1));
    expect(w.sectors[21].sumpLevel).toBeLessThan(1);
    expect(w.sectors[21].sumpLevel).toBeGreaterThan(0.9);
    expect(w.alloc.pumps).toEqual(allocate(24 * D * 0.5, claimsFor(wet21)).shares);
  });

  // @spec ADAPT-LIVABLE-007, ADAPT-LIVABLE-009
  it('STRATUM: recomputes criticality and reach when a sector floods mid-run', () => {
    const late = quietScript([{ type: 'flood', atH: 1 / 60, sector: 21, inflowM3h: 500, durH: 1 }]);
    const { w, k } = run('stratum', 0.5, [], 2, (x) => (x.sectors[21].sumpLevel = 0.9999), late);
    expect(w.sectors[21].sumpLevel).toBe(1); // dry at step 1, flooded during step 2
    expect(w.alloc.pumps).toEqual(allocate(24 * D * 0.5, claimsFor(dry)).shares);
    expect(k.metrics().p05!.value).toBeCloseTo(3 * PEOPLE * H, 9); // step 2 strands 21, 22 and 23
    k.step();
    expect(w.alloc.pumps).toEqual(allocate(24 * D * 0.5, claimsFor(wet21)).shares);
  });

  // @spec ADAPT-LIVABLE-007
  it('STRATUM: recomputes criticality when people change', () => {
    const { w, k } = run('stratum', 0.5);
    expect(w.alloc.pumps.s22).toBeCloseTo(D, 12);
    w.sectors[23].people = 0; // nobody left behind 22
    k.step();
    expect(w.alloc.pumps.s22).toBeLessThan(D);
  });

  // @spec ADAPT-LIVABLE-008, ADAPT-POLICY-008
  it('steps sumps with pump power and flood inflow, floods sectors and closes their tunnels', () => {
    const script = quietScript([{ type: 'flood', atH: 0, sector: 23, inflowM3h: 50, durH: 1 }]);
    const { w } = run('directorate', 1, [22], 1, (x) => {
      x.sectors[23].sumpLevel = 0.999;
      x.sectors[5].sumpLevel = 0.95; // above RECOVER but starts dry: flags come from isFlooded(sumpLevel, false)
    }, script);
    expect(w.sectors[0].sumpLevel).toBeCloseTo(sumpStep(1, 0.3, 0, 1, 60), 12);
    expect(w.sectors[22].sumpLevel).toBeCloseTo(sumpStep(6, 0.3, 0, 0, 60), 12);
    expect(w.sectors[23].sumpLevel).toBe(1);
    expect(passable(w, 23)).toEqual([false]);
    expect(passable(w, 22)).toEqual([true, false]);
    expect(passable(w, 5).every(Boolean)).toBe(true);
    expect(w.tunnels.edges.filter((e) => !e.passable)).toHaveLength(1);
  });

  // @spec ADAPT-LIVABLE-008, ADAPT-LIVABLE-009
  it('reads flood inflow at the step start and meters the state after the update', () => {
    const once = quietScript([{ type: 'flood', atH: 0, sector: 23, inflowM3h: 50, durH: 1 / 60 }]);
    expect(run('directorate', 1, [], 1, undefined, once).w.sectors[23].sumpLevel).toBeCloseTo(sumpStep(6, 0.3, 50, 1, 60), 12);
    const late = quietScript([{ type: 'flood', atH: 1 / 60, sector: 23, inflowM3h: 50, durH: 1 }]);
    expect(run('directorate', 1, [], 1, undefined, late).w.sectors[23].sumpLevel).toBeCloseTo(sumpStep(6, 0.3, 0, 1, 60), 12);
    // Sector 23 floods during step 1, so step 1 already strands its people.
    const script = quietScript([{ type: 'flood', atH: 0, sector: 23, inflowM3h: 50, durH: 1 }]);
    const { k } = run('directorate', 1, [], 1, (x) => (x.sectors[23].sumpLevel = 0.999), script);
    expect(k.metrics().p05!.value).toBeCloseTo(PEOPLE * H, 9);
  });

  it('writes only the sub-fields it owns', () => {
    const w = livableWorld();
    setPower(w, 1, [22]);
    for (const v of Object.values(w.alloc)) if (Object.keys(v).length === 0) v.s00 = 1;
    w.sectors[23].sumpLevel = 0.999;
    const before = structuredClone(w);
    const script = quietScript([{ type: 'flood', atH: 0, sector: 23, inflowM3h: 50, durH: 1 }]);
    createKernel(w, [createP05('stratum', script)], { check: true }).step();
    const paths = changedPaths(before, w).filter((p) => p !== 't');
    expect(paths.some((p) => p.endsWith('.passable'))).toBe(true);
    for (const p of paths) expect(p).toMatch(/^(alloc\.pumps\.s\d\d|sectors\.\d+\.sumpLevel|tunnels\.edges\.\d+\.passable)$/);
  });

  // @spec ADAPT-LIVABLE-009
  it('counts stranded person-hours: no path to the hub, everyone when the hub floods', () => {
    expect(createP05('directorate', quietScript()).metric(livableWorld()))
      .toEqual({ name: 'stranded person-hours', value: 0, unit: 'person-h', label: 'SIMULATED' });
    const s22 = run('directorate', 1, [], 2, (w) => (w.sectors[22].sumpLevel = 1));
    expect(s22.k.metrics().p05!.value).toBeCloseTo(2 * 2 * PEOPLE * H, 9); // 22 and 23
    const hub = run('directorate', 1, [], 1, (w) => (w.sectors[HUB].sumpLevel = 1));
    expect(hub.k.metrics().p05!.value).toBeCloseTo(24 * PEOPLE * H, 9);
    expect(run('stratum', 1).k.metrics().p05!.value).toBe(0);
  });

  // @spec ADAPT-LIVABLE-010
  it('STRATUM: no critical sector gets less than its full pumps while the pool covers the floors', () => {
    const lost = strandedIfLost(livableWorld().tunnels.edges, Array(24).fill(false), Array(24).fill(PEOPLE), HUB);
    const critical = ids.filter((_, s) => lost[s] > 0);
    expect(critical).toEqual(['s00', 's08', 's12', 's13', 's14', 's16', 's17', 's18', 's20', 's21', 's22']);
    for (const frac of [1, 0.6, 11.5 / 24]) {
      const a = run('stratum', frac).w.alloc.pumps;
      for (const id of critical) expect(a[id]).toBeGreaterThanOrEqual(D - 1e-12);
    }
  });

  // @spec ADAPT-LIVABLE-008, ADAPT-LIVABLE-009
  it('seven-day script: the Directorate strands sectors 22 and 23 after the hour-100 cut, STRATUM does not', () => {
    // Stand-in for p02 from hour 100 to 115: the Directorate cuts level 6 to 0, STRATUM holds it at its life floor.
    const shed = (policy: Policy): Adapter => ({
      id: 'p02', reads: ['alloc'], writes: ['alloc'], metric: () => ({ name: 'x', value: 0, unit: 'x', label: 'SIMULATED' }),
      step: (w) => {
        const cut = w.t >= 100 * 3600 && w.t < 115 * 3600 ? [20, 21, 22, 23] : [];
        setPower(w, 1, cut);
        if (policy === 'stratum') for (const s of cut) w.alloc.power[sectorId(s)] = lifeFloor(w.sectors[s].people);
      },
    });
    const result = (policy: Policy) => {
      const w = livableWorld();
      const k = createKernel(w, [shed(policy), createP03(policy, sevenDay), createP05(policy, sevenDay)], { check: true });
      k.run(7 * 86400);
      return k.metrics();
    };
    const d = result('directorate'), s = result('stratum');
    expect(d.p05!.value).toBeGreaterThan(2 * PEOPLE);
    expect(s.p05!.value).toBe(0);
    expect(Number.isFinite(d.p03!.value) && Number.isFinite(s.p03!.value)).toBe(true);
  }, 60_000); // two checked week-long runs
});
