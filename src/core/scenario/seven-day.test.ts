import { describe, expect, it } from 'vitest';
import type { ScenarioEvent } from './types.ts';
import { sevenDay } from './seven-day.ts';
import { validateScript } from './validate.ts';

type Of<T extends ScenarioEvent['type']> = Extract<ScenarioEvent, { type: T }>;
const all = <T extends ScenarioEvent['type']>(type: T) => sevenDay.events.filter((e): e is Of<T> => e.type === type);
const one = <T extends ScenarioEvent['type']>(type: T, atH: number) => all(type).find((e) => e.atH === atH)!;

/** The act holding hour `h`: the last one starting at or before it. */
const actAt = (h: number) => sevenDay.acts.filter((a) => a.atH <= h).at(-1)!;
const nextAct = (h: number) => sevenDay.acts.find((a) => a.atH > h);

/** Hours a grid event holds a non-zero loss: [start, end). */
const span = (e: Of<'shortfall'> | Of<'trip'>) =>
  e.type === 'trip' ? [e.atH, e.atH + e.durH] : [e.atH, e.atH + e.rampH + e.holdH + e.recoverH];

describe('sevenDay', () => {
  // @spec SCEN-010
  it('SCEN-010 passes validateScript, as seven days and as 30', () => {
    expect(sevenDay.days).toBe(7);
    expect(() => validateScript(sevenDay)).not.toThrow();
    expect(() => validateScript({ ...sevenDay, days: 30 })).not.toThrow();
    expect(sevenDay.demo).toEqual({ id: 'family', level: 5, sector: 1, members: 4 });
  });

  // @spec SCEN-010
  it('SCEN-010 holds the events of the design table', () => {
    expect(one('network-down', 0).durH).toBe(168);
    expect(one('separate', 2).away).toBe(0.3);
    expect(all('outbreak')).toEqual([20, 21, 22, 23].map((sector) => ({ type: 'outbreak', atH: 6, sector, cases: 10 })));
    expect(one('shortfall', 30)).toMatchObject({ from: 0.04, to: 0.08, rampH: 4, holdH: 6, recoverH: 2 });
    expect(one('contamination', 52)).toMatchObject({ level: 5, rampH: 0.5, durH: 12, delta: { cond: 60, toc: 5, turb: 1.5, biocide: -1.5 } });
    expect(one('shortfall', 60)).toMatchObject({ from: 0.0475, to: 0.0545, holdH: 2, recoverH: 1 });
    expect(one('shortfall', 60).rampH * 3600).toBeCloseTo(75, 9);
    expect(one('trip', 84)).toMatchObject({ loss: 0.058, durH: 3 });
    expect(one('shortfall', 100)).toMatchObject({ from: 0.05, to: 0.1, rampH: 1, holdH: 12, recoverH: 2 });
    expect(one('flood', 101)).toMatchObject({ sector: 22, inflowM3h: 15, durH: 10 });
    expect(sevenDay.events).toHaveLength(12);
  });

  // @spec SCEN-010
  it('SCEN-010 puts the fast shortfall and the plant trip inside real-time acts, each followed by a time-lapse', () => {
    expect(actAt(60).mode).toBe('realtime');
    expect(actAt(60).atH).toBe(60);
    expect((nextAct(60)!.atH - 60) * 3600).toBeCloseTo(90, 6);
    expect(actAt(84).mode).toBe('realtime');
    expect(actAt(84).atH).toBe(83.99);
    expect((nextAct(84)!.atH - 83.99) * 3600).toBeCloseTo(120, 6);
    expect(sevenDay.acts[0]).toMatchObject({ atH: 0, mode: 'timelapse', title: 'The network is down' });
    expect(actAt(60).title).toBe('The hum sags: under a minute of warning, too short to count');
    expect(actAt(84).title).toBe('A plant trip gives no warning');
    sevenDay.acts.forEach((a, i) => {
      if (a.mode === 'realtime') expect(sevenDay.acts[i + 1].mode).toBe('timelapse');
    });
  });

  // @spec SCEN-010
  it('SCEN-010 has no grid event active in the step before the trip, and floods during a shortfall', () => {
    // No loss in the 60 s step before the trip: capacity is at its margin, so the grid is GREEN there.
    const before = 84 - 60 / 3600;
    const grid = [...all('shortfall'), ...all('trip')].filter((e) => e.atH !== 84);
    for (const e of grid) {
      const [a, b] = span(e);
      expect(b <= before || a >= 84, `event at ${e.atH}`).toBe(true);
    }
    const flood = one('flood', 101);
    const [a, b] = span(one('shortfall', 100));
    expect(flood.atH >= a && flood.atH < b).toBe(true);
  });
});
