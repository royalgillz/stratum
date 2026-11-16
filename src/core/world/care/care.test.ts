import { describe, expect, it } from 'vitest';
import { rng } from '../../rng.ts';
import type { ScenarioEvent } from '../../scenario/types.ts';
import { busyMin, careRequests, firstCareMin, HOP_MIN, VISIT_MIN } from './care.ts';

const care = (atH: number, durH: number, red: number, amber: number): ScenarioEvent => ({ type: 'care', atH, durH, red, amber });
const seq = (...us: number[]) => {
  let i = 0;
  return () => us[i++]!;
};

describe('care delivery model', () => {
  it('pins its constants to docs/params.md', () => {
    expect({ HOP_MIN, VISIT_MIN }).toEqual({ HOP_MIN: 10, VISIT_MIN: 30 });
  });

  // @spec WORLD-CARE-001
  it('WORLD-CARE-001 draws time then sector per request, RED before AMBER per event, sorted by time with ties in draw order', () => {
    // event 1: 12 h at 2 RED and 4 AMBER a day: 1 RED, 2 AMBER. event 2: 24 h at 1 RED: 1 RED.
    const events: ScenarioEvent[] = [care(10, 12, 2, 4), { type: 'network-down', atH: 0, durH: 5 }, care(0, 24, 1, 0)];
    const r = seq(0.5, 0.99, 0.25, 0, 0.5, 0.5, 0.25, 0.2);
    expect(careRequests(events, r)).toEqual([
      { t: 6 * 3600, cls: 'RED', sector: 4 }, // event 2, at 0 + 0.25 x 24 h
      { t: 13 * 3600, cls: 'AMBER', sector: 0 },
      { t: 16 * 3600, cls: 'RED', sector: 23 },
      { t: 16 * 3600, cls: 'AMBER', sector: 12 }, // tie with the RED: draw order kept
    ]);
  });

  // @spec WORLD-CARE-001
  it('WORLD-CARE-001 makes round(rate x durH / 24) requests of each class and nothing for other events', () => {
    let calls = 0;
    const r = () => (calls++, 0.5);
    const out = careRequests([care(0, 144, 6, 12), { type: 'outbreak', atH: 0, sector: 1, cases: 3 }], r);
    expect(out.filter((x) => x.cls === 'RED')).toHaveLength(36);
    expect(out.filter((x) => x.cls === 'AMBER')).toHaveLength(72);
    expect(calls).toBe(2 * 108);
    expect(careRequests([care(0, 10, 1, 1.3)], () => 0.5)).toHaveLength(1); // round(0.42) = 0 RED, round(0.54) = 1 AMBER
  });

  // @spec WORLD-CARE-002
  it('WORLD-CARE-002 courier minutes from hops', () => {
    expect(firstCareMin(0)).toBe(0);
    expect(firstCareMin(5)).toBe(50);
    expect(busyMin(0)).toBe(30);
    expect(busyMin(5)).toBe(130);
  });

  // @spec WORLD-CARE-003
  it('WORLD-CARE-003 the same events and stream give the same requests', () => {
    const events = [care(24, 144, 6, 12), care(0, 168, 12, 24)];
    const a = careRequests(events, rng(7, 'p10'));
    expect(a.length).toBe(36 + 72 + 84 + 168);
    expect(careRequests(events, rng(7, 'p10'))).toEqual(a);
    expect(careRequests(events, rng(8, 'p10'))).not.toEqual(a);
    for (let i = 1; i < a.length; i++) expect(a[i]!.t).toBeGreaterThanOrEqual(a[i - 1]!.t);
  });

  // @spec WORLD-CARE-004
  it('WORLD-CARE-004 throws a RangeError for bad hops and bad care events', () => {
    for (const h of [-1, 0.5, NaN, Infinity]) {
      expect(() => firstCareMin(h)).toThrow(RangeError);
      expect(() => busyMin(h)).toThrow(RangeError);
    }
    const r = () => 0.5;
    for (const x of [NaN, Infinity]) expect(() => careRequests([care(x, 1, 1, 1)], r)).toThrow(RangeError);
    for (const x of [-1, NaN, Infinity]) {
      expect(() => careRequests([care(0, x, 1, 1)], r)).toThrow(RangeError);
      expect(() => careRequests([care(0, 1, x, 1)], r)).toThrow(RangeError);
      expect(() => careRequests([care(0, 1, 1, x)], r)).toThrow(RangeError);
    }
  });
});
