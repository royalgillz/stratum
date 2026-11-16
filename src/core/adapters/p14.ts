// p14 pioneers (design: docs/intent/adapters/surface/surface-design.md, "p14: pioneers"). Constants: docs/params.md.
import type { Adapter, Household } from '../contracts.ts';
import { rotate } from '../fairshare/fairshare.ts';
import type { Rng } from '../rng.ts';
import type { Script } from '../scenario/types.ts';
import { APF_SEALED, bandOf, required, TRIAL_N, trialPlan, type TrialPlan } from '../world/surface/surface.ts';
import { measured, OFFICIAL, rounds } from './p13.ts';
import { bySector, type Policy } from './shared.ts';

export const NO_PROOF = 100000; // ratio, above every option: nothing proven

export function createP14(policy: Policy, script: Script): Adapter & { plan(): TrialPlan | null } {
  const rs = rounds(script);
  let done = 0, first = true;
  let plan: { c: number; band: string; result: TrialPlan; slots: number[] } | null = null;

  /** Volunteers per sector for a plan of `stages` stages. */
  // @spec ADAPT-SURFACE-006
  const volunteers = (hs: readonly Household[], stages: number, rng: Rng): number[] => {
    const drawn = new Set<string>();
    if (policy === 'directorate') {
      if (stages) for (const h of hs.filter((x) => x.level === 1).slice(0, TRIAL_N)) drawn.add(h.id);
    } else {
      for (let k = 0; k < stages; k++) {
        const claims = hs.filter((h) => !drawn.has(h.id)).map((h) => ({ id: h.id, floor: 0, demand: 1, debt: 0 }));
        for (const id of rotate(TRIAL_N, claims, rng).winners) drawn.add(id);
      }
    }
    const slots = Array<number>(24).fill(0);
    for (const h of hs) if (drawn.has(h.id)) slots[h.sector]!++;
    return slots;
  };

  return {
    id: 'p14',
    reads: ['surface', 'households'],
    writes: ['alloc'],
    // @spec ADAPT-SURFACE-005
    step(world, _dt, rng) {
      let changed = first;
      first = false;
      for (; done < rs.length && rs[done]!.r <= world.t; done++) {
        const { c, e, r } = rs[done]!;
        if (plan && plan.c !== c) {
          plan = null;
          changed = true;
        }
        const v = policy === 'stratum' ? measured(world.surface.readings, e, r) : null;
        const band = policy === 'directorate' ? OFFICIAL : v ? bandOf(v) : 'unknown';
        if (band === 'unknown' || plan?.band === band) continue;
        const result = trialPlan(v ? required(v) : APF_SEALED, required(e), policy === 'stratum');
        plan = { c, band, result, slots: volunteers(world.households, result.stages.length, rng) };
        changed = true;
      }
      if (changed) world.alloc.trialSlots = bySector(plan?.slots ?? Array<number>(24).fill(0));
    },
    // @spec ADAPT-SURFACE-007
    metric: () => ({ name: 'protection factor proven over 30 days', value: plan?.result.verified || NO_PROOF, unit: 'APF', label: 'SIMULATED' }),
    /** The current plan's exposure-hours, breaches and stages, which the harness reports beside the metric. */
    plan: () => plan?.result ?? null,
  };
}
