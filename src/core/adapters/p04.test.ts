import { describe, expect, it } from 'vitest';
import type { WaterQuality, World } from '../contracts.ts';
import { createKernel } from '../kernel/kernel.ts';
import { rng } from '../rng.ts';
import type { ScenarioEvent, Script } from '../scenario/types.ts';
import { createDetector } from '../witness/detector.ts';
import { BASELINE, outlet, tapDelay } from '../world/water/water.ts';
import { createP04 } from './p04.ts';
import type { Policy } from './shared.ts';
import { ownOnly } from './testkit.ts';

const SEED = 7;
const H = 3600;

// Local fixture: 24 sectors of 500 people at baseline water (createWorld is built elsewhere).
function makeWorld(): World {
  const alloc = { power: {}, water: {}, food: {}, cooling: {}, pumps: {}, lampHours: {}, medicine: {}, bunks: {}, trialSlots: {}, returnSlots: {} };
  const sectors = Array.from({ length: 24 }, (_, s) => ({
    level: Math.floor(s / 4) + 1, temp: 24, wetBulb: 18, co2: 940, water: { ...BASELINE }, sumpLevel: 0.3,
    people: 500, sleepM2: 3.5, lightDose: 0, foodKcal: 0, stock: 5,
  }));
  return {
    t: 0, seed: SEED, clock: { mode: 'timelapse', scale: 3600 }, grid: { f: 400, rocof: 0, gapMW: 0, tier: 'GREEN' },
    sectors, tunnels: { nodes: 24, edges: [] }, households: [], ledger: { measured: [], official: [] },
    mesh: { inbox: [], delivered: [] }, alloc, surface: { readings: [], band: 'unknown' },
  };
}

const script = (events: ScenarioEvent[]): Script => ({
  name: 'test', days: 7, demo: { id: 'family', level: 5, sector: 1, members: 4 },
  acts: [{ atH: 0, mode: 'timelapse', title: 'test' }], events,
});
const contam = (atH: number, durH: number, rampH = 0, delta = { cond: 60, toc: 5, turb: 1.5, biocide: -1.5 }): ScenarioEvent => ({
  type: 'contamination', atH, level: 5, rampH, durH, delta,
});

/** Every step's six outlets replayed from p04's stream: out[step][level - 1]. */
function replay(events: ScenarioEvent[], steps: number): WaterQuality[][] {
  const r = rng(SEED, 'p04');
  return Array.from({ length: steps }, (_, i) => [1, 2, 3, 4, 5, 6].map((l) => outlet(l, i * 60, events, r)));
}

function run(policy: Policy, events: ScenarioEvent[], seconds: number) {
  const w = makeWorld();
  const p04 = ownOnly(createP04(policy, script(events)), w, (c) => c.sectors.forEach((x) => (x.water = BASELINE)), /^water\./);
  const k = createKernel(w, [p04], { dt: 60, check: true });
  k.run(seconds);
  return { w, metric: k.metrics().p04! };
}

// Contamination A (5 h to 7 h) is sampled at 06:00 day 1 and published 30 h; the 30 h sample is safe and
// lifts the hold at 54 h, inside contamination B (50 h to 80 h), whose 54 h sample puts it back at 78 h.
const TWO = [contam(5, 2), contam(50, 30)];
const runs = { directorate: run('directorate', TWO, 130 * H), stratum: run('stratum', TWO, 130 * H) };

describe('p04 water', () => {
  // @spec ADAPT-EVIDENCE-001
  it('sets each tap to its level outlet from tapDelay earlier, baseline before that, from outlets drawn in level order', () => {
    const events = [contam(1, 2)];
    const out = replay(events, 150);
    const a = run('stratum', events, 150 * 60);
    const t = 149 * 60; // the last step
    a.w.sectors.forEach((sec, s) => expect(sec.water).toEqual(out[(t - tapDelay(s % 4)) / 60]![sec.level - 1]));
    const young = run('directorate', events, 30 * 60);
    young.w.sectors.forEach((sec) => expect(sec.water).toEqual(BASELINE));
    const p = createP04('stratum', script([]));
    expect([p.id, p.reads, p.writes]).toEqual(['p04', ['sectors'], ['sectors', 'ledger']]);
  });

  // @spec ADAPT-EVIDENCE-003, ADAPT-EVIDENCE-005
  it('Directorate: holds a level from a published unsafe 06:00 sample until a later safe one, counting person-hours drunk', () => {
    const m = runs.directorate.metric;
    expect([m.name, m.unit, m.label]).toEqual(['person-hours of unsafe water drunk', 'person-h', 'SIMULATED']);
    // A: 4 taps x 500 people x 2 h unheld. B: held until 54 h, drunk 54 h to 78 h, held again from 78 h.
    expect(m.value).toBeCloseTo(4 * 500 * 2 + 4 * 500 * 24, 3);
  });

  // @spec ADAPT-EVIDENCE-002, ADAPT-EVIDENCE-005
  it('STRATUM: the detector hold starts before the first tap and lasts the longest tap delay past the last event', () => {
    expect(runs.stratum.metric.value).toBe(0);
  });

  // @spec ADAPT-EVIDENCE-002
  it('STRATUM: a biocide-only drop, which moves no other channel, still trips the detector and holds the level', () => {
    const events = [contam(5, 2, 0, { cond: 0, toc: 0, turb: 0, biocide: -1.5 })];
    expect(run('directorate', events, 10 * H).metric.value).toBeGreaterThan(0);
    expect(run('stratum', events, 10 * H).metric.value).toBe(0);
  });

  // @spec ADAPT-EVIDENCE-002, ADAPT-EVIDENCE-003
  it('STRATUM: the official hold still holds a level when a ramp too slow for the detector goes unsafe', () => {
    const events = [contam(5, 200, 100)]; // toc crosses 3 near 55 h; the 78 h sample is published at 102 h
    const d = createDetector();
    replay(events, 110 * 60).forEach((out, i) => {
      for (const c of ['cond', 'toc', 'turb', 'biocide'] as const) d.push(`water.${c}`, 'L5', i * 60, out[4]![c]);
    });
    expect(d.events).toEqual([]);
    const directorate = run('directorate', events, 110 * H).metric.value;
    expect(directorate).toBeGreaterThan(0);
    expect(run('stratum', events, 110 * H).metric.value).toBe(directorate);
  }, 60000);

  // @spec ADAPT-EVIDENCE-004
  it('ledgers published grab results under both policies and hourly sensor TOC under STRATUM only', () => {
    const out = replay(TWO, 130 * 60);
    const official = [30, 54, 78, 102, 126].flatMap((h) => [1, 2, 3, 4, 5, 6].map((l) => ({
      t: h * H, kind: 'water.toc', where: `L${l}`, value: out[((h - 24) * H) / 60]![l - 1]!.toc, source: 'official',
    })));
    const strip = (es: World['ledger']['official']) => es.map(({ hash: _h, ...e }) => e);
    const sort = (es: ReturnType<typeof strip>) => [...es].sort((a, b) => a.t - b.t || a.where.localeCompare(b.where));
    for (const r of Object.values(runs)) expect(sort(strip(r.w.ledger.official))).toEqual(official);
    expect(runs.directorate.w.ledger.measured).toEqual([]);
    const sensor = Array.from({ length: 130 }, (_, h) => [1, 2, 3, 4, 5, 6].map((l) => ({
      t: h * H, kind: 'water.toc', where: `L${l}`, value: out[h * 60]![l - 1]!.toc, source: `sensor:L${l}`,
    }))).flat();
    expect(strip(runs.stratum.w.ledger.measured)).toEqual(sensor);
  });
});
