import { describe, expect, it } from 'vitest';
import { capacityAt } from '../world/grid/grid.ts';
import type { ScenarioEvent, Script } from './types.ts';
import { sevenDay } from './seven-day.ts';
import { validateScript } from './validate.ts';
import { varyScript } from './vary.ts';

type Of<T extends ScenarioEvent['type']> = Extract<ScenarioEvent, { type: T }>;
const all = <T extends ScenarioEvent['type']>(type: T, s: Script = sevenDay) => s.events.filter((e): e is Of<T> => e.type === type);
const one = <T extends ScenarioEvent['type']>(type: T, atH: number) => all(type).find((e) => e.atH === atH)!;
/** The concrete script's copy of the event written at `atH` (varyScript keeps the event order). */
const concrete = <T extends ScenarioEvent['type']>(s: Script, type: T, atH: number) => s.events[sevenDay.events.indexOf(one(type, atH))] as Of<T>;

/** The act holding hour `h`: the last one starting at or before it. */
const actAt = (h: number) => sevenDay.acts.filter((a) => a.atH <= h).at(-1)!;
const nextAct = (h: number) => sevenDay.acts.find((a) => a.atH > h);

/** Hours a grid event holds a non-zero loss: [start, end). */
const span = (e: Of<'shortfall'> | Of<'trip'>) =>
  e.type === 'trip' ? [e.atH, e.atH + e.durH] : [e.atH, e.atH + e.rampH + e.holdH + e.recoverH];

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe('sevenDay', () => {
  // @spec SCEN-010
  it('SCEN-010 passes validateScript, as seven days and as 30', () => {
    expect(sevenDay.days).toBe(7);
    expect(() => validateScript(sevenDay)).not.toThrow();
    expect(() => validateScript({ ...sevenDay, days: 30 })).not.toThrow();
    expect(sevenDay.demo).toEqual({ id: 'family', level: 5, sector: 1, members: 4 });
    expect(sevenDay.vary).toEqual({ shiftH: 1, scale: 0.2 });
  });

  // @spec SCEN-010
  it('SCEN-010 holds the events of the design table', () => {
    expect(one('network-down', 0).durH).toBe(168);
    expect(one('separate', 2).away).toBe(0.3);
    expect(all('outbreak')).toEqual([20, 21, 22, 23].map((sector) => ({ type: 'outbreak', atH: 6, sector, cases: 10, fixed: true })));
    expect(one('farm-cut', 24)).toMatchObject({ level: 4, durH: 144 });
    expect(one('care', 24)).toMatchObject({ durH: 144, red: 6, amber: 12 });
    expect(one('shortfall', 30)).toMatchObject({ from: 0.04, to: 0.08, rampH: 4, holdH: 6, recoverH: 2 });
    expect(one('contamination', 52)).toMatchObject({ level: 5, rampH: 0.5, durH: 12, delta: { cond: 60, toc: 5, turb: 1.5, biocide: -1.5 } });
    expect(one('shortfall', 60)).toMatchObject({ from: 0.0475, to: 0.0545, holdH: 2, recoverH: 1 });
    expect(one('shortfall', 60).rampH * 3600).toBeCloseTo(75, 9);
    expect(one('shortfall', 64)).toMatchObject({ from: 0.04, to: 0.3, rampH: 13, holdH: 3, recoverH: 3 });
    expect(one('trip', 84)).toMatchObject({ loss: 0.058, durH: 3 });
    expect(one('shortfall', 100)).toMatchObject({ from: 0.05, to: 0.1, rampH: 1, holdH: 12, recoverH: 2 });
    expect(one('flood', 101)).toMatchObject({ sector: 22, inflowM3h: 15, durH: 10 });
    expect(one('surface', 120)).toMatchObject({ co: 20, o3: 0.4, so2: 1, crews: 5, falsified: 1, bias: 0.02 });
    expect(sevenDay.events).toHaveLength(16);
    for (const e of all('shortfall')) expect(e.recoverH, `shortfall at ${e.atH}`).toBeGreaterThan(0);
  });

  // @spec SCEN-010
  it('SCEN-010 marks the network cut, outbreak seeds, hour-60 shortfall, trip, deep shortfall and flood fixed, and nothing else', () => {
    const fixed = sevenDay.events.filter((e) => e.fixed === true);
    expect(fixed).toEqual([one('network-down', 0), ...all('outbreak'), one('shortfall', 60), one('shortfall', 64), one('trip', 84), one('flood', 101)]);
    for (const e of sevenDay.events.filter((x) => !fixed.includes(x))) expect(e.fixed, `${e.type} at ${e.atH}`).toBeUndefined();
  });

  // @spec SCEN-010
  it('SCEN-010 puts the fast shortfall, the deep shortfall and the plant trip inside real-time acts, each followed by a time-lapse', () => {
    expect(actAt(60).mode).toBe('realtime');
    expect(actAt(60).atH).toBe(60);
    expect((nextAct(60)!.atH - 60) * 3600).toBeCloseTo(90, 6);
    const dark = actAt(75.55 + 1 / 3600);
    expect(dark).toMatchObject({ atH: 75.55, mode: 'realtime', title: 'Level 5 goes dark: deepest first' });
    expect((nextAct(75.55)!.atH - 75.55) * 3600).toBeCloseTo(240, 6);
    const deep = span(one('shortfall', 64));
    expect(dark.atH > deep[0]! && dark.atH + 240 / 3600 < deep[1]!).toBe(true);
    expect(actAt(84).mode).toBe('realtime');
    expect(actAt(84).atH).toBe(83.99);
    expect((nextAct(84)!.atH - 83.99) * 3600).toBeCloseTo(120, 6);
    expect(sevenDay.acts[0]).toMatchObject({ atH: 0, mode: 'timelapse', title: 'The network is down' });
    expect(actAt(60).title).toBe('The hum sags: under a minute of warning, too short to count');
    expect(actAt(84).title).toBe('A plant trip gives no warning');
    expect(sevenDay.acts.filter((a) => a.mode === 'realtime')).toHaveLength(3);
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

describe('sevenDay over the harness seeds', () => {
  // @spec SCEN-SCRIPT-006
  it('SCEN-SCRIPT-006 has no shortfall or trip loss in the step before hour 84, and floods before the late hold ends, on every seed', () => {
    for (const seed of SEEDS) {
      const s = varyScript(sevenDay, seed);
      for (let t = 84 * 3600 - 60; t < 84 * 3600; t++) expect(capacityAt(s.events, t, 1), `seed ${seed} t ${t}`).toBe(1);
      const late = concrete(s, 'shortfall', 100), flood = concrete(s, 'flood', 101);
      expect(flood.atH, `seed ${seed}`).toBeLessThan(late.atH + late.rampH + late.holdH);
    }
  });
});
