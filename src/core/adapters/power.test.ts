// Tests for p01 (warning) and p02 (fair sharing), run through the kernel in checked mode.
import { describe, expect, it } from 'vitest';
import type { Adapter, Allocation, Sector, World } from '../contracts.ts';
import type { ScenarioEvent, Script } from '../scenario/types.ts';
import { sevenDay } from '../scenario/seven-day.ts';
import { createKernel } from '../kernel/kernel.ts';
import { allocate } from '../fairshare/fairshare.ts';
import { CAP_MARGIN, F0, capacityAt, swing, tierOf } from '../world/grid/grid.ts';
import { lifeFloor, powerDemand, sectorId, type Policy } from './shared.ts';
import { airUnwarned, createP01, FAN_ALERT_S, LISTEN_SHARE } from './p01.ts';
import { SHED_HZ, WATER_FLOOR, createP02 } from './p02.ts';

const H = 3600;
const IDS = Array.from({ length: 24 }, (_, s) => sectorId(s));
const EVEN = Array<number>(24).fill(500);

/** Local fixture: 24 sectors at full power, grid at 400 Hz and GREEN. */
function world(people: number[] = EVEN): World {
  const sector = (p: number, s: number): Sector => ({
    level: Math.floor(s / 4) + 1, temp: 24, wetBulb: 18, co2: 800, water: { cond: 0, toc: 0, turb: 0, biocide: 0 },
    sumpLevel: 0.2, people: p, sleepM2: 2, lightDose: 0, foodKcal: 0, stock: 5,
  });
  const power = Object.fromEntries(people.map((p, s) => [sectorId(s), powerDemand(p)]));
  return {
    t: 0, seed: 1, clock: { mode: 'timelapse', scale: 3600 },
    grid: { f: F0, rocof: 0, gapMW: 0, tier: 'GREEN' },
    sectors: people.map(sector),
    tunnels: { nodes: 24, edges: [] }, households: [],
    ledger: { measured: [], official: [] }, mesh: { inbox: [], delivered: [] },
    alloc: { power, water: {}, food: {}, cooling: {}, pumps: {}, lampHours: {}, medicine: {}, bunks: {}, trialSlots: {}, returnSlots: {} },
    surface: { readings: [], band: 'unknown' },
  };
}

const script = (events: ScenarioEvent[]): Script => ({ ...sevenDay, events });
const hold = (atH: number, loss: number, holdH: number): ScenarioEvent =>
  ({ type: 'shortfall', atH, from: loss, to: loss, rampH: 0, holdH, recoverH: 0 });
const metric = () => ({ name: 'stub', value: 0, unit: '', label: 'SIMULATED' as const });

/** Stands in for p01: sets grid.f to one value per step, the last repeating, or to a function of world time. */
function gridStub(fs: number[] | ((t: number) => number)): Adapter {
  let i = 0;
  const at = typeof fs === 'function' ? fs : () => fs[Math.min(i++, fs.length - 1)];
  return { id: 'p01', reads: [], writes: ['grid'], step: (w) => void (w.grid.f = at(w.t)), metric };
}

/** Stands in for p02: zeroes a sector's power in the step at the given world time. */
function cutStub(at: Record<number, string>): Adapter {
  return { id: 'p02', reads: [], writes: ['alloc'], step: (w) => void (at[w.t] && (w.alloc.power[at[w.t]] = 0)), metric };
}

const close = (a: Allocation, b: Allocation) => {
  expect(Object.keys(a)).toEqual(IDS);
  for (const id of IDS) expect(a[id]).toBeCloseTo(b[id], 9);
};
const sum = (a: Allocation) => Object.values(a).reduce((x, y) => x + y, 0);
const claims = (supply: number, floor: number[], demand: number[]) =>
  allocate(supply, IDS.map((id, s) => ({ id, floor: floor[s], demand: demand[s], debt: 0 }))).shares;

describe('p01 warning', () => {
  // @spec ADAPT-POWER-001
  it('sets f, rocof, tier and gapMW from the swing model at capacity and the allocated load', () => {
    const events = [hold(0, 0.05, 10)];
    const w = world();
    w.grid.f = 399.9;
    w.alloc.power.s00 = 0; // load is the allocation, 11.5 MW, not DEMAND_MW
    createKernel(w, [createP01('stratum', script(events))]).step();
    const cap = capacityAt(events, 0, CAP_MARGIN * 12);
    const { f, rocof } = swing(399.9, cap, 11.5, 60);
    expect(w.grid).toEqual({ f, rocof, gapMW: cap - 11.5, tier: tierOf(f, 'GREEN') });
  });

  // @spec ADAPT-POWER-001
  it('passes script.model.gridH to swing as the inertia constant', () => {
    const events = [hold(0, 0.05, 10)];
    const w = world();
    w.grid.f = 399.9;
    createKernel(w, [createP01('stratum', { ...script(events), model: { gridH: 30 } })]).step(); // tau 30 s, so the step does not settle
    const { f } = swing(399.9, capacityAt(events, 0, CAP_MARGIN * 12), 12, 60, 30);
    expect(w.grid.f).toBe(f);
    expect(f).not.toBe(swing(399.9, capacityAt(events, 0, CAP_MARGIN * 12), 12, 60).f);
  });

  // @spec ADAPT-POWER-001
  it('keeps the previous tier through the hysteresis band', () => {
    const w = world();
    [w.grid.f, w.grid.tier] = [399.96, 'AMBER'];
    createKernel(w, [createP01('stratum', script([hold(0, 1 - 11.9976 / 12.6, 10)]))]).step(); // settles at -0.04 Hz
    expect(w.grid.f).toBeCloseTo(399.96, 6);
    expect(w.grid.tier).toBe('AMBER');
    expect(tierOf(w.grid.f, 'GREEN')).toBe('GREEN'); // so the case tells the previous tier apart from GREEN
  });

  // @spec ADAPT-POWER-002, ADAPT-POWER-003
  it('records a cut at t - dt and warns it only after WARN_LEAD of AMBER or RED, steps before 0 being GREEN', () => {
    const events = [hold(0, 0.048, 10)]; // about -0.08 Hz at full load: AMBER from the first step
    const run = (policy: Policy, at: Record<number, string>) => {
      const k = createKernel(world(), [createP01(policy, script(events)), cutStub(at)]);
      k.run(2 * H);
      return k.metrics().p01!.value;
    };
    expect(run('stratum', { 600: 's00' })).toBe(1);
    expect(run('stratum', { 540: 's00' })).toBe(0);
    expect(run('stratum', { 600: 's00', 1200: 's01' })).toBe(0.5); // GREEN once s00 is off; s00 counted once
    expect(run('directorate', { 600: 's00' })).toBe(0);
  });

  // @spec ADAPT-POWER-004
  it('names its metric and gives 0 before any cut', () => {
    const k = createKernel(world(), [createP01('stratum', script([]))]);
    k.run(H);
    expect(k.metrics().p01).toEqual({ name: 'cuts warned 10 min ahead', value: 0, unit: 'share', label: 'SIMULATED' });
  });

  // @spec ADAPT-POWER-011, ADAPT-POWER-003
  it('records a trip\'s cuts and warns none of them, while a slow shortfall is warned', () => {
    const events: ScenarioEvent[] = [
      { type: 'trip', atH: 1, loss: 0.058, durH: 1 },
      { type: 'shortfall', atH: 4, from: 0.04, to: 0.08, rampH: 4, holdH: 1, recoverH: 2 },
    ];
    const run = (policy: Policy) => {
      const k = createKernel(world(), [createP01(policy, script(events)), createP02(policy, script(events))]);
      k.run(12 * H);
      return k.metrics().p01!.value;
    };
    expect(run('stratum')).toBe(0.5); // 24 trip cuts, none warned; 24 shortfall cuts, all warned
    expect(run('directorate')).toBe(0);
  });

  // @spec ADAPT-POWER-003, ADAPT-POWER-011
  it('warns 48 of the 120 seven-day cuts under STRATUM (five sheds, two warned) and none under the Directorate', () => {
    const run = (policy: Policy) => {
      const k = createKernel(world(), [createP01(policy, sevenDay), createP02(policy, sevenDay)]);
      k.run(sevenDay.days * 24 * H);
      return k.metrics();
    };
    const s = run('stratum'), d = run('directorate');
    expect(s.p01!.value).toBe(0.4);
    expect(d.p01!.value).toBe(0);
    expect(s.p02!.value).toBeGreaterThan(d.p02!.value);
  }, 60_000);
});

describe('p02 fair sharing', () => {
  const pd = EVEN.map(powerDemand);

  // @spec ADAPT-POWER-005
  // @spec ADAPT-POWER-005, ADAPT-POLICY-007
  it('sheds from f at or below F0 - SHED_HZ until capacity covers demand with the reserve, stopping when both hold', () => {
    const events: ScenarioEvent[] = [
      { type: 'trip', atH: 1, loss: 0.05, durH: 1 }, // 11.97 MW
      { type: 'trip', atH: 2, loss: 0.04, durH: 1 }, // 12.096 MW: covers DEMAND_MW but not the reserve
      { type: 'trip', atH: 4, loss: 0.04, durH: 1 },
    ];
    const low = F0 - SHED_HZ;
    const f = (t: number) => (t === H - 60 || t === H + 120 ? low : t === H + 60 ? low + 1e-9 : F0);
    const w = world();
    const others = { cooling: {}, pumps: {}, medicine: {} };
    Object.assign(w.alloc, others);
    const keys = Object.keys(w.alloc);
    const k = createKernel(w, [gridStub(f), createP02('stratum', script(events))]);
    const stepAt = (t: number) => (k.run(t - w.t), k.step());
    const full = Object.fromEntries(IDS.map((id, s) => [id, pd[s]]));
    const shed = (t: number) => expect(sum(w.alloc.power)).toBeCloseTo(capacityAt(events, t, CAP_MARGIN * 12) / 1.02, 9);
    stepAt(H - 60); // f at the trigger but full capacity: stopping wins
    close(w.alloc.power, full);
    stepAt(H); // capacity short, f at F0: no shed without the trigger
    close(w.alloc.power, full);
    stepAt(H + 60); // just above the trigger
    close(w.alloc.power, full);
    stepAt(H + 120);
    shed(H + 120);
    stepAt(H + 180); // f back at F0, still shedding
    shed(H + 180);
    stepAt(2 * H);
    shed(2 * H);
    stepAt(3 * H); // full capacity covers the reserve
    close(w.alloc.power, full);
    stepAt(4 * H); // a new shortfall needs a new f trigger
    close(w.alloc.power, full);
    expect(Object.keys(w.alloc)).toEqual(keys);
    for (const [key, v] of Object.entries(others)) expect(w.alloc[key as keyof typeof others]).toBe(v);
  });

  // @spec ADAPT-POWER-006
  it('cuts whole sectors deepest first, then restores top first as capacity returns', () => {
    const events: ScenarioEvent[] = [
      { type: 'trip', atH: 0, loss: 0.08, durH: 2 },
      { type: 'trip', atH: 0, loss: 0.08, durH: 1 },
    ];
    const w = world();
    const k = createKernel(w, [gridStub([F0 - 2]), createP02('directorate', script(events))]);
    const on = () => IDS.filter((id) => w.alloc.power[id] > 0).length;
    k.step(); // target 10.38 MW: sectors 20 to 23 cut
    expect(on()).toBe(20);
    for (const [s, id] of IDS.entries()) expect(w.alloc.power[id]).toBe(s < 20 ? pd[s] : 0);
    k.run(H); // target 11.36 MW: 20 and 21 back, 22 and 23 still cut
    for (const [s, id] of IDS.entries()) expect(w.alloc.power[id]).toBe(s < 22 ? pd[s] : 0);
  });

  // @spec ADAPT-POWER-006
  it('starts from the sectors served in the previous step, skipping a restore that does not fit', () => {
    const people = [...Array<number>(22).fill(500), 1000, 200]; // 12.2 MW
    const events: ScenarioEvent[] = [
      { type: 'trip', atH: 0, loss: 0.05, durH: 1 },
      { type: 'trip', atH: 0, loss: 0.035, durH: 2 },
    ];
    const w = world(people);
    const k = createKernel(w, [gridStub([F0 - 2]), createP02('directorate', script(events))]);
    const cut = () => IDS.filter((id) => w.alloc.power[id] === 0);
    k.step(); // target 11.49 MW: 23 and 22 cut, 22 does not fit back, 23 does
    expect(cut()).toEqual(['s22']);
    k.run(H); // target 12.12 MW: 22 still does not fit; cutting afresh from all sectors would cut 23 instead
    expect(cut()).toEqual(['s22']);
  });

  // @spec ADAPT-POWER-007
  it('shares power by Fair Share with life floors while shedding under STRATUM', () => {
    const events: ScenarioEvent[] = [{ type: 'trip', atH: 0, loss: 0.16, durH: 1 }];
    const target = capacityAt(events, 0, CAP_MARGIN * 12) / 1.02;
    const w = world();
    createKernel(w, [gridStub([F0 - 2]), createP02('stratum', script(events))]).step();
    close(w.alloc.power, claims(target, EVEN.map(lifeFloor), pd));
    for (const [s, id] of IDS.entries()) expect(w.alloc.power[id]).toBeGreaterThanOrEqual(lifeFloor(EVEN[s]));
  });

  // @spec ADAPT-POWER-007, ADAPT-POWER-008
  it('holds a large sector at its power and water floors when they sit above the water-filling level', () => {
    const people = [3000, ...Array<number>(23).fill(500)]; // 14.5 MW
    const w = world(people);
    createKernel(w, [gridStub([F0 - 2]), createP02('stratum', script([{ type: 'trip', atH: 0, loss: 0.32, durH: 1 }]))]).step();
    expect(w.alloc.power.s00).toBe(lifeFloor(3000)); // level about 0.40 MW, floor 0.9 MW
    expect(w.alloc.water.s00).toBe(3000 * WATER_FLOOR); // level about 15,700 L/day, floor 45,000
  });

  // @spec ADAPT-POWER-008
  it('splits recycled water by power served: powered sectors only, or by Fair Share', () => {
    const events: ScenarioEvent[] = [{ type: 'trip', atH: 0, loss: 0.16, durH: 1 }];
    const d = world();
    createKernel(d, [gridStub([F0 - 2]), createP02('directorate', script(events))]).step();
    const supplyD = 40 * 12000 * (10 / 12); // 20 of 24 sectors powered
    close(d.alloc.water, Object.fromEntries(IDS.map((id, s) => [id, s < 20 ? supplyD / 20 : 0])));
    const s = world();
    createKernel(s, [gridStub([F0 - 2]), createP02('stratum', script(events))]).step();
    const supplyS = 40 * 12000 * (sum(s.alloc.power) / 12);
    close(s.alloc.water, claims(supplyS, EVEN.map((p) => 15 * p), EVEN.map((p) => 50 * p)));
  });

  // @spec ADAPT-POWER-009
  it('splits food deliveries in proportion to demand, or by Fair Share', () => {
    const people = IDS.map((_, s) => 400 + 10 * s);
    const total = people.reduce((a, b) => a + b, 0);
    const run = (policy: Policy) => {
      const w = world(people);
      createKernel(w, [gridStub([F0]), createP02(policy, script([]))]).step();
      return w.alloc.food;
    };
    close(run('directorate'), Object.fromEntries(IDS.map((id, s) => [id, 2300 * people[s]])));
    close(run('stratum'), claims(2300 * total, people.map((p) => 2100 * p), people.map((p) => 2500 * p)));
  });

  // @spec ADAPT-POWER-009
  it('drops a farm cut-off level from the food supply: none for it under the Directorate, a share for every sector under STRATUM', () => {
    const people = IDS.map((_, s) => 400 + 10 * s);
    const reached = people.reduce((a, p, s) => (s >= 12 && s < 16 ? a : a + p), 0); // level 4 is sectors 12 to 15
    const events: ScenarioEvent[] = [{ type: 'farm-cut', atH: 1, level: 4, durH: 2 }, { type: 'trip', atH: 0, loss: 0.01, durH: 9 }];
    const at = (policy: Policy, t: number) => {
      const w = world(people);
      const k = createKernel(w, [gridStub([F0]), createP02(policy, script(events))]);
      k.run(t);
      k.step();
      return w.alloc.food;
    };
    const directorate = Object.fromEntries(IDS.map((id, s) => [id, 2300 * people[s]]));
    close(at('directorate', H - 60), directorate); // before the cut-off
    close(at('directorate', 3 * H), directorate); // after it ends
    close(at('directorate', H), Object.fromEntries(IDS.map((id, s) => [id, s >= 12 && s < 16 ? 0 : 2300 * people[s]])));
    close(at('stratum', H), claims(2300 * reached, people.map((p) => 2100 * p), people.map((p) => 2500 * p)));
    close(at('stratum', 3 * H), claims(2300 * people.reduce((a, b) => a + b, 0), people.map((p) => 2100 * p), people.map((p) => 2500 * p)));
  });

  // @spec ADAPT-POWER-010
  it('scores the person-weighted mean of the worst-off 10% of people, taking part of the last sector', () => {
    const people = [...Array<number>(23).fill(500), 600]; // 12,100 people: the worst 1,210 are sector 23 and 610 more
    const events: ScenarioEvent[] = [{ type: 'trip', atH: 0, loss: 0.05, durH: 1 }]; // target 11.83 MW: only sector 23 cut
    const k = createKernel(world(people), [gridStub([F0 - 2]), createP02('directorate', script(events))]);
    expect(k.metrics().p02).toEqual({ name: 'worst-decile served fraction', value: 0, unit: 'share', label: 'SIMULATED' });
    k.run(10 * 60);
    const cut = (0 + 0 + 0.92) / 3, fed = (1 + 0.8 + 0.92) / 3; // power, water, food served fractions
    expect(k.metrics().p02!.value).toBeCloseTo((600 * cut + 610 * fed) / 1210, 9);
  });
});

describe('p01 air: person-hours before a fan-stop warning', () => {
  const stops = (fanStops: Script['fanStops'], days = 7): Script => ({ ...sevenDay, days, fanStops });
  const both = (s: Script) => ({ d: airUnwarned(world(), s, 'directorate'), s: airUnwarned(world(), s, 'stratum') });
  const close = (got: { d: number; s: number }, d: number, s: number) => { expect(got.d).toBeCloseTo(d, 9); expect(got.s).toBeCloseTo(s, 9); };

  // @spec ADAPT-POWER-012
  it('ADAPT-POWER-012 Directorate: unwarned until the 06:00 bulletin or the fan restarts; STRATUM: phones after FAN_ALERT_S, the rest at the bulletin', () => {
    expect([LISTEN_SHARE, FAN_ALERT_S]).toEqual([0.5, 5]);
    // level 6 (2,000 people) at 16:00 for 3 h: no bulletin inside the stop
    close(both(stops([{ atH: 40, level: 6, durH: 3 }])), 6000, 1000 * 3 + (1000 * 5) / H);
    // level 4 at 05:00 for 4 h: the 06:00 bulletin warns everyone left after 1 h
    close(both(stops([{ atH: 101, level: 4, durH: 4 }])), 2000, 1000 + (1000 * 5) / H);
    // a stop at 06:00 exactly is warned by that bulletin; a stop shorter than the alert costs its whole span under both
    close(both(stops([{ atH: 30, level: 1, durH: 2 }])), 0, 0);
    close(both(stops([{ atH: 40, level: 1, durH: 1 / H }])), 2000 / H, 2000 / H);
    // stops add up, and people come from the world given
    expect(airUnwarned(world(EVEN.map((p, s) => (s >= 20 ? 2 * p : p))), stops([{ atH: 40, level: 6, durH: 3 }, { atH: 140, level: 2, durH: 2 }]), 'directorate')).toBe(12000 + 4000);
  });

  // @spec ADAPT-POWER-012
  it('ADAPT-POWER-012 counts nothing past the run end or without fan stops, and throws on a bad stop', () => {
    close(both(stops(undefined)), 0, 0);
    close(both(stops([{ atH: 23, level: 3, durH: 5 }], 1)), 2000, 1000 + (1000 * 5) / H); // clipped at hour 24
    close(both(stops([{ atH: 30, level: 3, durH: 5 }], 1)), 0, 0);
    for (const bad of [{ atH: 1, level: 7, durH: 1 }, { atH: 1, level: 1.5, durH: 1 }, { atH: -1, level: 1, durH: 1 }, { atH: 1, level: 1, durH: NaN }, { atH: 1, level: 1, durH: Infinity }]) {
      expect(() => airUnwarned(world(), stops([bad]), 'stratum')).toThrow(RangeError);
    }
  });
});
