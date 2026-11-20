// p01 Warning: runs the grid from p02's allocation and scores the cuts warned ahead
// (design: docs/intent/adapters/power/power-design.md, "p01: grid and warning").
import type { Adapter, World } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { CAP_MARGIN, capacityAt, swing, tierOf } from '../world/grid/grid.ts';
import { BULLETIN, DAY } from './p07.ts';
import { powerDemand, sectorId, type Policy } from './shared.ts';

/** A cut counts as warned with at least this much AMBER or RED before it, s (docs/params.md). */
export const WARN_LEAD = 600;
/** Share of residents near a phone with the Listen tab on (docs/params.md). */
export const LISTEN_SHARE = 0.5;
/** Seconds from a fan stop to FAN STOPPED on the phone: AIR-FAN-010's bound (docs/params.md). */
export const FAN_ALERT_S = 5;

/** Person-hours spent on a level with a stopped fan before a warning, over `script.fanStops`, people as in `world`
 * (design: power-design.md, "p01: air"). Directorate: the next 06:00 bulletin. STRATUM: phones first, the bulletin for the rest. */
// @spec ADAPT-POWER-012
export function airUnwarned(world: World, script: Script, policy: Policy): number {
  let total = 0;
  for (const { atH, level, durH } of script.fanStops ?? []) {
    if (!Number.isInteger(level) || level < 1 || level > 6 || !(atH >= 0) || !(durH >= 0) || !Number.isFinite(atH + durH)) {
      throw new RangeError(`bad fan stop: level ${level}, atH ${atH}, durH ${durH}`);
    }
    const t0 = atH * 3600, end = Math.min(t0 + durH * 3600, script.days * DAY);
    const hours = (warn: number) => Math.max(0, Math.min(warn, end) - t0) / 3600;
    const b = BULLETIN + DAY * Math.ceil((t0 - BULLETIN) / DAY), bulletin = hours(b);
    const people = world.sectors.reduce((a, s) => a + (s.level === level ? s.people : 0), 0);
    // The bulletin keeps running under STRATUM, so a phone holder is warned by whichever comes first.
    total += people * (policy === 'stratum' ? LISTEN_SHARE * hours(Math.min(t0 + FAN_ALERT_S, b)) + (1 - LISTEN_SHARE) * bulletin : bulletin);
  }
  return total;
}

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
      const pd = w.sectors.map((s) => powerDemand(s.people)), power = w.alloc.power; // read once: each world read costs a guard call in checked mode
      const full = pd.map((d, i) => power[sectorId(i)] >= d * (1 - 1e-9));
      for (const [i, f] of full.entries()) {
        if (!prev?.[i] || f) continue;
        cuts++; // the allocation that cut it was made at t - dt, under the tier in `since`
        if (policy === 'stratum' && since !== null && since <= w.t - dt - WARN_LEAD) warned++;
      }
      prev = full;
      // @spec ADAPT-POWER-001
      const cap = capacityAt(script.events, w.t, CAP_MARGIN * pd.reduce((a, d) => a + d, 0));
      // Object.values in key order, without its per-key descriptor reads, which are slow through the checked-mode guard
      const load = Reflect.ownKeys(power).reduce((a, k) => a + (typeof k === 'string' ? power[k]! : 0), 0);
      const { f, rocof } = swing(w.grid.f, cap, load, dt, script.model?.gridH);
      const tier = tierOf(f, w.grid.tier);
      since = tier === 'GREEN' ? null : (since ?? w.t);
      w.grid = { f, rocof, gapMW: cap - load, tier };
    },
    // @spec ADAPT-POWER-004
    metric: () => ({ name: 'cuts warned 10 min ahead', value: cuts ? warned / cuts : 0, unit: 'share', label: 'SIMULATED' }),
  };
}
