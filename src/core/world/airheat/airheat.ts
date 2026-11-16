// Air and heat: each quantity relaxes exactly towards a target set by depth, cooling and ventilation.
// Constants are in docs/params.md. Temperatures in deg C, CO2 in ppm, times in seconds.

export const ROCK_TOP = 25; // deg C, rock at level 1
export const ROCK_STEP = 3; // deg C per level
export const GAIN = 2; // deg C, people and equipment
export const SETPOINT = 24; // deg C
export const COOL_KW = 0.05; // kW per person per deg C above the setpoint
export const TAU_HEAT_S = 21600; // s
export const RH = 70; // %
export const WB_LIMIT = 27.5; // deg C wet-bulb
export const C_OUT = 420; // ppm
export const G = 0.0052; // L/s CO2 exhaled per person
export const Q = 10; // L/s fresh air per person
export const LEAK = 0.05; // fraction of Q with fans off
export const VOL_L = 30000; // L of air per person
export const CO2_LIMIT = 5000; // ppm, 8 h exposure limit
export const CO2_REF = C_OUT + (1e6 * G) / Q;

const finite = (...xs: number[]) => {
  for (const x of xs) if (!Number.isFinite(x)) throw new RangeError(`non-finite input ${x}`);
};
const positive = (x: number, name: string) => {
  if (!(x > 0) || x === Infinity) throw new RangeError(`${name} must be positive, got ${x}`);
};
const fraction = (x: number) => {
  if (!(x >= 0 && x <= 1)) throw new RangeError(`served fraction ${x} outside [0, 1]`);
};
const relax = (x: number, target: number, dt: number, tau: number) => target + (x - target) * Math.exp(-dt / tau);

// @spec WORLD-AIR-001, WORLD-AIR-008
export function uncooledTemp(level: number): number {
  if (!(Number.isInteger(level) && level >= 1 && level <= 6)) throw new RangeError(`level ${level} not in 1..6`);
  return ROCK_TOP + ROCK_STEP * (level - 1) + GAIN;
}

// @spec WORLD-AIR-001, WORLD-AIR-008
export function coolingDemandMW(level: number, people: number): number {
  finite(people);
  if (people < 0) throw new RangeError(`negative people ${people}`);
  return (COOL_KW * people * Math.max(0, uncooledTemp(level) - SETPOINT)) / 1000;
}

// @spec WORLD-AIR-002, WORLD-AIR-007, WORLD-AIR-008
export function tempStep(T: number, level: number, coolFrac: number, dt: number): number {
  finite(T);
  fraction(coolFrac);
  positive(dt, 'dt');
  const U = uncooledTemp(level);
  return relax(T, U - Math.max(0, U - SETPOINT) * coolFrac, dt, TAU_HEAT_S); // max(0, ..) is the "U at or below setpoint" case
}

// @spec WORLD-AIR-003, WORLD-AIR-008
export function wetBulb(T: number, rh: number): number {
  finite(T, rh);
  if (rh < 5 || rh > 99) throw new RangeError(`rh ${rh} outside [5, 99]`);
  return T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(T + rh) - Math.atan(rh - 1.676331)
    + 0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) - 4.686035;
}

// @spec WORLD-AIR-004, WORLD-AIR-008
export function co2Step(c: number, ventFrac: number, dt: number): { co2: number; tau: number } {
  finite(c);
  fraction(ventFrac);
  positive(dt, 'dt');
  const v = Math.max(LEAK, ventFrac);
  const tau = VOL_L / (Q * v);
  return { co2: relax(c, C_OUT + (1e6 * G) / (Q * v), dt, tau), tau };
}

// @spec WORLD-AIR-005, WORLD-AIR-008
export function timeToLimit(x: number, target: number, tau: number, limit: number): number {
  finite(x, target, limit);
  positive(tau, 'tau');
  if (x >= limit) return 0;
  if (target <= limit) return Infinity;
  return tau * Math.log((target - x) / (target - limit));
}

// Wet-bulb rises with dry-bulb at fixed humidity, so bisect over Stull's valid range once.
const DRY_LIMIT = (() => {
  let lo = -20, hi = 50;
  while (hi - lo > 1e-6) {
    const mid = (lo + hi) / 2;
    if (wetBulb(mid, RH) < WB_LIMIT) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

// @spec WORLD-AIR-006
export function dryBulbLimit(): number {
  return DRY_LIMIT;
}
