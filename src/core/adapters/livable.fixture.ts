// Test world for the livable adapters: District 7 at hour 0, 500 people per sector, cooled and ventilated.
// Local stand-in for the scenario's createWorld, which these tests do not depend on.
import type { World } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { CO2_REF, RH, SETPOINT, wetBulb } from '../world/airheat/airheat.ts';
import { BASELINE } from '../world/water/water.ts';
import { districtTunnels } from '../world/tunnels/tunnels.ts';
import { powerDemand, sectorId } from './shared.ts';

export const PEOPLE = 500;

export function livableWorld(seed = 1): World {
  const sectors = Array.from({ length: 24 }, (_, s) => ({
    level: Math.floor(s / 4) + 1, temp: SETPOINT, wetBulb: wetBulb(SETPOINT, RH), co2: CO2_REF, water: { ...BASELINE },
    sumpLevel: 0.3, people: PEOPLE, sleepM2: 3.5, lightDose: 0, foodKcal: 0, stock: 0,
  }));
  const power = Object.fromEntries(sectors.map((x, s) => [sectorId(s), powerDemand(x.people)]));
  return {
    t: 0, seed, clock: { mode: 'timelapse', scale: 3600 },
    grid: { f: 400, rocof: 0, gapMW: 0, tier: 'GREEN' },
    sectors, tunnels: districtTunnels(), households: [],
    ledger: { measured: [], official: [] }, mesh: { inbox: [], delivered: [] },
    alloc: { power, water: {}, food: {}, cooling: {}, pumps: {}, lampHours: {}, medicine: {}, bunks: {}, trialSlots: {}, returnSlots: {} },
    surface: { readings: [], band: 'unknown' },
  };
}

export const quietScript = (events: Script['events'] = []): Script => ({
  name: 'test', days: 1, demo: { id: 'family', level: 5, sector: 1, members: 4 },
  acts: [{ atH: 0, mode: 'timelapse', title: 'test' }], events,
});

/** Dotted paths of every leaf that differs between `a` and `b` (structural, so seed objects you want guarded). */
export function changedPaths(a: unknown, b: unknown, at = ''): string[] {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return Object.is(a, b) ? [] : [at];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) => changedPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], at ? `${at}.${k}` : k));
}

/** Sets every sector's power to `frac` of its demand, then cuts the listed sectors to 0. */
export function setPower(w: World, frac: number, cut: number[] = []): void {
  w.sectors.forEach((x, s) => (w.alloc.power[sectorId(s)] = cut.includes(s) ? 0 : frac * powerDemand(x.people)));
}
