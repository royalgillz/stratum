// Helpers every adapter shares (design: docs/intent/adapters/policy/policy-design.md, "Conventions").

/** Base load per person, kW (docs/params.md). */
export const BASE_KW = 1.0;
/** Life floor per person, kW (docs/params.md). */
export const LIFE_KW = 0.3;

/** Sector `s`'s claim id, s00 to s23, so Fair Share's id order is sector order. */
// @spec ADAPT-POLICY-005
export function sectorId(s: number): string {
  if (!Number.isInteger(s) || s < 0 || s > 23) throw new RangeError(`sector index out of range: ${s}`);
  return `s${String(s).padStart(2, '0')}`;
}

/** A sector's full power demand, MW. */
export const powerDemand = (people: number): number => (people * BASE_KW) / 1000;

/** A sector's life floor (ventilation, medical, charging), MW. */
export const lifeFloor = (people: number): number => (people * LIFE_KW) / 1000;
