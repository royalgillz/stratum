import { describe, expect, it } from 'vitest';
import type { ScenarioEvent } from '../../scenario/types.ts';
import {
  AMBIENT_MEL, BRIGHT_H, BRIGHT_MEL, CROPS, DAY_MEL, GROW_KW, GROW_LAMP_H, GROW_SEATS, LAMP_H, SEAT_KW, STAPLE, STOCK_DAYS, WAKE_H,
  bestCrop, dose, farmCut, grown, growSessions, kcalPerKWh, kwhToFeed, lampKWh, sessions,
} from './lightfood.ts';

const H = 3600;
const cut = (atH: number, level: number, durH: number): ScenarioEvent => ({ type: 'farm-cut', atH, level, durH });

describe('light and food', () => {
  it('holds the docs/params.md values', () => {
    expect([WAKE_H, AMBIENT_MEL, BRIGHT_MEL, DAY_MEL, BRIGHT_H, SEAT_KW, LAMP_H]).toEqual([16, 30, 300, 250, 4, 0.01, 2]);
    expect([GROW_SEATS, GROW_LAMP_H, GROW_KW, STOCK_DAYS, STAPLE]).toEqual([25, 16, 20, 3, 'grain']);
    expect(CROPS).toEqual({ lettuce: { kWhPerKg: 15, kcalPerKg: 150 }, grain: { kWhPerKg: 650, kcalPerKg: 3300 } });
  });

  // @spec WORLD-LIGHTFOOD-001
  it('WORLD-LIGHTFOOD-001 budgets LAMP_H seat-hours per person and counts whole sessions, keeping one lost to rounding', () => {
    expect(lampKWh(500)).toBeCloseTo(10, 12);
    expect(lampKWh(0)).toBe(0);
    expect(sessions(10)).toBe(250);
    expect(sessions(0.0399)).toBe(0);
    expect(sessions(0.04)).toBe(1);
    expect(sessions(lampKWh(150) * 0.6)).toBe(45); // 44.99999999999999 in floating point: the 1e-9 keeps the session
    expect(sessions(lampKWh(500) * 0.5)).toBe(125);
  });

  // @spec WORLD-LIGHTFOOD-002
  it('WORLD-LIGHTFOOD-002 seats GROW_SEATS times whole sessions per grow day, scaled by power served', () => {
    expect(growSessions(1)).toBe(100);
    expect(growSessions(0)).toBe(0);
    expect(growSessions(0.5)).toBe(50);
    expect(growSessions(0.019)).toBe(1);
    expect(growSessions(0.29)).toBe(29); // 28.999999999999996 in floating point: kept whole
  });

  // @spec WORLD-LIGHTFOOD-003
  it('WORLD-LIGHTFOOD-003 sums ambient and bright melanopic lux-hours over waking hours, bright at or above the threshold', () => {
    expect(dose(0)).toBe(30 * 16);
    expect(dose(4)).toBe(30 * 12 + 300 * 4);
    expect(dose(WAKE_H)).toBe(300 * 16);
    expect(BRIGHT_MEL).toBeGreaterThanOrEqual(DAY_MEL);
  });

  // @spec WORLD-LIGHTFOOD-004
  it('WORLD-LIGHTFOOD-004 gives kcal per kWh, food grown and the lamp energy to feed a ration', () => {
    expect(kcalPerKWh('lettuce')).toBe(10);
    expect(kcalPerKWh('grain')).toBeCloseTo(3300 / 650, 12);
    expect(grown(320, 'lettuce')).toBe(3200);
    expect(grown(0, 'grain')).toBe(0);
    expect(kwhToFeed(2100, 'lettuce')).toBeCloseTo(210, 9); // the design's "about 210 kWh"
    expect(kwhToFeed(2100, 'grain')).toBeGreaterThan(400);
  });

  // @spec WORLD-LIGHTFOOD-005
  it('WORLD-LIGHTFOOD-005 picks the crop with the most kcal per kWh, and the staple is a crop', () => {
    expect(bestCrop()).toBe('lettuce');
    expect(Object.keys(CROPS)).toContain(STAPLE);
  });

  // @spec WORLD-LIGHTFOOD-006
  it('WORLD-LIGHTFOOD-006 is true on [atH, atH + durH) for that level only, ignoring other event types', () => {
    const events: ScenarioEvent[] = [
      { type: 'trip', atH: 0, loss: 0.5, durH: 100 },
      { type: 'flood', atH: 0, sector: 12, inflowM3h: 15, durH: 100 },
      { type: 'contamination', atH: 0, level: 3, rampH: 1, durH: 200, delta: { cond: 1, toc: 1, turb: 1, biocide: 0 } }, // same shape as a farm cut
      cut(24, 4, 144),
    ];
    expect(farmCut(events, 4, 24 * H - 1)).toBe(false);
    expect(farmCut(events, 4, 24 * H)).toBe(true);
    expect(farmCut(events, 4, 168 * H - 1)).toBe(true);
    expect(farmCut(events, 4, 168 * H)).toBe(false);
    expect(farmCut(events, 3, 100 * H)).toBe(false);
    expect(farmCut([], 4, 100 * H)).toBe(false);
    expect(farmCut([cut(1, 2, 0)], 2, H)).toBe(false); // a zero-length cut never acts
    expect(farmCut([cut(0, 5, 1), cut(10, 5, 1)], 5, 10.5 * H)).toBe(true);
  });

  // @spec WORLD-LIGHTFOOD-007
  it('WORLD-LIGHTFOOD-007 throws a RangeError for bad people, kWh, kcal, t, f, h, crop, level or farm-cut timing', () => {
    for (const x of [-1, NaN, Infinity]) {
      expect(() => lampKWh(x)).toThrow(RangeError);
      expect(() => sessions(x)).toThrow(RangeError);
      expect(() => grown(x, 'grain')).toThrow(RangeError);
      expect(() => kwhToFeed(x, 'grain')).toThrow(RangeError);
      expect(() => farmCut([], 1, x)).toThrow(RangeError);
    }
    for (const f of [-0.01, 1.01, NaN]) expect(() => growSessions(f)).toThrow(RangeError);
    for (const h of [-0.01, WAKE_H + 0.01, NaN]) expect(() => dose(h)).toThrow(RangeError);
    for (const crop of ['potato', 'toString', '']) {
      expect(() => kcalPerKWh(crop)).toThrow(RangeError);
      expect(() => grown(1, crop)).toThrow(RangeError);
      expect(() => kwhToFeed(1, crop)).toThrow(RangeError);
    }
    for (const level of [0, 7, 2.5, NaN]) expect(() => farmCut([], level, 0)).toThrow(RangeError);
    expect(() => farmCut([cut(NaN, 2, 1)], 2, 0)).toThrow(RangeError);
    expect(() => farmCut([cut(1, 2, -1)], 2, 0)).toThrow(RangeError);
    expect(() => farmCut([cut(1, 2, Infinity)], 2, 0)).toThrow(RangeError);
    expect(() => farmCut([cut(1, 2, NaN)], 3, 0)).toThrow(RangeError); // checked whatever level is asked
  });
});
