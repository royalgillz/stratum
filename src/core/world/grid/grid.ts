// Grid model: capacity from scripted events, frequency from one aggregate swing equation with load damping.
// Pure functions, no randomness. Kundur 1994, chapters 3 and 11.
import type { Tier } from '../../contracts.ts';

export const F0 = 400; // Hz, nominal grid frequency
export const H = 4; // s, inertia constant
export const D = 2; // per unit load change per unit frequency change
export const CAP_MARGIN = 1.05; // nominal plant capacity, times full demand
const TAU = (2 * H) / D; // s
const RED_IN = -0.15, RED_OUT = -0.13, AMBER_IN = -0.05, AMBER_OUT = -0.03; // Hz from F0, the tracker's thresholds

type Field = 'from' | 'to' | 'rampH' | 'holdH' | 'recoverH' | 'loss' | 'durH';
/** A scenario event as the grid reads it: only `shortfall` and `trip` carry meaning here. Times in hours. */
export type GridEvent = { type: string; atH: number } & { [K in Field]?: number };

function finite(name: string, x: number, min = -Infinity): number {
  if (!Number.isFinite(x) || x < min) throw new RangeError(`grid: ${name} is ${x}`);
  return x;
}

function fraction(name: string, x: number | undefined): number {
  if (!(typeof x === 'number' && x >= 0 && x <= 1)) throw new RangeError(`grid: ${name} is ${x}`);
  return x;
}

/** Loss fraction of one event at world second t; 0 for event types the grid does not read. */
function lossAt(e: GridEvent, t: number): number {
  if (e.type !== 'shortfall' && e.type !== 'trip') return 0;
  const a = finite(`${e.type} atH`, e.atH) * 3600;
  const dur = (k: Field) => finite(`${e.type} ${k}`, e[k] as number, 0) * 3600;
  if (e.type === 'trip') {
    const loss = fraction('trip loss', e.loss), end = a + dur('durH');
    return t >= a && t < end ? loss : 0;
  }
  const from = fraction('shortfall from', e.from), to = fraction('shortfall to', e.to);
  const r = dur('rampH'), h = dur('holdH'), c = dur('recoverH');
  if (t < a) return 0;
  if (t < a + r) return from + ((to - from) * (t - a)) / r;
  if (t < a + r + h) return to;
  if (t < a + r + h + c) return to * (1 - (t - a - r - h) / c);
  return 0;
}

/** Plant capacity in MW at world second t. */
// @spec WORLD-GRID-001, WORLD-GRID-002, WORLD-GRID-003, WORLD-GRID-008
export function capacityAt(events: readonly GridEvent[], t: number, nominalMW: number): number {
  finite('t', t);
  finite('nominalMW', nominalMW, 0);
  const L = events.reduce((s, e) => s + lossAt(e, t), 0);
  return nominalMW * (1 - Math.min(1, Math.max(0, L)));
}

/** Frequency deviation in Hz where load damping balances the unserved load. */
// @spec WORLD-GRID-004, WORLD-GRID-008
export function steadyDeviation(capMW: number, loadMW: number): number {
  finite('capMW', capMW, 0);
  finite('loadMW', loadMW, 0);
  return loadMW <= capMW ? 0 : (-F0 * (loadMW - capMW)) / (D * loadMW); // also 0 at zero load, and never -0
}

/** Exact exponential step of the swing equation over dt seconds. */
// @spec WORLD-GRID-005, WORLD-GRID-006, WORLD-GRID-008
export function swing(f: number, capMW: number, loadMW: number, dt: number): { f: number; rocof: number } {
  finite('f', f);
  if (!(Number.isFinite(dt) && dt > 0)) throw new RangeError(`grid: dt is ${dt}`);
  const dss = steadyDeviation(capMW, loadMW);
  const next = F0 + dss + (f - F0 - dss) * Math.exp(-dt / TAU);
  return { f: next, rocof: (next - f) / dt };
}

/** Tier from frequency with the tracker's hysteresis. */
// @spec WORLD-GRID-007, WORLD-GRID-008
export function tierOf(f: number, previous: Tier): Tier {
  finite('f', f);
  // compared as f <= F0 + threshold, so F0 - 0.15 written by a caller lands on its own boundary
  if (f <= F0 + RED_IN || (previous === 'RED' && f <= F0 + RED_OUT)) return 'RED';
  if (f <= F0 + AMBER_IN || (previous !== 'GREEN' && f <= F0 + AMBER_OUT)) return 'AMBER';
  return 'GREEN';
}
