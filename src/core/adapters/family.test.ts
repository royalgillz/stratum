import { describe, expect, it } from 'vitest';
import type { Household, MeshMessage, Sector, TunnelEdge, World } from '../contracts.ts';
import { createKernel } from '../kernel/kernel.ts';
import { rng } from '../rng.ts';
import { sevenDay } from '../scenario/seven-day.ts';
import type { ScenarioEvent, Script } from '../scenario/types.ts';
import { districtTunnels } from '../world/tunnels/tunnels.ts';
import { AIR, DELIVER_WINDOW, P_HOP, createP07 } from './p07.ts';
import { BEACON_EVERY, FIRST_WINDOW, createP08, familyBoard } from './p08.ts';
import type { Policy } from './shared.ts';

// Local fixture: createWorld is built elsewhere, and these tests only need sectors, tunnels, households and mesh.
const H = 3600;
const level = (s: number) => Math.floor(s / 4) + 1;
const sector = (s: number): Sector => ({
  level: level(s), temp: 25, wetBulb: 20, co2: 800, water: { cond: 0, toc: 0, turb: 0, biocide: 0 },
  sumpLevel: 0.3, people: 500, sleepM2: 2, lightDose: 0, foodKcal: 0, stock: 5,
});
const hh = (id: string, s: number, members = 4): Household => ({ id, members, level: level(s), sector: s, shift: 0 });
const demo = hh('family', 17);

function makeWorld(o: { t?: number; seed?: number; edges?: TunnelEdge[]; households?: Household[] } = {}): World {
  return {
    t: o.t ?? 0,
    seed: o.seed ?? 1,
    clock: { mode: 'timelapse', scale: 3600 },
    grid: { f: 400, rocof: 0, gapMW: 0, tier: 'GREEN' },
    sectors: Array.from({ length: 24 }, (_, s) => sector(s)),
    tunnels: o.edges ? { nodes: 24, edges: o.edges } : districtTunnels(),
    households: o.households ?? [demo],
    ledger: { measured: [], official: [] },
    mesh: { inbox: [], delivered: [] },
    alloc: { power: {}, water: {}, food: {}, cooling: {}, pumps: {}, lampHours: {}, medicine: {}, bunks: {}, trialSlots: {}, returnSlots: {} },
    surface: { readings: [], band: 'unknown' },
  };
}
const script = (events: ScenarioEvent[]): Script => ({
  name: 'test', days: 7, demo: { id: 'family', level: 5, sector: 1, members: 4 }, acts: [{ atH: 0, mode: 'timelapse', title: 't' }], events,
});
const down = (atH: number, durH: number): ScenarioEvent => ({ type: 'network-down', atH, durH });
const edge = (a: number, b: number): TunnelEdge => ({ a, b, passable: true });

let nonce = 0;
/** An OK from sector node `node` for household `keySet`. */
function ok(at: number, keySet: string, member: number, node: number, label: 'LIVE' | 'SIMULATED' = 'SIMULATED'): MeshMessage {
  const bytes = new Uint8Array(25);
  bytes[0] = 0x30;
  bytes[1] = ++nonce;
  bytes[16] = 4;
  return { at, bytes, heard: { type: 0, keySet, minute: Math.floor(at / 60), payload: { member, code: 0, level: level(node), sector: node % 4, flags: 0, value: 0 }, label } };
}
const p07 = (w: World, policy: Policy, events: ScenarioEvent[]) => createKernel(w, [createP07(policy, script(events))], { check: true });
const draws = (seed: number, id: string, n: number) => { const r = rng(seed, id); return Array.from({ length: n }, () => r()); };
const slot = (u: number) => Math.floor(u * 4);

describe('p07 mesh delivery', () => {
  it('pins its constants to docs/params.md', () => {
    expect({ P_HOP, AIR, DELIVER_WINDOW }).toEqual({ P_HOP: 0.9, AIR: 3, DELIVER_WINDOW: 3600 });
  });

  // @spec ADAPT-FAMILY-001
  it('ADAPT-FAMILY-001 empties the inbox, drops the undecodable and unknown, and delivers LIVE and network-up messages unchanged', () => {
    for (const policy of ['directorate', 'stratum'] as const) {
      const w = makeWorld({ t: 10 * H, households: [demo, hh('h3', 3)] });
      const live = ok(9 * H, 'family', 1, 17, 'LIVE');
      const up = ok(9 * H, 'h3', 1, 0);
      const replay = ok(4 * H, 'h3', 2, 0, 'LIVE');
      replay.heard!.label = 'REPLAY'; // not simulated: delivered at once like LIVE, outside the metric, even with the network down
      const noHeard = { at: 9 * H, bytes: new Uint8Array(25) };
      w.mesh.inbox.push(noHeard, ok(9 * H, 'nobody', 1, 0), live, up, replay);
      const k = p07(w, policy, [down(0, 5)]);
      k.step();
      expect(w.mesh.inbox).toEqual([]); // p07 never appends to the inbox
      expect(w.mesh.delivered).toHaveLength(3);
      expect(w.mesh.delivered[0]).toBe(live);
      expect(w.mesh.delivered[1]).toBe(up);
      expect(w.mesh.delivered[2]).toBe(replay);
      expect(k.metrics().p07).toEqual({ name: 'messages delivered within 60 min', value: 1, unit: 'share', label: 'SIMULATED' });
    }
  });

  // @spec ADAPT-FAMILY-002
  it('ADAPT-FAMILY-002 holds network-down messages for the 06:00 bulletin under both policies', () => {
    for (const policy of ['directorate', 'stratum'] as const) {
      const w = makeWorld({ t: 3 * H + 60, edges: [], households: [hh('h3', 3)] }); // no edges: the mesh reaches no one
      const m = ok(3 * H, 'h3', 1, 0);
      w.mesh.inbox.push(m);
      const k = p07(w, policy, [down(0, 48)]);
      k.run(6 * H - w.t);
      expect(w.mesh.delivered).toEqual([]);
      k.step(); // the step that holds 06:00
      expect(w.mesh.delivered).toEqual([{ ...m, at: 6 * H }]);
      k.run(30 * H);
      expect(w.mesh.delivered).toHaveLength(1);
    }
  });

  // @spec ADAPT-FAMILY-002
  it('ADAPT-FAMILY-002 delivers what is still held in the first step after the network returns', () => {
    const w = makeWorld({ t: 7 * H + 60, households: [hh('h3', 3)] });
    const m = ok(7 * H, 'h3', 1, 0);
    w.mesh.inbox.push(m);
    const k = p07(w, 'directorate', [down(0, 8)]);
    k.run(8 * H - w.t);
    expect(w.mesh.delivered).toEqual([]);
    k.step();
    expect(w.mesh.delivered).toEqual([{ ...m, at: 8 * H }]);
  });

  // @spec ADAPT-FAMILY-001, ADAPT-FAMILY-002
  it('ADAPT-FAMILY-002 tests the network at the message\'s own at, not at the step time', () => {
    // down until 2h; sent at 2h - 30s, taken at 2h: held, then flushed in the same step as the network is back
    const a = makeWorld({ t: 2 * H, households: [hh('h3', 3)] });
    const m = ok(2 * H - 30, 'h3', 1, 0);
    a.mesh.inbox.push(m);
    p07(a, 'directorate', [down(0, 2)]).step();
    expect(a.mesh.delivered).toEqual([{ ...m, at: 2 * H }]);
    // down from 2h; sent at 2h - 30s: the network was up, delivered unchanged
    const b = makeWorld({ t: 2 * H, households: [hh('h3', 3)] });
    b.mesh.inbox.push(m);
    p07(b, 'directorate', [down(2, 2)]).step();
    expect(b.mesh.delivered).toHaveLength(1);
    expect(b.mesh.delivered[0]).toBe(m);
  });

  // @spec ADAPT-FAMILY-003, ADAPT-FAMILY-004, ADAPT-FAMILY-005
  it('ADAPT-FAMILY-003 relays along a line: origin transmits at at, each hop adds AIR and the relay slot', () => {
    // edges 0-1, 1-2; origin node 0, destination node 2. Draws: hop 0>1, slot of 1, hop 1>0, hop 1>2.
    // The origin owns the bytes, so hearing them back from 1 draws no slot. Without own() node 0 would draw
    // d[3] as a slot and hop 1>2 would use d[4], which fails here: the message would go to the bulletin.
    const seed = Array.from({ length: 2000 }, (_, i) => i).find((s) => { const d = draws(s, 'p07', 5); return d[0] < P_HOP && d[2] < P_HOP && d[3] < P_HOP && d[4] >= P_HOP; })!;
    const d = draws(seed, 'p07', 4);
    const w = makeWorld({ seed, t: 1000, edges: [edge(0, 1), edge(1, 2)], households: [hh('h2', 2)] });
    const m = ok(900, 'h2', 1, 0);
    w.mesh.inbox.push(m);
    p07(w, 'stratum', [down(0, 48)]).step();
    expect(w.mesh.delivered).toEqual([{ ...m, at: 900 + AIR + 3 * slot(d[1]) + AIR }]);
  });

  // @spec ADAPT-FAMILY-004, ADAPT-FAMILY-005
  it('ADAPT-FAMILY-004 runs events in time order and cancels a relay that hears a copy before its own send', () => {
    // edges 0-1, 0-2, 1-2, 2-3; origin 0, destination 3, reachable only through node 2.
    // Draws: hop 0>1, slot of 1, hop 0>2, slot of 2, then the first relay's hops, in edge order.
    const find = (want: (d: number[]) => boolean) => Array.from({ length: 2000 }, (_, i) => i).find((s) => want(draws(s, 'p07', 7)))!;
    const edges = [edge(0, 1), edge(0, 2), edge(1, 2), edge(2, 3)];
    const run = (seed: number) => {
      const w = makeWorld({ seed, t: 1000, edges, households: [hh('h3', 3)] });
      w.mesh.inbox.push(ok(900, 'h3', 1, 0));
      p07(w, 'stratum', [down(0, 48)]).step();
      return w.mesh.delivered;
    };
    // node 1 sends first (slot 0); node 2 (slot 2 or 3) hears that copy before its own send and cancels it: nobody reaches node 3
    const cancelled = find((d) => d[0] < P_HOP && slot(d[1]) === 0 && d[2] < P_HOP && slot(d[3]) >= 2 && d[5] < P_HOP);
    expect(run(cancelled)).toEqual([]);
    // node 2 sends first: node 3 hears it AIR later
    const sent = find((d) => d[0] < P_HOP && d[2] < P_HOP && slot(d[3]) < slot(d[1]) && d[6] < P_HOP);
    const d = draws(sent, 'p07', 7);
    expect(run(sent).map((x) => x.at)).toEqual([900 + AIR + 3 * slot(d[3]) + AIR]);
  });

  // @spec ADAPT-FAMILY-004
  it('ADAPT-FAMILY-004 draws only for passable edges and never crosses a closed one', () => {
    // closed 0-1 then open 0-2, destination 2: d[0] is hop 0>2. Drawing for the closed edge, or crossing it,
    // would spend d[0] on 0>1 and fail hop 0>2 on d[1] or d[2].
    const seed = Array.from({ length: 2000 }, (_, i) => i).find((s) => { const d = draws(s, 'p07', 3); return d[0] < P_HOP && d[1] >= P_HOP && d[2] >= P_HOP; })!;
    const w = makeWorld({ seed, t: 1000, edges: [{ a: 0, b: 1, passable: false }, edge(0, 2)], households: [hh('h2', 2)] });
    const m = ok(900, 'h2', 1, 0);
    w.mesh.inbox.push(m);
    p07(w, 'stratum', [down(0, 48)]).step();
    expect(w.mesh.delivered).toEqual([{ ...m, at: 900 + AIR }]);
    // reachable only through a closed edge: to the bulletin
    const c = makeWorld({ seed: 1, t: 1020, edges: [{ a: 0, b: 1, passable: false }], households: [hh('h1', 1)] });
    c.mesh.inbox.push(ok(900, 'h1', 1, 0));
    const k = p07(c, 'stratum', [down(0, 48)]);
    k.step();
    expect(c.mesh.delivered).toEqual([]);
    k.run(6 * H - c.t + 60);
    expect(c.mesh.delivered.map((x) => x.at)).toEqual([6 * H]);
  });

  // @spec ADAPT-FAMILY-005
  it('ADAPT-FAMILY-005 delivers at the first hearing when the destination hears a message twice', () => {
    // triangle 0-1, 0-2, 1-2, destination 2. Draws: hop 0>1, slot of 1, hop 0>2, slot of 2, hop 1>0, hop 1>2.
    // Node 1 sends first and node 2 hears it again; the delivery keeps the first hearing.
    const seed = Array.from({ length: 2000 }, (_, i) => i).find((s) => { const d = draws(s, 'p07', 6); return d[0] < P_HOP && d[2] < P_HOP && slot(d[1]) < slot(d[3]) && d[5] < P_HOP; })!;
    const w = makeWorld({ seed, t: 1000, edges: [edge(0, 1), edge(0, 2), edge(1, 2)], households: [hh('h2', 2)] });
    w.mesh.inbox.push(ok(900, 'h2', 1, 0));
    p07(w, 'stratum', [down(0, 48)]).step();
    expect(w.mesh.delivered.map((x) => x.at)).toEqual([900 + AIR]);
  });

  // @spec ADAPT-FAMILY-005
  it('ADAPT-FAMILY-005 delivers at once when origin is destination, and passes an unreached message to the bulletin', () => {
    const same = makeWorld({ t: 1000, edges: [], households: [hh('h0', 0)] });
    const m = ok(900, 'h0', 1, 0);
    same.mesh.inbox.push(m);
    p07(same, 'stratum', [down(0, 48)]).step();
    expect(same.mesh.delivered).toEqual([{ ...m, at: 900 }]);

    // a line of seven nodes: four relays carry the packet five hops, never six
    const line = [0, 1, 2, 3, 4, 5].map((a) => edge(a, a + 1));
    for (let seed = 1; seed <= 20; seed++) {
      const w = makeWorld({ seed, t: 1020, edges: line, households: [hh('h6', 6)] });
      w.mesh.inbox.push(ok(900, 'h6', 1, 0));
      const k = p07(w, 'stratum', [down(0, 48)]);
      k.step();
      expect(w.mesh.delivered).toEqual([]);
      k.run(6 * H - w.t + 60);
      expect(w.mesh.delivered.map((x) => x.at)).toEqual([6 * H]);
    }
  });

  // @spec ADAPT-FAMILY-004
  it('ADAPT-FAMILY-004 succeeds a hop with probability P_HOP', () => {
    let hit = 0;
    const n = 400;
    for (let seed = 0; seed < n; seed++) {
      const w = makeWorld({ seed, t: 1000, edges: [edge(0, 1)], households: [hh('h1', 1)] });
      w.mesh.inbox.push(ok(900, 'h1', 1, 0));
      p07(w, 'stratum', [down(0, 48)]).step();
      hit += w.mesh.delivered.length;
    }
    expect(hit / n).toBeGreaterThan(P_HOP - 0.05);
    expect(hit / n).toBeLessThan(P_HOP + 0.05);
  });

  // @spec ADAPT-FAMILY-006
  it('ADAPT-FAMILY-006 scores the share of simulated messages delivered within 60 min', () => {
    const w = makeWorld({ t: 5.5 * H + 60, households: [hh('h3', 3)] });
    const k = p07(w, 'directorate', [down(0, 48)]);
    expect(k.metrics().p07?.value).toBe(0);
    w.mesh.inbox.push(ok(5 * H, 'h3', 1, 0), ok(5.5 * H, 'h3', 2, 0), ok(4 * H, 'h3', 3, 0), ok(5 * H, 'family', 1, 17, 'LIVE'));
    k.run(6 * H - w.t + 60);
    const before = JSON.stringify(w);
    expect(k.metrics().p07?.value).toBeCloseTo(2 / 3, 12);
    expect(JSON.stringify(w)).toBe(before);
  });
});

describe('p08 family board', () => {
  it('pins its constants to docs/params.md', () => {
    expect({ FIRST_WINDOW, BEACON_EVERY }).toEqual({ FIRST_WINDOW: 1800, BEACON_EVERY: 6 * H });
  });

  const homes = [hh('h0', 0), hh('h9', 9, 3), demo, hh('h22', 22, 5), hh('h5', 5, 6), hh('h12', 12, 2)];
  const sep = (away: number) => [down(0, 168), { type: 'separate', atH: 0.5, away } as ScenarioEvent];

  /** Who goes where, replayed from p08's stream: four draws per member, demo household skipped. */
  function expected(seed: number, away: number) {
    const r = rng(seed, 'p08');
    const out: { id: string; member: number; level: number; sector: number; at: number }[] = [];
    for (const h of homes.filter((x) => x.id !== 'family')) {
      const others = [1, 2, 3, 4, 5, 6].filter((l) => l !== h.level);
      for (let member = 1; member < h.members; member++) {
        const [u, ul, us, ud] = [r(), r(), r(), r()];
        if (u < away) out.push({ id: h.id, member, level: others[Math.floor(ul * 5)], sector: Math.floor(us * 4), at: 0.5 * H + ud * FIRST_WINDOW });
      }
    }
    return out;
  }
  const seen = (w: World) => w.mesh.inbox.map((m) => ({ id: m.heard!.keySet, member: m.heard!.payload.member, level: m.heard!.payload.level, sector: m.heard!.payload.sector, at: m.at }));

  // @spec ADAPT-FAMILY-007
  it('ADAPT-FAMILY-007 separates members 1 and up with four draws each, skipping the demo household', () => {
    const want = expected(3, 0.5);
    expect(want.length).toBeGreaterThan(2);
    expect(want.length).toBeLessThan(homes.reduce((n, h) => n + h.members - 1, 0) - 3);
    const w = makeWorld({ seed: 3, t: 0.5 * H, households: homes });
    const k = createKernel(w, [createP08('stratum', script(sep(0.5)))], { check: true });
    k.run(FIRST_WINDOW); // every first beacon, no second one
    const byKey = (a: { id: string; member: number }, b: { id: string; member: number }) => (a.id + a.member < b.id + b.member ? -1 : 1);
    expect(seen(w).sort(byKey)).toEqual(want.sort(byKey));
    expect(w.mesh.delivered).toEqual([]); // p07 owns mesh.delivered; p08 only appends to the inbox
    for (const x of want) {
      expect(x.level).not.toBe(homes.find((h) => h.id === x.id)!.level);
      expect(x.member).toBeGreaterThan(0);
    }
  });

  // @spec ADAPT-FAMILY-007
  it('ADAPT-FAMILY-007 does nothing before the separation step, and draws the same under both policies', () => {
    const run = (policy: Policy) => {
      const w = makeWorld({ seed: 3, t: 0, households: homes });
      const k = createKernel(w, [createP08(policy, script(sep(0.5)))], { check: true });
      k.run(0.5 * H);
      expect(w.mesh.inbox).toEqual([]);
      k.run(H);
      return seen(w);
    };
    expect(run('directorate')).toEqual(run('stratum'));
  });

  // @spec ADAPT-FAMILY-008
  it('ADAPT-FAMILY-008 queues each beacon in the step that holds it, as a packet v3 OK with SIMULATED heard', () => {
    const w = makeWorld({ seed: 3, t: 0.5 * H, households: homes });
    const k = createKernel(w, [createP08('stratum', script(sep(0.5)))], { check: true });
    for (let i = 0; i < (6.5 * H) / 60; i++) {
      const t = w.t;
      const n = w.mesh.inbox.length;
      k.step();
      for (const m of w.mesh.inbox.slice(n)) {
        expect(m.at).toBeGreaterThanOrEqual(t);
        expect(m.at).toBeLessThan(t + 60);
      }
    }
    const want = expected(3, 0.5);
    expect(w.mesh.inbox).toHaveLength(2 * want.length);
    expect(w.mesh.delivered).toEqual([]);
    for (const m of w.mesh.inbox) {
      expect(m.bytes).toHaveLength(25);
      expect(m.bytes[0]).toBe(0x30);
      expect(m.bytes[16]).toBe(4);
      expect(m.heard).toMatchObject({ type: 0, minute: Math.floor(m.at / 60), label: 'SIMULATED' });
    }
    for (const x of want) {
      const mine = w.mesh.inbox.filter((m) => m.heard!.keySet === x.id && m.heard!.payload.member === x.member).map((m) => m.at);
      expect(mine).toEqual([x.at, x.at + BEACON_EVERY]);
    }
    expect(new Set(w.mesh.inbox.map((m) => m.bytes.join())).size).toBe(w.mesh.inbox.length);
  });

  // @spec ADAPT-FAMILY-009, ADAPT-FAMILY-010
  it('ADAPT-FAMILY-009 knows a member from a delivered SIMULATED OK at or after the separation, and averages the unknown hours', () => {
    const w = makeWorld({ seed: 3, t: 0.5 * H, households: homes });
    const k = createKernel(w, [createP08('stratum', script(sep(0.5)))], { check: true });
    expect(k.metrics().p08).toEqual({ name: 'mean hours until status known', value: 0, unit: 'h', label: 'SIMULATED' });
    const n = expected(3, 0.5).length;
    const [a, b] = expected(3, 0.5);
    k.run(600); // 10 steps, everyone unknown
    expect(k.metrics().p08?.value).toBeCloseTo(10 / 60, 12);
    const report = ok(2 * H, a.id, a.member, 0);
    report.heard!.type = 2;
    w.mesh.delivered.push(ok(0.5 * H - 1, a.id, a.member, 0), ok(H, a.id, a.member, 0, 'LIVE'), ok(H, 'h0', 0, 0), report);
    k.step(); // none of these counts
    expect(k.metrics().p08?.value).toBeCloseTo(11 / 60, 12);
    w.mesh.delivered.push(ok(0.5 * H, a.id, a.member, 0), ok(2 * H, b.id, b.member, 0));
    k.step(); // two known in this step
    expect(k.metrics().p08?.value).toBeCloseTo(11 / 60 + (n - 2) / n / 60, 12);
  });

  // @spec ADAPT-FAMILY-010
  it('ADAPT-FAMILY-010 under the Directorate everyone is known at the 06:00 bulletin: 5.5 h after a 00:30 separation', () => {
    const w = makeWorld({ seed: 3, t: 0, households: homes });
    const k = createKernel(w, [createP07('directorate', script(sep(0.5))), createP08('directorate', script(sep(0.5)))], { check: true });
    k.run(0.5 * H);
    expect(k.metrics().p08?.value).toBe(0);
    k.run(10 * H);
    expect(k.metrics().p08?.value).toBeCloseTo(5.5, 9);
  });
});

describe('family board', () => {
  // @spec ADAPT-FAMILY-011
  it('ADAPT-FAMILY-011 shows the latest delivered OK per household and member, without changing the world', () => {
    const w = makeWorld();
    const report = ok(150, 'h3', 1, 2); // newest for h3/1, but not an OK
    report.heard!.type = 2;
    // h0/1: two OKs with the same at; the later-delivered one wins
    w.mesh.delivered.push(ok(100, 'h3', 1, 5), ok(40, 'h3', 1, 6), ok(70, 'h3', 2, 9), report, { at: 200, bytes: new Uint8Array(25) }, ok(90, 'family', 0, 17, 'LIVE'),
      ok(80, 'h0', 1, 0, 'LIVE'), ok(80, 'h0', 1, 1));
    const before = JSON.stringify(w);
    expect(familyBoard(w)).toEqual({
      h3: { 1: { at: 100, minute: 1, level: 2, sector: 1, label: 'SIMULATED' }, 2: { at: 70, minute: 1, level: 3, sector: 1, label: 'SIMULATED' } },
      family: { 0: { at: 90, minute: 1, level: 5, sector: 1, label: 'LIVE' } },
      h0: { 1: { at: 80, minute: 1, level: 1, sector: 1, label: 'SIMULATED' } },
    });
    expect(JSON.stringify(w)).toBe(before);
  });

  // @spec ADAPT-FAMILY-012
  it('ADAPT-FAMILY-012 shows a LIVE OK for the demo household after the next step and changes no metric', () => {
    for (const policy of ['directorate', 'stratum'] as const) {
      const households = [demo, ...Array.from({ length: 48 }, (_, i) => hh(`h${i % 24}-${Math.floor(i / 24)}`, i % 24))];
      const twin = () => { const w = makeWorld({ seed: 11, households }); return { w, k: createKernel(w, [createP07(policy, sevenDay), createP08(policy, sevenDay)], { check: true }) }; };
      const a = twin(), b = twin();
      a.k.run(3 * H);
      b.k.run(3 * H);
      const live = ok(a.w.t, 'family', 2, 17, 'LIVE');
      live.heard!.minute = 29_400_000; // a full Unix minute
      a.w.mesh.inbox.push(live);
      a.k.step();
      b.k.step();
      expect(familyBoard(a.w).family?.[2]).toEqual({ at: 3 * H, minute: 29_400_000, level: 5, sector: 1, label: 'LIVE' });
      expect(a.k.metrics()).toEqual(b.k.metrics());
      a.k.run(24 * H);
      b.k.run(24 * H);
      expect(a.k.metrics()).toEqual(b.k.metrics());
    }
  });
});

describe('family adapters over the seven-day script', () => {
  // @spec ADAPT-FAMILY-001, ADAPT-FAMILY-010
  it('run checked for seven days under both policies, and the mesh makes status known sooner', () => {
    const households = [demo, ...Array.from({ length: 48 }, (_, i) => hh(`h${i % 24}-${Math.floor(i / 24)}`, i % 24))];
    const run = (policy: Policy) => {
      const w = makeWorld({ seed: 5, households });
      const k = createKernel(w, [createP07(policy, sevenDay), createP08(policy, sevenDay)], { check: true });
      k.run(7 * 24 * H);
      return k.metrics();
    };
    const dir = run('directorate'), str = run('stratum');
    for (const m of [dir, str]) for (const x of Object.values(m)) expect(Number.isFinite(x.value)).toBe(true);
    expect(str.p08!.value).toBeLessThan(dir.p08!.value);
    expect(str.p07!.value).toBeGreaterThan(dir.p07!.value);
    // pinned for seed 5: the cascade's draw order, ties and own() all move these
    expect(dir.p07!.value).toBe(0);
    expect(dir.p08!.value).toBeCloseTo(4, 9);
    expect(str.p07!.value).toBeCloseTo(0.538393, 6);
    expect(str.p08!.value).toBeCloseTo(2.02625, 6);
  });
});
