// Goertzel power of the windowed block xw at frequency f.
function power(xw: Float32Array, f: number, sr: number): number {
  const c = 2 * Math.cos((2 * Math.PI * f) / sr);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < xw.length; i++) {
    const s = xw[i] + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}

const argmax = (a: number[]) => a.reduce((best, v, i) => (v > a[best] ? i : best), 0);

// Strongest tone in [lo, hi] Hz: coarse bank (0.25 Hz), fine bank (0.02 Hz), parabola on log power.
// snrDb = peak over the median of the coarse bank.
export function track(x: Float32Array, sr: number, lo: number, hi: number) {
  const n = x.length;
  const xw = new Float32Array(n);
  for (let i = 0; i < n; i++) xw[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

  const coarse: number[] = [];
  for (let k = 0; lo + k * 0.25 <= hi + 1e-9; k++) coarse.push(power(xw, lo + k * 0.25, sr));
  const fc = lo + argmax(coarse) * 0.25;

  const fine: number[] = []; // fc +/- 0.16 Hz covers half a coarse step
  for (let k = -8; k <= 8; k++) fine.push(power(xw, fc + k * 0.02, sr));
  const j = Math.min(15, Math.max(1, argmax(fine)));
  const [a, b, c] = [fine[j - 1], fine[j], fine[j + 1]].map(Math.log);
  const p = (0.5 * (a - c)) / (a - 2 * b + c);
  const f = fc + (j - 8 + p) * 0.02;

  const median = [...coarse].sort((u, v) => u - v)[coarse.length >> 1];
  return { f, snrDb: 10 * Math.log10(fine[j] / median) };
}
