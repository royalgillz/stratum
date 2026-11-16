import { describe, expect, it } from 'vitest';
import { powerDemand } from '../adapters/shared.ts';
import { rng } from '../rng.ts';
import { CO2_REF, RH, SETPOINT, uncooledTemp, wetBulb } from '../world/airheat/airheat.ts';
import { CAP_MARGIN, F0 } from '../world/grid/grid.ts';
import { districtTunnels } from '../world/tunnels/tunnels.ts';
import { BASELINE } from '../world/water/water.ts';
import { sevenDay } from './seven-day.ts';
import { HH_PER_SECTOR } from './validate.ts';
import { createWorld, MED_START, PEOPLE, SLEEP_M2, SUMP_START } from './world.ts';

describe('createWorld', () => {
  // @spec SCEN-002
  it('SCEN-002 builds District 7 at hour 0', () => {
    const w = createWorld(42, sevenDay);
    expect(w.t).toBe(0);
    expect(w.seed).toBe(42);
    expect(w.clock).toEqual({ mode: 'timelapse', scale: 3600 });
    const demand = 24 * powerDemand(PEOPLE);
    expect(w.grid.f).toBe(F0);
    expect(w.grid.rocof).toBe(0);
    expect(w.grid.tier).toBe('GREEN');
    expect(w.grid.gapMW).toBeCloseTo(CAP_MARGIN * demand - demand, 12);
    expect(w.sectors).toHaveLength(24);
    w.sectors.forEach((s, i) => {
      const level = Math.floor(i / 4) + 1;
      const T = Math.min(uncooledTemp(level), SETPOINT);
      expect(s).toEqual({
        level, temp: T, wetBulb: wetBulb(T, RH), co2: CO2_REF, water: { ...BASELINE }, sumpLevel: SUMP_START,
        people: PEOPLE, sleepM2: SLEEP_M2, lightDose: 0, foodKcal: 0, stock: MED_START,
      });
    });
    expect(w.sectors[0].temp).toBe(SETPOINT); // level 1 uncooled is 27, above the setpoint
    expect(w.sectors[0].water).not.toBe(w.sectors[1].water); // no shared objects between sectors
    expect(w.tunnels).toEqual(districtTunnels());
    expect(Object.keys(w.alloc.power)).toEqual(Array.from({ length: 24 }, (_, s) => `s${String(s).padStart(2, '0')}`));
    for (const v of Object.values(w.alloc.power)) expect(v).toBe(powerDemand(PEOPLE));
    const { power, ...rest } = w.alloc;
    expect(power).toBeDefined();
    expect(Object.keys(rest).sort()).toEqual(['bunks', 'cooling', 'food', 'lampHours', 'medicine', 'pumps', 'returnSlots', 'trialSlots', 'water']);
    for (const a of Object.values(rest)) expect(a).toEqual({});
    expect(w.ledger).toEqual({ measured: [], official: [] });
    expect(w.mesh).toEqual({ inbox: [], delivered: [] });
    expect(w.surface).toEqual({ readings: [], band: 'unknown' });
  });

  // @spec SCEN-002
  it('SCEN-002 takes the first act clock, realtime at scale 1 and a set timelapse scale', () => {
    const rt = { ...sevenDay, acts: [{ atH: 0, mode: 'realtime' as const, title: 'x' }] };
    expect(createWorld(1, rt).clock).toEqual({ mode: 'realtime', scale: 1 });
    const tl = { ...sevenDay, acts: [{ atH: 0, mode: 'timelapse' as const, scale: 600, title: 'x' }] };
    expect(createWorld(1, tl).clock).toEqual({ mode: 'timelapse', scale: 600 });
    const two = { ...sevenDay, acts: [{ atH: 0, mode: 'realtime' as const, title: 'a' }, { atH: 1, mode: 'timelapse' as const, scale: 600, title: 'b' }] };
    expect(createWorld(1, two).clock).toEqual({ mode: 'realtime', scale: 1 });
  });

  // @spec SCEN-003
  it('SCEN-003 makes the generated households in order from the world stream, then the demo', () => {
    const w = createWorld(7, sevenDay);
    const u = rng(7, 'world');
    expect(w.households).toHaveLength(24 * HH_PER_SECTOR + 1);
    for (let s = 0, i = 0; s < 24; s++) {
      for (let n = 0; n < HH_PER_SECTOR; n++, i++) {
        expect(w.households[i]).toEqual({ id: `h${s}-${n}`, members: 2 + Math.floor(u() * 5), level: Math.floor(s / 4) + 1, sector: s, shift: n % 3 });
      }
    }
    expect(w.households.at(-1)).toEqual({ id: 'family', members: 4, level: 5, sector: 17, shift: 0 });
    const other = { ...sevenDay, demo: { id: 'x', level: 2, sector: 3, members: 6 } };
    expect(createWorld(1, other).households.at(-1)).toEqual({ id: 'x', members: 6, level: 2, sector: 7, shift: 0 });
    expect(w.households[50].id).toBe('h5-0');
    for (const h of w.households) expect(h.members).toBeGreaterThanOrEqual(1);
    expect(w.households.slice(0, -1).every((h) => h.members >= 2 && h.members <= 6)).toBe(true);
  });

  // @spec SCEN-003
  it('SCEN-003 is the same for the same seed and differs for another', () => {
    expect(createWorld(3, sevenDay)).toEqual(createWorld(3, sevenDay));
    const members = (seed: number) => createWorld(seed, sevenDay).households.map((h) => h.members);
    expect(members(3)).not.toEqual(members(4));
  });
});
