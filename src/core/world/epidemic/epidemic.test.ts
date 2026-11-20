import { describe, expect, it } from 'vitest';
import { rng } from '../../rng.ts';
import type { Rng } from '../../rng.ts';
import { binomial } from './binomial.ts';
import {
  BETA_CAP, C_EXHALED, C_OUT, CLIN_STEP, CLIN_TOP, CO2_REF, createEpidemic, EPI_DT, epiStep, GAMMA, GAMMA_T, MIX,
  P_REPORT, R0, rebreathed, seed, SIGMA,
} from './epidemic.ts';

const people = () => Array(24).fill(500);
const fill = (x: number) => Array(24).fill(x);
const pr = (rate: number, dt: number) => 1 - Math.exp((-rate * dt) / 86400);
/** Returns the given values in order, then 0.5 forever, and counts calls. */
const script = (us: number[] = []) => {
  const r = Object.assign(() => (r.calls < us.length ? us[r.calls++] : (r.calls++, 0.5)), { calls: 0 });
  return r;
};
const at = (u: number): Rng => () => u;

describe('epidemic', () => {
  // @spec WORLD-EPI-001
  it('WORLD-EPI-001 starts every sector susceptible and seeds index cases off the lists', () => {
    const p = people();
    p[3] = 7;
    const s = createEpidemic(p);
    expect(s.S).toEqual(p);
    for (const k of ['E', 'I', 'R'] as const) expect(s[k]).toEqual(fill(0));
    for (const k of ['clinic', 'residents', 'both'] as const) expect(s[k].flat()).toEqual([]);
    seed(s, 20, 10);
    seed(s, 3, 50);
    expect([s.S[20], s.I[20], s.S[3], s.I[3]]).toEqual([490, 10, 0, 7]);
    expect(s.clinic.flat().concat(s.residents.flat(), s.both.flat())).toEqual([]);
  });

  // @spec WORLD-EPI-002
  it('WORLD-EPI-002 uses within-level mixing and the ventilation factor, with no term between levels', () => {
    const dt = 86400; // a long step makes the draws sensitive to lambda
    const r0 = rebreathed(CO2_REF);
    expect(rebreathed(1180)).toBeCloseTo((1180 - C_OUT) / C_EXHALED, 15);
    expect(CO2_REF).toBe(940); // C_OUT + 1e6 x G / Q from the air model
    const co2 = fill(CO2_REF);
    co2[1] = 1200; // between ref and cap
    co2[2] = 20000; // past the cap
    for (const u of [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]) {
      const s = createEpidemic(people());
      seed(s, 0, 40);
      seed(s, 1, 5);
      seed(s, 2, 5);
      epiStep(s, 0, co2, fill(0), dt, at(u));
      const lvl = 50 / 2000;
      for (const [sec, own] of [[0, 40], [1, 5], [2, 5], [3, 0]]) {
        const beta = R0 * GAMMA * Math.min(BETA_CAP, rebreathed(co2[sec]) / r0);
        const lambda = beta * ((1 - MIX) * (own / 500) + MIX * lvl);
        expect(500 - own - s.S[sec]).toBe(binomial(500 - own, pr(lambda, dt), at(u)));
      }
      for (let sec = 4; sec < 24; sec++) expect(s.S[sec]).toBe(500);
    }
  });

  // @spec WORLD-EPI-003
  it('WORLD-EPI-003 draws exposed, infectious, treated and untreated recoveries in order and reports them', () => {
    const dt = 6 * 3600;
    const s = createEpidemic(people());
    Object.assign(s, { S: fill(400), E: fill(60), I: fill(30), R: fill(10) });
    const stock = fill(0);
    stock[0] = 12.7; // 12 whole courses
    stock[1] = 99; // more than I
    const us = [0.6, 0.4, 0.7, 0.2, 0.5, 0.5, 0.5, 0.3, 0.8, 0.1, 0.9];
    const r = script(us);
    const out = epiStep(s, 0, fill(CO2_REF), stock, dt, r);
    const lambda = R0 * GAMMA * (30 / 500);
    const draws = (u: number[], T: number) => [
      binomial(400, pr(lambda, dt), at(u[0])),
      binomial(60, pr(SIGMA, dt), at(u[1])),
      binomial(T, pr(GAMMA_T, dt), at(u[2])),
      binomial(30 - T, pr(GAMMA, dt), at(u[3])),
    ];
    const check = (sec: number, d: number[]) => {
      expect([s.S[sec], s.E[sec], s.I[sec], s.R[sec]]).toEqual([400 - d[0], 60 + d[0] - d[1], 30 + d[1] - d[2] - d[3], 10 + d[2] + d[3]]);
      expect(out.newCases[sec]).toBe(d[1]);
      expect(out.coursesUsed[sec]).toBe(d[2]);
    };
    check(0, draws(us.slice(0, 4), 12));
    check(1, draws(us.slice(7, 11), 30));
    check(2, draws([0.5, 0.5, 0.5, 0.5], 0));
    expect(out.coursesUsed[0]).toBeGreaterThan(0);
    expect(out.coursesUsed[2]).toBe(0);
    // T is floor(stock): a 30-day step recovers every treated case, so 12.7 courses treat exactly 12
    // and ni is drawn from E at the start of the step, so E = 0 gives no new cases however many are exposed
    const s2 = createEpidemic(people());
    Object.assign(s2, { S: fill(400), E: fill(0), I: fill(30), R: fill(70) });
    const out2 = epiStep(s2, 0, fill(CO2_REF), stock, 30 * 86400, script([0.99]));
    expect(400 - s2.S[0]).toBe(binomial(400, pr(lambda, 30 * 86400), at(0.99)));
    expect(400 - s2.S[0]).toBeGreaterThan(100);
    expect(out2.newCases[0]).toBe(0);
    expect(out2.coursesUsed[0]).toBe(12);
  });

  // @spec WORLD-EPI-004
  it('WORLD-EPI-004 keeps compartments non-negative integers that sum to the people', () => {
    const p = people();
    p[5] = 0;
    p[9] = 3;
    const s = createEpidemic(p);
    for (const sec of [0, 9, 13, 22]) seed(s, sec, 10);
    const r = rng(7, 'epi');
    const env = rng(7, 'env');
    for (let h = 0; h < 30 * 24; h++) {
      const co2 = Array.from({ length: 24 }, () => C_OUT + env() * 15000);
      const stock = Array.from({ length: 24 }, () => env() * 20);
      epiStep(s, h * EPI_DT, co2, stock, EPI_DT, r);
      for (let sec = 0; sec < 24; sec++) {
        const c = [s.S[sec], s.E[sec], s.I[sec], s.R[sec]];
        for (const x of c) expect(Number.isInteger(x) && x >= 0).toBe(true);
        expect(c[0] + c[1] + c[2] + c[3]).toBe(p[sec]);
      }
    }
    expect(s.R.reduce((a, b) => a + b, 0)).toBeGreaterThan(40); // the outbreak ran
  });

  // @spec WORLD-EPI-005
  it('WORLD-EPI-005 draws the two lists from new cases and makes seven draws per sector', () => {
    const dt = 12 * 3600;
    const s = createEpidemic(people());
    Object.assign(s, { E: fill(100), S: fill(400) });
    const us = [0.5, 0.5, 0.5, 0.5, 0.3, 0.6, 0.2];
    const t = 3 * 86400 + 80000; // late on day 3: the step ends on day 4, and round(t / 86400) is 4
    const half = (n: number) => Array(n * 7).fill(0.5);
    const r = script([...us, ...half(19), ...us, ...half(2), ...us]); // sectors 0 (level 1), 20 and 23 (level 6)
    const out = epiStep(s, t, fill(CO2_REF), fill(0), dt, r);
    expect(r.calls).toBe(7 * 24);
    for (const [sec, level] of [[0, 1], [20, 6], [23, 6]]) {
      const k = out.newCases[sec];
      expect(k).toBeGreaterThan(0);
      const n1 = binomial(k, CLIN_TOP - CLIN_STEP * (level - 1), at(0.3));
      const m = binomial(n1, P_REPORT, at(0.6));
      const n2 = m + binomial(k - n1, P_REPORT, at(0.2));
      expect(s.clinic[sec]).toEqual([0, 0, 0, n1]);
      expect(s.both[sec]).toEqual([0, 0, 0, m]);
      expect(s.residents[sec]).toEqual([0, 0, 0, n2]);
    }
    // a second step on the same day adds; an empty sector still draws seven times
    const before = s.clinic[0][3];
    const r2 = script([0.5, 0.5, 0.5, 0.5, 0.99]);
    const out2 = epiStep(s, t + 1000, fill(CO2_REF), fill(0), dt / 4, r2);
    expect(s.clinic[0][3]).toBe(before + binomial(out2.newCases[0], CLIN_TOP, at(0.99)));
    expect(r2.calls).toBe(7 * 24);
    const empty = createEpidemic(fill(0));
    const r3 = script();
    epiStep(empty, 0, fill(CO2_REF), fill(0), EPI_DT, r3);
    expect(r3.calls).toBe(7 * 24);
  });

  // @spec WORLD-EPI-007
  it('WORLD-EPI-007 gives identical states for identical inputs and draws', () => {
    const run = () => {
      const s = createEpidemic(people());
      seed(s, 20, 10);
      seed(s, 22, 10);
      const r = rng(42, 'epidemic');
      const outs = [];
      for (let h = 0; h < 10 * 24; h++) outs.push(epiStep(s, h * EPI_DT, fill(1500), fill(3.5), EPI_DT, r));
      return { s, outs };
    };
    expect(run()).toEqual(run());
  });

  // @spec WORLD-EPI-009
  it('WORLD-EPI-009 scales every capture probability by an optional capture factor, 1 by default', () => {
    const step = (capture?: number) => {
      const s = createEpidemic(people());
      for (let k = 0; k < 24; k++) s.E[k] = 100; // so new infectious cases reach the lists on every level
      const r = rng(5, 'epidemic');
      const out = epiStep(s, 0, fill(CO2_REF), fill(0), EPI_DT, r, capture);
      return { s, out };
    };
    expect(step()).toEqual(step(1));
    const a = step(0.5), b = step(1);
    expect(a.out).toEqual(b.out); // the epidemic itself is untouched
    const tot = (x: ReturnType<typeof step>, k: 'clinic' | 'residents') => x.s[k].flat().reduce((p, q) => p + q, 0);
    expect(tot(a, 'clinic')).toBeLessThan(tot(b, 'clinic'));
    expect(tot(a, 'residents')).toBeLessThan(tot(b, 'residents'));
    for (const c of [0, -1, NaN, Infinity, 1 / CLIN_TOP + 0.01]) expect(() => step(c)).toThrow(RangeError);
    expect(() => step(1.5)).not.toThrow();
  });

  // @spec WORLD-EPI-008
  it('WORLD-EPI-008 rejects invalid input with a RangeError', () => {
    const s = createEpidemic(people());
    seed(s, 0, 1); // lambda > 0 on level 1, so an unchecked infinite dt would change sectors 0 to 3 before a NaN probability throws
    const ok = (over: Partial<{ t: number; co2: number[]; stock: number[]; dt: number }>) => {
      const a = { t: 0, co2: fill(CO2_REF), stock: fill(1), dt: EPI_DT, ...over };
      return () => epiStep(s, a.t, a.co2, a.stock, a.dt, rng(1, 'x'));
    };
    for (const sec of [-1, 24, 1.5]) expect(() => seed(s, sec, 1)).toThrow(RangeError);
    for (const cases of [-1, 2.5, NaN]) expect(() => seed(s, 0, cases)).toThrow(RangeError);
    const withAt = (arr: number[], i: number, x: number) => arr.map((y, j) => (j === i ? x : y));
    for (const x of [-1, NaN, Infinity]) expect(ok({ stock: withAt(fill(1), 7, x) })).toThrow(RangeError);
    for (const x of [C_OUT - 1, NaN, Infinity]) expect(ok({ co2: withAt(fill(CO2_REF), 7, x) })).toThrow(RangeError);
    for (const t of [-1, NaN, Infinity]) expect(ok({ t })).toThrow(RangeError);
    for (const dt of [0, -60, NaN, Infinity]) expect(ok({ dt })).toThrow(RangeError);
    expect(() => rebreathed(C_OUT - 0.1)).toThrow(RangeError);
    expect(rebreathed(C_OUT)).toBe(0);
    expect(ok({ co2: fill(C_OUT) })).not.toThrow();
    expect(() => createEpidemic(fill(500).slice(1))).toThrow(RangeError);
    expect(() => createEpidemic(fill(-1))).toThrow(RangeError);
    // a rejected step leaves the state untouched
    const copy = structuredClone(s);
    expect(ok({ co2: withAt(fill(CO2_REF), 23, NaN) })).toThrow(RangeError);
    expect(ok({ dt: Infinity })).toThrow(RangeError);
    expect(s).toEqual(copy);
  });
});
