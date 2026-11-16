// p05 tunnels: divide the pump pool, step sumps, flood sectors and close their tunnels (docs/intent/adapters/livable).
import type { Adapter, Allocation } from '../contracts.ts';
import { allocate } from '../fairshare/fairshare.ts';
import type { Script } from '../scenario/types.ts';
import { floodInflow, HUB, isFlooded, PUMP_KW, reachable, strandedIfLost, sumpStep } from '../world/tunnels/tunnels.ts';
import { gridServed, proportional, served } from './p03.ts';
import { lastOf, sectorId, type Policy } from './shared.ts';

const D = PUMP_KW / 1000; // MW of pump power per sector

export function createP05(policy: Policy, script: Script): Adapter {
  let flooded: boolean[] | null = null;
  let personHours = 0;
  const lostOf = lastOf<number[]>(), memo = lastOf<Allocation>(), reachOf = lastOf<boolean[]>();
  return {
    id: 'p05',
    reads: ['sectors', 'alloc', 'tunnels'],
    writes: ['sectors', 'tunnels', 'alloc'],
    // @spec ADAPT-LIVABLE-006, ADAPT-LIVABLE-007, ADAPT-LIVABLE-008, ADAPT-LIVABLE-010, ADAPT-POLICY-008
    step(w, dt) {
      const { sectors, alloc, tunnels, t } = w; // read once: each world read costs a guard call in checked mode
      const wet = (flooded ??= sectors.map((x) => isFlooded(x.sumpLevel, false)));
      const pool = sectors.length * D * gridServed(w);
      if (policy === 'stratum') {
        const people = sectors.map((x) => x.people);
        // shortcut: these caches key on flooded flags and people only, assume tunnels.edges never change in a run; add the edges to the keys when a rung edits the graph
        const lost = lostOf([...wet.map(Number), ...people], () => strandedIfLost(tunnels.edges, wet, people, HUB));
        alloc.pumps = memo([pool, ...lost], () => allocate(pool, sectors.map((_, s) => ({ id: sectorId(s), floor: lost[s] > 0 ? D : 0, demand: D, debt: 0 }))).shares);
      } else alloc.pumps = proportional(w, pool, () => D);
      sectors.forEach((x, s) => {
        x.sumpLevel = sumpStep(x.level, x.sumpLevel, floodInflow(script.events, s, t), served(alloc.pumps[sectorId(s)], D), dt);
        wet[s] = isFlooded(x.sumpLevel, wet[s]);
      });
      for (const e of tunnels.edges) e.passable = !wet[e.a] && !wet[e.b];
      // @spec ADAPT-LIVABLE-009
      const reach = reachOf(wet.map(Number), () => reachable(tunnels.edges, HUB, tunnels.nodes)); // passable comes from wet alone
      const stranded = sectors.reduce((a, x, s) => a + (wet[HUB] || !reach[s] ? x.people : 0), 0);
      personHours += stranded * (dt / 3600);
    },
    metric: () => ({ name: 'stranded person-hours', value: personHours, unit: 'person-h', label: 'SIMULATED' }),
  };
}
