// p12 food: keeps each sector's store, decides what it eats when the farms stop, and scores how long the floor holds
// (design: docs/intent/adapters/lightfood/lightfood-design.md, "p12: food").
import type { Adapter } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { GROW_KW, GROW_LAMP_H, STAPLE, STOCK_DAYS, bestCrop, grown } from '../world/lightfood/lightfood.ts';
import { FOOD_FLOOR, FOOD_SUPPLY } from './p02.ts';
import { served } from './p03.ts';
import { powerDemand, sectorId, type Policy } from './shared.ts';

const DAY = 86400;

/** The first daily decision a farm cut covers (the first missed delivery), s; Infinity with none. */
export const cutStart = (script: Script) => Math.min(...script.events.flatMap((e) => {
  if (e.type !== 'farm-cut') return [];
  const d = Math.ceil(e.atH * 3600 / DAY) * DAY;
  return d < (e.atH + e.durH) * 3600 ? [d] : [];
}));

export function createP12(policy: Policy, script: Script): Adapter {
  const crop = policy === 'directorate' ? STAPLE : bestCrop();
  const c = cutStart(script); // b: the first decision from c with a breach
  let b = Infinity;
  let grew: number[] | null = null; // per sector: kcal grown since the last daily decision
  return {
    id: 'p12',
    reads: ['sectors', 'alloc'],
    writes: ['sectors'],
    step(w) {
      const { t, sectors, alloc } = w; // read once: each world read costs a guard call in checked mode
      // @spec ADAPT-LIGHTFOOD-004, ADAPT-POLICY-008
      if (!grew) {
        grew = sectors.map(() => 0);
        for (const x of sectors) x.foodKcal = STOCK_DAYS * FOOD_SUPPLY * x.people;
      }
      if (t % DAY === 0) {
        sectors.forEach((x, s) => {
          const p = x.people, arrivals = alloc.food[sectorId(s)] + grew![s];
          let eaten: number;
          if (policy === 'directorate') {
            // @spec ADAPT-LIGHTFOOD-005
            const have = x.foodKcal + arrivals;
            eaten = Math.min(FOOD_SUPPLY * p, have);
            x.foodKcal = have - eaten;
          } else {
            // @spec ADAPT-LIGHTFOOD-006
            const e = Math.min(FOOD_SUPPLY * p, arrivals);
            const store = x.foodKcal + arrivals - e;
            const more = Math.min(store, Math.max(0, FOOD_FLOOR * p - e));
            x.foodKcal = store - more;
            eaten = e + more;
          }
          if (t >= c && b === Infinity && eaten < FOOD_FLOOR * p * (1 - 1e-9)) b = t;
        });
        grew.fill(0);
      }
      if (t % 3600 === 0) {
        sectors.forEach((x, s) => (grew![s] += grown(GROW_KW * GROW_LAMP_H / 24 * served(alloc.power[sectorId(s)], powerDemand(x.people)), crop)));
      }
    },
    // @spec ADAPT-LIGHTFOOD-007
    metric: (w) => ({ name: 'days the food floor held after a farm cut-off', value: w.t >= c ? (Math.min(w.t, b) - c) / DAY : 0, unit: 'days', label: 'SIMULATED' }),
  };
}
