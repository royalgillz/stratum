// Care requests from sick children and courier times over the tunnels.
// Design: docs/intent/world/care/care-design.md.
import type { Rng } from '../../rng.ts';
import type { ScenarioEvent } from '../../scenario/types.ts';

// Every value below is listed in docs/params.md.
export const HOP_MIN = 10; // min per tunnel hop
export const VISIT_MIN = 30; // min with the child

export interface CareRequest {
  t: number; // world seconds
  cls: 'RED' | 'AMBER';
  sector: number; // 0..23, also the tunnel node
}

const bad = (x: number) => !Number.isFinite(x) || x < 0;

// @spec WORLD-CARE-001, WORLD-CARE-003, WORLD-CARE-004
export function careRequests(events: readonly ScenarioEvent[], rng: Rng): CareRequest[] {
  const out: CareRequest[] = [];
  for (const e of events) {
    if (e.type !== 'care') continue;
    if (!Number.isFinite(e.atH) || bad(e.durH) || bad(e.red) || bad(e.amber)) throw new RangeError(`invalid care event at ${e.atH}`);
    for (const [cls, rate] of [['RED', e.red], ['AMBER', e.amber]] as const) {
      for (let i = Math.round((rate * e.durH) / 24); i > 0; i--) {
        const t = e.atH * 3600 + rng() * e.durH * 3600;
        out.push({ t, cls, sector: Math.floor(rng() * 24) });
      }
    }
  }
  return out.sort((a, b) => a.t - b.t); // stable: ties keep draw order
}

const hopsOk = (hops: number) => {
  if (!Number.isInteger(hops) || hops < 0) throw new RangeError(`invalid hops ${hops}`);
};

// @spec WORLD-CARE-002, WORLD-CARE-004
export function firstCareMin(hops: number): number {
  hopsOk(hops);
  return hops * HOP_MIN;
}

// @spec WORLD-CARE-002, WORLD-CARE-004
export function busyMin(hops: number): number {
  hopsOk(hops);
  return 2 * hops * HOP_MIN + VISIT_MIN;
}
