// p11 light: turns each sector's lamp energy into bright sessions and scores who gets enough daytime light
// (design: docs/intent/adapters/lightfood/lightfood-design.md, "p11: light").
import type { Adapter, Claim } from '../contracts.ts';
import { nextDebt, rotate } from '../fairshare/fairshare.ts';
import type { Script } from '../scenario/types.ts';
import { BRIGHT_H, LAMP_H, WAKE_H, dose, growSessions, lampKWh, sessions } from '../world/lightfood/lightfood.ts';
import { served } from './p03.ts';
import { bySector, powerDemand, sectorId, weight, type Policy } from './shared.ts';

export function createP11(policy: Policy, _script: Script): Adapter {
  let sum: number[] | null = null; // per sector: this day's hourly power served fractions, summed
  let n = 0; // hourly samples this day
  const debt: Record<string, number> = {};
  let met = 0, all = 0; // person-days meeting the threshold, and all person-days
  return {
    id: 'p11',
    reads: ['sectors', 'alloc', 'households'],
    writes: ['sectors', 'alloc'],
    step(w, _dt, rng) {
      const { t, sectors, alloc } = w; // read once: each world read costs a guard call in checked mode
      // @spec ADAPT-LIGHTFOOD-008, ADAPT-POLICY-008
      if (!sum) {
        sum = sectors.map(() => 0);
        alloc.lampHours = bySector(sum);
      }
      if (t % 86400 === 0 && t > 0) {
        const hours: number[] = [];
        sectors.forEach((x, s) => {
          const p = x.people, f = n ? sum![s] / n : 0;
          let count: number, dayDose: number;
          if (policy === 'directorate') {
            // @spec ADAPT-LIGHTFOOD-001
            const h = LAMP_H * f, g = Math.min(p, growSessions(f));
            count = h >= BRIGHT_H ? p : g; // the all-p branch is unreachable at LAMP_H = 2 and untested until the deferred LAMP_H sweep
            hours.push(h * p);
            dayDose = p > 0 ? (g * dose(Math.min(WAKE_H, h + BRIGHT_H)) + (p - g) * dose(h)) / p : dose(h);
          } else {
            // @spec ADAPT-LIGHTFOOD-002, ADAPT-POLICY-009
            const k = sessions(lampKWh(p) * f) + growSessions(f), ws = weight(w, s);
            count = 0;
            if (ws > 0) {
              const claims: Claim[] = w.households.filter((h) => h.sector === s).map((h) => ({ id: h.id, floor: 0, demand: h.members, debt: debt[h.id] ?? 0 }));
              const r = rotate(Math.floor(k / ws + 1e-9), claims, rng); // 1e-9: n / w_s that should be whole never floors one short
              Object.assign(debt, nextDebt(claims, r.shares));
              const won = new Set(r.winners);
              count = Math.min(p, ws * claims.reduce((a, c) => a + (won.has(c.id) ? c.demand : 0), 0));
            }
            hours.push(k * BRIGHT_H);
            const share = p > 0 ? count / p : 0;
            dayDose = share * dose(BRIGHT_H) + (1 - share) * dose(0);
          }
          x.lightDose = dayDose;
          met += count;
          all += p;
        });
        alloc.lampHours = bySector(hours);
        sum.fill(0);
        n = 0;
      }
      // @spec ADAPT-POLICY-006
      if (t % 3600 === 0) {
        sectors.forEach((x, s) => (sum![s] += served(alloc.power[sectorId(s)], powerDemand(x.people))));
        n++;
      }
    },
    // @spec ADAPT-LIGHTFOOD-003
    metric: () => ({ name: 'share of person-days with 4 h of daytime light', value: all > 0 ? met / all : 0, unit: 'share', label: 'SIMULATED' }),
  };
}
