// p09 outbreak (design: docs/intent/adapters/evidence/evidence-design.md, "p09: outbreak"). Constants: docs/params.md.
import type { Adapter, Allocation } from '../contracts.ts';
import { allocate } from '../fairshare/fairshare.ts';
import type { Script } from '../scenario/types.ts';
import { chapman } from '../witness/chapman.ts';
import { createWitness } from '../witness/witness.ts';
import { createEpidemic, epiStep, seed, type EpiState } from '../world/epidemic/epidemic.ts';
import { sectorId, type Policy } from './shared.ts';

export const MED_SUPPLY = 20; // courses/day
export const CASE_WINDOW = 5; // days
const DAY = 86400;
const HOUR = 3600;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const total = (lists: number[][]) => sum(lists.map(sum));

/** Each sector's cases over the case period at 00:00 of day `d`: days `d - CASE_WINDOW` to `d - 1`. */
export const caseWindow = (lists: number[][], d: number) => lists.map((days) => sum(days.slice(Math.max(0, d - CASE_WINDOW), d)));

/** One day's medicine from per-sector counts over the case period (clinic n1, residents n2, both m): the shares and the courses held over. */
// @spec ADAPT-EVIDENCE-007, ADAPT-EVIDENCE-008
export function handOut(policy: Policy, courses: number, n1: number[], n2: number[], m: number[]): { shares: Allocation; held: number } {
  const ids = n1.map((_, s) => sectorId(s));
  if (policy === 'directorate') {
    const cases = sum(n1);
    return { shares: Object.fromEntries(ids.map((id, s) => [id, cases ? (courses * n1[s]!) / cases : 0])), held: cases ? 0 : courses };
  }
  const n = chapman(sum(n1), sum(n2), sum(m)).n;
  const list = sum(n2) > 0 ? n2 : n1; // with no residents' reports m is 0 too, so the union n1 + n2 - m is n1
  const listed = sum(list);
  const r = allocate(courses, ids.map((id, s) => ({ id, floor: 0, demand: listed ? (n * list[s]!) / listed : 0, debt: 0 })));
  return { shares: r.shares, held: r.surplus };
}

export function createP09(policy: Policy, script: Script): Adapter {
  let epi: EpiState | undefined;
  let witness: ReturnType<typeof createWitness> | undefined;
  let held = 0; // courses
  let truth = 0; // new infectious cases since t = 0

  const figure = (e: EpiState) => {
    const n1 = total(e.clinic);
    return policy === 'directorate' ? n1 : chapman(n1, total(e.residents), total(e.both)).n;
  };

  return {
    id: 'p09',
    reads: ['sectors', 'alloc'],
    writes: ['sectors', 'alloc', 'ledger'],
    // @spec ADAPT-EVIDENCE-006
    step(world, dt, rng) {
      const { t, sectors } = world;
      epi ??= createEpidemic(sectors.map((x) => x.people));
      witness ??= createWitness({ now: () => world.t, ledger: world.ledger });
      for (const e of script.events) {
        if (e.type === 'outbreak' && e.atH * HOUR >= t && e.atH * HOUR < t + dt) seed(epi, e.sector, e.cases);
      }
      const midnight = t % DAY === 0;
      // @spec ADAPT-EVIDENCE-009
      if (midnight) {
        const d = t / DAY;
        const r = handOut(policy, MED_SUPPLY + held, caseWindow(epi.clinic, d), caseWindow(epi.residents, d), caseWindow(epi.both, d));
        held = r.held;
        world.alloc.medicine = r.shares;
        sectors.forEach((x, s) => (x.stock += r.shares[sectorId(s)]!));
      }
      if (t % HOUR === 0) {
        const r = epiStep(epi, t, sectors.map((x) => x.co2), sectors.map((x) => x.stock), HOUR, rng, script.model?.capture);
        sectors.forEach((x, s) => (x.stock -= r.coursesUsed[s]!));
        truth += sum(r.newCases);
      }
      // @spec ADAPT-EVIDENCE-010
      if (midnight) {
        witness.observe('cases', 'district', total(epi.clinic), 'official');
        if (policy === 'stratum') {
          witness.observe('cases', 'district', figure(epi), 'estimate:capture-recapture');
          witness.observe('cases.both', 'district', total(epi.both), 'estimate:capture-recapture');
        }
      }
    },
    // @spec ADAPT-EVIDENCE-011
    metric: () => ({
      name: 'case-count relative error',
      value: epi ? Math.abs(figure(epi) - truth) / Math.max(1, truth) : 0,
      unit: 'ratio',
      label: 'SIMULATED',
    }),
  };
}
