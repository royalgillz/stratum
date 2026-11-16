// p03 heat: divide the cooling pool, step temperature, wet-bulb and CO2 (docs/intent/adapters/livable).
import type { Adapter, Allocation, World } from '../contracts.ts';
import { allocate } from '../fairshare/fairshare.ts';
import type { Script } from '../scenario/types.ts';
import { co2Step, coolingDemandMW, RH, tempStep, WB_LIMIT, wetBulb } from '../world/airheat/airheat.ts';
import { lifeFloor, powerDemand, sectorId, type Policy } from './shared.ts';

/** Share of people, and of cooling demand, a STRATUM refuge room holds (docs/params.md). */
export const REFUGE = 0.25;

// shortcut: served fractions live here until shared.ts has them (coreChangesNeeded); p05 imports them
export const served = (granted: number, demand: number): number => (demand > 0 ? Math.min(1, Math.max(0, granted / demand)) : 1);

/** Total power served over total power demanded. */
export function gridServed(w: World): number {
  let got = 0, want = 0;
  w.sectors.forEach((x, s) => {
    const d = powerDemand(x.people);
    got += served(w.alloc.power[sectorId(s)] ?? 0, d) * d;
    want += d;
  });
  return served(got, want);
}

/** Directorate rule: `pool` in proportion to demand among powered sectors, each capped at its demand. */
export function proportional(w: World, pool: number, demand: (s: number) => number): Allocation {
  const powered = (s: number) => (w.alloc.power[sectorId(s)] ?? 0) > 0;
  const want = w.sectors.reduce((a, _, s) => a + (powered(s) ? demand(s) : 0), 0);
  const k = want > 0 ? Math.min(1, pool / want) : 0;
  return Object.fromEntries(w.sectors.map((_, s) => [sectorId(s), powered(s) ? demand(s) * k : 0]));
}

export function createP03(policy: Policy, _script: Script): Adapter {
  let coolCap: number | null = null;
  let personHours = 0;
  return {
    id: 'p03',
    reads: ['sectors', 'alloc'],
    writes: ['sectors', 'alloc'],
    // @spec ADAPT-LIVABLE-001, ADAPT-LIVABLE-002, ADAPT-LIVABLE-003, ADAPT-LIVABLE-004, ADAPT-LIVABLE-010
    step(w, dt) {
      const demand = (s: number) => coolingDemandMW(w.sectors[s].level, w.sectors[s].people);
      coolCap ??= w.sectors.reduce((a, _, s) => a + demand(s), 0);
      const pool = coolCap * gridServed(w);
      w.alloc.cooling = policy === 'stratum'
        ? allocate(pool, w.sectors.map((_, s) => ({ id: sectorId(s), floor: REFUGE * demand(s), demand: demand(s), debt: 0 }))).shares
        : proportional(w, pool, demand);
      w.sectors.forEach((x, s) => {
        const id = sectorId(s), d = demand(s), got = w.alloc.cooling[id];
        const refugePaid = policy === 'stratum' ? Math.min(got, REFUGE * d) : 0;
        const c = policy === 'stratum' ? served(Math.max(0, got - refugePaid), (1 - REFUGE) * d) : served(got, d);
        x.temp = tempStep(x.temp, x.level, c, dt);
        x.wetBulb = wetBulb(x.temp, RH);
        x.co2 = co2Step(x.co2, served(w.alloc.power[id] ?? 0, lifeFloor(x.people)), dt).co2;
        // @spec ADAPT-LIVABLE-005
        if (x.wetBulb > WB_LIMIT) personHours += x.people * (d > 0 ? 1 - refugePaid / d : 1) * (dt / 3600);
      });
    },
    metric: () => ({ name: 'person-hours above 27.5 C wet-bulb', value: personHours, unit: 'person-h', label: 'SIMULATED' }),
  };
}
