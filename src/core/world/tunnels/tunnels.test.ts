import { describe, expect, it } from 'vitest';
import type { TunnelEdge } from '../../contracts.ts';
import type { ScenarioEvent } from '../../scenario/types.ts';
import {
  HUB, PUMP_CAP, PUMP_KW, RECOVER, SEEP_STEP, SEEP_TOP, SUMP_CAP,
  districtTunnels, floodInflow, hopsFrom, isFlooded, reachable, strandedIfLost, sumpStep,
} from './tunnels.ts';

const N = 24;
const e = (a: number, b: number, passable = true): TunnelEdge => ({ a, b, passable });
const dry = () => Array<boolean>(N).fill(false);
const wet = (...nodes: number[]) => dry().map((_, i) => nodes.includes(i));
const tens = Array.from({ length: N }, (_, i) => 10 * (i + 1)); // node i holds 10(i + 1) people
const flood = (atH: number, sector: number, inflowM3h: number, durH: number): ScenarioEvent => ({ type: 'flood', atH, sector, inflowM3h, durH });

describe('tunnels graph', () => {
  // @spec WORLD-TUNNEL-001
  it('WORLD-TUNNEL-001 builds the 28 edges of District 7 in order', () => {
    const t = districtTunnels();
    expect(t.nodes).toBe(24);
    expect(t.edges.map((x) => [x.a, x.b])).toEqual([
      [0, 1], [1, 2], [2, 3], [0, 3], [4, 5], [5, 6], [6, 7], [4, 7], [8, 9], [9, 10], [10, 11], [8, 11],
      [12, 13], [13, 14], [14, 15], [16, 17], [17, 18], [18, 19], [20, 21], [21, 22], [22, 23],
      [0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [2, 6], [6, 10],
    ]);
    expect(t.edges.every((x) => x.passable)).toBe(true);
    expect(HUB).toBe(0);
    // each call returns fresh edges: World is mutable
    t.edges[0].passable = false;
    expect(districtTunnels().edges[0].passable).toBe(true);
  });

  // @spec WORLD-TUNNEL-002
  it('WORLD-TUNNEL-002 joins nodes to the hub over passable edges only', () => {
    expect(reachable([e(0, 1), e(1, 2), e(3, 4)], 0, 5)).toEqual([true, true, true, false, false]);
    expect(reachable([e(0, 1), e(1, 2, false)], 0, 3)).toEqual([true, true, false]);
    expect(reachable([e(0, 1), e(1, 2, false)], 2, 3)).toEqual([false, false, true]);
    expect(reachable([], 0, 1)).toEqual([true]);
    expect(reachable(districtTunnels().edges, HUB, N).every(Boolean)).toBe(true);
  });

  // @spec WORLD-TUNNEL-003
  it('WORLD-TUNNEL-003 counts the people of a path that a node carries', () => {
    const path = [e(0, 1), e(1, 2)];
    const r = strandedIfLost(path, dry(), tens, 0);
    expect(r).toHaveLength(N);
    expect(r.slice(0, 3)).toEqual([20 + 30, 30, 0]); // own people never counted
    expect(r.slice(3).every((x) => x === 0)).toBe(true); // nodes that never reach the hub
    // a ring has no critical node but the hub
    expect(strandedIfLost([...path, e(0, 2)], dry(), tens, 0).slice(0, 3)).toEqual([50, 0, 0]);
  });

  // @spec WORLD-TUNNEL-003
  it('WORLD-TUNNEL-003 counts only paths that exist now, and a flooded node whose drying reconnects others', () => {
    const path = [e(0, 1), e(1, 2), e(2, 3)];
    // node 1 flooded: drying it reconnects 2 and 3; nodes behind it are already cut off
    expect(strandedIfLost(path, wet(1), tens, 0).slice(0, 4)).toEqual([0, 30 + 40, 0, 0]);
    // two flooded in series: drying either alone reconnects no one
    expect(strandedIfLost(path, wet(1, 2), tens, 0).slice(0, 4)).toEqual([0, 0, 0, 0]);
    // the hub flooded: it alone carries everyone
    expect(strandedIfLost(path, wet(0), tens, 0).slice(0, 4)).toEqual([20 + 30 + 40, 0, 0, 0]);
    // passable flags are ignored: flooding decides
    const closed = path.map((x) => ({ ...x, passable: false }));
    expect(strandedIfLost(closed, dry(), tens, 0).slice(0, 4)).toEqual([90, 70, 40, 0]);
    // another hub
    expect(strandedIfLost(path, dry(), tens, 3).slice(0, 4)).toEqual([0, 10, 10 + 20, 60]);
  });

  // @spec WORLD-TUNNEL-004
  it('WORLD-TUNNEL-004 finds the critical sections of District 7', () => {
    const { edges } = districtTunnels();
    const people = Array<number>(N).fill(500);
    const r = strandedIfLost(edges, dry(), people, HUB);
    const critical = r.flatMap((x, i) => (x > 0 ? [i] : []));
    expect(critical).toEqual([0, 8, 12, 13, 14, 16, 17, 18, 20, 21, 22]);
    expect(r[0]).toBe(23 * 500);
    expect(r[8]).toBe(12 * 500);
    const f = strandedIfLost(edges, wet(16), people, HUB);
    expect(f[16]).toBe(3500);
    expect(f.slice(17)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('tunnels sumps', () => {
  // @spec WORLD-TUNNEL-005
  it('WORLD-TUNNEL-005 steps the sump by mass balance', () => {
    const seep = (level: number) => SEEP_TOP + SEEP_STEP * (level - 1);
    const want = (level: number, s: number, inflow: number, pf: number, dt: number) =>
      s + ((seep(level) + inflow - PUMP_CAP * pf) * dt) / 3600 / SUMP_CAP;
    // pins the constants to docs/params.md
    expect({ SUMP_CAP, SEEP_TOP, SEEP_STEP, PUMP_CAP, PUMP_KW, RECOVER })
      .toEqual({ SUMP_CAP: 200, SEEP_TOP: 2, SEEP_STEP: 1, PUMP_CAP: 15, PUMP_KW: 20, RECOVER: 0.9 });
    expect(sumpStep(1, 0.3, 0, 0, 3600)).toBeCloseTo(0.3 + 2 / 200, 12);
    expect(sumpStep(6, 0.3, 0, 0, 3600)).toBeCloseTo(0.3 + 7 / 200, 12);
    expect(sumpStep(6, 0.3, 15, 0.5, 60)).toBeCloseTo(want(6, 0.3, 15, 0.5, 60), 12);
    expect(sumpStep(3, 0.5, 4, 0.2, 600)).toBeCloseTo(want(3, 0.5, 4, 0.2, 600), 12);
    expect(sumpStep(6, 0.999, 100, 0, 3600)).toBe(1);
    expect(sumpStep(1, 0.001, 0, 1, 3600)).toBe(0);
  });

  // @spec WORLD-TUNNEL-006
  it('WORLD-TUNNEL-006 sums active flood events on the sector', () => {
    const events: ScenarioEvent[] = [
      flood(100, 22, 15, 10),
      flood(105, 22, 5, 1),
      flood(100, 21, 7, 10),
      { type: 'trip', atH: 100, loss: 0.1, durH: 1 },
      { type: 'outbreak', atH: 100, sector: 22, cases: 10 },
    ];
    expect(floodInflow(events, 22, 100 * 3600 - 1)).toBe(0);
    expect(floodInflow(events, 22, 100 * 3600)).toBe(15);
    expect(floodInflow(events, 22, 105.5 * 3600)).toBe(20);
    expect(floodInflow(events, 22, 106 * 3600)).toBe(15); // end is open
    expect(floodInflow(events, 22, 110 * 3600)).toBe(0);
    expect(floodInflow(events, 21, 101 * 3600)).toBe(7);
    expect(floodInflow(events, 5, 101 * 3600)).toBe(0);
    expect(floodInflow([], 22, 0)).toBe(0);
  });

  // @spec WORLD-TUNNEL-007
  it('WORLD-TUNNEL-007 floods at 1 and recovers below RECOVER', () => {
    expect(isFlooded(1, false)).toBe(true);
    expect(isFlooded(1, true)).toBe(true);
    expect(isFlooded(0.95, true)).toBe(true);
    expect(isFlooded(0.95, false)).toBe(false);
    expect(isFlooded(RECOVER, true)).toBe(true);
    expect(isFlooded(RECOVER - 1e-9, true)).toBe(false);
    expect(isFlooded(0, false)).toBe(false);
  });
});

describe('tunnels validation', () => {
  // @spec WORLD-TUNNEL-008
  it('WORLD-TUNNEL-008 throws RangeError on bad input', () => {
    const people = Array<number>(N).fill(500);
    const bad: unknown[] = [
      () => reachable([e(0, 24)], 0, 24),
      () => reachable([e(-1, 2)], 0, 24),
      () => reachable([e(0, 1.5)], 0, 24),
      () => reachable([e(0, 25)], 0, 30),
      () => reachable([], 0, 2.5),
      () => reachable([e(3, 3)], 0, 24),
      () => reachable([e(2, 1)], 0, 24),
      () => strandedIfLost([e(0, 24)], dry(), people, 0),
      () => strandedIfLost([e(0, 1)], dry(), people.slice(1), 0),
      () => strandedIfLost([e(0, 1)], dry(), [...people.slice(1), -1], 0),
      () => strandedIfLost([e(0, 1)], dry(), [...people.slice(1), NaN], 0),
      () => strandedIfLost([e(0, 1)], dry(), [...people.slice(1), Infinity], 0),
      () => strandedIfLost([e(0, 1)], dry().slice(1), people, 0),
      () => strandedIfLost([e(0, 1)], [...dry().slice(1), 1] as unknown as boolean[], people, 0),
      () => strandedIfLost([e(0, 1)], dry(), people, 24),
      () => sumpStep(0, 0.5, 0, 0, 60),
      () => sumpStep(7, 0.5, 0, 0, 60),
      () => sumpStep(2.5, 0.5, 0, 0, 60),
      () => sumpStep(1, 0.5, 0, -0.1, 60),
      () => sumpStep(1, 0.5, 0, 1.1, 60),
      () => sumpStep(1, 0.5, 0, NaN, 60),
      () => sumpStep(1, 0.5, -1, 0, 60),
      () => sumpStep(1, 0.5, Infinity, 0, 60),
      () => sumpStep(1, 0.5, 0, 0, Infinity),
      () => sumpStep(1, 0.5, 0, 0, 0),
      () => sumpStep(1, 0.5, 0, 0, -60),
      () => sumpStep(1, 0.5, 0, 0, NaN),
      () => sumpStep(1, NaN, 0, 0, 60),
      () => sumpStep(1, 1.5, 0, 0, 60),
      () => isFlooded(NaN, false),
      () => isFlooded(0.95, undefined as unknown as boolean),
      () => floodInflow([flood(0, 1, -5, 1)], 1, 0),
      () => floodInflow([flood(0, 1, 5, NaN)], 1, 0),
      () => floodInflow([flood(0, 1, 5, -2)], 1, 0),
      () => floodInflow([flood(0, 1, 5, Infinity)], 1, 0),
      () => floodInflow([flood(NaN, 1, 5, 1)], 1, 0),
      () => floodInflow([], 24, 0),
      () => floodInflow([], 1, NaN),
    ];
    for (const f of bad) expect(f).toThrow(RangeError);
    expect(() => sumpStep(6, 0, 0, 1, 60)).not.toThrow();
    expect(() => strandedIfLost(districtTunnels().edges, dry(), Array<number>(N).fill(0), 0)).not.toThrow();
  });

  // @spec WORLD-TUNNEL-009
  it('WORLD-TUNNEL-009 counts the fewest passable edges from a node, null with no path', () => {
    expect(hopsFrom([e(0, 1), e(1, 2), e(0, 2), e(3, 4)], 1, 5)).toEqual([1, 0, 1, null, null]);
    expect(hopsFrom([e(0, 1), e(1, 2, false)], 0, 3)).toEqual([0, 1, null]);
    expect(hopsFrom([], 0, 1)).toEqual([0]);
    const d = hopsFrom(districtTunnels().edges, HUB, N);
    expect(d.slice(0, 4)).toEqual([0, 1, 2, 1]);
    expect([d[4], d[8], d[10], d[12], d[16], d[20], d[22], d[23]]).toEqual([1, 2, 4, 3, 4, 5, 7, 8]);
    expect(hopsFrom(districtTunnels().edges, 23, N)[0]).toBe(8);
    for (const bad of [() => hopsFrom([], 2, 2), () => hopsFrom([], -1, 24), () => hopsFrom([], 0.5, 24), () => hopsFrom([], 0, 25),
      () => hopsFrom([e(0, 24)], 0, 24), () => hopsFrom([e(2, 1)], 0, 24)]) expect(bad).toThrow(RangeError);
  });
});
