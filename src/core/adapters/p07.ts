// p07 Mesh delivery (design: docs/intent/adapters/family/family-design.md, "p07: delivery").
// Every simulated hop runs the real relay; only the air between sectors is simulated.
import type { Adapter, MeshMessage, TunnelEdge, World } from '../contracts.ts';
import { createRelay } from '../relay/relay.ts';
import type { Rng } from '../rng.ts';
import type { Script } from '../scenario/types.ts';
import type { Policy } from './shared.ts';

// Every value below is listed in docs/params.md.
export const P_HOP = 0.9; // probability one sector-to-sector hop is heard
export const AIR = 3; // s, air time per hop
export const DELIVER_WINDOW = 3600; // s
const BULLETIN = 6 * 3600, DAY = 86400; // daily 06:00 bulletin

type Relay = ReturnType<typeof createRelay>;

export function createP07(policy: Policy, script: Script): Adapter {
  const down = (x: number) => script.events.some((e) => e.type === 'network-down' && x >= e.atH * 3600 && x < (e.atH + e.durH) * 3600);
  let relays: Relay[] | undefined;
  // shortcut: household id -> sector, built once, assumes no adapter writes households (none does in rung 3); rebuild per step when one does
  let homes: Map<string, number> | undefined;
  let held: MeshMessage[] = [];
  let taken = 0, onTime = 0;

  const deliver = (w: World, m: MeshMessage, at: number) => {
    if (at - m.at <= DELIVER_WINDOW) onTime++;
    w.mesh.delivered.push(at === m.at ? m : { ...m, at });
  };
  const flush = (w: World, at: number) => {
    for (const m of held) deliver(w, m, at);
    held = [];
  };

  // The whole cascade of one message; returns when the destination first hears it, or null.
  // @spec ADAPT-FAMILY-003, ADAPT-FAMILY-004, ADAPT-FAMILY-005
  // `next[n]`: the far end of each passable edge at node n, in edge order (the order of the rng draws).
  function cascade(m: MeshMessage, origin: number, dest: number, next: readonly number[][], rng: Rng): number | null {
    if (origin === dest) return m.at;
    relays![origin].own(m.bytes);
    let seq = 0, got: number | null = null;
    const q = [{ node: origin, bytes: m.bytes, T: m.at, id: '', seq: seq++ }];
    while (q.length) {
      let i = 0;
      for (let j = 1; j < q.length; j++) if (q[j].T < q[i].T || (q[j].T === q[i].T && q[j].seq < q[i].seq)) i = j;
      const tx = q.splice(i, 1)[0];
      for (const nb of next[tx.node]!) {
        if (rng() >= P_HOP) continue;
        const T = tx.T + AIR;
        if (nb === dest && got === null) got = T;
        const act = relays![nb].hear(tx.bytes, { reject: 'unknown-tag' }, { state: 'NO_HUM' }, T * 1000);
        if (act && 'send' in act) q.push({ node: nb, bytes: act.send, T: act.atMs / 1000, id: act.id, seq: seq++ });
        else if (act) {
          const k = q.findIndex((x) => x.node === nb && x.id === act.cancel);
          if (k >= 0) q.splice(k, 1);
        }
      }
    }
    return got;
  }

  return {
    id: 'p07',
    reads: ['mesh', 'tunnels', 'households'],
    writes: ['mesh'],
    // @spec ADAPT-FAMILY-001, ADAPT-FAMILY-002
    step(world, dt, rng) {
      relays ??= Array.from({ length: world.tunnels.nodes }, () => createRelay(rng));
      if (!homes) {
        homes = new Map();
        for (const x of world.households) if (!homes.has(x.id)) homes.set(x.id, x.sector); // the first match, as find gave
      }
      const t = world.t;
      let next: number[][] | undefined; // built once per step, on the first cascade: plain arrays, read without the kernel's guard
      const adjacency = (edges: readonly TunnelEdge[]) => {
        const n: number[][] = Array.from({ length: world.tunnels.nodes }, () => []);
        for (const { a, b, passable } of edges) if (passable) n[a]!.push(b), a !== b && n[b]!.push(a);
        return n;
      };
      for (const m of world.mesh.inbox.splice(0)) {
        const h = m.heard;
        const home = h && homes.get(h.keySet);
        if (!h || home === undefined) continue;
        if (h.label !== 'SIMULATED') { // LIVE or REPLAY: heard in the room, outside the metric
          world.mesh.delivered.push(m);
          continue;
        }
        taken++;
        if (!down(m.at)) deliver(world, m, m.at);
        else {
          const origin = (h.payload.level - 1) * 4 + h.payload.sector;
          const at = policy === 'stratum' ? cascade(m, origin, home, (next ??= adjacency(world.tunnels.edges)), rng) : null;
          if (at === null) held.push(m);
          else deliver(world, m, at);
        }
      }
      const bulletin = BULLETIN + DAY * Math.ceil((t - BULLETIN) / DAY);
      if (bulletin < t + dt) flush(world, bulletin);
      if (!down(t)) flush(world, t);
    },
    // @spec ADAPT-FAMILY-006
    metric: () => ({ name: 'messages delivered within 60 min', value: taken > 0 ? onTime / taken : 0, unit: 'share', label: 'SIMULATED' }),
  };
}
