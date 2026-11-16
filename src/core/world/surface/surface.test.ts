import { describe, expect, it } from 'vitest';
import type { ScenarioEvent } from '../../scenario/types.ts';
import {
  APF_SEALED, bandOf, CREW_NOISE, crewRead, GASES, IDLH, OPTIONS, optionFor, REL, required, returnPerDay, STAGES, surfaceAt, TRIAL_N, trialPlan,
  type Campaign,
} from './surface.ts';

const H = 3600;
const camp = (atH: number, over: Partial<Campaign> = {}): Campaign => ({ type: 'surface', atH, co: 20, o3: 0.4, so2: 1, crews: 5, falsified: 1, bias: 0.02, ...over });
const seq = (...us: number[]) => {
  let i = 0;
  return () => us[i++ % us.length]!;
};

describe('surface', () => {
  it('holds the constants of docs/params.md', () => {
    expect(GASES).toEqual(['co', 'o3', 'so2']);
    expect(REL).toEqual({ co: 35, o3: 0.1, so2: 2 });
    expect(IDLH).toEqual({ co: 1200, o3: 5, so2: 100 });
    expect(OPTIONS).toEqual([1, 10, 50, 1000, 10000]);
    expect(STAGES).toEqual([1, 24, 168, 720]);
    expect([APF_SEALED, CREW_NOISE, TRIAL_N]).toEqual([10000, 0.1, 8]);
  });

  // @spec WORLD-SURFACE-001
  it('WORLD-SURFACE-001 returns the latest campaign started by t, the later on a tie, ignoring other events', () => {
    const a = camp(10), b = camp(20, { co: 1 }), c = camp(20, { co: 2 });
    const events: ScenarioEvent[] = [{ type: 'trip', atH: 0, loss: 0.5, durH: 1 }, b, a, c, { type: 'flood', atH: 30, sector: 1, inflowM3h: 1, durH: 1 }];
    expect(surfaceAt(events, 10 * H - 1)).toBeNull();
    expect(surfaceAt(events, 10 * H)).toBe(a);
    expect(surfaceAt(events, 20 * H - 1)).toBe(a);
    expect(surfaceAt(events, 20 * H)).toBe(c);
    expect(surfaceAt(events, 1e9)).toBe(c);
    expect(surfaceAt([], 0)).toBeNull();
  });

  // @spec WORLD-SURFACE-002
  it('WORLD-SURFACE-002 reads crews in order, gases in order, one draw each, falsified crews first', () => {
    const e = camp(0, { crews: 3, falsified: 2, bias: 0.5 });
    let draws = 0;
    const u = seq(0, 0.5, 1 - 2 ** -53, 0.25);
    const r = crewRead(e, 7 * H, () => (draws++, u()));
    expect(draws).toBe(9);
    expect(r.map((x) => `${x.crew}.${x.gas}`)).toEqual(['c1.co', 'c1.o3', 'c1.so2', 'c2.co', 'c2.o3', 'c2.so2', 'c3.co', 'c3.o3', 'c3.so2']);
    expect(r.every((x) => x.t === 7 * H)).toBe(true);
    const f = (truth: number, k: number, x: number) => truth * k * (1 + CREW_NOISE * (2 * x - 1));
    const us = [0, 0.5, 1 - 2 ** -53, 0.25, 0, 0.5, 1 - 2 ** -53, 0.25, 0];
    const expected = r.map((x, i) => f(e[x.gas as 'co'], i < 6 ? 0.5 : 1, us[i]!));
    r.forEach((x, i) => expect(x.ppm).toBeCloseTo(expected[i]!, 12));
    expect(r[0]!.ppm).toBeCloseTo(20 * 0.5 * 0.9, 12);
    expect(r[6]!.ppm).toBeCloseTo(20 * 1 * 1.1, 9);
  });

  // @spec WORLD-SURFACE-003
  it('WORLD-SURFACE-003 takes the largest ratio to REL, raised to APF_SEALED at IDLH or with CO above its REL', () => {
    expect(required({ co: 20, o3: 0.4, so2: 1 })).toBeCloseTo(4, 12);
    expect(required({ co: 0, o3: 0, so2: 3 })).toBeCloseTo(1.5, 12);
    expect(required({ co: 35, o3: 0, so2: 0 })).toBe(1); // at its REL, not above
    expect(required({ co: 35.01, o3: 0, so2: 0 })).toBe(APF_SEALED);
    expect(required({ co: 0, o3: 5, so2: 0 })).toBe(APF_SEALED); // at IDLH, ratio 50
    expect(required({ co: 0, o3: 4.99, so2: 0 })).toBeCloseTo(49.9, 9);
    expect(required({ co: 0, o3: 0, so2: 100 })).toBe(APF_SEALED);
    expect(required({ co: 0, o3: 2000, so2: 0 })).toBe(20000); // above APF_SEALED stays
  });

  // @spec WORLD-SURFACE-004
  it('WORLD-SURFACE-004 maps the required factor to a band', () => {
    const o3 = (r: number) => bandOf({ co: 0, o3: r * 0.1, so2: 0 });
    expect(o3(0)).toBe('open');
    expect(o3(1)).toBe('open');
    expect(o3(1.01)).toBe('mask');
    expect(o3(49.9)).toBe('mask');
    expect(bandOf({ co: 0, o3: 0, so2: 100 - 1e-9 })).toBe('mask'); // ratio 50
    expect(bandOf({ co: 0, o3: 0, so2: 1000 })).toBe('sealed');
    expect(bandOf({ co: 1500, o3: 2, so2: 20 })).toBe('sealed');
    expect(bandOf({ co: 0, o3: 1000, so2: 0 })).toBe('sealed');
    expect(bandOf({ co: 0, o3: 1000.1, so2: 0 })).toBe('closed');
    expect(bandOf({ co: 20, o3: 0.4, so2: 1 })).toBe('mask');
    // No concentration gives `suit`: O3 and SO2 reach their IDLH at 50 times their REL, and CO above its REL is raised to APF_SEALED.
    expect(bandOf({ co: 0, o3: 0, so2: 99.99 })).toBe('mask');
  });

  // @spec WORLD-SURFACE-005
  it('WORLD-SURFACE-005 returns the first option at least r, or null above 10,000', () => {
    expect(optionFor(0)).toBe(1);
    expect(optionFor(1)).toBe(1);
    expect(optionFor(1.5)).toBe(10);
    expect(optionFor(10)).toBe(10);
    expect(optionFor(11)).toBe(50);
    expect(optionFor(51)).toBe(1000);
    expect(optionFor(1001)).toBe(10000);
    expect(optionFor(10000)).toBe(10000);
    expect(optionFor(10000.5)).toBeNull();
  });

  // @spec WORLD-SURFACE-006
  it('WORLD-SURFACE-006 walks options up, breaching in the first hour, until a 720 h stage holds', () => {
    const held = (factor: number) => STAGES.map((hours) => ({ factor, hours, breached: false }));
    expect(trialPlan(4, 4, true)).toEqual({ verified: 10, exposureH: 8 * 913, breaches: 0, stages: held(10) });
    expect(trialPlan(4, 4, false)).toEqual({ verified: 10, exposureH: 8 * 720, breaches: 0, stages: [{ factor: 10, hours: 720, breached: false }] });
    const b = (factor: number) => ({ factor, hours: 1, breached: true });
    expect(trialPlan(0.4, APF_SEALED, true)).toEqual({ verified: 10000, exposureH: 4 * 8 + 8 * 913, breaches: 4, stages: [b(1), b(10), b(50), b(1000), ...held(10000)] });
    expect(trialPlan(0.4, 20, false)).toEqual({
      verified: 50, exposureH: 2 * 8 + 8 * 720, breaches: 2, stages: [b(1), b(10), { factor: 50, hours: 720, breached: false }],
    });
    expect(trialPlan(APF_SEALED, 4, false)).toEqual({ verified: 10000, exposureH: 5760, breaches: 0, stages: [{ factor: 10000, hours: 720, breached: false }] });
    expect(trialPlan(1, 20000, false)).toEqual({ verified: 0, exposureH: 5 * 8, breaches: 5, stages: [b(1), b(10), b(50), b(1000), b(10000)] });
    expect(trialPlan(20000, 1, true)).toEqual({ verified: 0, exposureH: 0, breaches: 0, stages: [] });
  });

  // @spec WORLD-SURFACE-007
  it('WORLD-SURFACE-007 caps the return at surface reception', () => {
    expect(returnPerDay(1)).toBe(500);
    expect(returnPerDay(0)).toBe(0);
    expect(returnPerDay(0.01)).toBeCloseTo(1070 * 20 * 0.01, 9);
  });

  // @spec WORLD-SURFACE-008
  it('WORLD-SURFACE-008 throws a RangeError on bad times, values and campaigns', () => {
    const ok = camp(0);
    const bad: [() => unknown, string][] = [
      [() => surfaceAt([ok], NaN), 't'],
      [() => surfaceAt([camp(NaN)], 0), 'atH'],
      [() => surfaceAt([camp(0, { crews: 0 })], 0), 'crews'],
      [() => surfaceAt([camp(0, { crews: 2.5 })], 0), 'crews'],
      [() => surfaceAt([camp(0, { falsified: 6 })], 0), 'falsified'],
      [() => surfaceAt([camp(0, { falsified: -1 })], 0), 'falsified'],
      [() => surfaceAt([camp(0, { falsified: 0.5 })], 0), 'falsified'],
      [() => surfaceAt([camp(0, { bias: -1 })], 0), 'bias'],
      [() => surfaceAt([camp(0, { co: -1 })], 0), 'co'],
      [() => crewRead(ok, Infinity, () => 0), 't'],
      [() => crewRead(camp(0, { o3: Infinity }), 0, () => 0), 'o3'],
      [() => crewRead(camp(0, { bias: NaN }), 0, () => 0), 'bias'],
      [() => required({ co: 0, o3: 0, so2: -1 }), 'so2'],
      [() => bandOf({ co: NaN, o3: 0, so2: 0 }), 'co'],
      [() => optionFor(-1), 'factor'],
      [() => optionFor(NaN), 'factor'],
      [() => trialPlan(1, Infinity, true), 'factor'],
      [() => trialPlan(-1, 1, true), 'factor'],
      [() => returnPerDay(-1), 'shafts'],
      [() => returnPerDay(Infinity), 'shafts'],
    ];
    for (const [f, word] of bad) expect(f).toThrow(new RegExp(word));
    for (const [f] of bad) expect(f).toThrow(RangeError);
    expect(surfaceAt([camp(0, { falsified: 0 }), camp(1, { falsified: 5, crews: 5 })], 0)).not.toBeNull();
  });
});
