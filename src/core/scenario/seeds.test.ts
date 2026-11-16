// The seven-day run over the 20 harness seeds under both policies (docs/intent/scenario, "Expected results";
// docs/intent/scenario/scripts). Every event hour is read from run.script, the concrete script of the seed.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Metric } from '../contracts.ts';
import { lifeFloor, powerDemand, sectorId, type Policy } from '../adapters/shared.ts';
import { createRun } from './run.ts';
import { sevenDay } from './seven-day.ts';
import type { ScenarioEvent } from './types.ts';

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
const DT = 60;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const DEMO_S = 17; // level 5 sector 1
const POLICIES = ['directorate', 'stratum'] as const;
const index = (type: ScenarioEvent['type'], atH: number) => sevenDay.events.findIndex((e) => e.type === type && e.atH === atH);
/** A window of hours as step times: from the step holding `a` to the step that ends at or after `b`. */
const steps = (a: number, b: number) => [Math.floor((a * H) / DT) * DT, Math.ceil((b * H) / DT) * DT] as const;

/** One unchecked seven-day run, stepped by hand to watch cut events, floods, sector 17 and p01 in chosen windows. */
function week(seed: number, policy: Policy) {
  tally.cases = 0;
  const run = createRun(sevenDay, seed, policy, { check: false });
  const { kernel: k, script } = run;
  const w = k.world;
  const slowE = script.events[index('shortfall', 30)] as Extract<ScenarioEvent, { type: 'shortfall' }>;
  const tripE = script.events[index('trip', 84)] as Extract<ScenarioEvent, { type: 'trip' }>;
  const slow = steps(slowE.atH, slowE.atH + slowE.rampH + slowE.holdH + slowE.recoverH);
  const trip = steps(tripE.atH, tripE.atH + tripE.durH);
  const act = script.acts.findIndex((a) => a.title === 'Level 5 goes dark: deepest first');
  const dark = [script.acts[act]!.atH * H, script.acts[act + 1]!.atH * H] as const;

  const full = () => w.sectors.map((x, s) => w.alloc.power[sectorId(s)]! >= powerDemand(x.people) * (1 - 1e-9));
  let prev = full();
  let cuts = 0, flooded = false;
  const cutsIn = { slow: 0, trip: 0 };
  const at: Record<number, { cuts: number; p01: number }> = {};
  const demo = { cutInAct: false, minInAct: Infinity, floor: lifeFloor(w.sectors[DEMO_S]!.people) };
  while (w.t < sevenDay.days * 24 * H) {
    if ([...slow, ...trip].includes(w.t)) at[w.t] = { cuts, p01: k.metrics().p01!.value };
    const t0 = w.t, before = w.alloc.power[sectorId(DEMO_S)]!;
    k.step();
    const now = full();
    const n = now.filter((f, s) => prev[s] && !f).length;
    cuts += n;
    if (w.t > slow[0] && w.t <= slow[1]) cutsIn.slow += n;
    if (w.t > trip[0] && w.t <= trip[1]) cutsIn.trip += n;
    prev = now;
    flooded ||= w.tunnels.edges.some((e) => !e.passable);
    const after = w.alloc.power[sectorId(DEMO_S)]!;
    if (t0 >= dark[0] && t0 < dark[1]) {
      demo.cutInAct ||= before >= powerDemand(w.sectors[DEMO_S]!.people) * (1 - 1e-9) && after === 0;
      demo.minInAct = Math.min(demo.minInAct, after);
    }
  }
  const warned = (t: number) => {
    const x = at[t]!.p01 * at[t]!.cuts; // an integer only while p01 counts the same cuts as this test
    expect(Math.abs(x - Math.round(x)), `seed ${seed} ${policy} t ${t}`).toBeLessThan(1e-6);
    return Math.round(x);
  };
  const m = k.metrics() as Record<string, Metric>;
  return {
    cutsIn, warnedSlow: warned(slow[1]) - warned(slow[0]), warnedTrip: warned(trip[1]) - warned(trip[0]), flooded, cases: tally.cases, demo,
    p02: m.p02!.value, p03: m.p03!.value, p05: m.p05!.value,
  };
}

describe('seven-day runs over the harness seeds', () => {
  let runs: Record<Policy, ReturnType<typeof week>[]>;
  beforeAll(() => {
    runs = { directorate: SEEDS.map((s) => week(s, 'directorate')), stratum: SEEDS.map((s) => week(s, 'stratum')) };
  }, 900_000);

  // @spec SCEN-011
  it('cuts during the slow shortfall under both policies, warns one under STRATUM, and warns no plant-trip cut', () => {
    for (const p of POLICIES) {
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
    for (const p of POLICIES) runs[p].forEach((r, i) => expect(r.cases, `${p} seed ${i + 1}`).toBeGreaterThanOrEqual(20));
  });

  // @spec SCEN-SCRIPT-004
  it('SCEN-SCRIPT-004 gives at least two final values of p02 under each policy, and of p03 and p05 under the Directorate', () => {
    const distinct = (p: Policy, id: 'p02' | 'p03' | 'p05') => new Set(runs[p].map((r) => r[id])).size;
    for (const p of POLICIES) expect(distinct(p, 'p02'), p).toBeGreaterThanOrEqual(2);
    expect(distinct('directorate', 'p03')).toBeGreaterThanOrEqual(2);
    expect(distinct('directorate', 'p05')).toBeGreaterThanOrEqual(2);
  });

  // @spec SCEN-SCRIPT-005
  it('SCEN-SCRIPT-005 cuts sector 17 from full to 0 inside the Level 5 act under the Directorate, and keeps its life floor under STRATUM', () => {
    runs.directorate.forEach((r, i) => expect(r.demo.cutInAct, `seed ${i + 1}`).toBe(true));
    runs.stratum.forEach((r, i) => expect(r.demo.minInAct, `seed ${i + 1}`).toBeGreaterThanOrEqual(r.demo.floor * (1 - 1e-9)));
  });
});
