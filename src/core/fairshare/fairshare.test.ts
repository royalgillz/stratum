import { describe, expect, it } from 'vitest';
import { rng } from '../rng.ts';
import type { Claim } from '../contracts.ts';
import { allocate, fairShare, nextDebt, rotate } from './fairshare.ts';

const c = (id: string, floor: number, demand: number, debt = 0): Claim => ({ id, floor, demand, debt });
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe('fairshare', () => {
  // @spec FAIR-001
  it('FAIR-001 water-fills above floors', () => {
    const r = allocate(10, [c('a', 1, 2), c('b', 1, 10), c('c', 1, 10)]);
    expect(r.shares.a).toBeCloseTo(2, 12);
    expect(r.shares.b).toBeCloseTo(4, 12);
    expect(r.shares.c).toBeCloseTo(4, 12);
    expect(r.lambda).toBeCloseTo(4, 12);
    // a floor above the water level is kept
    const r2 = allocate(10, [c('a', 6, 10), c('b', 0, 10), c('c', 0, 10)]);
    expect(r2.shares.a).toBeCloseTo(6, 12);
    expect(r2.shares.b).toBeCloseTo(2, 12);
    expect(r2.breach).toBeNull();
  });

  // @spec FAIR-002
  it('FAIR-002 states a floor breach and scales floors', () => {
    const r = allocate(3, [c('a', 2, 5), c('b', 4, 5), c('z', 0, 5)]);
    expect(r.shares.a).toBeCloseTo(1, 12);
    expect(r.shares.b).toBeCloseTo(2, 12);
    expect(r.shares.z).toBe(0);
    expect(r.breach).toEqual({ shortfall: 3, ids: ['a', 'b'] });
    expect(allocate(6, [c('a', 2, 5), c('b', 4, 5)]).breach).toBeNull();
  });

  // @spec FAIR-003
  it('FAIR-003 returns surplus when supply exceeds demand', () => {
    const r = allocate(20, [c('a', 1, 3), c('b', 1, 4)]);
    expect(r.shares).toEqual({ a: 3, b: 4 });
    expect(r.surplus).toBe(13);
    expect(r.lambda).toBeNull();
  });

  // @spec FAIR-004
  it('FAIR-004 rejects invalid input', () => {
    expect(() => allocate(-1, [])).toThrow(RangeError);
    expect(() => allocate(NaN, [])).toThrow(RangeError);
    expect(() => allocate(1, [c('a', -1, 2)])).toThrow(RangeError);
    expect(() => allocate(1, [c('a', 0, Infinity)])).toThrow(RangeError);
    expect(() => allocate(1, [c('a', 0, 1, -1)])).toThrow(RangeError);
    expect(() => allocate(1, [c('a', 0, 1), c('a', 0, 1)])).toThrow(RangeError);
    const r = rng(1, 'fairshare');
    expect(() => rotate(1.5, [c('a', 0, 1)], r)).toThrow(RangeError);
    expect(() => rotate(2, [c('a', 0, 1.5)], r)).toThrow(RangeError);
    expect(() => rotate(2, [c('a', 0, 1), c('a', 0, 1)], r)).toThrow(RangeError);
  });

  // @spec FAIR-005
  it('FAIR-005 raises demand below floor and reports it', () => {
    const r = allocate(10, [c('a', 3, 1), c('b', 0, 10)]);
    expect(r.adjusted).toEqual(['a']);
    expect(r.shares.a).toBeCloseTo(3, 12);
    expect(r.shares.b).toBeCloseTo(7, 12);
  });

  // @spec FAIR-006
  it('FAIR-006 handles empty claims and zero supply', () => {
    expect(allocate(5, [])).toMatchObject({ shares: {}, surplus: 5, breach: null, lambda: null });
    const z = allocate(0, [c('a', 1, 2), c('b', 0, 2)]);
    expect(z.shares).toEqual({ a: 0, b: 0 });
    expect(z.breach).toEqual({ shortfall: 1, ids: ['a'] });
    expect(allocate(0, [c('a', 0, 2)]).breach).toBeNull();
  });

  // @spec FAIR-007
  it('FAIR-007 is order independent, equal for ties and random-free', () => {
    const cs = [c('a', 1, 9), c('b', 1, 9), c('c', 2, 9), c('d', 0, 1)];
    const orig = Math.random;
    Math.random = () => { throw new Error('no randomness'); };
    try {
      const x = allocate(11, cs);
      const y = allocate(11, [...cs].reverse());
      expect(y.shares).toEqual(x.shares);
      expect(x.shares.a).toBe(x.shares.b);
    } finally {
      Math.random = orig;
    }
  });

  // @spec FAIR-008
  it('FAIR-008 conserves supply and bounds shares', () => {
    const r = rng(7, 'fairshare-test');
    for (let n = 0; n < 200; n++) {
      const cs = Array.from({ length: 1 + Math.floor(r() * 8) }, (_, i) => {
        const f = r() * 5;
        return c(`k${i}`, f, f + r() * 10);
      });
      const S = r() * 60;
      const out = allocate(S, cs);
      expect(sum(out.shares) + out.surplus).toBeCloseTo(S, 8);
      expect(Math.abs(sum(out.shares) + out.surplus - S)).toBeLessThanOrEqual(1e-9 * Math.max(1, S));
      for (const k of cs) {
        expect(out.shares[k.id]).toBeGreaterThanOrEqual(0);
        expect(out.shares[k.id]).toBeLessThanOrEqual(k.demand + 1e-12);
      }
    }
  });

  // @spec FAIR-009
  it('FAIR-009 draws whole-demand winners by id order and weight', () => {
    // one rng draw of 0 picks the first id; weights 1+debt
    const first = rotate(1, [c('b', 0, 1), c('a', 0, 1)], () => 0);
    expect(first.winners).toEqual(['a']);
    expect(first.shares).toEqual({ a: 1, b: 0 });
    expect(first.unitsLeft).toBe(0);
    // weights a=1, b=4 (debt 3): r=0.19 -> a (19% of 5 < 1? 0.95<1), r=0.21 -> b
    const lo = rotate(1, [c('a', 0, 1), c('b', 0, 1, 3)], () => 0.19);
    const hi = rotate(1, [c('a', 0, 1), c('b', 0, 1, 3)], () => 0.21);
    expect(lo.winners).toEqual(['a']);
    expect(hi.winners).toEqual(['b']);
    // only claims that fit are drawn; demand 0 never wins; claims are all-or-nothing
    const fit = rotate(3, [c('a', 0, 2), c('b', 0, 2), c('c', 0, 1), c('z', 0, 0)], () => 0);
    expect(fit.winners).toEqual(['a', 'c']);
    expect(fit.shares).toEqual({ a: 2, b: 0, c: 1, z: 0 });
    expect(fit.unitsLeft).toBe(0);
    // floors first: floors are paid, then remaining demand (d - f) is won whole
    const fl = rotate(6, [c('a', 1, 3), c('b', 1, 3), c('c', 2, 2)], () => 0);
    expect(fl.shares).toEqual({ a: 3, b: 1, c: 2 });
    expect(fl.winners).toEqual(['a']);
    expect(fl.unitsLeft).toBe(0);
  });

  it('FAIR-009 never pays a claim below its floor when units cover all floors', () => {
    for (let seed = 0; seed < 300; seed++) {
      const r = rng(seed, 'fairshare-floors');
      const cs = Array.from({ length: 1 + Math.floor(r() * 9) }, (_, i) => {
        const f = Math.floor(r() * 4);
        return c(`k${i}`, f, f + Math.floor(r() * 5), Math.floor(r() * 6));
      });
      const sf = cs.reduce((a, k) => a + k.floor, 0);
      const units = sf + Math.floor(r() * 20);
      const out = rotate(units, cs, rng(seed, 'fairshare'));
      expect(out.breach).toBeNull();
      expect(out.unitsLeft).toBeGreaterThanOrEqual(0);
      for (const k of cs) {
        expect(out.shares[k.id]).toBeGreaterThanOrEqual(k.floor);
        expect(out.shares[k.id]).toBeLessThanOrEqual(k.demand);
      }
      expect(sum(out.shares) + out.unitsLeft).toBe(units);
    }
  });

  // @spec FAIR-010
  it('FAIR-010 uses only the given Rng and ignores claim order', () => {
    const cs = Array.from({ length: 12 }, (_, i) => c(`f${i}`, 0, 1 + (i % 3), i % 4));
    const orig = Math.random;
    Math.random = () => { throw new Error('no randomness'); };
    try {
      const a = rotate(9, cs, rng(5, 'fairshare'));
      const b = rotate(9, [...cs].reverse(), rng(5, 'fairshare'));
      expect(b).toEqual(a);
      let calls = 0;
      rotate(0, cs, () => { calls++; return 0; });
      expect(calls).toBe(0);
    } finally {
      Math.random = orig;
    }
  });

  // @spec FAIR-011
  it('FAIR-011 states a breach when units cannot cover floors', () => {
    const r = rotate(2, [c('a', 1, 1), c('b', 1, 1), c('c', 1, 1), c('d', 0, 1)], () => 0);
    expect(r.breach?.shortfall).toBe(1);
    expect(r.winners).toEqual(['a', 'b']);
    expect(r.breach?.ids).toEqual(['c']);
    // whole floors only: demand above floor is not paid, and the floor-0 claim gets 0
    expect(r.shares).toEqual({ a: 1, b: 1, c: 0, d: 0 });
    // a floor too big for the units left is skipped, a smaller later one still fits
    const sk = rotate(3, [c('a', 2, 2), c('b', 2, 2), c('c', 1, 1)], () => 0);
    expect(sk.shares).toEqual({ a: 2, b: 0, c: 1 });
    expect(sk.breach).toEqual({ shortfall: 2, ids: ['b'] });
    const none = rotate(3, [c('a', 1, 1), c('b', 1, 1)], () => 0);
    expect(none.breach).toBeNull();
  });

  // @spec FAIR-012
  it('FAIR-012 updates debt and fairShare wraps allocate', () => {
    const cs = [c('a', 0, 3, 2), c('b', 0, 3, 2), c('c', 0, 3, 0)];
    expect(nextDebt(cs, { a: 3, b: 0, c: 1 })).toEqual({ a: 0, b: 5, c: 2 });
    const set = [c('a', 1, 4), c('b', 1, 9)];
    expect(fairShare(8, set)).toEqual(allocate(8, set).shares);
  });
});
