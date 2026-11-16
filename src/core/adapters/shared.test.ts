import { describe, expect, it } from 'vitest';
import { createWorld } from '../scenario/world.ts';
import { sevenDay } from '../scenario/seven-day.ts';
import { bySector, lastOf, lifeFloor, powerDemand, sectorId, weight } from './shared.ts';

describe('adapter shared helpers', () => {
  // @spec ADAPT-POLICY-005
  it('names sector claims s00 to s23 and rejects other indexes', () => {
    expect(sectorId(0)).toBe('s00');
    expect(sectorId(7)).toBe('s07');
    expect(sectorId(23)).toBe('s23');
    expect(() => sectorId(24)).toThrow(RangeError);
    expect(() => sectorId(-1)).toThrow(RangeError);
    expect(() => sectorId(1.5)).toThrow(RangeError);
  });

  // @spec ADAPT-POLICY-005
  it('reuses a cached allocation only while every input is the same number', () => {
    const memo = lastOf<number>();
    let made = 0;
    const get = (key: number[]) => memo(key, () => ++made);
    expect([get([1, 2]), get([1, 2]), get([1, 3]), get([1, 3, 0]), get([1, 3]), get([0]), get([-0])]).toEqual([1, 1, 2, 3, 4, 5, 6]);
    expect(bySector([5, 6])).toEqual({ s00: 5, s01: 6 });
    // A key whose make threw is not cached: the next call with it makes again.
    expect(() => memo([9], () => { throw new RangeError('bad'); })).toThrow(RangeError);
    expect(get([9])).toBe(7);
  });

  // @spec ADAPT-POLICY-005
  it('takes power demand at BASE_KW and the life floor at LIFE_KW per person, in MW', () => {
    expect(powerDemand(500)).toBeCloseTo(0.5, 12);
    expect(lifeFloor(500)).toBeCloseTo(0.15, 12);
    expect(powerDemand(0)).toBe(0);
  });

  // @spec ADAPT-POLICY-009
  it('weighs a tracked member of a sector as its people over the tracked members of the sector, 0 with none tracked', () => {
    const w = createWorld(5, sevenDay);
    for (let s = 0; s < 24; s++) {
      const members = w.households.filter((h) => h.sector === s).reduce((n, h) => n + h.members, 0);
      expect(weight(w, s), `sector ${s}`).toBe(w.sectors[s]!.people / members);
    }
    // The demo household counts in its sector (17) like any other.
    expect(w.households.some((h) => h.id === sevenDay.demo.id && h.sector === 17)).toBe(true);
    w.households = w.households.filter((h) => h.sector !== 3);
    expect(weight(w, 3)).toBe(0);
    w.sectors[4]!.people = 0;
    expect(weight(w, 4)).toBe(0);
  });
});
