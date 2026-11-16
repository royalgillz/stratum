// Sleeping space per sector, by shift. Design: docs/intent/world/space/space-design.md. Pure functions, no randomness.
// Every value below is listed in docs/params.md.
export const AREA_M2 = 1000; // m² of sleeping floor per sector, SLEEP_M2 x PEOPLE (a test pins it)
export const SPHERE_M2 = 3.5; // m² of covered living space per person, Sphere minimum
export const SHIFTS = 3; // sleep shifts of 8 h; shift 0 is the night

const check = (name: string, x: number) => {
  if (!Number.isFinite(x) || x < 0) throw new RangeError(`invalid ${name} ${x}`);
};

// @spec WORLD-SPACE-001, WORLD-SPACE-005
export function sleepM2(areaM2: number, sleepers: number): number {
  check('area', areaM2);
  check('sleepers', sleepers);
  return sleepers > 0 ? areaM2 / sleepers : areaM2;
}

// @spec WORLD-SPACE-002, WORLD-SPACE-005
export function shiftSleepers(members: readonly number[], shifts: readonly number[], weight: number): number[] {
  check('weight', weight);
  if (members.length !== shifts.length) throw new RangeError('members and shifts differ in length');
  const out = Array<number>(SHIFTS).fill(0);
  members.forEach((m, i) => {
    const k = shifts[i]!;
    check('size', m);
    if (!Number.isInteger(k) || k < 0 || k >= SHIFTS) throw new RangeError(`invalid shift ${k}`);
    out[k] += m;
  });
  return out.map((m) => weight * m);
}

// @spec WORLD-SPACE-003, WORLD-SPACE-005
export function fill(sizes: readonly number[], loads: readonly number[]): number[] {
  if (loads.length !== SHIFTS) throw new RangeError(`loads must have ${SHIFTS} entries`);
  loads.forEach((x) => check('load', x));
  const load = [...loads];
  return sizes.map((size) => {
    check('size', size);
    let k = 1;
    for (let j = 2; j < SHIFTS; j++) if (load[j]! < load[k]!) k = j;
    load[k] += size;
    return k;
  });
}

// @spec WORLD-SPACE-004, WORLD-SPACE-005
export function idleM2(areaM2: number, people: number, sleepers: number): number {
  check('area', areaM2);
  check('people', people);
  check('sleepers', sleepers);
  if (sleepers > people) throw new RangeError(`sleepers ${sleepers} above people ${people}`);
  return people > 0 ? areaM2 * (1 - sleepers / people) : areaM2;
}
