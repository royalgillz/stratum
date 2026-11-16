import { describe, expect, it } from 'vitest';
import { rng } from '../rng.ts';
import { sevenDay } from './seven-day.ts';
import type { Script } from './types.ts';
import { validateScript } from './validate.ts';
import { varyScript } from './vary.ts';

// One event of each type; events[1] and events[11] are fixed, events[5] says fixed: false. Fractions near 1 reach the clamp.
const script = (): Script => ({
  name: 'vary',
  days: 7,
  demo: { id: 'family', level: 5, sector: 1, members: 4 },
  acts: [{ atH: 0, mode: 'timelapse', title: 'a' }, { atH: 60, mode: 'realtime', title: 'b' }],
  vary: { shiftH: 1, scale: 0.2 },
  events: [
    { type: 'network-down', atH: 0, durH: 168 },
    { type: 'outbreak', atH: 6, sector: 20, cases: 10, fixed: true },
    { type: 'separate', atH: 2, away: 0.9 },
    { type: 'shortfall', atH: 30, from: 0.9, to: 0.95, rampH: 4, holdH: 6, recoverH: 2 },
    { type: 'contamination', atH: 52, level: 5, rampH: 12, durH: 12, delta: { cond: 60, toc: 5, turb: 1.5, biocide: -1.5 } },
    { type: 'trip', atH: 84, loss: 0.95, durH: 3, fixed: false },
    { type: 'flood', atH: 101, sector: 22, inflowM3h: 15, durH: 10 },
    { type: 'outbreak', atH: 6, sector: 21, cases: 7 },
    { type: 'farm-cut', atH: 24, level: 4, durH: 144 },
    { type: 'care', atH: 24, durH: 144, red: 6, amber: 12 },
    { type: 'surface', atH: 168, co: 20, o3: 0.4, so2: 1, crews: 5, falsified: 1, bias: 0.02 },
    { type: 'shortfall', atH: 64, from: 0.04, to: 0.3, rampH: 13, holdH: 3, recoverH: 3, fixed: true },
  ],
});

// The design's table, restated so the test checks varyScript against the text, not against itself.
const SIZE: Record<string, string[]> = {
  shortfall: ['from', 'to'], trip: ['loss'], flood: ['inflowM3h'], outbreak: ['cases'], separate: ['away'],
  care: ['red', 'amber'], surface: ['co', 'o3', 'so2', 'bias'],
};
const DURATION: Record<string, string[]> = {
  shortfall: ['rampH', 'holdH', 'recoverH'], trip: ['durH'], contamination: ['rampH', 'durH'], flood: ['durH'],
  'network-down': ['durH'], 'farm-cut': ['durH'], care: ['durH'],
};
const FRACTIONS = ['from', 'to', 'loss', 'away'];

describe('varyScript', () => {
  // @spec SCEN-SCRIPT-002
  it('SCEN-SCRIPT-002 moves and scales each unfixed event by three draws of the script stream, in script order', () => {
    for (const vary of [{ shiftH: 1, scale: 0.2 }, { shiftH: 3, scale: 0.5 }]) for (let seed = 1; seed <= 20; seed++) {
      const s = { ...script(), vary };
      const out = varyScript(s, seed);
      const r = rng(seed, 'script');
      s.events.forEach((e, i) => {
        const [u1, u2, u3] = [r(), r(), r()];
        const got = out.events[i] as unknown as Record<string, any>;
        if (e.fixed) return expect(got).toEqual(e);
        const was = e as unknown as Record<string, any>;
        const k2 = 1 + (2 * u2 - 1) * vary.scale;
        const k3 = 1 + (2 * u3 - 1) * vary.scale;
        expect(got.atH).toBeCloseTo(Math.min(168, Math.max(0, e.atH + (2 * u1 - 1) * vary.shiftH)), 12);
        for (const f of SIZE[e.type] ?? []) {
          let want = was[f] * k2;
          if (FRACTIONS.includes(f)) want = Math.min(1, Math.max(0, want));
          if (f === 'cases') want = Math.round(want);
          expect(got[f], `${seed} ${i} ${f}`).toBeCloseTo(want, 12);
        }
        for (const f of DURATION[e.type] ?? []) expect(got[f], `${seed} ${i} ${f}`).toBeCloseTo(was[f] * k3, 12);
        if (e.type === 'contamination') for (const k of ['cond', 'toc', 'turb', 'biocide']) expect(got.delta[k]).toBeCloseTo(was.delta[k] * k2, 12);
      });
    }
  });

  // @spec SCEN-SCRIPT-002
  it('SCEN-SCRIPT-002 clamps times to the run and fractions to [0, 1], and rounds cases', () => {
    const atZero = new Set<number>(), atEnd = new Set<number>(), fullFraction = new Set<number>(), fullLoss = new Set<number>(), fullFrom = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const out = varyScript(script(), seed);
      for (const e of out.events) {
        expect(e.atH).toBeGreaterThanOrEqual(0);
        expect(e.atH).toBeLessThanOrEqual(168);
        if (e.type === 'outbreak') expect(Number.isInteger(e.cases)).toBe(true);
        if (e.type === 'separate') expect(e.away).toBeLessThanOrEqual(1);
        if (e.type === 'shortfall') expect(e.to).toBeLessThanOrEqual(1);
      }
      const [down, , sep, short, , trip] = out.events as any[];
      if (trip.loss === 1) fullLoss.add(seed);
      if (short.from === 1) fullFrom.add(seed);
      if (down.atH === 0) atZero.add(seed);
      if (out.events[10].atH === 168) atEnd.add(seed);
      if (sep.away === 1) fullFraction.add(seed);
    }
    // Each clamp is reached on some seed.
    expect(atZero.size).toBeGreaterThan(0);
    expect(atEnd.size).toBeGreaterThan(0);
    expect(fullFraction.size).toBeGreaterThan(0);
    expect(fullLoss.size).toBeGreaterThan(0);
    expect(fullFrom.size).toBeGreaterThan(0);
  });

  // @spec SCEN-SCRIPT-003
  it('SCEN-SCRIPT-003 keeps what the screen shows and the structure of every event, and does not change its input', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = script();
      const before = JSON.parse(JSON.stringify(s));
      const out = varyScript(s, seed);
      expect(s).toEqual(before);
      expect(out.name).toBe(s.name);
      expect(out.days).toBe(s.days);
      expect(out.demo).toEqual(s.demo);
      expect(out.acts).toEqual(s.acts);
      expect(out.vary).toEqual(s.vary);
      expect(out.events.map((e) => e.type)).toEqual(s.events.map((e) => e.type));
      expect(out.events[1]).toEqual(s.events[1]);
      expect(out.events[11]).toEqual(s.events[11]);
      out.events.forEach((e, i) => {
        const was = s.events[i] as unknown as Record<string, unknown>;
        const got = e as unknown as Record<string, unknown>;
        for (const k of ['level', 'sector', 'crews', 'falsified', 'fixed']) expect(got[k]).toBe(was[k]);
      });
      expect(varyScript(s, seed)).toEqual(out);
      expect(() => validateScript(out)).not.toThrow();
      expect(() => validateScript(varyScript({ ...sevenDay, vary: { shiftH: 1, scale: 0.2 } }, seed))).not.toThrow();
    }
    expect(varyScript(script(), 1)).not.toEqual(varyScript(script(), 2));
  });

  // @spec SCEN-SCRIPT-003
  it('SCEN-SCRIPT-003 returns a script equal to its input when vary is absent', () => {
    const { vary: _, ...s } = script();
    expect(varyScript(s, 3)).toEqual(s);
    expect(varyScript(sevenDay, 3)).toEqual(sevenDay);
  });
});
