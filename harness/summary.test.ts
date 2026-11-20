import { describe, expect, it } from 'vitest';
import { finals, interval, paired, summarise, t95 } from './summary.ts';

describe('harness summary', () => {
  it('gives the 95% interval of the mean from the t distribution', () => {
    // By hand: mean 3, sample sd sqrt(2.5), se sqrt(2.5)/sqrt(5) = 0.707107, t(4) = 2.7764, half width 1.963216.
    const r = interval([1, 2, 3, 4, 5]);
    expect(r.mean).toBe(3);
    expect(r.lo).toBeCloseTo(1.036784, 5);
    expect(r.hi).toBeCloseTo(4.963216, 5);
  });

  it('collapses the interval to the mean with one seed', () => {
    expect(interval([7])).toEqual({ mean: 7, lo: 7, hi: 7 });
  });

  it('has the tabled t quantiles, including df 19 that the default 20-seed run uses', () => {
    expect(t95(1)).toBe(12.7062);
    expect(t95(2)).toBe(4.3027);
    expect(t95(5)).toBe(2.5706);
    expect(t95(19)).toBe(2.093);
    expect(t95(20)).toBe(2.086);
  });

  it('continues the t table smoothly past df 30', () => {
    expect(t95(30)).toBe(2.0423);
    expect(t95(40)).toBeCloseTo(2.0211, 3);
    expect(t95(120)).toBeCloseTo(1.9799, 3);
  });

  it('takes the last sample of each seed and the mean across seeds at each sample time', () => {
    const s = (value: number[]) => ({ p01: { name: 'cut', unit: 'share', label: 'SIMULATED' as const, t: [0, 3600], value } });
    const out = summarise([s([0, 2]), s([2, 4])]);
    expect(out.p01!.final.values).toEqual([2, 4]);
    expect(out.p01!.final.mean).toBe(3);
    expect(out.p01!.hourly).toEqual({ t: [0, 3600], mean: [1, 3] });
    expect(out.p01!.label).toBe('SIMULATED');
  });

  it('summarises beside figures per key across seeds, and adds none without them', () => {
    const s = { p15: { name: 'wait', unit: 'days', label: 'SIMULATED' as const, t: [0], value: [3] } };
    const f = (value: number) => ({ p15: { level1: { name: 'level 1 mean wait', unit: 'days', value } } });
    const out = summarise([s, s], [f(1), f(3)]);
    expect(out.p15!.beside).toEqual({ level1: { name: 'level 1 mean wait', unit: 'days', mean: 2, lo: expect.any(Number), hi: expect.any(Number), values: [1, 3] } });
    expect(summarise([s, s]).p15!.beside).toBeUndefined();
  });

  it('pairs two conditions by seed and keeps only the final values in finals', () => {
    // Differences [1, 2, 3]: mean 2, sd 1, half width t(2) / sqrt(3) = 2.484138.
    const r = paired([2, 4, 6], [1, 2, 3]);
    expect(r.mean).toBe(2);
    expect(r.hi - r.mean).toBeCloseTo(4.3027 / Math.sqrt(3), 6);
    expect(() => paired([1], [1, 2])).toThrow(RangeError);
    const s = (value: number[]) => ({ p01: { name: 'cut', unit: 'share', label: 'SIMULATED' as const, t: [0, 3600], value } });
    expect(finals([s([0, 2]), s([2, 4])])).toEqual({ p01: { name: 'cut', unit: 'share', label: 'SIMULATED', final: { mean: 3, lo: expect.any(Number), hi: expect.any(Number), values: [2, 4] } } });
  });
});
