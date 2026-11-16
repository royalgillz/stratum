// Output pin for the speed work (SCEN-009): digests of the hourly metrics and final world, recorded
// before any speed change, so a faster run is also the same run. No timing here, so it never flakes.
import { describe, expect, it } from 'vitest';
import type { Policy } from '../adapters/shared.ts';
import { hex } from '../witness/ledger.ts';
import { sha256 } from '../witness/sha256.ts';
import { createRun } from './run.ts';
import { sevenDay } from './seven-day.ts';

const ADAPTERS = Array.from({ length: 15 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`);

/** What runHeadless (SCEN-007) does, unchecked (SCEN-008: same outputs as checked): metrics at t 0 and every hour. */
function digest(policy: Policy, days: number, seed: number): string {
  const { kernel: k } = createRun({ ...sevenDay, days }, seed, policy, { check: false });
  const series = [k.metrics()];
  expect(Object.keys(series[0]!)).toEqual(ADAPTERS);
  for (let h = 0; h < days * 24; h++) {
    k.run(3600);
    series.push(k.metrics());
  }
  return hex(sha256(new TextEncoder().encode(JSON.stringify({ series, world: k.world })))).slice(0, 16);
}

const PINNED: Record<string, string> = {
  'directorate 7 1': '756a8ef8131139a5',
  'stratum 7 1': '386dd0d829f8e05e',
  'directorate 30 1': '6f345dcc6e69348a',
  'stratum 30 1': 'af5ab34b48bb8fa5',
  'directorate 7 2': 'cad3da6c6bd9acf4',
  'stratum 7 2': 'b6ccfc5a10fadd1c',
  'directorate 7 3': 'a71a623d2b6e2abd',
  'stratum 7 3': '942bef8c638deb1e',
};

describe('headless run outputs', () => {
  it.each(Object.keys(PINNED))('%s (policy, days, seed) keeps its pinned digest', { timeout: 120_000 }, (key) => {
    const [policy, days, seed] = key.split(' ');
    expect(digest(policy as Policy, Number(days), Number(seed))).toBe(PINNED[key]);
  });
});
