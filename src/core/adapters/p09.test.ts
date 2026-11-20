import { describe, expect, it } from 'vitest';
import type { Adapter, Allocation, World } from '../contracts.ts';
import { createKernel } from '../kernel/kernel.ts';
import { rng } from '../rng.ts';
import type { ScenarioEvent, Script } from '../scenario/types.ts';
import { chapman } from '../witness/chapman.ts';
import { verifyChain } from '../witness/ledger.ts';
import { CO2_REF, createEpidemic, epiStep, seed } from '../world/epidemic/epidemic.ts';
import { BASELINE } from '../world/water/water.ts';
import { sevenDay } from '../scenario/seven-day.ts';
import { createP04 } from './p04.ts';
import { caseWindow, createP09, handOut, MED_SUPPLY } from './p09.ts';
import { sectorId, type Policy } from './shared.ts';
import { ownOnly } from './testkit.ts';

const SEED = 11;
const DAY = 86400;

// Local fixture: 24 sectors of 400 + 10 s people at CO2_REF + 50 s ppm with 5 courses each (createWorld is built elsewhere).
function makeWorld(): World {
  const alloc = { power: {}, water: {}, food: {}, cooling: {}, pumps: {}, lampHours: {}, medicine: {}, bunks: {}, trialSlots: {}, returnSlots: {} };
  const sectors = Array.from({ length: 24 }, (_, s) => ({
    level: Math.floor(s / 4) + 1, temp: 24, wetBulb: 18, co2: CO2_REF + 50 * s, water: { ...BASELINE }, sumpLevel: 0.3,
    people: 400 + 10 * s, sleepM2: 3.5, lightDose: 0, foodKcal: 0, stock: 5,
  }));
  return {
    t: 0, seed: SEED, clock: { mode: 'timelapse', scale: 3600 }, grid: { f: 400, rocof: 0, gapMW: 0, tier: 'GREEN' },
    sectors, tunnels: { nodes: 24, edges: [] }, households: [], ledger: { measured: [], official: [] },
    mesh: { inbox: [], delivered: [] }, alloc, surface: { readings: [], band: 'unknown' },
  };
}

const EVENTS: ScenarioEvent[] = [20, 21, 22, 23].map((sector) => ({ type: 'outbreak', atH: 6, sector, cases: 10 }));
const script: Script = {
  name: 'test', days: 7, demo: { id: 'family', level: 5, sector: 1, members: 4 },
  acts: [{ atH: 0, mode: 'timelapse', title: 'test' }], events: EVENTS,
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const zeros = (n = 24) => Array<number>(n).fill(0);
const at = (pairs: Record<number, number>) => zeros().map((_, s) => pairs[s] ?? 0);
const keyed = (xs: number[]): Allocation => Object.fromEntries(xs.map((x, s) => [sectorId(s), x]));

/** The step order of ADAPT-EVIDENCE-006 replayed by hand on p09's stream, recording each day's cumulative lists. */
function mirror(policy: Policy, steps: number, capture?: number) {
  const r = rng(SEED, 'p09');
  const { sectors } = makeWorld();
  const epi = createEpidemic(sectors.map((x) => x.people));
  const stock = Array(24).fill(5);
  let held = 0;
  let truth = 0;
  let med: Allocation = {};
  const days: { t: number; n1: number; n2: number; m: number }[] = [];
  const tot = (l: number[][]) => sum(l.map(sum));
  for (let i = 0; i < steps; i++) {
    const t = i * 60;
    for (const e of EVENTS) if (e.type === 'outbreak' && e.atH * 3600 >= t && e.atH * 3600 < t + 60) seed(epi, e.sector, e.cases);
    if (t % DAY === 0) {
      const d = t / DAY;
      const h = handOut(policy, MED_SUPPLY + held, caseWindow(epi.clinic, d), caseWindow(epi.residents, d), caseWindow(epi.both, d));
      held = h.held;
      med = h.shares;
      stock.forEach((_, s) => (stock[s] += h.shares[sectorId(s)]!));
    }
    if (t % 3600 === 0) {
      const res = epiStep(epi, t, sectors.map((x) => x.co2), [...stock], 3600, r, capture);
      res.coursesUsed.forEach((u, s) => (stock[s] -= u));
      truth += sum(res.newCases);
    }
    if (t % DAY === 0) days.push({ t, n1: tot(epi.clinic), n2: tot(epi.residents), m: tot(epi.both) });
  }
  return { stock, med, truth, days, cum: days[days.length - 1]! };
}

const own09 = (a: Adapter, w: World) => ownOnly(a, w, (c) => { c.sectors.forEach((x) => (x.stock = 0)); c.alloc.medicine = {}; }, /^cases/);
const own04 = (a: Adapter, w: World) => ownOnly(a, w, (c) => c.sectors.forEach((x) => (x.water = BASELINE)), /^water\./);

function run(policy: Policy, seconds: number, s: Script = script) {
  const w = makeWorld();
  const k = createKernel(w, [own09(createP09(policy, s), w)], { dt: 60, check: true });
  k.run(seconds);
  return { w, metric: k.metrics().p09! };
}

const SPAN = 6 * DAY + 60; // takes the 00:00 step of day 6
const runs = { directorate: run('directorate', SPAN), stratum: run('stratum', SPAN) };
const mirrors = { directorate: mirror('directorate', SPAN / 60), stratum: mirror('stratum', SPAN / 60) };

describe('p09 outbreak', () => {
  // @spec ADAPT-EVIDENCE-007, ADAPT-EVIDENCE-008
  it('takes the case window at 00:00 of day d as days d - 5 to d - 1, clipped at day 0', () => {
    const lists = [[1, 2, 4, 8, 16, 32, 64, 128], [3]];
    expect(caseWindow(lists, 7)).toEqual([4 + 8 + 16 + 32 + 64, 0]);
    expect(caseWindow(lists, 3)).toEqual([1 + 2 + 4, 3]);
    expect(caseWindow(lists, 0)).toEqual([0, 0]);
  });

  // @spec ADAPT-EVIDENCE-007
  it('Directorate: splits courses by clinic cases in the window, holding all over when there are none', () => {
    expect(handOut('directorate', 20, at({ 20: 2, 21: 6 }), zeros(), zeros())).toEqual({ shares: keyed(at({ 20: 5, 21: 15 })), held: 0 });
    expect(handOut('directorate', 20, zeros(), at({ 3: 4 }), zeros())).toEqual({ shares: keyed(zeros()), held: 20 });
  });

  // @spec ADAPT-EVIDENCE-008
  it('STRATUM: gives each sector the pooled Chapman estimate times its share of the residents list, by Fair Share', () => {
    // N = 11 x 9 / 5 - 1 = 18.8; residents' list 6 : 2 gives demands 14.1 and 4.7.
    const n1 = at({ 20: 7, 21: 3 });
    const n2 = at({ 20: 6, 21: 2 });
    const m = at({ 20: 3, 21: 1 });
    const full = handOut('stratum', 25, n1, n2, m);
    expect(full.shares.s20).toBeCloseTo(14.1, 9);
    expect(full.shares.s21).toBeCloseTo(4.7, 9);
    expect(full.held).toBeCloseTo(6.2, 9);
    const short = handOut('stratum', 10, n1, n2, m);
    expect([short.shares.s20, short.shares.s21, short.held]).toEqual([expect.closeTo(5.3, 9), expect.closeTo(4.7, 9), 0]);
    // No residents' reports: the union (here the clinic list) splits N = chapman(4, 0, 0) = 4.
    const union = handOut('stratum', 20, at({ 20: 3, 23: 1 }), zeros(), zeros());
    expect([union.shares.s20, union.shares.s23, union.held]).toEqual([3, 1, 16]);
    expect(handOut('stratum', 20, zeros(), zeros(), zeros())).toEqual({ shares: keyed(zeros()), held: 20 });
    expect(Object.keys(full.shares)).toEqual(zeros().map((_, s) => sectorId(s)));
  });

  // @spec ADAPT-EVIDENCE-006, ADAPT-EVIDENCE-009
  it('seeds, hands out medicine, steps the epidemic hourly and writes shares to alloc.medicine and stock, in that order', () => {
    for (const p of ['directorate', 'stratum'] as const) {
      const { w } = runs[p];
      const mm = mirrors[p];
      expect(mm.truth).toBeGreaterThan(0);
      expect(sum(Object.values(mm.med))).toBeGreaterThan(0); // medicine was really handed out
      expect(w.alloc.medicine).toEqual(mm.med);
      w.sectors.forEach((sec, s) => expect(sec.stock).toBeCloseTo(mm.stock[s]!, 9));
    }
    const p = createP09('stratum', script);
    expect([p.id, p.reads, p.writes]).toEqual(['p09', ['sectors', 'alloc'], ['sectors', 'alloc', 'ledger']]);
  });

  // @spec ADAPT-EVIDENCE-006
  it('passes script.model.capture to epiStep', () => {
    const { w } = run('directorate', 2 * DAY + 60, { ...script, model: { capture: 0.5 } });
    const half = mirror('directorate', (2 * DAY + 60) / 60, 0.5);
    expect(w.alloc.medicine).toEqual(half.med);
    expect(half.cum.n1).not.toBe(mirror('directorate', (2 * DAY + 60) / 60).cum.n1);
  }, 30_000);

  // @spec ADAPT-EVIDENCE-010
  it('ledgers the clinic count daily under both policies and the Chapman estimate and both-list count under STRATUM', () => {
    const strip = (es: World['ledger']['official']) => es.map(({ hash: _h, ...e }) => e);
    for (const p of ['directorate', 'stratum'] as const) {
      const { w } = runs[p];
      expect(strip(w.ledger.official)).toEqual(mirrors[p].days.map((d) => ({ t: d.t, kind: 'cases', where: 'district', value: d.n1, source: 'official' })));
      expect(verifyChain(w.ledger.official, 'official')).toEqual({ ok: true });
    }
    expect(runs.directorate.w.ledger.measured).toEqual([]);
    const src = 'estimate:capture-recapture';
    expect(strip(runs.stratum.w.ledger.measured)).toEqual(mirrors.stratum.days.flatMap((d) => [
      { t: d.t, kind: 'cases', where: 'district', value: chapman(d.n1, d.n2, d.m).n, source: src },
      { t: d.t, kind: 'cases.both', where: 'district', value: d.m, source: src },
    ]));
  });

  // @spec ADAPT-EVIDENCE-011
  it('reports the relative error of the figure each policy acts on against new infectious cases', () => {
    for (const p of ['directorate', 'stratum'] as const) {
      const { n1, n2, m } = mirrors[p].cum;
      const truth = mirrors[p].truth;
      const figure = p === 'directorate' ? n1 : chapman(n1, n2, m).n;
      const metric = runs[p].metric;
      expect([metric.name, metric.unit, metric.label]).toEqual(['case-count relative error', 'ratio', 'SIMULATED']);
      expect(metric.value).toBeCloseTo(Math.abs(figure - truth) / Math.max(1, truth), 12);
    }
    expect(createP09('directorate', script).metric(makeWorld()).value).toBe(0);
  });

  // @spec ADAPT-EVIDENCE-004, ADAPT-EVIDENCE-010
  it('shares the ledger chains with p04 through the seven-day script under either policy, writing only its own kinds', () => {
    for (const p of ['directorate', 'stratum'] as const) {
      const w = makeWorld();
      const k = createKernel(w, [own04(createP04(p, sevenDay), w), own09(createP09(p, sevenDay), w)], { dt: 60, check: true });
      k.run(60 * 3600); // through the hour-52 contamination and two midnights
      for (const chain of ['measured', 'official'] as const) expect(verifyChain(w.ledger[chain], chain)).toEqual({ ok: true });
      const kinds = new Set([...w.ledger.measured, ...w.ledger.official].map((e) => e.kind));
      expect([...kinds].sort()).toEqual(p === 'stratum' ? ['cases', 'cases.both', 'water.toc'] : ['cases', 'water.toc']);
      const m = k.metrics();
      expect(Number.isFinite(m.p09!.value)).toBe(true);
      if (p === 'stratum') expect(m.p04!.value).toBe(0); // the ramp is caught before any tap runs bad
      else expect(m.p04!.value).toBeGreaterThan(0);
    }
  }, 60000);
});
