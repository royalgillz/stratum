import { describe, expect, it } from 'vitest';
import { rng } from './rng.ts';

const draw = (r: () => number, n: number) => Array.from({ length: n }, r);

describe('rng', () => {
  it('replays the same sequence for the same seed and stream', () => {
    expect(draw(rng(42, 'grid'), 100)).toEqual(draw(rng(42, 'grid'), 100));
  });

  it('gives different sequences for different streams and different seeds', () => {
    const a = draw(rng(42, 'grid'), 10);
    expect(draw(rng(42, 'water'), 10)).not.toEqual(a);
    expect(draw(rng(43, 'grid'), 10)).not.toEqual(a);
  });

  it('stays in [0, 1) with a mean near 0.5', () => {
    const xs = draw(rng(7, 'any'), 100_000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(Math.abs(xs.reduce((s, x) => s + x, 0) / xs.length - 0.5)).toBeLessThan(0.01);
  });
});
