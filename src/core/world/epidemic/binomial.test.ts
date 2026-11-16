import { describe, expect, it } from 'vitest';
import { rng } from '../../rng.ts';
import { binomial } from './binomial.ts';

const counting = () => {
  const r = Object.assign(() => (r.calls++, 0.5), { calls: 0 });
  return r;
};

describe('binomial', () => {
  // @spec WORLD-EPI-006
  it('WORLD-EPI-006 inverts the CDF from exactly one draw', () => {
    for (const [n, p] of [[0, 0.3], [10, 0], [10, 1], [10, 0.3], [10, 0.8]]) {
      const r = counting();
      binomial(n, p, r);
      expect(r.calls).toBe(1);
    }
    expect(binomial(10, 0, () => 0.999)).toBe(0);
    expect(binomial(10, 1, () => 0)).toBe(10);
    // Bin(2, 0.5): CDF 0.25, 0.75, 1
    expect(binomial(2, 0.5, () => 0)).toBe(0);
    expect(binomial(2, 0.5, () => 0.25)).toBe(1);
    expect(binomial(2, 0.5, () => 0.74)).toBe(1);
    expect(binomial(2, 0.5, () => 0.75)).toBe(2);
    // the rounded CDF of Bin(10, 0.3) sums to 0.9999999999999997, at or below this u, so n is returned
    expect(binomial(10, 0.3, () => 1 - 2 ** -53)).toBe(10);
    // p > 0.5 mirrors p < 0.5 with the same u
    expect(binomial(7, 0.9, () => 0.3)).toBe(7 - binomial(7, 0.1, () => 0.3));
  });

  // @spec WORLD-EPI-006
  it('WORLD-EPI-006 matches the binomial mean and variance', () => {
    for (const p of [0.3, 0.8]) {
      const r = rng(1, 'test');
      const xs = Array.from({ length: 100_000 }, () => binomial(50, p, r));
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
      expect(Math.abs(mean - 50 * p)).toBeLessThan(0.05);
      expect(Math.abs(v / (50 * p * (1 - p)) - 1)).toBeLessThan(0.02);
    }
  });

  // @spec WORLD-EPI-008
  it('WORLD-EPI-008 rejects p outside [0, 1] and a bad n', () => {
    const r = rng(1, 'test');
    for (const p of [-0.1, 1.1, NaN]) expect(() => binomial(5, p, r)).toThrow(RangeError);
    for (const n of [-1, 1.5, Infinity]) expect(() => binomial(n, 0.5, r)).toThrow(RangeError);
  });
});
