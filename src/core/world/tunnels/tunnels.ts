// District 7's tunnel graph, its sumps, and who a flooded section cuts off from the hub.
// Design: docs/intent/world/tunnels/tunnels-design.md. Pure functions, no randomness.
import type { TunnelEdge, World } from '../../contracts.ts';
import type { ScenarioEvent } from '../../scenario/types.ts';

export const HUB = 0; // level 1 sector 0: clinic, water point, way out
const NODES = 24;
export const SUMP_CAP = 200; // m³
export const SEEP_TOP = 2; // m³/h at level 1
export const SEEP_STEP = 1; // m³/h added per level down
export const PUMP_CAP = 15; // m³/h at full pump power
export const PUMP_KW = 20; // kW per sector
export const RECOVER = 0.9; // a flooded node is passable again below this sump fraction

// Rings and corridors, then the main shaft, then the second stair (design, "Graph").
const EDGES = [
  [0, 1], [1, 2], [2, 3], [0, 3], [4, 5], [5, 6], [6, 7], [4, 7], [8, 9], [9, 10], [10, 11], [8, 11],
  [12, 13], [13, 14], [14, 15], [16, 17], [17, 18], [18, 19], [20, 21], [21, 22], [22, 23],
  [0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [2, 6], [6, 10],
];

const isNode = (x: number, n: number) => Number.isInteger(x) && x >= 0 && x < n;

function checkGraph(edges: readonly TunnelEdge[], hub: number, n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > NODES) throw new RangeError(`invalid nodes ${n}`);
  if (!isNode(hub, n)) throw new RangeError(`invalid hub ${hub}`);
  for (const { a, b } of edges) if (!isNode(a, n) || !isNode(b, n) || a >= b) throw new RangeError(`invalid edge (${a}, ${b})`);
}

function search(edges: readonly TunnelEdge[], hub: number, n: number, open: (x: TunnelEdge) => boolean): boolean[] {
  const next: number[][] = Array.from({ length: n }, () => []);
  for (const x of edges) if (open(x)) next[x.a].push(x.b), next[x.b].push(x.a);
  const seen = Array<boolean>(n).fill(false);
  seen[hub] = true;
  for (const queue = [hub]; queue.length; ) {
    for (const v of next[queue.shift()!]) if (!seen[v]) seen[v] = true, queue.push(v);
  }
  return seen;
}

// @spec WORLD-TUNNEL-001
export function districtTunnels(): World['tunnels'] {
  return { nodes: NODES, edges: EDGES.map(([a, b]) => ({ a, b, passable: true })) };
}

// @spec WORLD-TUNNEL-002, WORLD-TUNNEL-008
export function reachable(edges: readonly TunnelEdge[], hub: number, nodes: number): boolean[] {
  checkGraph(edges, hub, nodes);
  return search(edges, hub, nodes, (x) => x.passable);
}

// @spec WORLD-TUNNEL-003, WORLD-TUNNEL-004, WORLD-TUNNEL-008
export function strandedIfLost(edges: readonly TunnelEdge[], flooded: readonly boolean[], people: readonly number[], hub: number): number[] {
  checkGraph(edges, hub, NODES);
  if (people.length !== NODES || people.some((p) => !Number.isFinite(p) || p < 0)) throw new RangeError('people must be 24 non-negative finite numbers');
  if (flooded.length !== NODES || flooded.some((f) => typeof f !== 'boolean')) throw new RangeError('flooded must be 24 booleans');
  // Reach from the hub with node v forced to `wet`, every other node as given; edge `passable` flags are ignored.
  const reach = (v: number, wet: boolean) =>
    search(edges, hub, NODES, ({ a, b }) => !(a === v ? wet : flooded[a]) && !(b === v ? wet : flooded[b]));
  return people.map((_, v) => {
    const dry = reach(v, false);
    const lost = reach(v, true);
    return people.reduce((s, p, u) => (u !== v && dry[u] && !lost[u] ? s + p : s), 0);
  });
}

// @spec WORLD-TUNNEL-005, WORLD-TUNNEL-008
export function sumpStep(level: number, sumpLevel: number, inflowM3h: number, pumpFrac: number, dt: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new RangeError(`invalid level ${level}`);
  if (!(sumpLevel >= 0 && sumpLevel <= 1)) throw new RangeError(`invalid sumpLevel ${sumpLevel}`);
  if (!(inflowM3h >= 0) || inflowM3h === Infinity) throw new RangeError(`invalid inflow ${inflowM3h}`);
  if (!(pumpFrac >= 0 && pumpFrac <= 1)) throw new RangeError(`invalid pumpFrac ${pumpFrac}`);
  if (!(dt > 0) || dt === Infinity) throw new RangeError(`invalid dt ${dt}`);
  const seepage = SEEP_TOP + SEEP_STEP * (level - 1);
  const next = sumpLevel + ((seepage + inflowM3h - PUMP_CAP * pumpFrac) * dt) / 3600 / SUMP_CAP;
  return Math.min(1, Math.max(0, next));
}

// @spec WORLD-TUNNEL-006, WORLD-TUNNEL-008
export function floodInflow(events: readonly ScenarioEvent[], sector: number, t: number): number {
  if (!isNode(sector, NODES)) throw new RangeError(`invalid sector ${sector}`);
  if (!Number.isFinite(t)) throw new RangeError(`invalid t ${t}`);
  let sum = 0;
  for (const e of events) {
    if (e.type !== 'flood' || e.sector !== sector) continue;
    if (!(e.inflowM3h >= 0) || e.inflowM3h === Infinity) throw new RangeError(`invalid flood inflow ${e.inflowM3h}`);
    if (!Number.isFinite(e.atH) || !(e.durH >= 0) || e.durH === Infinity) throw new RangeError(`invalid flood time ${e.atH}, ${e.durH}`);
    if (t >= e.atH * 3600 && t < (e.atH + e.durH) * 3600) sum += e.inflowM3h;
  }
  return sum;
}

// @spec WORLD-TUNNEL-007, WORLD-TUNNEL-008
export function isFlooded(sumpLevel: number, wasFlooded: boolean): boolean {
  if (!(sumpLevel >= 0 && sumpLevel <= 1)) throw new RangeError(`invalid sumpLevel ${sumpLevel}`);
  if (typeof wasFlooded !== 'boolean') throw new RangeError(`invalid wasFlooded ${wasFlooded}`);
  return sumpLevel >= 1 ? true : sumpLevel < RECOVER ? false : wasFlooded;
}
