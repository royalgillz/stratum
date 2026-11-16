// p02 Fair sharing: decides who gets power, water and food, and scores how the worst-off fare
// (design: docs/intent/adapters/power/power-design.md, "p02: power, water and food").
import type { Adapter } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { allocate } from '../fairshare/fairshare.ts';
import { CAP_MARGIN, F0, capacityAt } from '../world/grid/grid.ts';
import { lifeFloor, powerDemand, sectorId, type Policy } from './shared.ts';

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
  return {
    id: 'p02',
    reads: ['grid', 'sectors', 'alloc'],
    writes: ['alloc'],
    step(w, dt) {
      const ids = w.sectors.map((_, s) => sectorId(s));
      const people = w.sectors.map((s) => s.people);
      const fair = (supply: number, floor: number[], demand: number[]) => {
        const shares = allocate(supply, ids.map((id, s) => ({ id, floor: floor[s], demand: demand[s], debt: 0 }))).shares;
        return ids.map((id) => shares[id]);
      };
      const pd = people.map(powerDemand);
      const demandMW = sum(pd);
      const cap = capacityAt(script.events, w.t, CAP_MARGIN * demandMW);
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
        power = fair(target, people.map(lifeFloor), pd);
      }
      // @spec ADAPT-POWER-008
      const wd = people.map((p) => p * WATER_DEMAND);
      const ws = RECYCLE_LPD * sum(people) * served(sum(power), demandMW);
      const water = policy === 'directorate'
        ? prop(ws, wd.map((d, s) => (power[s] > 0 ? d : 0)))
        : fair(ws, people.map((p) => p * WATER_FLOOR), wd);
      // @spec ADAPT-POWER-009
      const fd = people.map((p) => p * FOOD_DEMAND);
      const fs = FOOD_SUPPLY * sum(people);
      const food = policy === 'directorate' ? prop(fs, fd) : fair(fs, people.map((p) => p * FOOD_FLOOR), fd);

      const rec = (xs: number[]) => Object.fromEntries(ids.map((id, s) => [id, xs[s]]));
      w.alloc.power = rec(power);
      w.alloc.water = rec(water);
      w.alloc.food = rec(food);
      // @spec ADAPT-POLICY-008
      if (!got.length) [got, want] = [ids.map(() => [0, 0, 0]), ids.map(() => [0, 0, 0])];
      for (const s of ids.keys()) {
        [power[s], water[s], food[s]].forEach((g, k) => (got[s][k] += g * dt));
        [pd[s], wd[s], fd[s]].forEach((d, k) => (want[s][k] += d * dt));
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
