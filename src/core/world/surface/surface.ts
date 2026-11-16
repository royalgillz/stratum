// Surface and return model (design: docs/intent/world/surface/surface-design.md). Constants: docs/params.md.
import type { SurfaceReading } from '../../contracts.ts';
import type { Rng } from '../../rng.ts';
import type { ScenarioEvent } from '../../scenario/types.ts';

export type Campaign = Extract<ScenarioEvent, { type: 'surface' }>;
export type Gas = 'co' | 'o3' | 'so2';
export type Conc = Record<Gas, number>; // ppm

export const GASES: readonly Gas[] = ['co', 'o3', 'so2'];
export const REL: Readonly<Conc> = { co: 35, o3: 0.1, so2: 2 }; // ppm, NIOSH
export const IDLH: Readonly<Conc> = { co: 1200, o3: 5, so2: 100 }; // ppm, NIOSH
export const OPTIONS: readonly number[] = [1, 10, 50, 1000, 10000]; // OSHA assigned protection factors, rising
export const APF_SEALED = 10000;
export const CREW_NOISE = 0.1; // fraction of truth, uniform
export const READ_EVERY = 6; // h
export const STAGES: readonly number[] = [1, 24, 168, 720]; // h
export const TRIAL_N = 8; // people per stage
export const SHAFT_PPH = 1070; // people/hour
export const SHAFT_H = 20; // h/day
export const RECEPTION_PD = 500; // people/day

const check = (name: string, v: number, ok = v >= 0) => {
  if (!Number.isFinite(v) || !ok) throw new RangeError(`invalid ${name} ${v}`);
};
const conc = (c: Conc) => GASES.forEach((g) => check(g, c[g]));
const campaign = (e: Campaign) => {
  check('atH', e.atH, true);
  conc(e);
  check('bias', e.bias);
  check('crews', e.crews, Number.isInteger(e.crews) && e.crews >= 1);
  check('falsified', e.falsified, Number.isInteger(e.falsified) && e.falsified >= 0 && e.falsified <= e.crews);
};

// @spec WORLD-SURFACE-001, WORLD-SURFACE-008
export function surfaceAt(events: readonly ScenarioEvent[], t: number): Campaign | null {
  check('t', t, true);
  let best: Campaign | null = null;
  for (const e of events) {
    if (e.type !== 'surface') continue;
    campaign(e);
    if (e.atH * 3600 <= t && (!best || e.atH >= best.atH)) best = e;
  }
  return best;
}

// @spec WORLD-SURFACE-002, WORLD-SURFACE-008
export function crewRead(e: Campaign, t: number, rng: Rng): SurfaceReading[] {
  campaign(e);
  check('t', t, true);
  const out: SurfaceReading[] = [];
  for (let c = 1; c <= e.crews; c++) {
    const k = c <= e.falsified ? e.bias : 1;
    for (const gas of GASES) out.push({ crew: `c${c}`, gas, ppm: e[gas] * k * (1 + CREW_NOISE * (2 * rng() - 1)), t });
  }
  return out;
}

// @spec WORLD-SURFACE-003, WORLD-SURFACE-008
export function required(c: Conc): number {
  conc(c);
  const hr = Math.max(...GASES.map((g) => c[g] / REL[g]));
  return GASES.some((g) => c[g] >= IDLH[g]) || c.co > REL.co ? Math.max(hr, APF_SEALED) : hr;
}

// @spec WORLD-SURFACE-004
export function bandOf(c: Conc): string {
  const r = required(c);
  return r <= 1 ? 'open' : r <= 50 ? 'mask' : r <= 1000 ? 'suit' : r <= APF_SEALED ? 'sealed' : 'closed';
}

// @spec WORLD-SURFACE-005, WORLD-SURFACE-008
export function optionFor(r: number): number | null {
  check('factor', r);
  return OPTIONS.find((f) => f >= r) ?? null;
}

export interface TrialPlan {
  verified: number; // factor of the verified option, 0 when none holds
  exposureH: number; // person-hours
  breaches: number;
  stages: { factor: number; hours: number; breached: boolean }[];
}

// @spec WORLD-SURFACE-006, WORLD-SURFACE-008
export function trialPlan(startR: number, trueR: number, staged: boolean): TrialPlan {
  check('factor', trueR);
  const plan: TrialPlan = { verified: 0, exposureH: 0, breaches: 0, stages: [] };
  const start = optionFor(startR);
  if (start === null) return plan;
  for (const factor of OPTIONS.slice(OPTIONS.indexOf(start))) {
    const breached = trueR > factor; // the outcome depends on the option alone, so every stage of an option ends alike
    for (const h of staged ? STAGES : [720]) {
      const hours = breached ? 1 : h; // a breach is seen at the first hourly check
      plan.stages.push({ factor, hours, breached });
      plan.exposureH += TRIAL_N * hours;
      if (breached) break;
    }
    if (breached) plan.breaches++;
    else return { ...plan, verified: factor };
  }
  return plan;
}

// @spec WORLD-SURFACE-007, WORLD-SURFACE-008
export function returnPerDay(shafts: number): number {
  check('shafts', shafts);
  return Math.min(SHAFT_PPH * SHAFT_H * shafts, RECEPTION_PD);
}
