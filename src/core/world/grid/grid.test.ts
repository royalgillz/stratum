import { describe, expect, it } from 'vitest';
import { capacityAt, D, F0, H, steadyDeviation, swing, tierOf, type GridEvent } from './grid.ts';

const HR = 3600;
const sf = (over: Partial<GridEvent> = {}): GridEvent => ({ type: 'shortfall', atH: 1, from: 0.1, to: 0.3, rampH: 2, holdH: 1, recoverH: 4, ...over });
const trip = (over: Partial<GridEvent> = {}): GridEvent => ({ type: 'trip', atH: 2, loss: 0.25, durH: 3, ...over });
const lossAt = (e: GridEvent, t: number) => 1 - capacityAt([e], t, 1);

describe('grid', () => {
  // @spec WORLD-GRID-001
  it('WORLD-GRID-001 sums losses, clamps to [0, 1] and ignores other event types', () => {
    const t = 2 * HR; // shortfall ramp midpoint (0.2) and inside the trip (0.25)
    expect(capacityAt([sf(), trip()], t, 100)).toBeCloseTo(100 * (1 - 0.45), 9);
    expect(capacityAt([], t, 100)).toBe(100);
    expect(capacityAt([trip({ loss: 0.7 }), trip({ loss: 0.6 })], t, 100)).toBe(0);
    const other = [{ type: 'flood', atH: 0, durH: 10, inflowM3h: 15, sector: 22 }, { type: 'network-down', atH: 0, durH: 168 }];
    expect(capacityAt([...other, trip()], t, 100)).toBeCloseTo(75, 9);
  });

  // @spec WORLD-GRID-002
  it('WORLD-GRID-002 shortfall ramps, holds, recovers, then ends', () => {
    const e = sf();
    expect(lossAt(e, 1 * HR - 1)).toBe(0);
    expect(lossAt(e, 1 * HR)).toBeCloseTo(0.1, 12);
    expect(lossAt(e, 2 * HR)).toBeCloseTo(0.2, 12);
    expect(lossAt(e, 3 * HR)).toBeCloseTo(0.3, 12); // hold starts
    expect(lossAt(e, 4 * HR - 1)).toBeCloseTo(0.3, 12);
    expect(lossAt(e, 6 * HR)).toBeCloseTo(0.15, 12); // recovery midpoint
    expect(lossAt(e, 8 * HR)).toBe(0);
    expect(lossAt(e, 100 * HR)).toBe(0);
    // zero-length phases are skipped
    const noRamp = sf({ rampH: 0, holdH: 0 });
    expect(lossAt(noRamp, 1 * HR)).toBeCloseTo(0.3, 12);
    expect(lossAt(noRamp, 3 * HR)).toBeCloseTo(0.15, 12);
    expect(lossAt(sf({ recoverH: 0 }), 4 * HR)).toBe(0);
    expect(lossAt(sf({ rampH: 0, holdH: 0, recoverH: 0 }), 1 * HR)).toBe(0);
  });

  // @spec WORLD-GRID-003
  it('WORLD-GRID-003 trip loses its fraction on a half-open interval', () => {
    const e = trip();
    expect(lossAt(e, 2 * HR - 1)).toBe(0);
    expect(lossAt(e, 2 * HR)).toBe(0.25);
    expect(lossAt(e, 5 * HR - 1)).toBe(0.25);
    expect(lossAt(e, 5 * HR)).toBe(0);
  });

  // @spec WORLD-GRID-004
  it('WORLD-GRID-004 steady deviation from the unserved fraction', () => {
    expect(steadyDeviation(90, 100)).toBeCloseTo((-F0 * 10) / (D * 100), 12);
    expect(steadyDeviation(100, 90)).toBe(0);
    expect(steadyDeviation(100, 100)).toBe(0);
    expect(steadyDeviation(0, 0)).toBe(0);
  });

  // @spec WORLD-GRID-005
  it('WORLD-GRID-005 exact exponential step and rocof', () => {
    const tau = (2 * H) / D;
    const dss = steadyDeviation(99, 100);
    for (const dt of [0.02, 1, 60]) {
      const r = swing(400.5, 99, 100, dt);
      const want = F0 + dss + (400.5 - F0 - dss) * Math.exp(-dt / tau);
      expect(r.f).toBeCloseTo(want, 12);
      expect(r.rocof).toBeCloseTo((want - 400.5) / dt, 9);
    }
    // 3000 emitter steps of 20 ms land where one 60 s step does
    let f = F0;
    for (let i = 0; i < 3000; i++) f = swing(f, 99, 100, 0.02).f;
    expect(f).toBeCloseTo(swing(F0, 99, 100, 60).f, 9);
  });

  // @spec WORLD-GRID-006
  it('WORLD-GRID-006 recovers towards F0 when served; 0.1% short gives -200 mHz', () => {
    for (const f0 of [399, 399.9, F0]) {
      const r = swing(f0, 100, 100, 1);
      expect(r.f).toBeGreaterThanOrEqual(f0);
      expect(r.f).toBeLessThanOrEqual(F0);
    }
    expect(swing(401, 120, 100, 1).f).toBeLessThan(401);
    expect(steadyDeviation(1000 / 1.001, 1000)).toBeCloseTo(-0.2, 3);
    expect(Math.abs(steadyDeviation(100, 100.1) + 0.2)).toBeLessThan(0.001);
    expect(swing(F0, 100, 100.1, 1e6).f - F0).toBeCloseTo(-0.2, 3);
  });

  // @spec WORLD-GRID-007
  it('WORLD-GRID-007 tiers with the tracker thresholds and hysteresis', () => {
    expect(tierOf(F0, 'GREEN')).toBe('GREEN');
    expect(tierOf(F0 - 0.15, 'GREEN')).toBe('RED');
    expect(tierOf(F0 - 0.149, 'GREEN')).toBe('AMBER');
    expect(tierOf(F0 - 0.14, 'RED')).toBe('RED');
    expect(tierOf(F0 - 0.13, 'RED')).toBe('RED');
    expect(tierOf(F0 - 0.129, 'RED')).toBe('AMBER');
    expect(tierOf(F0 - 0.14, 'AMBER')).toBe('AMBER');
    expect(tierOf(F0 - 0.05, 'GREEN')).toBe('AMBER');
    expect(tierOf(F0 - 0.049, 'GREEN')).toBe('GREEN');
    expect(tierOf(F0 - 0.04, 'AMBER')).toBe('AMBER');
    expect(tierOf(F0 - 0.03, 'RED')).toBe('AMBER');
    expect(tierOf(F0 - 0.029, 'AMBER')).toBe('GREEN');
    expect(tierOf(F0 - 0.029, 'RED')).toBe('GREEN');
  });

  // @spec WORLD-GRID-008
  it('WORLD-GRID-008 throws RangeError on bad inputs', () => {
    const bad = [NaN, Infinity, -Infinity];
    for (const x of bad) {
      expect(() => capacityAt([], x, 1)).toThrow(RangeError);
      expect(() => capacityAt([], 0, x)).toThrow(RangeError);
      expect(() => steadyDeviation(x, 1)).toThrow(RangeError);
      expect(() => steadyDeviation(1, x)).toThrow(RangeError);
      expect(() => swing(x, 1, 1, 1)).toThrow(RangeError);
      expect(() => swing(F0, 1, 1, x)).toThrow(RangeError);
      expect(() => tierOf(x, 'GREEN')).toThrow(RangeError);
    }
    expect(() => capacityAt([], 0, -1)).toThrow(RangeError);
    expect(() => steadyDeviation(-1, 1)).toThrow(RangeError);
    expect(() => steadyDeviation(1, -1)).toThrow(RangeError);
    expect(() => swing(F0, -1, 1, 1)).toThrow(RangeError);
    expect(() => swing(F0, 1, 1, 0)).toThrow(RangeError);
    expect(() => swing(F0, 1, 1, -1)).toThrow(RangeError);
    for (const e of [
      sf({ from: -0.1 }), sf({ to: 1.1 }), sf({ to: undefined }), sf({ rampH: -1 }), sf({ holdH: NaN }), sf({ recoverH: undefined }),
      trip({ loss: 2 }), trip({ loss: undefined }), trip({ durH: -1 }), trip({ durH: Infinity }), trip({ atH: NaN }),
    ]) {
      expect(() => capacityAt([e], 0, 1)).toThrow(RangeError);
    }
    // other event types are not the grid's to check
    expect(() => capacityAt([{ type: 'flood', atH: 0, durH: -1 }], 0, 1)).not.toThrow();
  });
});
