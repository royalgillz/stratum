import { describe, expect, it } from 'vitest';
import { bySector, lastOf, lifeFloor, powerDemand, sectorId } from './shared.ts';

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
});
