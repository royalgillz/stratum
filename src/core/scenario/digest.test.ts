// Output pin for the speed work (SCEN-009): digests of the hourly metrics and final world, recorded
// before any speed change, so a faster run is also the same run. No timing here, so it never flakes.
import { describe, expect, it } from 'vitest';
import { createP01 } from '../adapters/p01.ts';
import { createP02 } from '../adapters/p02.ts';
import { createP03 } from '../adapters/p03.ts';
import { createP04 } from '../adapters/p04.ts';
import { createP05 } from '../adapters/p05.ts';
import { createP07 } from '../adapters/p07.ts';
import { createP08 } from '../adapters/p08.ts';
import { createP09 } from '../adapters/p09.ts';
import type { Policy } from '../adapters/shared.ts';
import { createKernel } from '../kernel/kernel.ts';
import { hex } from '../witness/ledger.ts';
import { sha256 } from '../witness/sha256.ts';
import { sevenDay } from './seven-day.ts';
import { createWorld } from './world.ts';

const ADAPTERS = [createP01, createP02, createP03, createP04, createP05, createP07, createP08, createP09];

/** What runHeadless (SCEN-007) does, unchecked (SCEN-008: same outputs as checked): metrics at t 0 and every hour. */
function digest(policy: Policy, days: number, seed: number): string {
  const script = { ...sevenDay, days };
  const k = createKernel(createWorld(seed, script), ADAPTERS.map((f) => f(policy, script)), { check: false });
  const series = [k.metrics()];
  for (let h = 0; h < days * 24; h++) {
    k.run(3600);
    series.push(k.metrics());
  }
  return hex(sha256(new TextEncoder().encode(JSON.stringify({ series, world: k.world })))).slice(0, 16);
}

const PINNED: Record<string, string> = {
  'directorate 7 1': 'dbb7d325291bdf72',
  'stratum 7 1': '7430bf0d4c547b03',
  'directorate 30 1': '0d17e0797d172892',
  'stratum 30 1': 'e19f4f1c275797a9',
  'directorate 7 2': '0b692883933282aa',
  'stratum 7 2': '8a37562236adbf17',
  'directorate 7 3': '4518d924aa849799',
  'stratum 7 3': '5de7af4a54e636a6',
};

describe('headless run outputs', () => {
  it.each(Object.keys(PINNED))('%s (policy, days, seed) keeps its pinned digest', { timeout: 120_000 }, (key) => {
    const [policy, days, seed] = key.split(' ');
    expect(digest(policy as Policy, Number(days), Number(seed))).toBe(PINNED[key]);
  });
});
