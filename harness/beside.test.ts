import { describe, expect, it } from 'vitest';
import type { Policy } from '../src/core/adapters/shared.ts';
import { runHeadless } from '../src/core/scenario/run.ts';
import { sevenDay } from '../src/core/scenario/seven-day.ts';
import { varyScript } from '../src/core/scenario/vary.ts';
import { NO_PROOF } from '../src/core/adapters/p14.ts';
import { beside, replayP14 } from './beside.ts';

const week = (policy: Policy) => {
  const { series, world } = runHeadless(sevenDay, 1, policy, { sampleEvery: 7 * 86400, check: false });
  const proven = replayP14(world, varyScript(sevenDay, 1), 1, policy)?.verified || NO_PROOF;
  return { final: series.p15!.value.at(-1)!, b: beside(world, varyScript(sevenDay, 1), 1, policy), proven, p14: series.p14!.value.at(-1)! };
};

describe('harness beside figures, seven-day seed 1', () => {
  const runs = { directorate: week('directorate'), stratum: week('stratum') };

  it("copies p15's plan: the worst level's wait equals p15's metric under both policies", () => {
    for (const { final, b } of Object.values(runs)) expect(Math.max(...Object.values(b.p15!).map((f) => f.value))).toBeCloseTo(final, 9);
  });

  it("replays p14's plan: its verdict equals p14's metric under both policies", () => {
    for (const { proven, p14 } of Object.values(runs)) expect(proven).toBe(p14);
  });

  it('counts one household per sleeping space under the Directorate and up to three under STRATUM', () => {
    expect(runs.directorate.b.p06!.sharing!.value).toBe(1);
    expect(runs.stratum.b.p06!.sharing!.value).toBeGreaterThan(1);
    expect(runs.stratum.b.p06!.sharing!.value).toBeLessThanOrEqual(3);
  });

  it('scores the seven-day fan stops: 12,000 person-hours unwarned under the Directorate, about half under STRATUM', () => {
    expect(runs.directorate.b.p01!.airUnwarnedH!.value).toBe(12000);
    expect(runs.stratum.b.p01!.airUnwarnedH!.value).toBeCloseTo(6000 + (3000 * 5) / 3600, 9);
  });

  it('gives the trial costs of surface-design: 5,760 person-hours direct, 7,304 staged, no breach against a mask truth', () => {
    expect(runs.directorate.b.p14).toMatchObject({ exposureH: { value: 5760 }, breaches: { value: 0 } });
    expect(runs.stratum.b.p14).toMatchObject({ exposureH: { value: 7304 }, breaches: { value: 0 } });
  });
});
