// Cross-adapter tests for the factory and the conventions every adapter follows (docs/intent/adapters/policy).
import { describe, expect, it, vi } from 'vitest';
import type { Adapter, Allocation, World } from '../contracts.ts';
import { createKernel } from '../kernel/kernel.ts';
import { rng } from '../rng.ts';
import { sevenDay } from '../scenario/seven-day.ts';
import type { Script } from '../scenario/types.ts';
import { createWorld } from '../scenario/world.ts';
import { coolingDemandMW, co2Step, CO2_REF } from '../world/airheat/airheat.ts';
import { PUMP_KW } from '../world/tunnels/tunnels.ts';
import { STOCK_DAYS } from '../world/lightfood/lightfood.ts';
import { createAdapters } from './index.ts';
import { FOOD_SUPPLY } from './p02.ts';
import { gridServed, served } from './p03.ts';
import { OFFICIAL } from './p13.ts';
import { NO_PROOF } from './p14.ts';
import { lifeFloor, powerDemand, sectorId, weight, type Policy } from './shared.ts';
import { stressWeek } from '../scenario/stress-week.ts';

// Pass-through spies: the stream names an adapter asks rng.ts for while `on`, and the claim ids of every rotation.
const spy = vi.hoisted(() => ({ on: false, streams: [] as string[], who: '', rotations: [] as { who: string; ids: string[] }[] }));
vi.mock('../rng.ts', async (real) => {
  const m = await real<typeof import('../rng.ts')>();
  return { ...m, rng: (seed: number, name: string) => (spy.on && spy.streams.push(name), m.rng(seed, name)) };
});
vi.mock('../fairshare/fairshare.ts', async (real) => {
  const m = await real<typeof import('../fairshare/fairshare.ts')>();
  return { ...m, rotate: (...a: Parameters<typeof m.rotate>) => (spy.rotations.push({ who: spy.who, ids: a[1].map((c) => c.id) }), m.rotate(...a)) };
});

const DAY = 86400;
const SEED = 3;
const IDS = Array.from({ length: 24 }, (_, s) => sectorId(s));
const ADAPTER_IDS = Array.from({ length: 15 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`);
const POLICIES: Policy[] = ['directorate', 'stratum'];
const sum = (a: Allocation) => Object.values(a).reduce((x, y) => x + y, 0);
const byId = (as: Adapter[], id: string) => as.find((a) => a.id === id)!;
/** The seven-day script cut to its first day: separation, outbreak seed, network down. */
const dayOne: Script = { ...sevenDay, days: 1, acts: sevenDay.acts.filter((a) => a.atH <= 24), events: sevenDay.events.filter((e) => e.atH <= 24) };

function runFor(policy: Policy, script: Script, seconds: number, wrap = (a: Adapter) => a, per?: Partial<Record<string, Policy>>) {
  const w = createWorld(SEED, script);
  spy.on = true; // an adapter that made its own stream at build time would show here
  const set = createAdapters(policy, script, per);
  spy.on = false;
  const k = createKernel(w, set.map(wrap), { dt: 60, check: true });
  k.run(seconds);
  return { w, m: k.metrics() };
}

// The rung 3 and rung 4 tables of adapters-design.md.
const TABLE: Record<string, [string[], string[]]> = {
  p01: [['grid', 'sectors', 'alloc'], ['grid']],
  p02: [['grid', 'sectors', 'alloc'], ['alloc']],
  p03: [['sectors', 'alloc'], ['sectors', 'alloc']],
  p04: [['sectors'], ['sectors', 'ledger']],
  p05: [['sectors', 'alloc', 'tunnels'], ['sectors', 'tunnels', 'alloc']],
  p07: [['mesh', 'tunnels', 'households'], ['mesh']],
  p08: [['mesh', 'households'], ['mesh']],
  p09: [['sectors', 'alloc'], ['sectors', 'alloc', 'ledger']],
  p06: [['sectors', 'households'], ['sectors', 'households']],
  p10: [['tunnels'], []],
  p11: [['sectors', 'alloc', 'households'], ['sectors', 'alloc']],
  p12: [['sectors', 'alloc'], ['sectors']],
  p13: [['surface'], ['surface', 'ledger']],
  p14: [['surface', 'households'], ['alloc']],
  p15: [['households', 'sectors'], ['alloc']],
};

// "Who writes what": the sub-fields each adapter owns, and the ledger kinds it may append.
const OWNS: Record<string, { grid?: true; alloc?: (keyof World['alloc'])[]; sector?: string[]; passable?: true; shift?: true; band?: true }> = {
  p01: { grid: true },
  p02: { alloc: ['power', 'water', 'food'] },
  p03: { alloc: ['cooling'], sector: ['temp', 'wetBulb', 'co2'] },
  p04: { sector: ['water'] },
  p05: { alloc: ['pumps'], sector: ['sumpLevel'], passable: true },
  p07: {},
  p08: {},
  p09: { alloc: ['medicine'], sector: ['stock'] },
  p06: { sector: ['sleepM2'], shift: true },
  p10: {},
  p11: { alloc: ['lampHours'], sector: ['lightDose'] },
  p12: { sector: ['foodKcal'] },
  p13: { band: true },
  p14: { alloc: ['trialSlots'] },
  p15: { alloc: ['returnSlots'] },
};
const KINDS: Record<string, RegExp> = { p04: /^water\./, p09: /^cases/, p13: /^surface\./ };

/** The fields some adapter owns, less those `id` owns. (A full structuredClone per adapter step is too slow for seven days.) */
const owned = (w: World, id: string) => {
  const o = OWNS[id]!;
  const omit = (x: object, ks: string[] = []) => Object.fromEntries(Object.entries(x).filter(([k]) => !ks.includes(k)));
  return JSON.stringify([
    o.grid ? 0 : w.grid, omit(w.alloc, o.alloc), w.sectors.map((x) => omit(x, o.sector)), w.tunnels.edges.map((e) => (o.passable ? 0 : e.passable)),
    o.shift ? 0 : w.households.map((h) => h.shift), o.band ? 0 : w.surface.band,
  ]);
};
/** The fields no adapter owns: checked once around each whole step. */
const unowned = (w: World) => JSON.stringify([Object.keys(w), Object.keys(w.surface), w.seed, w.clock, w.households.map(({ shift, ...rest }) => rest), w.tunnels.nodes, w.tunnels.edges.map((e) => [e.a, e.b])]);
const prefix = <T>(a: readonly T[], b: readonly T[]) => a.length <= b.length && a.every((x, i) => b[i] === x);
const subsequence = <T>(a: readonly T[], b: readonly T[]) => { let i = 0; for (const x of b) if (x === a[i]) i++; return i === a.length; };

/** Checks one adapter's step against the "Who writes what" table and the allocation conventions, on the raw world `w`. */
let still = '';
function audited(a: Adapter, w: World, policy: Policy, coolCap: number): Adapter {
  return {
    ...a,
    step(view, dt, r) {
      const before = owned(w, a.id);
      if (a.id === 'p01') still = unowned(w);
      const inbox = [...w.mesh.inbox], delivered = [...w.mesh.delivered];
      const measured = [...w.ledger.measured], official = [...w.ledger.official], readings = [...w.surface.readings];
      a.step(view, dt, r);
      const after = owned(w, a.id);
      if (a.id === 'p15' && unowned(w) !== still) expect.fail(`a field no adapter owns changed at ${w.t}`);
      if (!prefix(readings, w.surface.readings) || (a.id !== 'p13' && w.surface.readings.length !== readings.length)) expect.fail(`${a.id} changed surface.readings outside its rows at ${w.t}`);
      if (after !== before) expect(JSON.parse(after), `${a.id} at ${w.t}`).toEqual(JSON.parse(before));
      // shortcut: messages and ledger entries are compared by reference, so an edit inside one goes unseen; verifyChain catches ledger edits
      const okInbox = a.id === 'p07' ? subsequence(w.mesh.inbox, inbox) : a.id === 'p08' ? prefix(inbox, w.mesh.inbox) : prefix(inbox, w.mesh.inbox) && w.mesh.inbox.length === inbox.length;
      const okDelivered = prefix(delivered, w.mesh.delivered) && (a.id === 'p07' || w.mesh.delivered.length === delivered.length);
      if (!okInbox || !okDelivered) expect.fail(`${a.id} changed the mesh outside its rows at ${w.t}`);
      for (const [old, now] of [[measured, w.ledger.measured], [official, w.ledger.official]] as const) {
        if (!prefix(old, now)) expect.fail(`${a.id} replaced a ledger entry at ${w.t}`);
        for (const e of now.slice(old.length)) if (!KINDS[a.id]?.test(e.kind)) expect.fail(`${a.id} wrote ledger kind ${e.kind} at ${w.t}`);
      }
      for (const good of OWNS[a.id]!.alloc ?? []) if (Object.keys(w.alloc[good]).join() !== IDS.join()) expect.fail(`${a.id} wrote alloc.${good} with keys ${Object.keys(w.alloc[good])}`);
      if (a.id === 'p03' || a.id === 'p05') {
        const demand = (s: number) => (a.id === 'p03' ? coolingDemandMW(w.sectors[s]!.level, w.sectors[s]!.people) : PUMP_KW / 1000);
        const pool = (a.id === 'p03' ? coolCap : 24 * (PUMP_KW / 1000)) * gridServed(w);
        const powered = IDS.reduce((x, id, s) => x + (w.alloc.power[id]! > 0 ? demand(s) : 0), 0);
        const want = policy === 'stratum' ? pool : Math.min(pool, powered);
        const got = sum(a.id === 'p03' ? w.alloc.cooling : w.alloc.pumps);
        if (Math.abs(got - want) > 1e-9) expect.fail(`${a.id} pool ${got} is not ${want} at ${w.t}`);
      }
    },
  };
}

describe('createAdapters', () => {
  // @spec ADAPT-POLICY-001
  it('returns fresh p01 to p15 for either policy and rejects any other policy', () => {
    for (const p of POLICIES) {
      const a = createAdapters(p, sevenDay), b = createAdapters(p, sevenDay);
      expect(a.map((x) => x.id)).toEqual(ADAPTER_IDS);
      a.forEach((x, i) => expect(x).not.toBe(b[i]));
    }
    for (const bad of ['', 'Directorate', 'fair', undefined]) expect(() => createAdapters(bad as Policy, sevenDay)).toThrow(RangeError);
  });

  // @spec ADAPT-POLICY-010
  it('builds each adapter named in a per-adapter map with its policy and the rest with the given one', () => {
    const all = (p: Policy) => Object.fromEntries(ADAPTER_IDS.map((id) => [id, p]));
    for (const p of POLICIES) {
      const other: Policy = p === 'stratum' ? 'directorate' : 'stratum';
      const plain = runFor(p, dayOne, DAY / 2);
      // A map naming every adapter is that policy alone; an empty map is no map.
      const swapped = runFor(other, dayOne, DAY / 2, undefined, all(p));
      expect(swapped.w).toEqual(plain.w);
      expect(swapped.m).toEqual(plain.m);
      const empty = runFor(p, dayOne, DAY / 2, undefined, {});
      expect(empty.w).toEqual(plain.w);
    }
    // One adapter switched: p13 alone under the Directorate posts the official band on its first step; its STRATUM twin does not.
    const mixed = createAdapters('stratum', dayOne, { p13: 'directorate' });
    const w = createWorld(SEED, dayOne);
    createKernel(w, [byId(mixed, 'p13'), byId(mixed, 'p15')]).step();
    expect(w.surface.band).toBe(OFFICIAL);
    const z = createWorld(SEED, dayOne);
    createKernel(z, [byId(createAdapters('stratum', dayOne), 'p13')]).step();
    expect(z.surface.band).toBe('unknown');
    // p15 kept STRATUM's rule: the same plan as an all-STRATUM p15.
    const y = createWorld(SEED, dayOne);
    createKernel(y, [byId(createAdapters('stratum', dayOne), 'p15')]).step();
    expect(w.alloc.returnSlots).toEqual(y.alloc.returnSlots);
    for (const bad of [{ p16: 'stratum' }, { p00: 'directorate' }, { p13: 'fair' }, { p13: undefined }, { toString: 'stratum' }]) {
      expect(() => createAdapters('stratum', dayOne, bad as never), JSON.stringify(bad)).toThrow(RangeError);
    }
  }, 60_000);

  // @spec ADAPT-POLICY-002
  it('declares the reads and writes of the rung 3 and rung 4 tables', () => {
    for (const p of POLICIES) {
      for (const a of createAdapters(p, sevenDay)) {
        expect([[...a.reads].sort(), [...a.writes].sort()], a.id).toEqual(TABLE[a.id]!.map((x) => [...x].sort()));
      }
    }
  });

  // @spec ADAPT-POLICY-001, ADAPT-POLICY-003
  it('gives identical worlds and metrics from two sets, with another run between them, and draws only from the stream passed in', () => {
    for (const p of POLICIES) {
      const a = runFor(p, dayOne, DAY);
      runFor(p === 'stratum' ? 'directorate' : 'stratum', dayOne, DAY);
      const b = runFor(p, dayOne, DAY);
      expect(b.w).toEqual(a.w);
      expect(b.m).toEqual(a.m);
      // Same world seed, other streams: the run changes, so the draws come from the stream, not from world.seed.
      spy.streams = [];
      const other = runFor(p, dayOne, DAY, (x) => {
        const r = rng(SEED + 1, x.id);
        return { ...x, step: (v, dt) => { spy.on = true; try { x.step(v, dt, r); } finally { spy.on = false; } } };
      });
      expect(other.w.mesh).not.toEqual(a.w.mesh);
      // No adapter makes a stream of its own, at build time or in a step: every draw comes from the one passed in.
      expect(spy.streams).toEqual([]);
    }
  }, 60_000);

  // @spec ADAPT-POLICY-004
  it('returns finite SIMULATED metrics that leave the world unchanged, 0 before any denominator exists', () => {
    // Not shares: p06 is m2 per sleeper over people who exist from t 0; p14 is NO_PROOF until a verdict (ADAPT-SURFACE-007).
    const before: Record<string, number> = { p06: 2.0, p14: NO_PROOF };
    for (const p of POLICIES) {
      const w = createWorld(SEED, dayOne);
      const fresh = createAdapters(p, dayOne);
      const copy = structuredClone(w);
      for (const a of fresh) expect(a.metric(w), a.id).toMatchObject({ value: before[a.id] ?? 0, label: 'SIMULATED' });
      expect(w).toEqual(copy);
      const k = createKernel(w, fresh);
      k.run(DAY / 2);
      const mid = structuredClone(w);
      for (const a of fresh) {
        const m = a.metric(w);
        expect(Number.isFinite(m.value) && m.label === 'SIMULATED', a.id).toBe(true);
      }
      expect(w).toEqual(mid);
    }
  }, 30_000);

  // @spec ADAPT-POLICY-006
  it('clamps every served fraction to [0, 1], 1 with no demand, and ventilates from power over the life floor', () => {
    expect([served(0.5, 1), served(2, 1), served(-1, 1), served(0, 0), served(1, 0)]).toEqual([0.5, 1, 0, 1, 1]);
    const w = createWorld(SEED, dayOne);
    const floor = lifeFloor(w.sectors[0]!.people);
    const power = [0.5 * floor, 0, 2 * powerDemand(w.sectors[2]!.people), floor];
    power.forEach((x, s) => (w.alloc.power[sectorId(s)] = x));
    createKernel(w, [byId(createAdapters('directorate', dayOne), 'p03')]).step();
    [0.5, 0, 1, 1].forEach((v, s) => expect(w.sectors[s]!.co2).toBeCloseTo(co2Step(CO2_REF, v, 60).co2, 9));
  });

  // @spec ADAPT-POLICY-008
  it('builds world-dependent state on the first step: p01 from the initial alloc.power, tiers before 0 GREEN, p05 dry flags', () => {
    // p01: a sector trimmed in the initial allocation is no cut; a trim at t = 120 has only 2 min of AMBER behind it, one at 900 has 15.
    const script: Script = { ...dayOne, events: [{ type: 'shortfall', atH: 0, from: 0.049, to: 0.049, rampH: 0, holdH: 2, recoverH: 0 }] };
    const trim: Adapter = {
      id: 'p02', reads: [], writes: ['alloc'], metric: () => ({ name: 'stub', value: 0, unit: '', label: 'SIMULATED' }),
      step: (v) => { if (v.t === 120 || v.t === 900) v.alloc.power[v.t === 120 ? 's00' : 's01'] = 0.99 * powerDemand(500); },
    };
    const w = createWorld(SEED, script);
    w.alloc.power.s05 = 0.99 * powerDemand(500);
    w.grid.tier = 'AMBER';
    const k = createKernel(w, [byId(createAdapters('stratum', script), 'p01'), trim]);
    k.step();
    expect(w.grid.tier).not.toBe('GREEN');
    k.run(1800);
    expect(w.grid.tier).not.toBe('GREEN');
    expect(k.metrics().p01!.value).toBe(0.5);

    // p05: flags start as isFlooded(sumpLevel, false); a sump between RECOVER and full starts dry.
    const v = createWorld(SEED, dayOne);
    v.sectors[5]!.sumpLevel = 0.95;
    v.sectors[23]!.sumpLevel = 1;
    createKernel(v, [byId(createAdapters('directorate', dayOne), 'p05')]).step();
    const open = (s: number) => v.tunnels.edges.filter((e) => e.a === s || e.b === s).map((e) => e.passable);
    expect(open(5).every(Boolean)).toBe(true);
    expect(open(23).some(Boolean)).toBe(false);

    // p03: the cooling capacity comes from the first world it steps, not from a default.
    const u = createWorld(SEED, dayOne);
    u.sectors[0]!.people = 1000;
    u.alloc.power.s00 = powerDemand(1000);
    createKernel(u, [byId(createAdapters('stratum', dayOne), 'p03')]).step();
    expect(sum(u.alloc.cooling)).toBeCloseTo(u.sectors.reduce((a, x) => a + coolingDemandMW(x.level, x.people), 0), 9);

    // Rung 4: p11's zero lamp-hours, p12's stores, p13's Witness (and the official verdict), p15's plan, on the first step.
    for (const p of POLICIES) {
      const x = createWorld(SEED, dayOne);
      x.sectors[3]!.people = 800;
      x.t = 60; // off the daily decision, so p12's store is what it built
      const set = createAdapters(p, dayOne).filter((a) => ['p11', 'p12', 'p13', 'p15'].includes(a.id));
      createKernel(x, set).step();
      expect(x.alloc.lampHours).toEqual(Object.fromEntries(IDS.map((id) => [id, 0])));
      x.sectors.forEach((s) => expect(s.foodKcal).toBe(STOCK_DAYS * FOOD_SUPPLY * s.people));
      expect(x.surface.band).toBe(p === 'directorate' ? OFFICIAL : 'unknown');
      expect(Object.keys(x.alloc.returnSlots)).toEqual(IDS);
      expect(sum(x.alloc.returnSlots)).toBeGreaterThan(0);
      expect(byId(set, 'p15').metric(x).value).toBeGreaterThan(0);
    }
    // p13 binds its Witness on the first step to the world passed in: the round's entries land in that world's ledger, at its t.
    const lit: Script = { ...dayOne, events: [{ type: 'surface', atH: 0, co: 20, o3: 0.4, so2: 1, crews: 5, falsified: 1, bias: 0.02 }] };
    for (const p of POLICIES) {
      const z = createWorld(SEED, lit), other = createWorld(SEED, lit);
      z.t = other.t = 60;
      const p13 = byId(createAdapters(p, lit), 'p13');
      createKernel(z, [p13]).step();
      createKernel(other, [p13]).step();
      const entries = (x: World) => [...x.ledger.measured, ...x.ledger.official].filter((e) => e.kind.startsWith('surface.'));
      expect(entries(z).map((e) => e.t), p).toEqual(entries(z).map(() => 60));
      expect(entries(z).length).toBeGreaterThan(p === 'stratum' ? 1 : 0); // the official band, and under STRATUM the crews' readings
      expect(entries(other), p).toEqual([]);
    }
    // p10 draws its requests on its first step, from the stream it is given, and none on a later step with no request due.
    const care: Script = { ...dayOne, events: [{ type: 'care', atH: 1, durH: 2, red: 24, amber: 24 }] };
    const draws: number[] = [];
    const p10 = byId(createAdapters('directorate', care), 'p10'); // no pop-up placement at t 0
    const y = createWorld(SEED, care);
    for (let i = 0; i < 2; i++) {
      let n = 0;
      const r = rng(SEED, 'count');
      p10.step(y, 60, () => (n++, r()));
      draws.push(n);
      y.t += 60;
    }
    expect(draws).toEqual([8, 0]); // 2 RED and 2 AMBER, a time and a sector each
  });

  // @spec ADAPT-POLICY-002, ADAPT-POLICY-005, ADAPT-POLICY-007
  it('writes only its own sub-fields, keyed s00 to s23, with pools at capacity times grid served, through checked seven-day and stress-week runs', () => {
    // The stress week reaches paths the seven-day run does not: four farm cut-offs, supply below every life floor, a sealed-band plan.
    for (const script of [sevenDay, stressWeek]) {
      for (const p of POLICIES) {
        const w = createWorld(SEED, script);
        const coolCap = w.sectors.reduce((a, x) => a + coolingDemandMW(x.level, x.people), 0);
        const k = createKernel(w, createAdapters(p, script).map((a) => audited(a, w, p, coolCap)), { dt: 60, check: true });
        k.run(script.days * DAY);
        expect(w.t).toBe(script.days * DAY);
        expect(w.ledger.measured.length + w.ledger.official.length).toBeGreaterThan(0);
        if (script === sevenDay) expect(w.mesh.delivered.length).toBeGreaterThan(0); // the stress week has no separation, so no family messages
      }
    }
  }, 600_000);

  // @spec ADAPT-POLICY-009
  it('weights a sector by people over tracked members, 0 with none, and rotates households by household id only', () => {
    const lit: Script = { ...dayOne, days: 2, events: [...dayOne.events, { type: 'surface', atH: 0, co: 20, o3: 0.4, so2: 1, crews: 5, falsified: 1, bias: 0.02 }] };
    const w = createWorld(SEED, lit);
    w.households = w.households.filter((h) => h.sector !== 7); // sector 7 has no tracked household
    const members = (s: number) => w.households.filter((h) => h.sector === s).reduce((a, h) => a + h.members, 0);
    w.sectors.forEach((x, s) => expect(weight(w, s), `s${s}`).toBe(s === 7 ? 0 : x.people / members(s)));
    spy.rotations = [];
    const rotating = ['p06', 'p11', 'p14', 'p15']; // p13 makes the readings p14 plans from; p10 rotates levels, not households
    const set = createAdapters('stratum', lit).filter((a) => [...rotating, 'p13'].includes(a.id));
    createKernel(w, set.map((a) => ({ ...a, step: (v, dt, r) => ((spy.who = a.id), a.step(v, dt, r)) })), { dt: 60, check: true }).run(lit.days * DAY);
    expect([...new Set(spy.rotations.map((x) => x.who))].sort()).toEqual(rotating);
    const ids = new Set(w.households.map((h) => h.id));
    for (const { who, ids: claims } of spy.rotations) {
      expect(claims.length, `${who} rotated an empty sector`).toBeGreaterThan(0); // sector 7, weight 0, takes part in none
      for (const id of claims) expect(ids.has(id), `${who} claims ${id}`).toBe(true);
    }
  }, 60_000);
});
