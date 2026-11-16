// Stochastic SEIR per sector with ventilation-driven transmission and two capture lists.
// Rates are per day; t and dt are in world seconds. Constants: docs/params.md.
import type { Rng } from '../../rng.ts';
import { binomial } from './binomial.ts';

export const C_OUT = 420; // ppm, intake CO2
export const C_EXHALED = 38000; // ppm, exhaled-breath CO2 (Rudnick and Milton 2003)
// shortcut: copies the air model's CO2_REF (C_OUT + 1e6 x G / Q, G 0.0052 L/s, Q 10 L/s) because world/airheat is not on main yet; import it from there once it lands.
export const CO2_REF = C_OUT + (1e6 * 0.0052) / 10;
export const BETA_CAP = 5; // x beta at CO2_REF
export const R0 = 2.5;
export const SIGMA = 1 / 3; // per day, 1 / latent period
export const GAMMA = 1 / 5; // per day, untreated recovery
export const GAMMA_T = 1 / 2; // per day, treated recovery
export const MIX = 0.1; // share of contacts with the rest of the level
export const EPI_DT = 3600; // s, one epidemic step
export const CLIN_TOP = 0.6; // clinic capture at level 1
export const CLIN_STEP = 0.08; // less per level deeper
export const P_REPORT = 0.5; // residents' report capture

const SECTORS = 24;
const DAY = 86400;

export interface EpiState {
  N: number[]; // people per sector
  S: number[];
  E: number[];
  I: number[];
  R: number[];
  // Per-day lists grow as steps reach each day; read a day no step has reached as 0: list[d] ?? 0.
  clinic: number[][]; // [sector][day] new cases on the clinic list
  residents: number[][]; // [sector][day] new cases on the residents' list
  both: number[][]; // [sector][day] new cases on both lists
}

export interface EpiStepResult {
  newCases: number[]; // new infectious cases per sector
  coursesUsed: number[]; // treated recoveries per sector
}

const count = (x: number) => Number.isInteger(x) && x >= 0;
const days = () => Array.from({ length: SECTORS }, () => [] as number[]);

// @spec WORLD-EPI-001
export function createEpidemic(people: number[]): EpiState {
  if (people.length !== SECTORS || !people.every(count)) throw new RangeError('people must be 24 non-negative integers');
  return { N: [...people], S: [...people], E: Array(SECTORS).fill(0), I: Array(SECTORS).fill(0), R: Array(SECTORS).fill(0), clinic: days(), residents: days(), both: days() };
}

// @spec WORLD-EPI-001, WORLD-EPI-008
export function seed(state: EpiState, sector: number, cases: number): void {
  if (!(Number.isInteger(sector) && sector >= 0 && sector < SECTORS)) throw new RangeError(`invalid sector ${sector}`);
  if (!count(cases)) throw new RangeError(`invalid cases ${cases}`);
  const n = Math.min(cases, state.S[sector]);
  state.S[sector] -= n;
  state.I[sector] += n;
}

/** Rebreathed fraction of Rudnick and Milton. */
// @spec WORLD-EPI-002, WORLD-EPI-008
export function rebreathed(co2: number): number {
  if (!Number.isFinite(co2) || co2 < C_OUT) throw new RangeError(`invalid co2 ${co2}`);
  return (co2 - C_OUT) / C_EXHALED;
}

const share = (i: number, n: number) => (n > 0 ? i / n : 0); // an empty sector or level spreads nothing

function add(list: number[], day: number, x: number): void {
  while (list.length <= day) list.push(0);
  list[day] += x;
}

// @spec WORLD-EPI-002, WORLD-EPI-003, WORLD-EPI-004, WORLD-EPI-005, WORLD-EPI-007, WORLD-EPI-008
export function epiStep(state: EpiState, t: number, co2: number[], stock: number[], dt: number, rng: Rng): EpiStepResult {
  if (!Number.isFinite(t) || t < 0) throw new RangeError(`invalid t ${t}`);
  if (!Number.isFinite(dt) || dt <= 0) throw new RangeError(`invalid dt ${dt}`);
  const beta = co2.slice(0, SECTORS).map((c) => R0 * GAMMA * Math.min(BETA_CAP, rebreathed(c) / rebreathed(CO2_REF)));
  if (beta.length < SECTORS) throw new RangeError('co2 must have 24 sectors');
  for (let s = 0; s < SECTORS; s++) if (!Number.isFinite(stock[s]) || stock[s] < 0) throw new RangeError(`invalid stock ${stock[s]}`);

  const { S, E, I, R, N } = state;
  const I0 = [...I]; // every draw uses the compartments at the start of the step
  const sum = (xs: number[], l: number) => xs[l] + xs[l + 1] + xs[l + 2] + xs[l + 3];
  const pr = (rate: number) => 1 - Math.exp((-rate * dt) / DAY);
  const day = Math.floor(t / DAY);
  const newCases: number[] = [];
  const coursesUsed: number[] = [];
  for (let s = 0; s < SECTORS; s++) {
    const l = s - (s % 4);
    const lambda = beta[s] * ((1 - MIX) * share(I0[s], N[s]) + MIX * share(sum(I0, l), sum(N, l)));
    const T = Math.min(I[s], Math.floor(stock[s]));
    const ne = binomial(S[s], pr(lambda), rng);
    const ni = binomial(E[s], pr(SIGMA), rng);
    const rt = binomial(T, pr(GAMMA_T), rng);
    const ru = binomial(I[s] - T, pr(GAMMA), rng);
    S[s] -= ne;
    E[s] += ne - ni;
    I[s] += ni - rt - ru;
    R[s] += rt + ru;
    const n1 = binomial(ni, CLIN_TOP - CLIN_STEP * (l / 4), rng);
    const m = binomial(n1, P_REPORT, rng);
    const n2 = m + binomial(ni - n1, P_REPORT, rng);
    add(state.clinic[s], day, n1);
    add(state.both[s], day, m);
    add(state.residents[s], day, n2);
    newCases.push(ni);
    coursesUsed.push(rt);
  }
  return { newCases, coursesUsed };
}
