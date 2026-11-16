import type { Rng } from '../../rng.ts';

/** One binomial draw by inverting the CDF from exactly one rng() value. */
// @spec WORLD-EPI-006, WORLD-EPI-008
export function binomial(n: number, p: number, rng: Rng): number {
  if (!(p >= 0 && p <= 1)) throw new RangeError(`invalid p ${p}`);
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`invalid n ${n}`);
  const u = rng();
  return p > 0.5 ? n - invert(n, 1 - p, u) : invert(n, p, u);
}

// shortcut: (1 - p)^n underflows to 0 for n above about 1000 at p = 0.5 and then returns n; sectors hold 500 people, so use a normal approximation if a sector ever holds thousands.
function invert(n: number, p: number, u: number): number {
  const q = 1 - p;
  let pk = q ** n;
  let cdf = pk;
  let k = 0;
  while (cdf <= u && k < n) {
    pk *= ((n - k) / (k + 1)) * (p / q);
    cdf += pk;
    k++;
  }
  return k;
}
