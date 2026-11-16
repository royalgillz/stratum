import { describe, expect, it } from 'vitest';
import { rng } from '../../rng.ts';
import type { ScenarioEvent } from '../../scenario/types.ts';
import { BASELINE, outlet, tapDelay, unsafe } from './water.ts';

const zero = () => 0; // u1 = 0 gives zero noise
const H = 3600;
const contam = (atH: number, level: number, rampH: number, durH: number, toc = 4): ScenarioEvent => ({
  type: 'contamination', atH, level, rampH, durH, delta: { cond: 60, toc, turb: 1.5, biocide: -1.5 },
});

describe('water', () => {
  // @spec WORLD-WATER-001
  it('WORLD-WATER-001 sums same-level contamination, ignores other levels and types, clamps at 0', () => {
    expect(outlet(3, 0, [], zero)).toEqual(BASELINE);
    const events: ScenarioEvent[] = [
      contam(0, 5, 0, 10),
      contam(0, 5, 0, 10),
      contam(0, 4, 0, 10),
      { type: 'flood', atH: 0, sector: 20, inflowM3h: 15, durH: 10 },
      { type: 'trip', atH: 0, loss: 0.5, durH: 10 },
    ];
    const q = outlet(5, H, events, zero);
    expect(q.cond).toBeCloseTo(150 + 120, 12);
    expect(q.toc).toBeCloseTo(0.5 + 8, 12);
    expect(q.turb).toBeCloseTo(0.2 + 3, 12);
    expect(q.biocide).toBe(0); // 2 - 3 clamped
    expect(outlet(6, H, events, zero)).toEqual(BASELINE);
  });

  // @spec WORLD-WATER-002
  it('WORLD-WATER-002 ramps linearly, holds at 1, then drops to 0', () => {
    const e = [contam(10, 2, 0.5, 2)];
    const toc = (tH: number) => outlet(2, tH * H, e, zero).toc - BASELINE.toc;
    expect(toc(9.99)).toBe(0);
    expect(toc(10)).toBe(0);
    expect(toc(10.25)).toBeCloseTo(2, 12); // w = 0.5
    expect(toc(10.5)).toBeCloseTo(4, 12);
    expect(toc(11.99)).toBeCloseTo(4, 12);
    expect(toc(12)).toBe(0);
    // a zero ramp is a step at a
    const step = [contam(10, 2, 0, 2)];
    expect(outlet(2, 10 * H, step, zero).toc).toBeCloseTo(BASELINE.toc + 4, 12);
    expect(outlet(2, 10 * H - 1, step, zero).toc).toBe(BASELINE.toc);
    // a zero-length event never acts
    expect(outlet(2, 10 * H, [contam(10, 2, 0, 0)], zero)).toEqual(BASELINE);
  });

  // @spec WORLD-WATER-003
  it('WORLD-WATER-003 draws Box-Muller noise, eight draws per call in a fixed order', () => {
    const us = [0.5, 0, 0.5, 0.5, 0.9, 0.25, 0.1, 0];
    let i = 0;
    const seq = () => us[i++];
    const g = (u1: number, u2: number) => Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
    const q = outlet(1, 0, [], seq);
    expect(i).toBe(8);
    expect(q.cond).toBeCloseTo(150 + 0.02 * 150 * g(0.5, 0), 12);
    expect(q.toc).toBeCloseTo(0.5 + 0.02 * 0.5 * g(0.5, 0.5), 12);
    expect(q.turb).toBeCloseTo(0.2 + 0.02 * 0.2 * g(0.9, 0.25), 12);
    expect(q.biocide).toBeCloseTo(2 + 0.02 * 2 * g(0.1, 0), 12);
    // the count never depends on the values, and the same stream gives the same output
    let n = 0;
    const r = rng(7, 'p04');
    const counted = () => (n++, r());
    for (let k = 0; k < 50; k++) outlet(5, k * 600, [contam(0, 5, 0.5, 12)], counted);
    expect(n).toBe(400);
    expect(outlet(5, 100, [], rng(7, 'x'))).toEqual(outlet(5, 100, [], rng(7, 'x')));
  });

  // @spec WORLD-WATER-004
  it('WORLD-WATER-004 tap delay grows by sector', () => {
    expect([0, 1, 2, 3].map(tapDelay)).toEqual([3600, 4800, 6000, 7200]);
  });

  // @spec WORLD-WATER-005
  it('WORLD-WATER-005 unsafe on organic carbon above 3 or iodine below 1', () => {
    expect(unsafe(BASELINE)).toBe(false);
    expect(unsafe({ ...BASELINE, toc: 3 })).toBe(false);
    expect(unsafe({ ...BASELINE, toc: 3.001 })).toBe(true);
    expect(unsafe({ ...BASELINE, biocide: 1 })).toBe(false);
    expect(unsafe({ ...BASELINE, biocide: 0.999 })).toBe(true);
    expect(unsafe({ ...BASELINE, cond: 1e6, turb: 1e6 })).toBe(false);
  });

  // @spec WORLD-WATER-006
  it('WORLD-WATER-006 throws RangeError on bad input', () => {
    for (const level of [0, 7, 2.5, NaN]) expect(() => outlet(level, 0, [], zero)).toThrow(RangeError);
    for (const sector of [-1, 4, 1.5, NaN]) expect(() => tapDelay(sector)).toThrow(RangeError);
    for (const t of [NaN, Infinity, -Infinity]) expect(() => outlet(1, t, [], zero)).toThrow(RangeError);
    const bad: ScenarioEvent[] = [
      contam(0, 1, 0, -1),
      contam(0, 1, -1, 2),
      contam(0, 1, 3, 2),
      contam(0, 1, 0, 2, NaN),
      contam(0, 1, 0, 2, Infinity),
      contam(NaN, 1, 0, 2),
    ];
    for (const e of bad) expect(() => outlet(1, 0, [e], zero)).toThrow(RangeError);
    // a bad event on another level is still a caller bug
    expect(() => outlet(2, 0, [contam(0, 1, 3, 2)], zero)).toThrow(RangeError);
    // validation happens before any draw
    let n = 0;
    expect(() => outlet(1, NaN, [], () => (n++, 0))).toThrow(RangeError);
    expect(n).toBe(0);
  });
});
