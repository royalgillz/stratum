// Light and food model (design: docs/intent/world/lightfood/lightfood-design.md). Constants: docs/params.md.
// Pure functions, no randomness.
import type { ScenarioEvent } from '../../scenario/types.ts';

export const WAKE_H = 16; // h/day
export const AMBIENT_MEL = 30; // lux melanopic EDI outside bright sessions
export const BRIGHT_MEL = 300; // lux melanopic EDI in a bright session
export const DAY_MEL = 250; // lux melanopic EDI, Brown et al. 2022
export const BRIGHT_H = 4; // h per bright session
export const SEAT_KW = 0.01; // kW per bright seat
export const LAMP_H = 2; // bright h per person per day of lamp budget
export const GROW_SEATS = 25; // seats per sector's grow room
export const GROW_LAMP_H = 16; // h/day the grow lamps run
export const GROW_KW = 20; // kW per sector's grow room
export const CROPS: Readonly<Record<string, Readonly<{ kWhPerKg: number; kcalPerKg: number }>>> = Object.freeze({
  lettuce: Object.freeze({ kWhPerKg: 15, kcalPerKg: 150 }),
  grain: Object.freeze({ kWhPerKg: 650, kcalPerKg: 3300 }),
});
export const STAPLE = 'grain'; // the central farms' crop
export const STOCK_DAYS = 3; // days of the standard ration in store

const nonNeg = (x: number, what: string) => {
  if (!(Number.isFinite(x) && x >= 0)) throw new RangeError(`invalid ${what} ${x}`);
  return x;
};
const cropOf = (crop: string) => {
  if (!Object.hasOwn(CROPS, crop)) throw new RangeError(`unknown crop ${crop}`);
  return CROPS[crop]!;
};

// @spec WORLD-LIGHTFOOD-001, WORLD-LIGHTFOOD-007
export const lampKWh = (people: number): number => nonNeg(people, 'people') * LAMP_H * SEAT_KW;
export const sessions = (kWh: number): number => Math.floor(nonNeg(kWh, 'kWh') / (SEAT_KW * BRIGHT_H) + 1e-9); // 1e-9: rounding never loses a session

// @spec WORLD-LIGHTFOOD-002
export function growSessions(f: number): number {
  if (!(f >= 0 && f <= 1)) throw new RangeError(`invalid served fraction ${f}`);
  return Math.floor(GROW_SEATS * Math.floor(GROW_LAMP_H / BRIGHT_H) * f + 1e-9);
}

// @spec WORLD-LIGHTFOOD-003
export function dose(h: number): number {
  if (!(h >= 0 && h <= WAKE_H)) throw new RangeError(`invalid bright hours ${h}`);
  return AMBIENT_MEL * (WAKE_H - h) + BRIGHT_MEL * h;
}

// @spec WORLD-LIGHTFOOD-004
export const kcalPerKWh = (crop: string): number => cropOf(crop).kcalPerKg / cropOf(crop).kWhPerKg;
export const grown = (kWh: number, crop: string): number => nonNeg(kWh, 'kWh') * kcalPerKWh(crop);
export const kwhToFeed = (kcal: number, crop: string): number => nonNeg(kcal, 'kcal') / kcalPerKWh(crop);

// @spec WORLD-LIGHTFOOD-005
export const bestCrop = (): string => Object.keys(CROPS).reduce((a, b) => (kcalPerKWh(b) > kcalPerKWh(a) ? b : a));

// @spec WORLD-LIGHTFOOD-006, WORLD-LIGHTFOOD-007
export function farmCut(events: readonly ScenarioEvent[], level: number, t: number): boolean {
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new RangeError(`invalid level ${level}`);
  nonNeg(t, 't');
  let on = false;
  for (const e of events) {
    if (e.type !== 'farm-cut') continue;
    if (!Number.isFinite(e.atH) || !(Number.isFinite(e.durH) && e.durH >= 0)) throw new RangeError(`invalid farm-cut timing at ${e.atH} h`);
    if (e.level === level && t >= e.atH * 3600 && t < (e.atH + e.durH) * 3600) on = true;
  }
  return on;
}
