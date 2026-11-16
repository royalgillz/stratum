// District 7 at hour 0 (design: docs/intent/scenario/scenario-design.md, "Initial world").
// Constants are rows in docs/params.md.
import type { Household, Sector, World } from '../contracts.ts';
import { powerDemand, sectorId } from '../adapters/shared.ts';
import { rng } from '../rng.ts';
import { CO2_REF, RH, SETPOINT, uncooledTemp, wetBulb } from '../world/airheat/airheat.ts';
import { CAP_MARGIN, F0 } from '../world/grid/grid.ts';
import { districtTunnels } from '../world/tunnels/tunnels.ts';
import { BASELINE } from '../world/water/water.ts';
import type { Script } from './types.ts';
import { HH_PER_SECTOR } from './validate.ts';

export const PEOPLE = 500; // people per sector
export const SUMP_START = 0.3; // fraction of sump capacity
export const MED_START = 5; // treatment courses per sector
export const SLEEP_M2 = 2.0; // m² per person

const SECTORS = 24;
const levelOf = (s: number) => Math.floor(s / 4) + 1;

// @spec SCEN-002, SCEN-003
export function createWorld(seed: number, script: Script): World {
  const act = script.acts[0];
  const sectors = Array.from({ length: SECTORS }, (_, s): Sector => {
    const level = levelOf(s);
    const temp = Math.min(uncooledTemp(level), SETPOINT);
    return {
      level, temp, wetBulb: wetBulb(temp, RH), co2: CO2_REF, water: { ...BASELINE }, sumpLevel: SUMP_START,
      people: PEOPLE, sleepM2: SLEEP_M2, lightDose: 0, foodKcal: 0, stock: MED_START,
    };
  });
  const demand = SECTORS * powerDemand(PEOPLE);

  // The 'world' stream is drawn only here, so it never shifts an adapter's draws.
  const u = rng(seed, 'world');
  const households: Household[] = [];
  for (let s = 0; s < SECTORS; s++) {
    for (let n = 0; n < HH_PER_SECTOR; n++) {
      households.push({ id: `h${s}-${n}`, members: 2 + Math.floor(u() * 5), level: levelOf(s), sector: s, shift: n % 3 });
    }
  }
  const { demo } = script;
  households.push({ id: demo.id, members: demo.members, level: demo.level, sector: (demo.level - 1) * 4 + demo.sector, shift: 0 });

  return {
    t: 0,
    seed,
    clock: act.mode === 'realtime' ? { mode: 'realtime', scale: 1 } : { mode: 'timelapse', scale: act.scale ?? 3600 },
    grid: { f: F0, rocof: 0, gapMW: CAP_MARGIN * demand - demand, tier: 'GREEN' },
    sectors,
    tunnels: districtTunnels(),
    households,
    ledger: { measured: [], official: [] },
    mesh: { inbox: [], delivered: [] },
    alloc: {
      power: Object.fromEntries(sectors.map((x, s) => [sectorId(s), powerDemand(x.people)])),
      water: {}, food: {}, cooling: {}, pumps: {}, lampHours: {}, medicine: {}, bunks: {}, trialSlots: {}, returnSlots: {},
    },
    surface: { readings: [], band: 'unknown' },
  };
}
