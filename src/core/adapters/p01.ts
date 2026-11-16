// p01 Warning: runs the grid from p02's allocation and scores the cuts warned ahead
// (design: docs/intent/adapters/power/power-design.md, "p01: grid and warning").
import type { Adapter } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { CAP_MARGIN, capacityAt, swing, tierOf } from '../world/grid/grid.ts';
import { powerDemand, sectorId, type Policy } from './shared.ts';

/** A cut counts as warned with at least this much AMBER or RED before it, s (docs/params.md). */
export const WARN_LEAD = 600;

export function createP01(policy: Policy, script: Script): Adapter {
  let prev: boolean[] | null = null; // fully served per sector in the previous step's allocation
  let since: number | null = null; // world time the current unbroken AMBER or RED run began; null while GREEN
  let cuts = 0;
  let warned = 0;
  return {
    id: 'p01',
    reads: ['grid', 'sectors', 'alloc'],
    writes: ['grid'],
    step(w, dt) {
      // @spec ADAPT-POWER-002, ADAPT-POWER-003, ADAPT-POWER-011, ADAPT-POLICY-008
      const full = w.sectors.map((s, i) => w.alloc.power[sectorId(i)] >= powerDemand(s.people) * (1 - 1e-9));
      for (const [i, f] of full.entries()) {
        if (!prev?.[i] || f) continue;
        cuts++; // the allocation that cut it was made at t - dt, under the tier in `since`
        if (policy === 'stratum' && since !== null && since <= w.t - dt - WARN_LEAD) warned++;
      }
      prev = full;
      // @spec ADAPT-POWER-001
      const cap = capacityAt(script.events, w.t, CAP_MARGIN * w.sectors.reduce((a, s) => a + powerDemand(s.people), 0));
      const load = Object.values(w.alloc.power).reduce((a, b) => a + b, 0);
      const { f, rocof } = swing(w.grid.f, cap, load, dt);
      const tier = tierOf(f, w.grid.tier);
      since = tier === 'GREEN' ? null : (since ?? w.t);
      w.grid = { f, rocof, gapMW: cap - load, tier };
    },
    // @spec ADAPT-POWER-004
    metric: () => ({ name: 'cuts warned 10 min ahead', value: cuts ? warned / cuts : 0, unit: 'share', label: 'SIMULATED' }),
  };
}
