import type { Allocation, Claim, FairShare } from '../contracts.ts';
import type { Rng } from '../rng.ts';

export interface Breach {
  shortfall: number; // sum of floors minus supply
  ids: string[]; // claims below their floor, ascending id order
}

export interface AllocationResult {
  shares: Allocation;
  surplus: number;
  lambda: number | null; // water level; null when S >= sum of demands, on a breach, or with no claims
  breach: Breach | null;
  adjusted: string[]; // ids whose demand was below their floor and was raised
}

export interface RotationResult {
  shares: Allocation;
  winners: string[]; // in draw order
  unitsLeft: number;
  breach: Breach | null;
}

const byId = (a: Claim, b: Claim) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); // UTF-16 code-unit order
const bad = (x: number) => !Number.isFinite(x) || x < 0;
const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function validate(supply: number, claims: Claim[], whole: boolean): Claim[] {
  if (bad(supply) || (whole && !Number.isInteger(supply))) throw new RangeError(`invalid supply ${supply}`);
  const seen = new Set<string>();
  for (const k of claims) {
    if (bad(k.floor) || bad(k.demand) || bad(k.debt)) throw new RangeError(`invalid claim ${k.id}`);
    if (whole && !(Number.isInteger(k.demand) && Number.isInteger(k.floor))) throw new RangeError(`non-integer claim ${k.id}`);
    if (seen.has(k.id)) throw new RangeError(`duplicate id ${k.id}`);
    seen.add(k.id);
  }
  return [...claims].sort(byId);
}

// @spec FAIR-001, FAIR-002, FAIR-003, FAIR-004, FAIR-005, FAIR-006, FAIR-007, FAIR-008
export function allocate(supply: number, claims: Claim[]): AllocationResult {
  const sorted = validate(supply, claims, false);
  const adjusted = sorted.filter((k) => k.demand < k.floor).map((k) => k.id);
  const cs = sorted.map((k) => ({ id: k.id, f: k.floor, d: Math.max(k.demand, k.floor) }));
  const sf = total(cs.map((k) => k.f));
  const sd = total(cs.map((k) => k.d));
  const shares: Allocation = {};
  const out = (surplus: number, lambda: number | null, breach: Breach | null): AllocationResult => ({
    shares, surplus, lambda, breach, adjusted,
  });

  if (supply < sf) {
    for (const k of cs) shares[k.id] = (k.f * supply) / sf;
    return out(0, null, { shortfall: sf - supply, ids: cs.filter((k) => k.f > 0).map((k) => k.id) });
  }
  if (supply >= sd) {
    for (const k of cs) shares[k.id] = k.d;
    return out(supply - sd, null, null);
  }
  // Total use at level L is piecewise linear in L; walk the breakpoints to the segment holding supply.
  const use = (l: number) => total(cs.map((k) => Math.max(k.f, Math.min(k.d, l))));
  const points = [...new Set(cs.flatMap((k) => [k.f, k.d]))].filter((p) => p > 0).sort((a, b) => a - b);
  let lo = 0;
  let lambda = points[points.length - 1];
  for (const p of points) {
    if (use(p) >= supply) {
      const active = cs.filter((k) => k.f <= lo && k.d > lo).length;
      lambda = active ? lo + (supply - use(lo)) / active : p;
      break;
    }
    lo = p;
  }
  for (const k of cs) shares[k.id] = Math.max(k.f, Math.min(k.d, lambda));
  return out(0, lambda, null);
}

/** Satisfies the frozen FairShare type in contracts.ts. */
export const fairShare: FairShare = (supply, claims) => allocate(supply, claims).shares;

// @spec FAIR-009, FAIR-010, FAIR-011
export function rotate(units: number, claims: Claim[], draw: Rng): RotationResult {
  const sorted = validate(units, claims, true).map((k) => ({ ...k, demand: Math.max(k.demand, k.floor) }));
  const sf = total(sorted.map((k) => k.floor));
  const covered = units >= sf;
  // Covered: floors are paid up front and the lottery hands out remaining demand.
  // Breach: the lottery decides whose whole floor is paid.
  const ask = (k: (typeof sorted)[number]) => (covered ? k.demand - k.floor : k.floor);
  const shares: Allocation = Object.fromEntries(sorted.map((k) => [k.id, covered ? k.floor : 0]));
  const winners: string[] = [];
  let left = covered ? units - sf : units;
  let pool = sorted.filter((k) => ask(k) > 0);
  for (;;) {
    const fit = pool.filter((k) => ask(k) <= left);
    if (!fit.length) break;
    const r = draw() * total(fit.map((k) => 1 + k.debt));
    let run = 0;
    const pick = fit.find((k) => (run += 1 + k.debt) > r) ?? fit[fit.length - 1];
    winners.push(pick.id);
    shares[pick.id] = covered ? pick.demand : pick.floor;
    left -= ask(pick);
    pool = pool.filter((k) => k !== pick);
  }
  const breach = covered
    ? null
    : { shortfall: sf - units, ids: sorted.filter((k) => k.floor > 0 && shares[k.id] === 0).map((k) => k.id) };
  return { shares, winners, unitsLeft: left, breach };
}

// @spec FAIR-012
export function nextDebt(claims: Claim[], shares: Allocation): Record<string, number> {
  return Object.fromEntries(
    claims.map((k) => {
      const got = shares[k.id] ?? 0;
      return [k.id, got >= k.demand ? 0 : k.debt + k.demand - got];
    }),
  );
}
