// The seven-day run over the 20 harness seeds under both policies (docs/intent/scenario, "Expected results").
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { powerDemand, sectorId, type Policy } from '../adapters/shared.ts';
import { createRun } from './run.ts';
import { sevenDay } from './seven-day.ts';

// Tallies new infectious cases (seeds excluded) as p09's epidemic steps, passing everything through.
const tally = vi.hoisted(() => ({ cases: 0 }));
vi.mock('../world/epidemic/epidemic.ts', async (orig) => {
  const m = await orig<typeof import('../world/epidemic/epidemic.ts')>();
  return {
    ...m,
    epiStep: (...a: Parameters<typeof m.epiStep>) => {
      const r = m.epiStep(...a);
      tally.cases += r.newCases.reduce((x, y) => x + y, 0);
      return r;
    },
  };
});

const H = 3600;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

/** One unchecked seven-day run, stepped by hand to watch cut events, floods and p01 at chosen hours. */
function week(seed: number, policy: Policy) {
  tally.cases = 0;
  const { kernel: k } = createRun(sevenDay, seed, policy, { check: false });
  const w = k.world;
  const full = () => w.sectors.map((x, s) => w.alloc.power[sectorId(s)]! >= powerDemand(x.people) * (1 - 1e-9));
  let prev = full();
  let cuts = 0, flooded = false;
  const cutsIn = { slow: 0, trip: 0 };
  const at: Record<number, { cuts: number; p01: number }> = {};
  while (w.t < sevenDay.days * 24 * H) {
    if ([30, 50, 83, 95].includes(w.t / H)) at[w.t / H] = { cuts, p01: k.metrics().p01!.value };
    k.step();
    const now = full();
    const n = now.filter((f, s) => prev[s] && !f).length;
    cuts += n;
    if (w.t > 30 * H && w.t <= 50 * H) cutsIn.slow += n;
    if (w.t > 84 * H && w.t <= 95 * H) cutsIn.trip += n;
    prev = now;
    flooded ||= w.tunnels.edges.some((e) => !e.passable);
  }
  const warned = (h: number) => {
    const x = at[h]!.p01 * at[h]!.cuts; // an integer only while p01 counts the same cuts as this test
    expect(Math.abs(x - Math.round(x)), `seed ${seed} ${policy} hour ${h}`).toBeLessThan(1e-6);
    return Math.round(x);
  };
  return { cutsIn, warnedSlow: warned(50) - warned(30), warnedTrip: warned(95) - warned(83), flooded, p05: k.metrics().p05!.value, cases: tally.cases };
}

describe('seven-day runs over the harness seeds', () => {
  let runs: Record<Policy, ReturnType<typeof week>[]>;
  beforeAll(() => {
    runs = { directorate: SEEDS.map((s) => week(s, 'directorate')), stratum: SEEDS.map((s) => week(s, 'stratum')) };
  }, 900_000);

  // @spec SCEN-011
  it('cuts during the slow shortfall under both policies, warns one under STRATUM, and warns no plant-trip cut', () => {
    for (const p of ['directorate', 'stratum'] as const) {
      runs[p].forEach((r, i) => {
        expect(r.cutsIn.slow, `${p} seed ${i + 1}`).toBeGreaterThan(0);
        expect(r.cutsIn.trip, `${p} seed ${i + 1}`).toBeGreaterThan(0);
        expect(r.warnedTrip, `${p} seed ${i + 1}`).toBe(0);
        if (p === 'stratum') expect(r.warnedSlow, `seed ${i + 1}`).toBeGreaterThan(0);
        else expect(r.warnedSlow).toBe(0);
      });
    }
  });

  // @spec SCEN-012
  it('floods a sump under the Directorate and gives at least 20 new infectious cases under each policy', () => {
    runs.directorate.forEach((r, i) => {
      expect(r.flooded, `seed ${i + 1}`).toBe(true);
      expect(r.p05, `seed ${i + 1}`).toBeGreaterThan(0);
    });
    for (const p of ['directorate', 'stratum'] as const) runs[p].forEach((r, i) => expect(r.cases, `${p} seed ${i + 1}`).toBeGreaterThanOrEqual(20));
  });
});
