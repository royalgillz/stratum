import { describe, expect, it } from 'vitest';
import type { Adapter, Claim, Household, World } from '../contracts.ts';
import { nextDebt, rotate } from '../fairshare/fairshare.ts';
import { createKernel } from '../kernel/kernel.ts';
import { rng } from '../rng.ts';
import type { ScenarioEvent } from '../scenario/types.ts';
import { verifyChain } from '../witness/ledger.ts';
import { APF_SEALED, crewRead, required, trialPlan, type Campaign } from '../world/surface/surface.ts';
import { livableWorld, quietScript } from './livable.fixture.ts';
import { BANDS, createP13, rounds } from './p13.ts';
import { createP14, NO_PROOF } from './p14.ts';
import { createP15 } from './p15.ts';
import { sectorId, type Policy } from './shared.ts';
import { ownOnly } from './testkit.ts';

// Local fixture: 500 people per sector, three tracked households of 2, 3 and 4 members each (weight 500 / 9).
const H = 3600;
const SEED = 3;
const MEMBERS = [2, 3, 4];
const homes = (): Household[] =>
  Array.from({ length: 24 }, (_, s) => MEMBERS.map((members, n) => ({ id: `h${s}-${n}`, members, level: Math.floor(s / 4) + 1, sector: s, shift: 0 }))).flat();
function world(households = homes()): World {
  const w = livableWorld(SEED);
  w.households = households;
  return w;
}
const camp = (atH: number, o: Partial<Campaign> = {}): Campaign => ({ type: 'surface', atH, co: 20, o3: 0.4, so2: 1, crews: 5, falsified: 1, bias: 0.02, ...o });
const MASK = camp(0); // the seven-day campaign's truth, band mask
const LIARS = camp(0, { co: 1500, o3: 2, so2: 20, falsified: 3, bias: 0.01 }); // the stress week's campaign: true sealed, measured open
const script = (events: ScenarioEvent[], days = 1) => ({ ...quietScript(events), days });
const zeros = () => Object.fromEntries(Array.from({ length: 24 }, (_, s) => [sectorId(s), 0]));

function run(adapters: Adapter[], w: World, seconds: number, dt = 60) {
  const k = createKernel(w, adapters, { dt, check: true });
  k.run(seconds);
  k.step(); // the step at t = seconds
  return k;
}

describe('p13 surface truth', () => {
  // @spec ADAPT-SURFACE-011
  it('declares its reads and writes', () => {
    const a = createP13('stratum', quietScript());
    expect([a.id, [...a.reads], [...a.writes]]).toEqual(['p13', ['surface'], ['surface', 'ledger']]);
  });

  it('rounds: every READ_EVERY hours from a campaign until the next one or the end of the run, the later on a tie', () => {
    const r = rounds(script([camp(7), { type: 'trip', atH: 0, loss: 0.1, durH: 1 }, camp(0.5, { co: 1 }), camp(0.5, { co: 2 })]));
    expect(r.map((x) => [x.c, x.e.co, x.r / H])).toEqual([[1, 2, 0.5], [1, 2, 6.5], [2, 20, 7], [2, 20, 13], [2, 20, 19]]);
  });

  // @spec ADAPT-SURFACE-001, ADAPT-SURFACE-004
  it('Directorate: band sealed from the first step, one official observation per round, no readings', () => {
    const w = world();
    const k = createKernel(w, [createP13('directorate', script([camp(1)]))], { check: true });
    expect(k.metrics().p13).toEqual({ name: 'wrong-band rate', value: 0, unit: 'share', label: 'SIMULATED' });
    k.step();
    expect(w.surface.band).toBe('sealed');
    expect(w.ledger.official).toHaveLength(0);
    k.run(24 * H);
    expect(w.ledger.official.map((e) => [e.t / H, e.kind, e.where, e.value, e.source])).toEqual(
      [1, 7, 13, 19].map((h) => [h, 'surface.band', 'surface', 3, 'official']),
    );
    expect(w.ledger.measured).toHaveLength(0);
    expect(w.surface.readings).toHaveLength(0);
    expect(k.metrics().p13!.value).toBe(1); // sealed against a true mask
  });

  // @spec ADAPT-SURFACE-001, ADAPT-SURFACE-002, ADAPT-SURFACE-003, ADAPT-SURFACE-004
  it('STRATUM: appends and observes each crew reading, then the quorum band beside the official one', () => {
    const w = world();
    const k = createKernel(w, [createP13('stratum', script([MASK]))], { check: true });
    k.step();
    const expected = crewRead(MASK, 0, rng(SEED, 'p13'));
    expect(w.surface.readings).toEqual(expected);
    expect(w.surface.band).toBe('mask');
    expect(w.ledger.measured.map((e) => [e.kind, e.where, e.value, e.source])).toEqual([
      ...expected.map((x) => [`surface.${x.gas}`, 'surface', x.ppm, `crew:${x.crew}`]),
      ['surface.band', 'surface', 1, 'estimate:quorum'],
    ]);
    expect(w.ledger.official.map((e) => [e.kind, e.value, e.source])).toEqual([['surface.band', 3, 'official']]);
    k.run(24 * H - 60);
    expect(w.surface.readings).toHaveLength(4 * 15);
    expect(verifyChain(w.ledger.measured, 'measured').ok && verifyChain(w.ledger.official, 'official').ok).toBe(true);
    expect(w.surface.band).toBe('mask');
    expect(k.metrics().p13!.value).toBe(0);
  });

  // @spec ADAPT-SURFACE-002
  it('processes every round due in a step, in order, each at its own reading time', () => {
    const w = world();
    const k = run([createP13('stratum', script([camp(0.5), camp(7, { co: 1 })]))], w, 12 * H, 12 * H);
    const r = rng(SEED, 'p13');
    expect(w.surface.readings).toEqual([...crewRead(camp(0.5), 0.5 * H, r), ...crewRead(camp(0.5), 6.5 * H, r), ...crewRead(camp(7, { co: 1 }), 7 * H, r)]);
    expect(w.ledger.official.map((e) => e.t)).toEqual([12 * H, 12 * H, 12 * H]);
    expect(k.metrics().p13!.value).toBe(0);
  });

  // @spec ADAPT-SURFACE-003, ADAPT-SURFACE-004
  it('STRATUM: unknown without a quorum, counted wrong; a lying majority makes the verdict confidently wrong', () => {
    const few = world();
    const k = run([createP13('stratum', script([camp(0, { crews: 2, falsified: 0 })]))], few, 0);
    expect(few.surface.band).toBe('unknown');
    expect(few.ledger.measured.filter((e) => e.kind === 'surface.band')).toHaveLength(0);
    expect(k.metrics().p13!.value).toBe(1);

    const rate = (policy: Policy) => {
      const w = world();
      const m = run([createP13(policy, script([LIARS]))], w, 24 * H).metrics().p13!.value;
      return { m, verdicts: [...new Set(w.ledger.measured.filter((e) => e.kind === 'surface.band').map((e) => BANDS[e.value]))] };
    };
    expect(rate('stratum')).toEqual({ m: 1, verdicts: ['open'] }); // open or, when the liars disagree, unknown: never the true sealed
    expect(rate('directorate')).toEqual({ m: 0, verdicts: [] });
  });

  // @spec ADAPT-SURFACE-001, ADAPT-SURFACE-003
  it('STRATUM: leaves surface.band unknown until its first round', () => {
    const w = world();
    const k = createKernel(w, [createP13('stratum', script([camp(2)]))], { dt: H, check: true });
    k.step();
    expect(w.surface.band).toBe('unknown');
    k.step();
    expect(w.surface.band).toBe('unknown');
    k.step(); // t = 2 h
    expect(w.surface.band).toBe('mask');
  });

  // @spec ADAPT-SURFACE-011
  it('changes only surface and appends only surface.* ledger entries', () => {
    for (const policy of ['directorate', 'stratum'] as const) {
      const w = world();
      let old: unknown[] | null = null; // ownOnly blanks the copy from before the step, then the one from after
      const blank = (c: { surface: World['surface'] }) => {
        if (old) expect(c.surface.readings.slice(0, old.length)).toEqual(old); // old readings stay, in place: only appends
        old = old ? null : c.surface.readings;
        c.surface.readings = [];
        c.surface.band = '';
      };
      const a = ownOnly(createP13(policy, script([MASK])), w, blank, /^surface\./);
      const k = run([a], w, 12 * H, 6 * H);
      expect(k.metrics().p13!.label).toBe('SIMULATED');
    }
  });
});

describe('p14 pioneers', () => {
  // @spec ADAPT-SURFACE-011
  it('declares its reads and writes', () => {
    const a = createP14('stratum', quietScript());
    expect([a.id, [...a.reads], [...a.writes]]).toEqual(['p14', ['surface', 'households'], ['alloc']]);
  });

  // @spec ADAPT-SURFACE-006, ADAPT-SURFACE-007
  it('NO_PROOF and zero trial slots before any campaign', () => {
    for (const policy of ['directorate', 'stratum'] as const) {
      const w = world();
      const k = run([createP13(policy, script([camp(2)])), createP14(policy, script([camp(2)]))], w, H);
      expect(w.alloc.trialSlots).toEqual(zeros());
      expect(k.metrics().p14).toEqual({ name: 'protection factor proven over 30 days', value: NO_PROOF, unit: 'APF', label: 'SIMULATED' });
    }
    expect(NO_PROOF).toBe(100000);
  });

  // @spec ADAPT-SURFACE-005, ADAPT-SURFACE-006, ADAPT-SURFACE-007
  it('Directorate: its staff go straight to 30 days in supplied air', () => {
    for (const truth of [MASK, LIARS]) {
      const w = world();
      const p14 = createP14('directorate', script([truth]));
      expect(p14.plan()).toBeNull();
      const k = run([p14], w, 24 * H);
      expect(trialPlan(APF_SEALED, required(truth), false).verified).toBe(10000);
      expect(k.metrics().p14!.value).toBe(10000);
      expect(p14.plan()).toEqual({ verified: 10000, exposureH: 5760, breaches: 0, stages: [{ factor: 10000, hours: 720, breached: false }] }); // unstaged
      expect(w.alloc.trialSlots).toEqual({ ...zeros(), s00: 3, s01: 3, s02: 2 }); // the first 8 of level 1 in list order
    }
  });

  /** p14's STRATUM draws replayed by hand for one plan with `stages` stages. */
  const mirror = (stages: number, r = rng(SEED, 'p14')) => {
    const drawn = new Set<string>();
    for (let k = 0; k < stages; k++) {
      const claims: Claim[] = homes().filter((h) => !drawn.has(h.id)).map((h) => ({ id: h.id, floor: 0, demand: 1, debt: 0 }));
      rotate(8, claims, r).winners.forEach((id) => drawn.add(id));
    }
    const slots = zeros();
    for (const h of homes()) if (drawn.has(h.id)) slots[sectorId(h.sector)]!++;
    return slots;
  };
  const sum = (a: Record<string, number>) => Object.values(a).reduce((x, y) => x + y, 0);

  // @spec ADAPT-SURFACE-005, ADAPT-SURFACE-006, ADAPT-SURFACE-007
  it('STRATUM: staged trials from the quorum band, a lottery of 8 new volunteers per stage', () => {
    const w = world();
    const p14 = createP14('stratum', script([MASK]));
    const k = run([createP13('stratum', script([MASK])), p14], w, 24 * H);
    expect(k.metrics().p14!.value).toBe(10); // a half mask proven
    expect(p14.plan()).toMatchObject({ verified: 10, exposureH: 8 * (1 + 24 + 168 + 720), breaches: 0 }); // 7,304
    expect(w.alloc.trialSlots).toEqual(mirror(4));
    expect(sum(w.alloc.trialSlots)).toBe(32);

    // The stress week's campaign: measured open, four breaches before supplied air holds.
    const s = world();
    const p14s = createP14('stratum', script([LIARS]));
    const ks = run([createP13('stratum', script([LIARS])), p14s], s, 24 * H);
    expect(ks.metrics().p14!.value).toBe(10000);
    expect(p14s.plan()).toMatchObject({ verified: 10000, exposureH: 4 * 8 + 7304, breaches: 4 });
    expect(s.alloc.trialSlots).toEqual(mirror(8));
    expect(sum(s.alloc.trialSlots)).toBe(64);
  });

  // @spec ADAPT-SURFACE-005
  it('STRATUM: keeps its plan while the band is unknown, replans when the known band changes', () => {
    const w = world();
    const k = createKernel(w, [createP14('stratum', script([MASK]))], { dt: 6 * H, check: true });
    const read = (t: number, o3s: number[]) =>
      o3s.forEach((o3, c) => w.surface.readings.push(...(['co', 'o3', 'so2'] as const).map((gas) => ({ crew: `c${c + 1}`, gas, ppm: { co: 20, o3, so2: 1 }[gas], t }))));
    read(0, [0.4, 0.4, 0.4]); // mask, required 4: a half mask
    k.step();
    const first = { ...w.alloc.trialSlots };
    expect(k.metrics().p14!.value).toBe(10);
    read(6 * H, [0.01, 0.4, 2]); // no quorum on o3
    k.step();
    expect(k.metrics().p14!.value).toBe(10);
    expect(w.alloc.trialSlots).toEqual(first);
    read(12 * H, [3, 3, 3]); // mask again, required 30: the same band, the same plan
    k.step();
    expect(k.metrics().p14!.value).toBe(10);
    expect(w.alloc.trialSlots).toEqual(first);
    read(18 * H, [0.05, 0.05, 0.05]); // open: plan again from no protection, which breaches before the half mask holds
    k.step();
    expect(k.metrics().p14!.value).toBe(10);
    expect(sum(w.alloc.trialSlots)).toBe(40); // five stages now
  });

  // @spec ADAPT-SURFACE-005, ADAPT-SURFACE-006
  it('STRATUM: a new campaign drops the old plan, and stays without one while its band is unknown', () => {
    const events = [MASK, camp(6, { crews: 2, falsified: 0 })];
    const w = world();
    const k = run([createP13('stratum', script(events)), createP14('stratum', script(events))], w, 6 * H);
    expect(k.metrics().p14!.value).toBe(NO_PROOF);
    expect(w.alloc.trialSlots).toEqual(zeros());
  });

  // @spec ADAPT-SURFACE-011
  it('changes only alloc.trialSlots', () => {
    const w = world();
    const p14 = ownOnly(createP14('stratum', script([MASK])), w, (c) => (c.alloc.trialSlots = {}), /^$/);
    run([createP13('stratum', script([MASK])), p14], w, 12 * H, 6 * H);
  });
});

describe('p15 return', () => {
  // @spec ADAPT-SURFACE-011
  it('declares its reads and writes', () => {
    const a = createP15('stratum', quietScript());
    expect([a.id, [...a.reads], [...a.writes]]).toEqual(['p15', ['households', 'sectors'], ['alloc']]);
  });

  // @spec ADAPT-SURFACE-008, ADAPT-SURFACE-010
  it('Directorate: upper levels first, 500 people a day, level 6 waits for the rest', () => {
    const w = world();
    const k = createKernel(w, [createP15('directorate', script([]))], { check: true });
    expect(k.metrics().p15).toEqual({ name: "worst level's mean wait", value: 0, unit: 'days', label: 'SIMULATED' });
    k.step();
    expect(w.alloc.returnSlots).toEqual({ ...zeros(), s00: 111 + 167 + 222 }); // round(500 / 9 x members)
    expect(k.metrics().p15!.value).toBeCloseTo(21.5, 12); // level 6 on days 20 to 23
  });

  // @spec ADAPT-SURFACE-008, ADAPT-SURFACE-010
  it('Directorate: a day takes households in order while the next fits, and a household larger than reception fits a day alone', () => {
    const hh = (id: string, members: number, sector: number): Household => ({ id, members, level: Math.floor(sector / 4) + 1, sector, shift: 0 });
    const plan = (hs: Household[]) => {
      const w = world(hs);
      w.sectors[0]!.people = 600; // a and b stand for 300 each
      w.sectors[4]!.people = 100; // c for 100
      w.sectors[8]!.people = 800; // d for 800, above reception
      const k = run([createP15('directorate', script([]))], w, 0);
      return { slots: w.alloc.returnSlots, worst: k.metrics().p15!.value };
    };
    const abc = [hh('a', 3, 0), hh('b', 3, 0), hh('c', 1, 4)];
    expect(plan(abc)).toEqual({ slots: { ...zeros(), s00: 300 }, worst: 1 }); // c would fit beside a, but b is next: a day 0, b and c day 1
    expect(plan([...abc, hh('d', 1, 8)])).toEqual({ slots: { ...zeros(), s00: 600, s04: 100 }, worst: 1 }); // 800 a day: d alone on day 1
  });

  /** p15's STRATUM plan replayed by hand: each household's day. */
  const mirror = (hs: Household[], d: (h: Household) => number) => {
    const r = rng(SEED, 'p15');
    let left = hs.map((h) => ({ h, d: d(h), debt: d(h) * (h.level - 1), day: 0 }));
    const all = [...left];
    for (let day = 0; left.length; day++) {
      const claims: Claim[] = left.map((x) => ({ id: x.h.id, floor: 0, demand: x.d, debt: x.debt }));
      const res = rotate(500, claims, r);
      const debt = nextDebt(claims, res.shares);
      for (const x of left) {
        x.debt = debt[x.h.id]!;
        if (res.winners.includes(x.h.id)) x.day = day;
      }
      left = left.filter((x) => !res.winners.includes(x.h.id));
    }
    return all;
  };

  // @spec ADAPT-SURFACE-009, ADAPT-SURFACE-010
  it('STRATUM: a lottery each day with debt from depth, so levels mix and the worst mean wait falls', () => {
    const w = world();
    const k = run([createP15('stratum', script([]))], w, 0);
    const plan = mirror(homes(), (h) => Math.round((500 / 9) * h.members));
    const slots = zeros();
    for (const x of plan) if (x.day === 0) slots[sectorId(x.h.sector)]! += x.d;
    expect(w.alloc.returnSlots).toEqual(slots);
    const means = [1, 2, 3, 4, 5, 6].map((l) => {
      const xs = plan.filter((x) => x.h.level === l);
      return xs.reduce((a, x) => a + x.d * x.day, 0) / xs.reduce((a, x) => a + x.d, 0);
    });
    expect(k.metrics().p15!.value).toBeCloseTo(Math.max(...means), 12);
    expect(k.metrics().p15!.value).toBeLessThan(21.5);
    expect(means[5]).toBeLessThan(means[0]!); // the deep levels are likelier to go first
  });

  // @spec ADAPT-SURFACE-008, ADAPT-SURFACE-009
  it('leaves out households that stand for nobody: a sector with 0 people', () => {
    for (const policy of ['directorate', 'stratum'] as const) {
      const plan = (hs: Household[]) => {
        const w = world(hs);
        w.sectors[5]!.people = 0;
        const k = run([createP15(policy, script([]))], w, 0); // hangs if a household with d_h 0 stays in the STRATUM lottery
        return { slots: w.alloc.returnSlots, worst: k.metrics().p15!.value };
      };
      const got = plan(homes());
      expect(got.slots.s05).toBe(0);
      expect(got).toEqual(plan(homes().filter((h) => h.sector !== 5)));
    }
  });

  // @spec ADAPT-SURFACE-010, ADAPT-SURFACE-011
  it('plans once and changes only alloc.returnSlots', () => {
    const w = world();
    const p15 = ownOnly(createP15('stratum', script([])), w, (c) => (c.alloc.returnSlots = {}), /^$/);
    const k = run([p15], w, 2 * H);
    const v = k.metrics().p15!.value;
    w.sectors[0]!.people = 5000;
    k.step();
    expect(k.metrics().p15!.value).toBe(v);
  });
});
