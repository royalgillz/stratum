// The seven-day and 30-day runs in checked mode: wall time only (SCEN-009). digest.test.ts pins their outputs.
import { describe, expect, it } from 'vitest';
import { runHeadless } from './run.ts';
import { sevenDay } from './seven-day.ts';

describe('headless run speed', () => {
  // @spec SCEN-009
  // SCEN-009 is a laptop budget; shared CI runners vary too much in speed, so CI skips the wall-time check (digest.test.ts still pins the output there).
  it.skipIf(!!import.meta.env.CI).each([
    ['directorate', 7, 3000],
    ['stratum', 7, 3000],
    ['directorate', 30, 10000],
    ['stratum', 30, 10000],
  ] as const)(
    'SCEN-009 %s for %i days takes under %i ms',
    { timeout: 300_000, retry: 2 }, // wall time on a shared laptop: a retry measures again after a load spike
    (policy, days, limit) => {
      const t0 = performance.now();
      const { series } = runHeadless({ ...sevenDay, days }, 1, policy);
      const ms = performance.now() - t0;
      console.log(`SCEN-009: ${policy}, ${days} days in ${ms.toFixed(0)} ms`);
      expect(ms).toBeLessThan(limit);
      expect(Object.keys(series)).toHaveLength(15); // all fifteen adapters
    },
  );
});
