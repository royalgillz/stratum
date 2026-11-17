// Tests for p11 (light) and p12 (food), run through the kernel in checked mode.
import { describe, expect, it } from 'vitest';
import type { Adapter, Claim, Household, World } from '../contracts.ts';
import { nextDebt, rotate } from '../fairshare/fairshare.ts';
import { createKernel } from '../kernel/kernel.ts';
import { rng, type Rng } from '../rng.ts';
import type { ScenarioEvent } from '../scenario/types.ts';
import { BRIGHT_H, GROW_KW, GROW_LAMP_H, LAMP_H, WAKE_H, dose, grown, growSessions, lampKWh, sessions } from '../world/lightfood/lightfood.ts';
import { livableWorld, PEOPLE, quietScript, setPower } from './livable.fixture.ts';
import { FOOD_FLOOR, FOOD_SUPPLY, createP02 } from './p02.ts';
import { createP11 } from './p11.ts';
import { createP12 } from './p12.ts';
import { bySector, powerDemand, sectorId, weight, type Policy } from './shared.ts';
import { ownOnly } from './testkit.ts';

const DAY = 86400;
const IDS = Array.from({ length: 24 }, (_, s) => sectorId(s));
const metric = () => ({ name: 'stub', value: 0, unit: '', label: 'SIMULATED' as const });
const cut = (atH: number, level: number, durH: number): ScenarioEvent => ({ type: 'farm-cut', atH, level, durH });

/** Ten tracked households per sector, 2 to 6 members, none in the sectors listed in `skip`. */
function world(skip: number[] = []): World {
  const w = livableWorld();
  w.households = IDS.flatMap((_, s): Household[] => (skip.includes(s) ? [] : Array.from({ length: 10 }, (_, n) => ({
    id: `h${s}-${n}`, members: 2 + ((s + n) % 5), level: Math.floor(s / 4) + 1, sector: s, shift: n % 3,
  }))));
  return w;
}

/** Stands in for p02: sets each sector's power to `frac(s, t)` of its demand and its food delivery to `food(s, t)` kcal/day. */
function supplyStub(frac: (s: number, t: number) => number, food: (s: number, t: number) => number = () => FOOD_SUPPLY * PEOPLE): Adapter {
  return {
    id: 'p02', reads: [], writes: ['alloc'], metric,
    step(w) {
      const t = w.t;
      w.alloc.power = bySector(IDS.map((_, s) => frac(s, t) * powerDemand(PEOPLE)));
      w.alloc.food = bySector(IDS.map((_, s) => food(s, t)));
    },
  };
}

/** `a` stepped with a stream that throws, so any draw fails the run. */
const noDraws = (a: Adapter): Adapter => ({ ...a, step: (w, dt) => a.step(w, dt, () => { throw new Error(`${a.id} drew`); }) });

describe('p11 light', () => {
  // @spec ADAPT-LIGHTFOOD-008
  it('declares its reads and writes, zeroes lampHours on the first step and changes only lightDose and lampHours', () => {
    const a = createP11('stratum', quietScript());
    expect([a.id, [...a.reads], [...a.writes]]).toEqual(['p11', ['sectors', 'alloc', 'households'], ['sectors', 'alloc']]);
    for (const policy of ['directorate', 'stratum'] as const) {
      const w = world();
      setPower(w, 0.8);
      const own = ownOnly(createP11(policy, quietScript()), w, (c) => {
        c.alloc.lampHours = {};
        for (const x of c.sectors) x.lightDose = 0;
      }, /^$/);
      const k = createKernel(w, [own], { check: true, dt: 3600 }); // hourly steps: the snapshots are slow, and p11 acts only hourly
      k.step();
      expect(w.alloc.lampHours).toEqual(bySector(Array<number>(24).fill(0)));
      k.run(2 * DAY);
      expect(Object.keys(w.alloc.lampHours)).toEqual(IDS);
    }
  });

  // @spec ADAPT-LIGHTFOOD-001, ADAPT-LIGHTFOOD-009
  it('Directorate: spreads LAMP_H x f hours each, farm workers meet the threshold, on the mean of the day\'s hourly samples', () => {
    const w = world();
    // s01 at half power; s02 cut at 12:30 (hourly samples 0 to 12 h at 1, 13 to 23 h at 0: f = 13/24); from day 2 every sector at full power
    const frac = (s: number, t: number) => (t >= DAY ? 1 : s === 1 ? 0.5 : s === 2 && t >= DAY / 2 + 1800 ? 0 : 1);
    const k = createKernel(w, [supplyStub(frac), noDraws(createP11('directorate', quietScript()))], { check: true });
    k.run(DAY);
    expect(w.sectors[0].lightDose).toBe(0); // no decision before the first day ends
    k.step(); // t = 86400: decides day 1; this step's sample (full power everywhere) belongs to day 2
    const want = (f: number) => {
      const h = LAMP_H * f, g = Math.min(PEOPLE, growSessions(f));
      return { hours: h * PEOPLE, dose: (g * dose(Math.min(WAKE_H, h + BRIGHT_H)) + (PEOPLE - g) * dose(h)) / PEOPLE, met: g };
    };
    for (const [s, f] of [[0, 1], [1, 0.5], [2, 13 / 24]]) {
      expect(w.alloc.lampHours[sectorId(s)]).toBeCloseTo(want(f).hours, 9);
      expect(w.sectors[s].lightDose).toBeCloseTo(want(f).dose, 9);
    }
    const met1 = 22 * want(1).met + want(0.5).met + want(13 / 24).met;
    expect(k.metrics().p11!.value).toBeCloseTo(met1 / (24 * PEOPLE), 12);
    k.run(DAY);
    expect(w.alloc.lampHours.s02).toBeCloseTo(want(1).hours, 9); // day 2 at full power
    expect(k.metrics().p11!.value).toBeCloseTo((met1 + 24 * 100) / (48 * PEOPLE), 12);
  });

  // @spec ADAPT-LIGHTFOOD-002
  it('STRATUM: rotates whole sessions plus grow seats by household debt, scaled by the sector weight', () => {
    const w = world([23]); // sector 23 tracks no household: weight 0, no rotation
    const frac = (s: number) => (s === 5 ? 0.5 : 1);
    const k = createKernel(w, [supplyStub(frac), createP11('stratum', quietScript())], { check: true });
    // the expected run: the kernel's p11 stream, sectors in order, debts carried day to day
    const r: Rng = rng(w.seed, 'p11');
    const debt: Record<string, number> = {};
    const expected = () => IDS.map((_, s) => {
      const f = frac(s), ws = weight(w, s);
      const n = sessions(lampKWh(PEOPLE) * f) + growSessions(f);
      if (ws === 0) return { n, met: 0 };
      const claims: Claim[] = w.households.filter((h) => h.sector === s).map((h) => ({ id: h.id, floor: 0, demand: h.members, debt: debt[h.id] ?? 0 }));
      const rot = rotate(Math.floor(n / ws + 1e-9), claims, r);
      Object.assign(debt, nextDebt(claims, rot.shares));
      const members = rot.winners.reduce((a, id) => a + claims.find((c) => c.id === id)!.demand, 0);
      return { n, met: Math.min(PEOPLE, ws * members) };
    });
    let met = 0;
    for (let day = 1; day <= 3; day++) {
      k.run(DAY); // to the day's end: from day 2 on, the run's last step is the 00:00 decision
      if (day === 1) k.step();
      const want = expected();
      want.forEach(({ n, met: m }, s) => {
        const share = m / PEOPLE;
        expect(w.alloc.lampHours[sectorId(s)]).toBeCloseTo(n * BRIGHT_H, 9);
        expect(w.sectors[s].lightDose).toBeCloseTo(share * dose(BRIGHT_H) + (1 - share) * dose(0), 9);
      });
      met += want.reduce((a, x) => a + x.met, 0);
      expect(k.metrics().p11!.value).toBeCloseTo(met / (day * 24 * PEOPLE), 12);
    }
    expect(w.sectors[23].lightDose).toBe(dose(0));
    const v = k.metrics().p11!.value;
    expect(v).toBeGreaterThan(0.6); // the design's "about 0.7, less in dark sectors"
    expect(v).toBeLessThan(0.75);
    expect(Object.values(debt).some((d) => d > 0)).toBe(true); // someone was passed over and carries debt
  });

  // @spec ADAPT-LIGHTFOOD-003
  it('names its metric, 0 before the first day ends, about 0.2 under the Directorate over a week', () => {
    const w = world();
    const k = createKernel(w, [supplyStub(() => 1), createP11('directorate', quietScript())], { check: true });
    k.run(DAY);
    expect(k.metrics().p11).toEqual({ name: 'share of person-days with 4 h of daytime light', value: 0, unit: 'share', label: 'SIMULATED' });
    k.run(6 * DAY);
    expect(k.metrics().p11!.value).toBeCloseTo(0.2, 12);
  });
});

describe('p12 food', () => {
  const store = 3 * FOOD_SUPPLY * PEOPLE;
  const daily = (f: number, crop: 'grain' | 'lettuce') => 24 * grown(GROW_KW * GROW_LAMP_H / 24 * f, crop);

  // @spec ADAPT-LIGHTFOOD-008
  it('declares its reads and writes and changes only foodKcal', () => {
    const a = createP12('stratum', quietScript());
    expect([a.id, [...a.reads], [...a.writes]]).toEqual(['p12', ['sectors', 'alloc'], ['sectors']]);
    for (const policy of ['directorate', 'stratum'] as const) {
      const w = world();
      const own = ownOnly(createP12(policy, quietScript()), w, (c) => {
        for (const x of c.sectors) x.foodKcal = 0;
      }, /^$/);
      createKernel(w, [supplyStub(() => 1, () => 0), own], { check: true, dt: 3600 }).run(2 * DAY); // hourly steps: the snapshots are slow
    }
  });

  // @spec ADAPT-LIGHTFOOD-004, ADAPT-LIGHTFOOD-005, ADAPT-LIGHTFOOD-009
  it('starts with STOCK_DAYS of rations, grows the staple or the best crop hourly, and eats the day\'s arrivals at 00:00', () => {
    for (const [policy, crop] of [['directorate', 'grain'], ['stratum', 'lettuce']] as const) {
      const w = world();
      const frac = (s: number) => (s === 1 ? 0.5 : 1);
      const k = createKernel(w, [supplyStub(frac), noDraws(createP12(policy, quietScript()))], { check: true });
      k.step(); // t = 0: stores set, the day's delivery eaten whole, nothing grown yet
      expect(w.sectors.map((x) => x.foodKcal)).toEqual(Array<number>(24).fill(store));
      k.run(DAY); // to t = 86400 + 60: grown food of day 1 kept, the 00:00 sample of day 2 not yet eaten
      expect(w.sectors[0].foodKcal).toBeCloseTo(store + daily(1, crop), 6);
      expect(w.sectors[1].foodKcal).toBeCloseTo(store + daily(0.5, crop), 6);
      k.run(DAY); // the 00:00 decision of day 2 eats only day 2's growth: the counter was reset
      expect(w.sectors[0].foodKcal).toBeCloseTo(store + 2 * daily(1, crop), 6);
      expect(w.sectors[1].foodKcal).toBeCloseTo(store + 2 * daily(0.5, crop), 6);
    }
  });

  // @spec ADAPT-LIGHTFOOD-005, ADAPT-LIGHTFOOD-009
  it('Directorate: a sector without deliveries eats the standard ration from its store until it runs out', () => {
    const w = world();
    const k = createKernel(w, [supplyStub(() => 0, (s) => (s === 0 ? 0 : FOOD_SUPPLY * PEOPLE)), noDraws(createP12('directorate', quietScript()))], { check: true });
    k.step();
    expect(w.sectors[0].foodKcal).toBe(store - FOOD_SUPPLY * PEOPLE); // dark sector: nothing grown
    expect(w.sectors[1].foodKcal).toBe(store);
    k.run(2 * DAY);
    expect(w.sectors[0].foodKcal).toBe(0);
    k.run(DAY);
    expect(w.sectors[0].foodKcal).toBe(0);
    expect(w.sectors.every((x) => x.foodKcal >= 0)).toBe(true);
  });

  // @spec ADAPT-LIGHTFOOD-006, ADAPT-LIGHTFOOD-009
  it('STRATUM: eats arrivals up to the standard ration, stores the rest, and tops up from the store to the floor only', () => {
    const w = world();
    const food = (s: number) => (s === 0 ? 2000 : s === 1 ? 2400 : 0) * PEOPLE;
    const k = createKernel(w, [supplyStub(() => 0, food), noDraws(createP12('stratum', quietScript()))], { check: true });
    k.step();
    expect(w.sectors[0].foodKcal).toBeCloseTo(store - (FOOD_FLOOR - 2000) * PEOPLE, 6);
    expect(w.sectors[1].foodKcal).toBeCloseTo(store + (2400 - FOOD_SUPPLY) * PEOPLE, 6);
    expect(w.sectors[2].foodKcal).toBeCloseTo(store - FOOD_FLOOR * PEOPLE, 6);
    k.run(4 * DAY); // sector 2's store (3 x 2300) covers three floors (3 x 2100) and then runs dry
    expect(w.sectors[2].foodKcal).toBe(0);
    expect(w.sectors.every((x) => x.foodKcal >= 0)).toBe(true);
  });

  // @spec ADAPT-LIGHTFOOD-007, ADAPT-POWER-009
  it('counts days from the first missed delivery to the first breach: about 3 under the Directorate, censored under STRATUM', () => {
    const events = [cut(30, 4, 144), cut(50, 2, 10)]; // c is day 2 at 00:00, the first decision after hour 30; the later level 2 cut misses no delivery
    const run = (policy: Policy, events: ScenarioEvent[]) => {
      const s = { ...quietScript(events), days: 7 };
      const w = world();
      const k = createKernel(w, [createP02(policy, s), createP12(policy, s)], { check: true });
      return { w, k, at: (t: number) => (k.run(t - w.t), k.metrics().p12!) };
    };
    const d = run('directorate', events);
    expect(d.at(2 * DAY)).toEqual({ name: 'days the food floor held after a farm cut-off', value: 0, unit: 'days', label: 'SIMULATED' });
    expect(d.at(3 * DAY + 3600).value).toBeCloseTo(1 + 1 / 24, 12);
    expect(d.at(6 * DAY).value).toBe(3); // level 4 eats its last full ration on day 4, breaches at day 5 00:00
    expect(d.w.sectors.every((x) => x.foodKcal >= 0)).toBe(true);
    const s = run('stratum', events);
    expect(s.at(7 * DAY).value).toBeCloseTo(5, 12); // no breach: world.t - c
    expect(run('stratum', []).at(3 * DAY).value).toBe(0);
    expect(run('directorate', [{ type: 'trip', atH: 1, loss: 0.01, durH: 1 }]).at(3 * DAY).value).toBe(0);
    // the earliest cut listed second and starting exactly at 00:00 of day 2: that delivery is missed, so c = 2 x DAY
    const e = run('directorate', [cut(60, 2, 10), cut(48, 4, 144)]);
    expect(e.at(2 * DAY - 60).value).toBe(0);
    expect(e.at(3 * DAY).value).toBeCloseTo(1, 12);
    expect(e.at(6 * DAY).value).toBe(3); // breach at day 5 00:00
    // cuts that stop no delivery (within one day, or zero length) set no c
    expect(run('directorate', [cut(50, 2, 10), cut(48, 3, 0)]).at(7 * DAY).value).toBe(0);
  }, 30_000); // two full weeks; times out at 5 s when the machine is busy

  // @spec ADAPT-LIGHTFOOD-007
  it('does not count a breach for eating the floor less a rounding unit', () => {
    const w = world();
    const food = (s: number, t: number) => (s > 0 ? FOOD_SUPPLY * PEOPLE : t >= 3 * DAY ? FOOD_FLOOR * PEOPLE * (1 - 1e-10) : 0);
    const k = createKernel(w, [supplyStub(() => 0, food), createP12('directorate', quietScript([cut(0, 1, 1)]))], { check: true });
    k.run(3 * DAY); // three rations from the store: empty at day 3
    expect(w.sectors[0].foodKcal).toBe(0);
    k.run(2 * DAY); // from day 3 sector 0 eats only its delivery, 1e-10 short of the floor
    expect(k.metrics().p12!.value).toBeCloseTo(5, 12);
  });
});
