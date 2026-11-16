// The stress week: its events, and where STRATUM loses over the harness seeds (docs/intent/scenario/scripts).
import { beforeAll, describe, expect, it } from 'vitest';
import type { AdapterId } from '../contracts.ts';
import { cutStart } from '../adapters/p12.ts';
import type { Policy } from '../adapters/shared.ts';
import { runHeadless } from './run.ts';
import { stressWeek } from './stress-week.ts';
import type { ScenarioEvent } from './types.ts';
import { validateScript } from './validate.ts';
import { varyScript } from './vary.ts';

type Of<T extends ScenarioEvent['type']> = Extract<ScenarioEvent, { type: T }>;
const all = <T extends ScenarioEvent['type']>(type: T) => stressWeek.events.filter((e): e is Of<T> => e.type === type);
const DAY = 86400;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe('stressWeek', () => {
  // @spec SCEN-SCRIPT-007
  it('SCEN-SCRIPT-007 passes validateScript and holds the design table, fixed where it says, under one time-lapse act', () => {
    expect(() => validateScript(stressWeek)).not.toThrow();
    expect(stressWeek).toMatchObject({ days: 7, vary: { shiftH: 1, scale: 0.2 }, demo: { id: 'family', level: 5, sector: 1, members: 4 } });
    expect(stressWeek.acts).toEqual([{ atH: 0, mode: 'timelapse', title: 'A week below the floor' }]);
    const f = { fixed: true };
    expect(all('network-down')).toEqual([{ type: 'network-down', atH: 0, durH: 168, ...f }]);
    expect(all('farm-cut')).toEqual([3, 4, 5, 6].map((level) => ({ type: 'farm-cut', atH: 0, level, durH: 168, ...f })));
    expect(all('care')).toEqual([{ type: 'care', atH: 0, durH: 168, red: 12, amber: 24 }]);
    expect(all('outbreak')).toEqual([20, 21, 22, 23].map((sector) => ({ type: 'outbreak', atH: 6, sector, cases: 10, ...f })));
    expect(all('shortfall')).toEqual([{ type: 'shortfall', atH: 12, from: 0.1, to: 0.8, rampH: 2, holdH: 24, recoverH: 2, ...f }]);
    expect(all('flood')).toEqual([{ type: 'flood', atH: 14, sector: 13, inflowM3h: 20, durH: 18 }]);
    expect(all('surface')).toEqual([{ type: 'surface', atH: 24, co: 1500, o3: 2, so2: 20, crews: 5, falsified: 3, bias: 0.01, ...f }]);
    expect(stressWeek.events).toHaveLength(13);
  });
});

describe('the stress week over the harness seeds', () => {
  const final = (seed: number, policy: Policy) => {
    const { series } = runHeadless(stressWeek, seed, policy, { sampleEvery: 7 * DAY, check: false });
    return (id: AdapterId) => series[id]!.value.at(-1)!;
  };
  let runs: { seed: number; d: ReturnType<typeof final>; s: ReturnType<typeof final> }[];
  beforeAll(() => {
    runs = SEEDS.map((seed) => ({ seed, d: final(seed, 'directorate'), s: final(seed, 'stratum') }));
  }, 600_000);

  // @spec SCEN-SCRIPT-008
  it('SCEN-SCRIPT-008 gives STRATUM a worse p13, a p03 above 0, a food floor breach and a p14 no lighter, on every seed', () => {
    for (const { seed, d, s } of runs) {
      // p12's metric stops at the first breach; the floor held to the end only if it reaches the end of the run.
      const c = cutStart(varyScript(stressWeek, seed));
      expect(s('p13'), `seed ${seed}`).toBeGreaterThan(d('p13'));
      expect(s('p03'), `seed ${seed}`).toBeGreaterThan(0);
      expect(s('p12'), `seed ${seed}`).toBeLessThan((stressWeek.days * DAY - c) / DAY);
      expect(s('p14'), `seed ${seed}`).toBeGreaterThanOrEqual(d('p14'));
    }
  });
});
