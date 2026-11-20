// Figures the rung 4 designs ask the harness to report beside some metrics, from public core functions only:
// p06 contact cost (spacecare-design "p06"), p12 cost to other levels (lightfood-design "Food metric"),
// p14 exposure-hours and breaches, p15 each level's mean wait (surface-design "p14", "p15"),
// p01 person-hours with a stopped fan before a warning (power-design "p01: air").
import type { AdapterId, World } from '../src/core/contracts.ts';
import { airUnwarned } from '../src/core/adapters/p01.ts';
import { census } from '../src/core/adapters/p06.ts';
import { FOOD_SUPPLY } from '../src/core/adapters/p02.ts';
import { createP14 } from '../src/core/adapters/p14.ts';
import { weight, type Policy } from '../src/core/adapters/shared.ts';
import { nextDebt, rotate } from '../src/core/fairshare/fairshare.ts';
import { rng } from '../src/core/rng.ts';
import type { Script } from '../src/core/scenario/types.ts';
import { createWorld } from '../src/core/scenario/world.ts';
import { returnPerDay } from '../src/core/world/surface/surface.ts';

export interface Figure { name: string; unit: string; value: number }
export type Beside = Partial<Record<AdapterId, Record<string, Figure>>>;

/** Each level's people-weighted mean wait (days), index = level (0 unused). A copy of p15's plan, which keeps the per-level means private. */
// shortcut: duplicates createP15's plan loop; drop it if p15 ever exposes its waits (run.ts asserts the max equals p15's metric).
export function levelWaits(world: World, policy: Policy, seed: number): number[] {
  const r = rng(seed, 'p15'); // p15 draws only in its first step, from its own stream
  const all = world.households
    .map((h) => ({ id: h.id, level: h.level, d: Math.round(weight(world, h.sector) * h.members), debt: 0, day: 0 }))
    .filter((x) => x.d > 0);
  const u = Math.max(returnPerDay(1), ...all.map((x) => x.d));
  for (const x of all) x.debt = x.d * (x.level - 1);
  let left = policy === 'directorate' ? [...all].sort((a, b) => a.level - b.level) : all;
  for (let day = 0; left.length; day++) {
    let placed: Set<string>;
    if (policy === 'directorate') {
      let room = u, j = 0;
      while (j < left.length && left[j]!.d <= room) room -= left[j++]!.d;
      placed = new Set(left.slice(0, j).map((x) => x.id));
    } else {
      const claims = left.map((x) => ({ id: x.id, floor: 0, demand: x.d, debt: x.debt }));
      const res = rotate(u, claims, r);
      const debt = nextDebt(claims, res.shares);
      placed = new Set(res.winners);
      for (const x of left) x.debt = debt[x.id]!;
    }
    for (const x of left) if (placed.has(x.id)) x.day = day;
    left = left.filter((x) => !placed.has(x.id));
  }
  const people = Array<number>(7).fill(0), waited = Array<number>(7).fill(0);
  for (const x of all) (people[x.level]! += x.d), (waited[x.level]! += x.d * x.day);
  return people.map((p, l) => (p > 0 ? waited[l]! / p : 0));
}

/** p14's plan replayed on a copy of the final world; readings are filtered by round time, so it matches the run's last plan. */
export function replayP14(world: World, script: Script, seed: number, policy: Policy) {
  const p14 = createP14(policy, script);
  p14.step(structuredClone(world), 60, rng(seed, 'p14'));
  return p14.plan();
}

/** The figures for one finished run. `script` is the run's concrete script (run.script), `world` its final world. */
export function beside(world: World, script: Script, seed: number, policy: Policy): Beside {
  // p06: households sleeping in one space each day, people-weighted over sectors (1 under one room per household).
  const rows = census(world, policy).filter((x) => x.shift === 0);
  const people = world.sectors.reduce((a, x) => a + x.people, 0);
  const sharing = rows.reduce((a, x) => a + world.sectors[x.sector]!.people * x.sharing, 0) / people;

  // p12: store left on the levels no farm cut covers, in days of the standard ration (each starts with STOCK_DAYS).
  const cut = new Set(script.events.flatMap((e) => (e.type === 'farm-cut' ? [e.level] : [])));
  const other = world.sectors.filter((_, s) => !cut.has(Math.floor(s / 4) + 1));
  const store = other.reduce((a, x) => a + x.foodKcal, 0) / (FOOD_SUPPLY * other.reduce((a, x) => a + x.people, 0));

  const plan = replayP14(world, script, seed, policy);

  const start = createWorld(seed, script);
  const waits = levelWaits(start, policy, seed);
  // p01 air: only for a script with fan stops, so the other evidence files keep their bytes.
  const air = script.fanStops?.length ? { p01: { airUnwarnedH: { name: 'person-hours with a stopped fan, not yet warned', unit: 'person-h', value: airUnwarned(start, script, policy) } } } : {};
  return {
    ...air,
    p06: { sharing: { name: 'households sleeping in one space a day', unit: 'households', value: sharing } },
    p12: { otherStore: { name: 'store left on levels no farm cut-off covers', unit: 'days', value: store } },
    p14: {
      exposureH: { name: 'trial exposure-hours', unit: 'person-hours', value: plan?.exposureH ?? 0 },
      breaches: { name: 'trial breaches', unit: 'count', value: plan?.breaches ?? 0 },
    },
    p15: Object.fromEntries([1, 2, 3, 4, 5, 6].map((l) => [`level${l}`, { name: `level ${l} mean wait`, unit: 'days', value: waits[l]! }])),
  };
}
