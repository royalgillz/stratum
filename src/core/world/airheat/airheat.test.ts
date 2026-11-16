import { describe, expect, it } from 'vitest';
import {
  CO2_LIMIT, CO2_REF, RH, WB_LIMIT, co2Step, coolingDemandMW, dryBulbLimit, tempStep, timeToLimit, uncooledTemp, wetBulb,
} from './airheat.ts';

describe('airheat', () => {
  // @spec WORLD-AIR-001
  it('WORLD-AIR-001 uncooled temperature and cooling demand by level', () => {
    expect(uncooledTemp(1)).toBe(27); // 25 + 0 + 2
    expect(uncooledTemp(6)).toBe(42); // 25 + 15 + 2
    expect(coolingDemandMW(6, 500)).toBeCloseTo((0.05 * 500 * 18) / 1000, 12);
    expect(coolingDemandMW(1, 500)).toBeCloseTo((0.05 * 500 * 3) / 1000, 12);
    expect(coolingDemandMW(3, 0)).toBe(0);
  });

  // @spec WORLD-AIR-002
  it('WORLD-AIR-002 relaxes temperature exactly towards the cooled target', () => {
    const target = 42 - 18 * 0.5;
    expect(tempStep(30, 6, 0.5, 3600)).toBeCloseTo(target + (30 - target) * Math.exp(-3600 / 21600), 12);
    // exact: two half steps equal one whole step
    expect(tempStep(tempStep(30, 6, 0.5, 1800), 6, 0.5, 1800)).toBeCloseTo(tempStep(30, 6, 0.5, 3600), 12);
    expect(tempStep(24, 2, 0, 21600)).toBeCloseTo(30 + (24 - 30) * Math.exp(-1), 12); // U(2) = 30
  });

  // @spec WORLD-AIR-003
  it('WORLD-AIR-003 matches Stull 2011', () => {
    expect(Math.abs(wetBulb(20, 50) - 13.7)).toBeLessThan(0.05); // the paper's worked example
  });

  // @spec WORLD-AIR-004
  it('WORLD-AIR-004 relaxes CO2 exactly with a ventilation time constant', () => {
    expect(CO2_REF).toBeCloseTo(420 + (1e6 * 0.0052) / 10, 9); // 940
    const on = co2Step(420, 1, 3000);
    expect(on.tau).toBeCloseTo(3000, 9); // 30000 L / 10 L/s
    expect(on.co2).toBeCloseTo(CO2_REF + (420 - CO2_REF) * Math.exp(-1), 9);
    const off = co2Step(940, 0, 3600); // leakage only: v = 0.05
    const target = 420 + (1e6 * 0.0052) / 0.5;
    expect(off.tau).toBeCloseTo(60000, 9);
    expect(off.co2).toBeCloseTo(target + (940 - target) * Math.exp(-3600 / 60000), 9);
    expect(co2Step(940, 0.02, 3600)).toEqual(off); // below leakage, leakage rules
  });

  // @spec WORLD-AIR-005
  it('WORLD-AIR-005 time to limit', () => {
    expect(timeToLimit(5000, 9000, 100, 5000)).toBe(0);
    expect(timeToLimit(6000, 9000, 100, 5000)).toBe(0);
    expect(timeToLimit(6000, 940, 100, 5000)).toBe(0); // over the limit wins over a target under it
    expect(CO2_LIMIT).toBe(5000);
    expect(timeToLimit(900, 5000, 100, 5000)).toBe(Infinity);
    expect(timeToLimit(900, 940, 100, 5000)).toBe(Infinity);
    expect(timeToLimit(940, 10820, 60000, 5000)).toBeCloseTo(60000 * Math.log((10820 - 940) / (10820 - 5000)), 9);
    // it agrees with the step: relaxing for that long lands on the limit
    const t = timeToLimit(940, 10820, 60000, 5000);
    expect(co2Step(940, 0, t).co2).toBeCloseTo(5000, 6);
  });

  // @spec WORLD-AIR-006
  it('WORLD-AIR-006 dry-bulb limit at the model humidity', () => {
    const L = dryBulbLimit();
    expect(WB_LIMIT).toBe(27.5);
    expect(RH).toBe(70);
    expect(wetBulb(L - 0.01, RH)).toBeLessThan(WB_LIMIT);
    expect(wetBulb(L + 0.01, RH)).toBeGreaterThan(WB_LIMIT);
  });

  // @spec WORLD-AIR-007
  // The "or at U where U is lower" branch is unreachable with the default parameters (U(1) = 27 > 24); covered by inspection only.
  it('WORLD-AIR-007 full cooling settles at the setpoint, none leaves level 6 past the limit', () => {
    for (let level = 1; level <= 6; level++) expect(tempStep(35, level, 1, 1e9)).toBeCloseTo(24, 9);
    const hot = tempStep(24, 6, 0, 1e9);
    expect(hot).toBeCloseTo(42, 9);
    expect(hot).toBeGreaterThan(dryBulbLimit());
  });

  // @spec WORLD-AIR-008
  it('WORLD-AIR-008 throws RangeError on bad input', () => {
    const bad: (() => unknown)[] = [
      () => uncooledTemp(0), () => uncooledTemp(7), () => uncooledTemp(2.5), () => uncooledTemp(NaN),
      () => coolingDemandMW(1, NaN), () => coolingDemandMW(1, Infinity), () => coolingDemandMW(1, -1),
      () => tempStep(NaN, 1, 0, 60), () => tempStep(30, 1, -0.1, 60), () => tempStep(30, 1, 1.1, 60),
      () => tempStep(30, 1, 0, 0), () => tempStep(30, 1, 0, -60), () => tempStep(30, 7, 0, 60),
      () => wetBulb(30, 4), () => wetBulb(30, 100), () => wetBulb(Infinity, 70),
      () => co2Step(NaN, 1, 60), () => co2Step(900, 2, 60), () => co2Step(900, -1, 60), () => co2Step(900, 1, 0),
      () => timeToLimit(1, 2, 0, 3), () => timeToLimit(1, 2, -1, 3), () => timeToLimit(NaN, 2, 1, 3),
      () => timeToLimit(1, Infinity, 1, 3), () => timeToLimit(1, 2, 1, NaN),
      () => wetBulb(30, NaN), () => tempStep(30, 1, NaN, 60), () => co2Step(900, NaN, 60),
      () => tempStep(30, 1, 0, NaN), () => tempStep(30, 1, 0, Infinity), () => timeToLimit(1, 2, Infinity, 3),
    ];
    for (const f of bad) expect(f).toThrow(RangeError);
    expect(() => wetBulb(30, 5)).not.toThrow();
    expect(() => wetBulb(30, 99)).not.toThrow();
  });
});
