import { describe, expect, it } from 'vitest';
import type { SurfaceReading } from '../contracts.ts';
import { chapman } from './chapman.ts';
import { quorum } from './quorum.ts';

describe('chapman', () => {
  // @spec WIT-011
  it('returns the Chapman estimate and its interval', () => {
    const r = chapman(100, 80, 40);
    expect(r.n).toBeCloseTo((101 * 81) / 41 - 1, 9);
    const v = (101 * 81 * 60 * 40) / (41 * 41 * 42);
    expect(r.hi).toBeCloseTo(r.n + 1.96 * Math.sqrt(v), 9);
    expect(r.lo).toBeCloseTo(r.n - 1.96 * Math.sqrt(v), 9);
  });

  // @spec WIT-011
  it('raises the lower end to the number of distinct cases seen, and handles full overlap', () => {
    expect(chapman(10, 10, 0).lo).toBe(20);
    expect(chapman(7, 7, 7)).toEqual({ n: 7, lo: 7, hi: 7 });
  });

  // @spec WIT-011
  it('throws RangeError for inputs that cannot occur', () => {
    for (const a of [[-1, 5, 0], [5, 5, 6], [5, 3, 4], [1.5, 2, 1], [5, 5, NaN], [5, 5, -1]] as const) {
      expect(() => chapman(a[0], a[1], a[2])).toThrow(RangeError);
    }
  });
});

const rd = (crew: string, ppm: number, t: number, gas = 'CO'): SurfaceReading => ({ crew, gas, ppm, t });

describe('quorum', () => {
  // @spec WIT-012
  it('returns the median and agreeing count when 3 crews are within 25%', () => {
    expect(quorum([rd('a', 100, 1), rd('b', 110, 1), rd('c', 90, 1), rd('d', 400, 1)], 'CO')).toEqual({ value: 110, agreeing: 3 });
  });

  // @spec WIT-012
  it('uses each crew once, at its latest reading, and only the named gas', () => {
    const rs = [rd('a', 500, 1), rd('a', 100, 5), rd('a', 900, 5), rd('b', 100, 2), rd('c', 100, 2), rd('c', 1, 1), rd('z', 100, 2, 'O3')];
    // a: 900 (tie on t, later wins), b 100, c 100 -> median 100, only b and c agree
    expect(quorum(rs, 'CO')).toBeNull();
    expect(quorum([rd('a', 100, 9), rd('a', 100, 8), rd('b', 100, 1)], 'CO')).toBeNull(); // two crews
  });

  // @spec WIT-012
  it('takes the upper middle value as the median of an even count, a zero median needs exact zeros, and 25% is inclusive', () => {
    expect(quorum([rd('a', 100, 1), rd('b', 100, 1), rd('c', 120, 1), rd('d', 200, 1)], 'CO')).toEqual({ value: 120, agreeing: 3 });
    expect(quorum([rd('a', 0, 1), rd('b', 0, 1), rd('c', 0, 1), rd('d', 0.1, 1), rd('e', 5, 1)], 'CO')).toEqual({ value: 0, agreeing: 3 });
    expect(quorum([rd('a', 100, 1), rd('b', 125, 1), rd('c', 75, 1)], 'CO')).toEqual({ value: 100, agreeing: 3 });
    expect(quorum([], 'CO')).toBeNull();
  });
});
