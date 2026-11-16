// p06 sleeping space (design: docs/intent/adapters/spacecare/spacecare-design.md, "p06: sleeping space").
import type { Adapter, Claim, Household, World } from '../contracts.ts';
import { nextDebt, rotate } from '../fairshare/fairshare.ts';
import type { Script } from '../scenario/types.ts';
import { AREA_M2, fill, idleM2, SHIFTS, shiftSleepers, sleepM2 } from '../world/space/space.ts';
import { weight, type Policy } from './shared.ts';

const DAY = 86400;

const tracked = (w: World, s: number): Household[] => w.households.filter((h) => h.sector === s);

export function createP06(policy: Policy, _script: Script): Adapter {
  const debts = new Map<string, number>(); // household id -> debt for the night shift
  return {
    id: 'p06',
    reads: ['sectors', 'households'],
    writes: ['sectors', 'households'],
    // @spec ADAPT-SPACECARE-001, ADAPT-SPACECARE-002
    step(w, _dt, rng) {
      if (w.t % DAY !== 0) return;
      w.sectors.forEach((x, s) => {
        const ws = weight(w, s);
        if (policy === 'directorate' || ws === 0) {
          x.sleepM2 = sleepM2(AREA_M2, x.people);
          return;
        }
        const hs = tracked(w, s);
        const claims: Claim[] = hs.map((h) => ({ id: h.id, floor: 0, demand: h.members, debt: debts.get(h.id) ?? 0 }));
        const night = rotate(Math.floor(hs.reduce((a, h) => a + h.members, 0) / SHIFTS), claims, rng);
        const won = new Set(night.winners);
        const rest = hs.filter((h) => !won.has(h.id));
        const placed = fill(rest.map((h) => h.members), [0, 0, 0]);
        rest.forEach((h, i) => (h.shift = placed[i]!));
        for (const h of hs) if (won.has(h.id)) h.shift = 0;
        for (const [id, d] of Object.entries(nextDebt(claims, night.shares))) debts.set(id, d);
        x.sleepM2 = sleepM2(AREA_M2, Math.max(...shiftSleepers(hs.map((h) => h.members), hs.map((h) => h.shift), ws)));
      });
    },
    // @spec ADAPT-SPACECARE-003
    metric(w) {
      let people = 0, m2 = 0;
      for (const x of w.sectors) (people += x.people), (m2 += x.people * x.sleepM2);
      return { name: 'sleeping m2 per sleeper (busiest shift)', value: people > 0 ? m2 / people : 0, unit: 'm2', label: 'SIMULATED' };
    },
  };
}

/** Per sector and shift: people asleep, assigned floor left empty, households sharing one sleeping space a day. Reads the world only. */
// @spec ADAPT-SPACECARE-004
export function census(w: World, policy: Policy): { sector: number; shift: number; asleep: number; idleM2: number; sharing: number }[] {
  return w.sectors.flatMap((x, s) => {
    const hs = tracked(w, s);
    const asleep = shiftSleepers(hs.map((h) => h.members), hs.map((h) => h.shift), weight(w, s));
    const sharing = policy === 'directorate' ? 1 : asleep.filter((a) => a > 0).length;
    return asleep.map((a, shift) => {
      const n = Math.min(a, x.people); // weight x members can round a hair above people
      return { sector: s, shift, asleep: n, idleM2: idleM2(AREA_M2, x.people, n), sharing };
    });
  });
}
