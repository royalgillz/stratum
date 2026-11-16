// p02 Fair sharing: decides who gets power, water and food, and scores how the worst-off fare
// (design: docs/intent/adapters/power/power-design.md, "p02: power, water and food").
import type { Adapter } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { allocate } from '../fairshare/fairshare.ts';
import { CAP_MARGIN, F0, capacityAt } from '../world/grid/grid.ts';
import { farmCut } from '../world/lightfood/lightfood.ts';
import { bySector, lastOf, lifeFloor, powerDemand, sectorId, type Policy } from './shared.ts';

// docs/params.md
export const SHED_HZ = 1.0; // Hz below F0
export const RESERVE = 0.02; // target load is capacity / (1 + RESERVE) while shedding
export const RECYCLE_LPD = 40; // L/person/day at full grid supply
export const WATER_FLOOR = 15; // L/person/day
export const WATER_DEMAND = 50; // L/person/day
export const FOOD_SUPPLY = 2300; // kcal/person/day
export const FOOD_FLOOR = 2100; // kcal/person/day
export const FOOD_DEMAND = 2500; // kcal/person/day
export const WORST = 0.1; // the worst-off share of people

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const served = (g: number, d: number) => (d > 0 ? Math.min(1, Math.max(0, g / d)) : 1);
const prop = (supply: number, d: number[], t = sum(d)) => d.map((x) => (t > 0 ? (supply * x) / t : 0));

export function createP02(policy: Policy, script: Script): Adapter {
  let shedding = false;
  let got: number[][] = []; // per sector: cumulative granted power, water, food (good-units x s)
  let want: number[][] = []; // per sector: cumulative demanded, same units
  const cuts = script.events.filter((e) => e.type === 'farm-cut'); // farmCut reads only these; filtered once, it runs every step
  const memo = { power: lastOf<number[]>(), water: lastOf<number[]>(), food: lastOf<number[]>() }; // food and water rarely change
  return {
    id: 'p02',
    reads: ['grid', 'sectors', 'alloc'],
    writes: ['alloc'],
    step(w, dt) {
      const t = w.t;
      const people = w.sectors.map((s) => s.people); // one pass: each world read costs a guard call in checked mode
      const ids = people.map((_, s) => sectorId(s));
      const fair = (good: keyof typeof memo, supply: number, floor: number[], demand: number[]) => memo[good]([supply, ...floor, ...demand], () => {
        const shares = allocate(supply, ids.map((id, s) => ({ id, floor: floor[s], demand: demand[s], debt: 0 }))).shares;
        return ids.map((id) => shares[id]);
      });
      const pd = people.map(powerDemand);
      const demandMW = sum(pd);
      const cap = capacityAt(script.events, t, CAP_MARGIN * demandMW);
      // @spec ADAPT-POWER-005
      if (w.grid.f <= F0 - SHED_HZ) shedding = true;
      if (cap >= demandMW * (1 + RESERVE)) shedding = false; // capacity with reserve ends a shed even on a low f
      const target = cap / (1 + RESERVE);
      let power = pd;
      if (shedding && policy === 'directorate') {
        // @spec ADAPT-POWER-006
        const on = pd.map((d, s) => w.alloc.power[ids[s]] >= d * (1 - 1e-9));
        let load = sum(pd.filter((_, s) => on[s]));
        for (let s = ids.length - 1; s >= 0 && load > target; s--) {
          if (on[s]) [on[s], load] = [false, load - pd[s]];
        }
        for (let s = 0; s < ids.length; s++) {
          if (!on[s] && load + pd[s] <= target) [on[s], load] = [true, load + pd[s]];
        }
        power = pd.map((d, s) => (on[s] ? d : 0));
      } else if (shedding) {
        // @spec ADAPT-POWER-007
        power = fair('power', target, people.map(lifeFloor), pd);
      }
      // @spec ADAPT-POWER-008
      const wd = people.map((p) => p * WATER_DEMAND);
      const ws = RECYCLE_LPD * sum(people) * served(sum(power), demandMW);
      const water = policy === 'directorate'
        ? prop(ws, wd.map((d, s) => (power[s] > 0 ? d : 0)))
        : fair('water', ws, people.map((p) => p * WATER_FLOOR), wd);
      // @spec ADAPT-POWER-009
      const fd = people.map((p) => p * FOOD_DEMAND);
      const fed = cuts.length ? w.sectors.map((x) => !farmCut(cuts, x.level, t)) : people.map(() => true); // no cut: skip the guarded level reads
      const fs = FOOD_SUPPLY * sum(people.map((p, s) => (fed[s] ? p : 0)));
      const food = policy === 'directorate'
        ? prop(fs, fd.map((d, s) => (fed[s] ? d : 0)))
        : fair('food', fs, people.map((p) => p * FOOD_FLOOR), fd);

      w.alloc.power = bySector(power);
      w.alloc.water = bySector(water);
      w.alloc.food = bySector(food);
      // @spec ADAPT-POLICY-008
      if (!got.length) [got, want] = [ids.map(() => [0, 0, 0]), ids.map(() => [0, 0, 0])];
      for (const s of ids.keys()) {
        const g = got[s], d = want[s]; // plain adds: this runs for every sector on every step
        g[0] += power[s] * dt, g[1] += water[s] * dt, g[2] += food[s] * dt;
        d[0] += pd[s] * dt, d[1] += wd[s] * dt, d[2] += fd[s] * dt;
      }
    },
    // @spec ADAPT-POWER-010
    metric(w) {
      const people = w.sectors.map((s) => s.people);
      let need = WORST * sum(people);
      const out = { name: 'worst-decile served fraction', value: 0, unit: 'share', label: 'SIMULATED' as const };
      if (!got.length || !(need > 0)) return out;
      const score = got.map((g, s) => sum(g.map((x, k) => served(x, want[s][k]))) / 3);
      let acc = 0;
      for (const s of [...score.keys()].sort((a, b) => score[a] - score[b])) {
        const take = Math.min(need, people[s]);
        acc += take * score[s];
        need -= take;
        if (need <= 0) break;
      }
      return { ...out, value: acc / (WORST * sum(people)) };
    },
  };
}
