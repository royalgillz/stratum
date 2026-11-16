// p05 tunnels: divide the pump pool, step sumps, flood sectors and close their tunnels (docs/intent/adapters/livable).
import type { Adapter } from '../contracts.ts';
import { allocate } from '../fairshare/fairshare.ts';
import type { Script } from '../scenario/types.ts';
import { floodInflow, HUB, isFlooded, PUMP_KW, reachable, strandedIfLost, sumpStep } from '../world/tunnels/tunnels.ts';
import { gridServed, proportional, served } from './p03.ts';
import { sectorId, type Policy } from './shared.ts';

const D = PUMP_KW / 1000; // MW of pump power per sector

export function createP05(policy: Policy, script: Script): Adapter {
  let flooded: boolean[] | null = null;
  let personHours = 0;
  let lostKey = '', lost: number[] = [];
  return {
    id: 'p05',
    reads: ['sectors', 'alloc', 'tunnels'],
    writes: ['sectors', 'tunnels', 'alloc'],
    // @spec ADAPT-LIVABLE-006, ADAPT-LIVABLE-007, ADAPT-LIVABLE-008, ADAPT-LIVABLE-010, ADAPT-POLICY-008
    step(w, dt) {
      const wet = (flooded ??= w.sectors.map((x) => isFlooded(x.sumpLevel, false)));
      const pool = w.sectors.length * D * gridServed(w);
      if (policy === 'stratum') {
        const people = w.sectors.map((x) => x.people), key = `${wet}|${people}`;
        // shortcut: cache keyed on flooded flags and people only, assumes tunnels.edges never change in a run; add the edges to the key when a rung edits the graph
        if (key !== lostKey) (lost = strandedIfLost(w.tunnels.edges, wet, people, HUB)), (lostKey = key);
        w.alloc.pumps = allocate(pool, w.sectors.map((_, s) => ({ id: sectorId(s), floor: lost[s] > 0 ? D : 0, demand: D, debt: 0 }))).shares;
      } else w.alloc.pumps = proportional(w, pool, () => D);
      w.sectors.forEach((x, s) => {
        x.sumpLevel = sumpStep(x.level, x.sumpLevel, floodInflow(script.events, s, w.t), served(w.alloc.pumps[sectorId(s)], D), dt);
        wet[s] = isFlooded(x.sumpLevel, wet[s]);
      });
      for (const e of w.tunnels.edges) e.passable = !wet[e.a] && !wet[e.b];
      // @spec ADAPT-LIVABLE-009
      const reach = reachable(w.tunnels.edges, HUB, w.tunnels.nodes);
      const stranded = w.sectors.reduce((a, x, s) => a + (wet[HUB] || !reach[s] ? x.people : 0), 0);
      personHours += stranded * (dt / 3600);
    },
    metric: () => ({ name: 'stranded person-hours', value: personHours, unit: 'person-h', label: 'SIMULATED' }),
  };
}
