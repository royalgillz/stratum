import { describe, expect, it } from 'vitest';
import type { World } from '../contracts.ts';
import { rotate } from '../fairshare/fairshare.ts';
import { createKernel } from '../kernel/kernel.ts';
import { rng, type Rng } from '../rng.ts';
import type { ScenarioEvent } from '../scenario/types.ts';
import { busyMin, careRequests, firstCareMin } from '../world/care/care.ts';
import { districtTunnels, hopsFrom } from '../world/tunnels/tunnels.ts';
import { livableWorld, quietScript } from './livable.fixture.ts';
import { P_HOP } from './p07.ts';
import { createP05 } from './p05.ts';
import { COURIERS, createP10, POPUP } from './p10.ts';
import type { Policy } from './shared.ts';

const H = 3600, DAY = 86400;
const care = (atH: number, durH: number, red: number, amber: number): ScenarioEvent => ({ type: 'care', atH, durH, red, amber });
const down = (atH: number, durH: number): ScenarioEvent => ({ type: 'network-down', atH, durH });
const hopsOn = (w: World, s: number) => hopsFrom(w.tunnels.edges, s, 24);
const hop0 = (s: number) => hopsFrom(districtTunnels().edges, s, 24)[0]!;
const bulletin = (T: number) => 6 * H + DAY * Math.ceil((T - 6 * H) / DAY);
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

function p10(policy: Policy, events: ScenarioEvent[], seed = 1) {
  const w = livableWorld(seed);
  return { w, k: createKernel(w, [createP10(policy, quietScript(events))], { check: true }) };
}
const median = (k: ReturnType<typeof createKernel>) => k.metrics().p10!.value;

/** STRATUM's pop-up nodes from `rotate` with these level debts, in rising level order. */
function popups(r: Rng, debts = [0, 0, 0, 0, 0, 0]): number[] {
  const claims = debts.map((debt, i) => ({ id: `L${i + 1}`, floor: 0, demand: 1, debt }));
  return rotate(POPUP, claims, r).winners.map((id) => Number(id.slice(1))).sort((a, b) => a - b).map((l) => (l - 1) * 4 + 1);
}
const nearest = (s: number, points: number[]) => Math.min(...points.map((n) => hopsFrom(districtTunnels().edges, s, 24)[n] ?? Infinity));

/** The specs replayed step by step over intact tunnels with the network cut over [0, cutH): each request's first care, Infinity while unserved. */
function replay(policy: Policy, events: ScenarioEvent[], seed: number, until: number, cutH: number) {
  const r = rng(seed, 'p10');
  const q = careRequests(events, r).map((x, i) => ({ ...x, i, arrival: Infinity, care: Infinity }));
  const node = [0, 0, 0], busy = [0, 0, 0]; // per courier
  const hops = (s: number) => hopsFrom(districtTunnels().edges, s, 24) as number[];
  const rank = (x: (typeof q)[number]) => (policy === 'stratum' && x.cls === 'AMBER' ? 1 : 0);
  for (let t = 0; t < until; t += 60) {
    if (policy === 'stratum' && t % DAY === 0) {
      const debt = [1, 2, 3, 4, 5, 6].map((l) => q.filter((x) => Math.floor(x.sector / 4) + 1 === l && x.arrival >= t - DAY && x.arrival < t).length);
      popups(r, debt).forEach((n, k) => (node[k + 1] = n));
    }
    for (const x of q.filter((x) => x.t >= t && x.t < t + 60)) {
      const near = Math.min(...node.map((n) => hops(x.sector)[n]!));
      const up = x.t >= cutH * H;
      const mesh = !up && policy === 'stratum' && near <= 4 && Array.from({ length: near }, () => r()).every((u) => u < P_HOP);
      x.arrival = up || mesh ? x.t : Math.min(bulletin(x.t), cutH * H);
    }
    for (const x of q.filter((x) => x.arrival < t + 60 && x.care === Infinity).sort((a, b) => rank(a) - rank(b) || a.arrival - b.arrival || a.i - b.i)) {
      const h = hops(x.sector);
      const k = [0, 1, 2].filter((k) => busy[k]! <= t).sort((a, b) => h[node[a]!]! - h[node[b]!]! || a - b)[0];
      if (k === undefined) break; // intact tunnels: no free courier for this one means none for the rest
      const start = Math.max(t, x.arrival);
      x.care = start + firstCareMin(h[node[k]!]!) * 60;
      busy[k] = start + busyMin(h[node[k]!]!) * 60;
    }
  }
  return q;
}
const medianAt = (q: ReturnType<typeof replay>, T: number) => {
  const waits = q.filter((x) => x.cls === 'RED' && x.t < T).map((x) => Math.min(x.care, T) - x.t).sort((a, b) => a - b);
  return waits.length ? waits[waits.length >> 1]! / H : 0;
};

describe('p10 care delivery', () => {
  it('pins its constants to docs/params.md', () => {
    expect({ COURIERS, POPUP }).toEqual({ COURIERS: 3, POPUP: 2 });
  });

  // @spec ADAPT-SPACECARE-010
  it('ADAPT-SPACECARE-010 declares its reads and no writes', () => {
    const a = createP10('stratum', quietScript());
    expect(a.id).toBe('p10');
    expect([...a.reads]).toEqual(['tunnels']);
    expect([...a.writes]).toEqual([]);
  });

  // @spec ADAPT-SPACECARE-005, ADAPT-SPACECARE-006, ADAPT-SPACECARE-008, ADAPT-SPACECARE-009
  it('ADAPT-SPACECARE-005 draws the requests on the first step; with the network up a RED child waits only for the walk', () => {
    const events = [care(1, 20, 1.2, 0)]; // one RED request in [1 h, 21 h)
    for (const seed of [1, 2, 3, 4, 5]) {
      const [q] = careRequests(events, rng(seed, 'p10'));
      const { w, k } = p10('directorate', events, seed);
      expect(median(k)).toBe(0);
      k.run(Math.floor(q!.t / 60) * 60); // up to the step that holds the request: not yet sent
      expect(median(k)).toBe(0);
      k.step(); // sent and the courier on its way: the wait so far until it gets there
      expect(median(k)).toBeCloseTo((Math.min(q!.t + hop0(q!.sector) * 600, w.t) - q!.t) / H, 12);
      k.run(hop0(q!.sector) * 600);
      expect(median(k)).toBeCloseTo((hop0(q!.sector) * 10) / 60, 12);
      expect(k.metrics().p10).toMatchObject({ name: 'median hours to first care (RED)', unit: 'h', label: 'SIMULATED' });
    }
  });

  // @spec ADAPT-SPACECARE-006, ADAPT-SPACECARE-009
  it('ADAPT-SPACECARE-006 Directorate: with the network down a request waits for 06:00 or the end of the cut, whichever is first', () => {
    const events = (cutH: number) => [down(0, cutH), care(1, 20, 1.2, 0)];
    const T = (seed: number) => careRequests(events(48), rng(seed, 'p10'))[0]!;
    // the bulletin
    const late = seeds.find((s) => T(s).t > 6 * H)!;
    const a = p10('directorate', events(48), late);
    a.k.run(48 * H);
    expect(median(a.k)).toBeCloseTo((bulletin(T(late).t) - T(late).t + hop0(T(late).sector) * 600) / H, 9);
    // the end of a 3 h cut, with the wait so far counted while it lasts
    const early = seeds.find((s) => T(s).t < 2.5 * H && T(s).sector !== 0)!;
    const b = p10('directorate', events(3), early);
    b.k.run(2.5 * H);
    expect(median(b.k)).toBeCloseTo((2.5 * H - T(early).t) / H, 9);
    b.k.run(4 * H);
    expect(median(b.k)).toBeCloseTo((3 * H - T(early).t + hop0(T(early).sector) * 600) / H, 9);
  });

  // @spec ADAPT-SPACECARE-006, ADAPT-SPACECARE-007
  // A 20 h cut and one RED request in [1 h, 19 h): every arrival falls on day 1, before the pop-ups move.
  const day1 = [down(0, 20), care(1, 18, 1.2, 0)];
  const held = (T: number) => Math.min(bulletin(T), 20 * H);

  it('ADAPT-SPACECARE-006 STRATUM: within MAX_HOPS of a care point the mesh carries it when every hop succeeds', () => {
    const events = day1;
    let reached = 0, dropped = 0;
    for (const seed of seeds.slice(0, 60)) {
      const r = rng(seed, 'p10');
      const [q] = careRequests(events, r);
      const near = nearest(q!.sector, [0, ...popups(r)]);
      const ok = near <= 4 && Array.from({ length: near }, () => r()).every((u) => u < P_HOP);
      if (near > 0) ok ? reached++ : dropped++;
      const { k } = p10('stratum', events, seed);
      k.run(48 * H);
      expect(median(k)).toBeCloseTo(((ok ? q!.t : held(q!.t)) - q!.t + near * 600) / H, 9);
    }
    expect(reached).toBeGreaterThan(0);
    expect(dropped).toBeGreaterThan(0);
  });

  // @spec ADAPT-SPACECARE-006
  it('ADAPT-SPACECARE-006 STRATUM: reach is decided once, at send; no path means waiting even after the tunnels reopen', () => {
    const events = day1;
    const seed = seeds.find((s) => {
      const r = rng(s, 'p10');
      const [q] = careRequests(events, r);
      return ![0, ...popups(r)].includes(q!.sector);
    })!;
    const r = rng(seed, 'p10');
    const [q] = careRequests(events, r);
    const near = nearest(q!.sector, [0, ...popups(r)]);
    const { w, k } = p10('stratum', events, seed);
    for (const e of w.tunnels.edges) e.passable = false;
    k.run(Math.floor(q!.t / 60) * 60 + 60); // through the step that sends it
    for (const e of w.tunnels.edges) e.passable = true;
    k.run(22 * H - w.t);
    expect(median(k)).toBeCloseTo((held(q!.t) - q!.t + near * 600) / H, 9);
  });

  // @spec ADAPT-SPACECARE-007
  it('ADAPT-SPACECARE-007 STRATUM places the pop-ups each day by the previous day\'s arrivals per level', () => {
    const events = [care(0, 12, 0, 48), care(25, 20, 1.2, 0)]; // 24 AMBER on day 1, one RED on day 2, network up
    const expected = (seed: number, withDebt: boolean) => {
      const r = rng(seed, 'p10');
      const q = careRequests(events, r);
      popups(r); // 00:00 on day 1
      const debts = [1, 2, 3, 4, 5, 6].map((l) => (withDebt ? q.filter((x) => x.cls === 'AMBER' && Math.floor(x.sector / 4) + 1 === l).length : 0));
      const red = q.find((x) => x.cls === 'RED')!;
      return (nearest(red.sector, [0, ...popups(r, debts)]) * 10) / 60;
    };
    const differs = seeds.filter((s) => expected(s, true) !== expected(s, false)).slice(0, 3);
    expect(differs.length).toBeGreaterThan(0);
    for (const seed of [...differs, 1, 2]) {
      const { k } = p10('stratum', events, seed);
      k.run(46 * H);
      expect(median(k)).toBeCloseTo(expected(seed, true), 9);
    }
  });

  // @spec ADAPT-SPACECARE-008
  it('ADAPT-SPACECARE-008 STRATUM sends RED first; the Directorate serves in order of arrival', () => {
    // 4 AMBER in [0, 1 h), then 1 RED in [2 h, 3 h); no tunnel is open until 06:00, so the mesh reaches nobody away from a care point
    const events = [down(0, 48), care(0, 1, 0, 96), care(2, 1, 24, 0)];
    const seed = seeds.find((s) => {
      const r = rng(s, 'p10');
      const q = careRequests(events, r);
      const points = [0, ...popups(r)];
      return q.every((x) => !points.includes(x.sector));
    })!;
    const r = rng(seed, 'p10');
    const red = careRequests(events, r).find((x) => x.cls === 'RED')!;
    const near = nearest(red.sector, [0, ...popups(r)]);
    const wait = (policy: Policy) => {
      const { w, k } = p10(policy, events, seed);
      for (const e of w.tunnels.edges) e.passable = false;
      k.run(6 * H);
      for (const e of w.tunnels.edges) e.passable = true;
      k.run(18 * H);
      return median(k);
    };
    const str = wait('stratum');
    expect(str).toBeCloseTo((6 * H - red.t + near * 600) / H, 9);
    expect(wait('directorate')).toBeGreaterThan((6 * H - red.t + hop0(red.sector) * 600) / H + 0.4); // fifth in line behind three couriers
  });

  // @spec ADAPT-SPACECARE-008, ADAPT-SPACECARE-009
  it('ADAPT-SPACECARE-008 leaves a request no courier can reach waiting while later ones go first; the median takes the upper middle', () => {
    const events = [care(1, 20, 2.4, 0)]; // two RED requests
    const iso = (w: World, s: number) => { for (const e of w.tunnels.edges) if (e.a === s || e.b === s) e.passable = false; };
    const seed = seeds.find((s) => {
      const [a, b] = careRequests(events, rng(s, 'p10'));
      const w = livableWorld();
      iso(w, a!.sector);
      return a!.sector !== 0 && b!.sector !== a!.sector && hopsOn(w, b!.sector)[0] !== null;
    })!;
    const [a, b] = careRequests(events, rng(seed, 'p10'));
    const { w, k } = p10('directorate', events, seed);
    iso(w, a!.sector);
    const waitB = hopsOn(w, b!.sector)[0]! * 600;
    k.run(22 * H);
    expect(median(k)).toBeCloseTo(Math.max(22 * H - a!.t, waitB) / H, 9);
    for (const e of w.tunnels.edges) e.passable = true;
    k.run(60 + hop0(a!.sector) * 600); // the step at 22 h sends a courier; then its walk
    expect(median(k)).toBeCloseTo(Math.max(22 * H + hop0(a!.sector) * 600 - a!.t, waitB) / H, 9);
  });

  // @spec ADAPT-SPACECARE-006
  it('ADAPT-SPACECARE-006 Directorate: overlapping cuts hold a request until no cut covers the network', () => {
    const events = [down(0, 3), down(2, 3), care(1, 0.5, 48, 0)]; // one RED in [1 h, 1.5 h): network back at 5 h, not 3 h
    for (const seed of [1, 2, 3]) {
      const [q] = careRequests(events, rng(seed, 'p10'));
      const { k } = p10('directorate', events, seed);
      k.run(8 * H);
      expect(median(k)).toBeCloseTo((5 * H - q!.t + hop0(q!.sector) * 600) / H, 9);
    }
  });

  // @spec ADAPT-SPACECARE-006
  it('ADAPT-SPACECARE-006 STRATUM draws every hop of a request even after one fails', () => {
    // one AMBER in [6 h, 7 h), held to the end of the cut at 20 h; one RED in [8 h, 18 h), served first
    const events = [down(0, 20), care(6, 1, 0, 24), care(8, 10, 2.4, 0)];
    const at = (seed: number) => {
      const r = rng(seed, 'p10');
      const [a, red] = careRequests(events, r);
      const points = [0, ...popups(r)];
      const na = nearest(a!.sector, points), nr = nearest(red!.sector, points);
      const u = Array.from({ length: 8 }, () => r());
      const reached = (from: number) => nr <= 4 && u.slice(from, from + nr).every((x) => x < P_HOP);
      // the AMBER's first hop fails and the RED's reach depends on whether the AMBER drew its other hops
      return { red: red!, nr, ok: reached(na), pick: na >= 2 && na <= 4 && u[0]! >= P_HOP && reached(na) !== reached(1) };
    };
    const seed = Array.from({ length: 2000 }, (_, i) => i + 1).find((s) => at(s).pick)!;
    const { red, nr, ok } = at(seed);
    const { k } = p10('stratum', events, seed);
    k.run(24 * H);
    expect(median(k)).toBeCloseTo(((ok ? red.t : 20 * H) - red.t + nr * 600) / H, 9);
  });

  // @spec ADAPT-SPACECARE-006, ADAPT-SPACECARE-007
  it('ADAPT-SPACECARE-007 at 00:00 the pop-ups move before the requests of that step are sent', () => {
    const events = [down(0, 48), care(24, 1 / 60, 1440, 0)]; // one RED in the first minute of day 2
    const at = (seed: number) => {
      const r = rng(seed, 'p10');
      const [q] = careRequests(events, r);
      const day1 = [0, ...popups(r)], day2 = [0, ...popups(r)]; // nothing arrived on day 1: no debts
      const near = nearest(q!.sector, day2);
      const ok = near <= 4 && Array.from({ length: near }, () => r()).every((u) => u < P_HOP);
      return { near, pick: ok && nearest(q!.sector, day1) > 4 }; // only a day-2 pop-up is in mesh range
    };
    const seed = seeds.find((s) => at(s).pick)!;
    const { k } = p10('stratum', events, seed);
    k.run(26 * H);
    expect(median(k)).toBeCloseTo((at(seed).near * 600) / H, 9);
  });

  // @spec ADAPT-SPACECARE-008
  it('ADAPT-SPACECARE-008 a courier is busy for the walk, the visit and the walk back from max(t, arrival), and free at a step start equal to that', () => {
    const grid = (x: number) => Math.ceil(x / 60) * 60;
    const one = (atS: number, durS: number, cls: 'RED' | 'AMBER') => care(atS / H, durS / H, cls === 'RED' ? (24 * H) / durS : 0, cls === 'AMBER' ? (24 * H) / durS : 0);
    for (const seed of [1, 2, 3, 4, 5]) {
      // network up: 2 AMBER in [1 h, 1.1 h) take couriers 0 and 1, each busy from its own time. In the minute the first
      // of them frees, after it, a third AMBER takes courier 2, then a RED arrives and waits for the next step
      const two = care(1, 0.1, 0, 480);
      const free = Math.min(...careRequests([two], rng(seed, 'p10')).map((x) => x.t + busyMin(hop0(x.sector)) * 60));
      const d = (grid(free) - free) / 2;
      const up = [two, one(free, d, 'AMBER'), one(free + d, d, 'RED')];
      const red = careRequests(up, rng(seed, 'p10'))[3]!;
      const a = p10('directorate', up, seed);
      a.k.run(8 * H);
      expect(median(a.k)).toBeCloseTo((grid(free) + hop0(red.sector) * 600 - red.t) / H, 9);
      // network down: 3 AMBER then a RED all arrive at 06:00, so the first courier frees exactly on a step start and the RED goes then
      const amber = care(1, 0.1, 0, 720);
      const held = [down(0, 24), amber, care(2, 1, 24, 0)];
      const r2 = careRequests(held, rng(seed, 'p10'));
      const back = 6 * H + Math.min(...r2.slice(0, 3).map((x) => busyMin(hop0(x.sector)) * 60));
      const b = p10('directorate', held, seed);
      b.k.run(12 * H);
      expect(median(b.k)).toBeCloseTo((back + hop0(r2[3]!.sector) * 600 - r2[3]!.t) / H, 9);
    }
  });

  // @spec ADAPT-SPACECARE-006, ADAPT-SPACECARE-007, ADAPT-SPACECARE-008, ADAPT-SPACECARE-009
  it('matches a step-by-step replay of the specs hour by hour: pop-ups by the last 24 h of arrivals, courier order and freeing', () => {
    const cases = [
      { cutH: 48, hours: 72, events: [down(0, 48), care(0, 48, 0, 24), care(48, 24, 12, 0)] }, // AMBER debts over two cut days, RED on day 3
      { cutH: 0, hours: 54, events: [care(0, 48, 24, 12)] }, // network up and couriers often busy: ties, and busy across 00:00
    ];
    for (const { cutH, hours, events } of cases) {
      for (const policy of ['directorate', 'stratum'] as const) {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
          const q = replay(policy, events, seed, hours * H, cutH);
          const { w, k } = p10(policy, events, seed);
          for (let h = 1; h <= hours; h++) {
            k.run(H);
            expect(median(k), `${policy}, seed ${seed}, ${h} h`).toBeCloseTo(medianAt(q, w.t), 9);
          }
        }
      }
    }
  });

  // @spec ADAPT-SPACECARE-005, ADAPT-SPACECARE-009
  it('runs checked with p05 and a flood under both policies, replays from its seed, and STRATUM reaches RED children sooner', () => {
    const script = quietScript([down(0, 72), care(0, 72, 6, 12), { type: 'flood', atH: 30, sector: 21, inflowM3h: 50, durH: 10 }]);
    const run = (policy: Policy) => {
      const w = livableWorld(5);
      const k = createKernel(w, [createP05(policy, script), createP10(policy, script)], { check: true });
      k.run(3 * DAY);
      return { m: k.metrics(), w };
    };
    const dir = run('directorate'), str = run('stratum');
    expect(run('stratum')).toEqual(str);
    for (const x of [dir, str]) expect(Number.isFinite(x.m.p10!.value)).toBe(true);
    expect(str.m.p10!.value).toBeLessThan(dir.m.p10!.value);
  });
});
