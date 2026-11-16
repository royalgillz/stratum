// p15 return (design: docs/intent/adapters/surface/surface-design.md, "p15: return"). Constants: docs/params.md.
import type { Adapter } from '../contracts.ts';
import { nextDebt, rotate } from '../fairshare/fairshare.ts';
import type { Script } from '../scenario/types.ts';
import { returnPerDay } from '../world/surface/surface.ts';
import { bySector, weight, type Policy } from './shared.ts';

export function createP15(policy: Policy, _script: Script): Adapter {
  let worst: number | undefined; // set once, by the plan on the first step

  return {
    id: 'p15',
    reads: ['households', 'sectors'],
    writes: ['alloc'],
    // @spec ADAPT-SURFACE-008, ADAPT-SURFACE-009, ADAPT-SURFACE-010
    step(world, _dt, rng) {
      if (worst !== undefined) return;
      const w = world.sectors.map((_, s) => weight(world, s));
      // A household standing for nobody (d 0) can never win a rotation, so it is left out of the plan.
      const all = world.households
        .map((h) => ({ id: h.id, level: h.level, sector: h.sector, d: Math.round(w[h.sector]! * h.members), debt: 0, day: 0 }))
        .filter((x) => x.d > 0);
      const u = Math.max(returnPerDay(1), ...all.map((x) => x.d));
      for (const x of all) x.debt = x.d * (x.level - 1);
      let left = policy === 'directorate' ? [...all].sort((a, b) => a.level - b.level) : all; // stable: list order within a level
      for (let day = 0; left.length; day++) {
        let placed: Set<string>;
        if (policy === 'directorate') {
          let room = u, j = 0;
          while (j < left.length && left[j]!.d <= room) room -= left[j++]!.d;
          placed = new Set(left.slice(0, j).map((x) => x.id));
        } else {
          const claims = left.map((x) => ({ id: x.id, floor: 0, demand: x.d, debt: x.debt }));
          const res = rotate(u, claims, rng);
          const debt = nextDebt(claims, res.shares);
          placed = new Set(res.winners);
          for (const x of left) x.debt = debt[x.id]!;
        }
        for (const x of left) if (placed.has(x.id)) x.day = day;
        left = left.filter((x) => !placed.has(x.id));
      }
      const slots = Array<number>(24).fill(0);
      for (const x of all) if (x.day === 0) slots[x.sector]! += x.d;
      world.alloc.returnSlots = bySector(slots);
      const people = Array<number>(7).fill(0), waited = Array<number>(7).fill(0); // by level
      for (const x of all) {
        people[x.level]! += x.d;
        waited[x.level]! += x.d * x.day;
      }
      worst = Math.max(0, ...people.map((p, l) => (p > 0 ? waited[l]! / p : 0)));
    },
    metric: () => ({ name: "worst level's mean wait", value: worst ?? 0, unit: 'days', label: 'SIMULATED' }),
  };
}
