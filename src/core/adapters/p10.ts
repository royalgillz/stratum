// p10 care delivery (design: docs/intent/adapters/spacecare/spacecare-design.md, "p10: care delivery").
import type { Adapter } from '../contracts.ts';
import { rotate } from '../fairshare/fairshare.ts';
import { MAX_HOPS } from '../packet/codec.ts';
import type { Script } from '../scenario/types.ts';
import { busyMin, careRequests, firstCareMin, type CareRequest } from '../world/care/care.ts';
import { HUB, hopsFrom } from '../world/tunnels/tunnels.ts';
import { BULLETIN, DAY, P_HOP } from './p07.ts';
import type { Policy } from './shared.ts';

// Every value below is listed in docs/params.md.
export const COURIERS = 3; // the same staff under both policies
export const POPUP = 2; // STRATUM pop-up care points, one courier each

type Req = CareRequest & { i: number; arrival: number; care?: number }; // i: draw order after the sort by time

export function createP10(policy: Policy, script: Script): Adapter {
  const cuts = script.events.flatMap((e) => (e.type === 'network-down' ? [[e.atH * 3600, (e.atH + e.durH) * 3600] as const] : []));
  const cutAt = (x: number) => cuts.find(([a, b]) => x >= a && x < b);
  const cutEnd = (x: number) => {
    for (let c = cutAt(x); c; c = cutAt(x)) x = c[1]; // overlapping cuts: the network is back at the first time no cut covers
    return x;
  };
  // Courier k's care point; under STRATUM 1 to POPUP are the pop-ups, at the hub until the first placement.
  const couriers = Array.from({ length: COURIERS }, () => ({ node: HUB, busyUntil: -Infinity }));
  let reqs: Req[] | undefined;
  let sent = 0;
  let open: Req[] = [];

  return {
    id: 'p10',
    reads: ['tunnels'],
    writes: [],
    // @spec ADAPT-SPACECARE-005, ADAPT-SPACECARE-006, ADAPT-SPACECARE-007, ADAPT-SPACECARE-008, ADAPT-POLICY-008
    step(w, dt, rng) {
      const all = (reqs ??= careRequests(script.events, rng).map((r, i) => ({ ...r, i, arrival: Infinity })));
      const { t } = w;
      const hops: (number | null)[][] = []; // per step, per sector: the tunnels may change between steps
      const from = (s: number) => (hops[s] ??= hopsFrom(w.tunnels.edges, s, w.tunnels.nodes));

      if (policy === 'stratum' && t % DAY === 0) {
        const claims = [1, 2, 3, 4, 5, 6].map((l) => ({
          id: `L${l}`, floor: 0, demand: 1,
          debt: all.filter((r) => Math.floor(r.sector / 4) + 1 === l && r.arrival >= t - DAY && r.arrival < t).length,
        }));
        const levels = rotate(POPUP, claims, rng).winners.map((id) => Number(id.slice(1))).sort((a, b) => a - b);
        levels.forEach((l, k) => (couriers[k + 1]!.node = (l - 1) * 4 + 1));
      }

      for (; sent < all.length && all[sent]!.t < t + dt; sent++) {
        const r = all[sent]!;
        open.push(r);
        if (!cutAt(r.t)) {
          r.arrival = r.t;
          continue;
        }
        if (policy === 'stratum') {
          const h = from(r.sector);
          const near = Math.min(...couriers.map((c) => h[c.node] ?? Infinity));
          if (near <= MAX_HOPS) {
            let ok = true;
            for (let k = 0; k < near; k++) if (rng() >= P_HOP) ok = false; // every hop drawn, even after one fails
            if (ok) {
              r.arrival = r.t;
              continue;
            }
          }
        }
        r.arrival = Math.min(BULLETIN + DAY * Math.ceil((r.t - BULLETIN) / DAY), cutEnd(r.t));
      }

      const rank = (r: Req) => (policy === 'stratum' && r.cls === 'AMBER' ? 1 : 0); // triage under STRATUM
      open.sort((a, b) => rank(a) - rank(b) || a.arrival - b.arrival || a.i - b.i);
      for (const r of open) {
        if (couriers.every((c) => c.busyUntil > t)) break; // nobody free: the rest wait too
        if (r.arrival >= t + dt) continue;
        const h = from(r.sector);
        let best = -1;
        couriers.forEach((c, k) => {
          const x = h[c.node];
          if (c.busyUntil <= t && x !== null && (best < 0 || x < h[couriers[best]!.node]!)) best = k;
        });
        if (best < 0) continue; // no free courier can reach it: it waits, later requests may go first
        const x = h[couriers[best]!.node]!, start = Math.max(t, r.arrival);
        r.care = start + firstCareMin(x) * 60;
        couriers[best]!.busyUntil = start + busyMin(x) * 60;
      }
      open = open.filter((r) => r.care === undefined);
    },
    // @spec ADAPT-SPACECARE-009
    metric(w) {
      const waits = (reqs ?? []).filter((r) => r.cls === 'RED' && r.t < w.t).map((r) => Math.min(r.care ?? Infinity, w.t) - r.t).sort((a, b) => a - b);
      return { name: 'median hours to first care (RED)', value: waits.length ? waits[waits.length >> 1]! / 3600 : 0, unit: 'h', label: 'SIMULATED' };
    },
  };
}
