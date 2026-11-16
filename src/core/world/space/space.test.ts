import { describe, expect, it } from 'vitest';
import { PEOPLE, SLEEP_M2 } from '../../scenario/world.ts';
import { AREA_M2, fill, idleM2, SHIFTS, shiftSleepers, sleepM2, SPHERE_M2 } from './space.ts';

describe('space model', () => {
  it('pins its constants to docs/params.md', () => {
    expect({ AREA_M2, SPHERE_M2, SHIFTS }).toEqual({ AREA_M2: 1000, SPHERE_M2: 3.5, SHIFTS: 3 });
  });

  // @spec WORLD-SPACE-001
  it('WORLD-SPACE-001 sleeping floor per sleeper, the whole area with nobody asleep', () => {
    expect(AREA_M2).toBe(SLEEP_M2 * PEOPLE);
    expect(sleepM2(1000, 500)).toBe(2);
    expect(sleepM2(1000, 160)).toBe(6.25);
    expect(sleepM2(1000, 0)).toBe(1000);
  });

  // @spec WORLD-SPACE-002
  it('WORLD-SPACE-002 sums weighted members per shift', () => {
    expect(shiftSleepers([2, 3, 4, 5], [0, 2, 0, 1], 10)).toEqual([60, 50, 30]);
    expect(shiftSleepers([], [], 10)).toEqual([0, 0, 0]);
    expect(shiftSleepers([4], [1], 0)).toEqual([0, 0, 0]);
  });

  // @spec WORLD-SPACE-003
  it('WORLD-SPACE-003 fills shifts 1 and 2 by lowest load, lower index on a tie, without touching its inputs', () => {
    const sizes = [5, 3, 2, 4, 6];
    const loads = [0, 0, 0];
    // 5 > 1 (tie); 3 > 2; 2 > 2 (3 < 5); 4 > 1 (5 = 5, tie to 1); 6 > 2 (9 > 5)
    expect(fill(sizes, loads)).toEqual([1, 2, 2, 1, 2]);
    expect(sizes).toEqual([5, 3, 2, 4, 6]);
    expect(loads).toEqual([0, 0, 0]);
    expect(fill([1, 1], [0, 7, 2])).toEqual([2, 2]); // shift 0 is never chosen, even with the lowest load
    expect(fill([], [0, 0, 0])).toEqual([]);
  });

  // @spec WORLD-SPACE-004
  it('WORLD-SPACE-004 idle assigned floor is the share of people awake', () => {
    expect(idleM2(1000, 500, 100)).toBe(800);
    expect(idleM2(1000, 500, 500)).toBe(0);
    expect(idleM2(1000, 500, 0)).toBe(1000);
    expect(idleM2(1000, 0, 0)).toBe(1000);
  });

  // @spec WORLD-SPACE-005
  it('WORLD-SPACE-005 throws a RangeError for bad inputs', () => {
    const bad = [-1, NaN, Infinity];
    for (const x of bad) {
      expect(() => sleepM2(x, 1)).toThrow(RangeError);
      expect(() => sleepM2(1, x)).toThrow(RangeError);
      expect(() => idleM2(x, 1, 0)).toThrow(RangeError);
      expect(() => idleM2(1, x, 0)).toThrow(RangeError);
      expect(() => idleM2(1, 1, x)).toThrow(RangeError);
      expect(() => shiftSleepers([2], [0], x)).toThrow(RangeError);
      expect(() => shiftSleepers([x], [0], 1)).toThrow(RangeError);
      expect(() => fill([x], [0, 0, 0])).toThrow(RangeError);
      expect(() => fill([1], [0, x, 0])).toThrow(RangeError);
    }
    expect(() => idleM2(1000, 10, 11)).toThrow(RangeError);
    expect(() => shiftSleepers([2, 3], [0], 1)).toThrow(RangeError);
    for (const k of [-1, 3, 0.5, NaN]) expect(() => shiftSleepers([2], [k], 1)).toThrow(RangeError);
    expect(() => fill([1], [0, 0])).toThrow(RangeError);
    expect(() => fill([1], [0, 0, 0, 0])).toThrow(RangeError);
  });
});
