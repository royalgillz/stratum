import { describe, expect, it } from 'vitest';
import type { Claim, Household, World } from '../contracts.ts';
import { nextDebt, rotate } from '../fairshare/fairshare.ts';
import { createKernel } from '../kernel/kernel.ts';
import { rng } from '../rng.ts';
import type { ScenarioEvent } from '../scenario/types.ts';
import { AREA_M2, fill, idleM2, shiftSleepers } from '../world/space/space.ts';
import { changedPaths, livableWorld, quietScript } from './livable.fixture.ts';
import { census, createP06 } from './p06.ts';
import type { Policy } from './shared.ts';

const H = 3600, DAY = 86400;
const hh = (id: string, s: number, members: number, shift = 0): Household => ({ id, members, level: Math.floor(s / 4) + 1, sector: s, shift });
// sector 0: five households (20 members); sector 5: two; sector 9: one; the rest untracked
const homes = () => [hh('a', 0, 2, 0), hh('b', 0, 6, 1), hh('x', 5, 3, 2), hh('c', 0, 4, 2), hh('d', 0, 5, 0), hh('y', 5, 4, 0), hh('e', 0, 3, 1), hh('z', 9, 2, 1)];

function world(o: { t?: number; seed?: number } = {}): World {
  const w = livableWorld(o.seed ?? 1);
  w.t = o.t ?? 0;
  w.households = homes();
  return w;
}
const p06 = (w: World, policy: Policy, events: ScenarioEvent[] = []) => createKernel(w, [createP06(policy, quietScript(events))], { check: true });

/** STRATUM's daily rotation replayed from p06's stream: shifts per household id, and the debts after it. */
function replay(seed: number, days: number) {
  const r = rng(seed, 'p06');
  const debt = new Map<string, number>();
  const shift = new Map<string, number>();
  for (let d = 0; d < days; d++) {
    for (let s = 0; s < 24; s++) {
      const hs = homes().filter((h) => h.sector === s);
      if (!hs.length) continue;
      const claims: Claim[] = hs.map((h) => ({ id: h.id, floor: 0, demand: h.members, debt: debt.get(h.id) ?? 0 }));
      const rot = rotate(Math.floor(hs.reduce((a, h) => a + h.members, 0) / 3), claims, r);
      const rest = hs.filter((h) => !rot.winners.includes(h.id));
      const placed = fill(rest.map((h) => h.members), [0, 0, 0]);
      for (const h of hs) shift.set(h.id, rot.winners.includes(h.id) ? 0 : placed[rest.indexOf(h)]!);
      for (const [id, x] of Object.entries(nextDebt(claims, rot.shares))) debt.set(id, x);
    }
  }
  return { shift, debt };
}

describe('p06 sleeping space', () => {
  // @spec ADAPT-SPACECARE-010
  it('ADAPT-SPACECARE-010 declares its reads and writes', () => {
    const a = createP06('stratum', quietScript());
    expect(a.id).toBe('p06');
    expect([...a.reads]).toEqual(['sectors', 'households']);
    expect([...a.writes]).toEqual(['sectors', 'households']);
  });

  // @spec ADAPT-SPACECARE-001
  it('ADAPT-SPACECARE-001 Directorate: one room per household, AREA_M2 / people at 00:00, shifts untouched', () => {
    const w = world();
    w.sectors[3]!.people = 400;
    const before = structuredClone(w);
    const k = p06(w, 'directorate');
    k.step();
    expect(w.sectors.map((x) => x.sleepM2)).toEqual(w.sectors.map((x) => AREA_M2 / x.people));
    expect(w.sectors[3]!.sleepM2).toBe(2.5);
    expect(changedPaths(before, w).filter((p) => p !== 't' && !/^sectors\.\d+\.sleepM2$/.test(p))).toEqual([]);
    // between midnights nothing is written
    w.sectors[0]!.sleepM2 = 9;
    k.run(DAY - 60);
    expect(w.sectors[0]!.sleepM2).toBe(9);
    k.step(); // the step at t = 86400
    expect(w.sectors[0]!.sleepM2).toBe(2);
  });

  // @spec ADAPT-SPACECARE-001
  it('ADAPT-SPACECARE-001 does nothing in a first step that is not at 00:00', () => {
    const w = world({ t: 3 * H });
    const before = structuredClone(w);
    p06(w, 'stratum').step();
    expect(changedPaths(before, w)).toEqual(['t']);
  });

  // @spec ADAPT-SPACECARE-001, ADAPT-SPACECARE-002
  it('ADAPT-SPACECARE-002 STRATUM: the night by rotate with debt, the rest by fill, households whole, only shift changes', () => {
    for (const seed of [1, 2, 3, 4]) {
      const w = world({ seed });
      const before = structuredClone(w);
      const k = p06(w, 'stratum');
      k.step();
      const { shift } = replay(seed, 1);
      expect(w.households.map((h) => h.shift)).toEqual(w.households.map((h) => shift.get(h.id)));
      expect(changedPaths(before, w).filter((p) => p !== 't' && !/^sectors\.\d+\.sleepM2$/.test(p) && !/^households\.\d+\.shift$/.test(p))).toEqual([]);
      // sector 0: 20 members, so at most 6 on the night shift, whole households only
      const night = w.households.filter((h) => h.sector === 0 && h.shift === 0).reduce((a, h) => a + h.members, 0);
      expect(night).toBeGreaterThan(0);
      expect(night).toBeLessThanOrEqual(6);
      for (const s of [0, 5, 9]) {
        const hs = w.households.filter((h) => h.sector === s);
        const m = Math.max(...shiftSleepers(hs.map((h) => h.members), hs.map((h) => h.shift), 500 / hs.reduce((a, h) => a + h.members, 0)));
        expect(w.sectors[s]!.sleepM2).toBeCloseTo(AREA_M2 / m, 12);
      }
      expect(w.sectors[9]!.sleepM2).toBe(2); // one household of 2: none on the night, all on shift 1
      expect(w.sectors[1]!.sleepM2).toBe(2); // no tracked households
      // the next day the debts carry: replayed over two days
      k.run(DAY);
      const two = replay(seed, 2).shift;
      expect(w.households.map((h) => h.shift)).toEqual(w.households.map((h) => two.get(h.id)));
    }
  });

  // @spec ADAPT-SPACECARE-002
  it('ADAPT-SPACECARE-002 debt rotates the night: over two weeks every household of sector 0 gets it', () => {
    const w = world({ seed: 9 });
    const k = p06(w, 'stratum', [{ type: 'care', atH: 0, durH: 24, red: 1, amber: 1 }, { type: 'farm-cut', atH: 0, level: 6, durH: 48 }]);
    const nights = new Map<string, number>();
    for (let d = 0; d < 14; d++) {
      k.step();
      for (const h of w.households) if (h.sector === 0 && h.shift === 0) nights.set(h.id, (nights.get(h.id) ?? 0) + 1);
      k.run(DAY - 60);
    }
    expect([...nights.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  // @spec ADAPT-SPACECARE-003
  it('ADAPT-SPACECARE-003 scores the person-weighted mean sleeping m2 without changing the world', () => {
    const w = world();
    w.sectors[0]!.people = 1000;
    const k = p06(w, 'directorate');
    k.step();
    const before = structuredClone(w);
    expect(k.metrics().p06).toEqual({ name: 'sleeping m2 per sleeper (busiest shift)', value: (1000 * 1 + 23 * 500 * 2) / 12500, unit: 'm2', label: 'SIMULATED' });
    expect(w).toEqual(before);
    const s = world();
    const ks = p06(s, 'stratum');
    ks.step();
    expect(ks.metrics().p06!.value).toBeCloseTo(s.sectors.reduce((a, x) => a + x.sleepM2, 0) / 24, 12);
    expect(ks.metrics().p06!.value).toBeGreaterThan(2);
  });

  // @spec ADAPT-SPACECARE-004
  it('ADAPT-SPACECARE-004 census: asleep, idle floor and sharing per sector and shift, world unchanged', () => {
    const w = world();
    const before = structuredClone(w);
    for (const policy of ['directorate', 'stratum'] as const) {
      const c = census(w, policy);
      expect(c).toHaveLength(72);
      expect(c.map((x) => [x.sector, x.shift])).toEqual(Array.from({ length: 72 }, (_, i) => [Math.floor(i / 3), i % 3]));
      // sector 0 shifts as written: 0 holds a and d (7), 1 holds b and e (9), 2 holds c (4), 25 people per member
      expect(c.slice(0, 3).map((x) => x.asleep)).toEqual([175, 225, 100]);
      expect(c[2]).toEqual({ sector: 0, shift: 2, asleep: 100, idleM2: idleM2(AREA_M2, 500, 100), sharing: policy === 'directorate' ? 1 : 3 });
      expect(c[15]!.sharing).toBe(policy === 'directorate' ? 1 : 2); // sector 5: households on shifts 0 and 2
      expect(c[27]!.sharing).toBe(1); // sector 9: one household on shift 1
      expect(c[3]).toEqual({ sector: 1, shift: 0, asleep: 0, idleM2: AREA_M2, sharing: policy === 'directorate' ? 1 : 0 });
    }
    expect(w).toEqual(before);
  });

  // @spec ADAPT-SPACECARE-004
  it('ADAPT-SPACECARE-004 census never reports more asleep than people', () => {
    const w = livableWorld();
    w.households = [hh('q', 3, 15, 0)]; // 500 / 15 x 15 rounds to 500.00000000000006
    expect(census(w, 'stratum')[9]).toEqual({ sector: 3, shift: 0, asleep: 500, idleM2: 0, sharing: 1 });
  });

  it('runs checked under both policies, and STRATUM gives more sleeping floor per sleeper', () => {
    const run = (policy: Policy) => {
      const w = world({ seed: 4 });
      const k = p06(w, policy, [{ type: 'care', atH: 24, durH: 144, red: 6, amber: 12 }, { type: 'network-down', atH: 0, durH: 168 }]);
      k.run(3 * DAY);
      return k.metrics().p06!.value;
    };
    expect(run('directorate')).toBe(2);
    expect(run('stratum')).toBeGreaterThan(2);
  });
});
