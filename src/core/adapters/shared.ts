// Helpers every adapter shares (design: docs/intent/adapters/policy/policy-design.md, "Conventions").

/** Base load per person, kW (docs/params.md). */
export const BASE_KW = 1.0;
/** Life floor per person, kW (docs/params.md). */
export const LIFE_KW = 0.3;

// Built once: the same string objects every step make keyed reads and writes on allocations much cheaper.
const IDS = Array.from({ length: 24 }, (_, s) => `s${String(s).padStart(2, '0')}`);

/** Sector `s`'s claim id, s00 to s23, so Fair Share's id order is sector order. */
// @spec ADAPT-POLICY-005
export function sectorId(s: number): string {
  if (!Number.isInteger(s) || s < 0 || s > 23) throw new RangeError(`sector index out of range: ${s}`);
  return IDS[s]!;
}

/** `{ s00: xs[0], s01: xs[1], ... }`, built in a loop: Object.fromEntries is several times slower, and this runs every step. */
export function bySector(xs: readonly number[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (let s = 0; s < xs.length; s++) o[sectorId(s)] = xs[s]!;
  return o;
}

/** A sector's full power demand, MW. */
export const powerDemand = (people: number): number => (people * BASE_KW) / 1000;

/** A sector's life floor (ventilation, medical, charging), MW. */
export const lifeFloor = (people: number): number => (people * LIFE_KW) / 1000;

/** A one-entry memo: returns the last value `make` gave while every number in `key` is the same. `key` must hold every input; callers must not mutate the value. */
export function lastOf<T>(): (key: readonly number[], make: () => T) => T {
  let k: readonly number[] | undefined, v: T;
  const same = (key: readonly number[]) => {
    if (!k || key.length !== k.length) return false;
    for (let i = 0; i < key.length; i++) if (!Object.is(key[i], k[i])) return false;
    return true;
  };
  return (key, make) => {
    if (same(key)) return v;
    const nv = make(); // key stored only after make succeeds, so a throw leaves the old pair intact
    k = key;
    return (v = nv);
  };
}

/** The two policies a run compares (docs/intent/adapters/adapters-design.md, "The two policies"). */
export type Policy = 'directorate' | 'stratum';
