/** Chapman capture-recapture estimate with a 95% interval. */
// @spec WIT-011
export function chapman(n1: number, n2: number, m: number): { n: number; lo: number; hi: number } {
  if (![n1, n2, m].every((v) => Number.isInteger(v) && v >= 0) || m > Math.min(n1, n2)) {
    throw new RangeError('chapman needs non-negative integers with m <= min(n1, n2)');
  }
  const n = ((n1 + 1) * (n2 + 1)) / (m + 1) - 1;
  const sd = Math.sqrt(((n1 + 1) * (n2 + 1) * (n1 - m) * (n2 - m)) / ((m + 1) ** 2 * (m + 2)));
  return { n, lo: Math.max(n - 1.96 * sd, n1 + n2 - m), hi: n + 1.96 * sd };
}
