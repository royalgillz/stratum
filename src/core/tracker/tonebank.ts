// Strongest-tone estimator for the tracker (design: docs/intent/tracker/tracker-design.md § Estimator).

const COARSE = 0.25; // Hz between coarse bins
const FINE = 0.02; // Hz between fine bins
const FINE_HALF = 8; // fine bins each side: ±0.16 Hz covers half a coarse step
const LOBE = 1; // Hz: Hann main-lobe half-width at a 2 s window, excluded from the noise floor
const GUARD = 2; // Hz searched beyond each band edge: a peak there means the tone is outside the band

/** Goertzel power of the windowed block at frequency f. */
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
const median = (a: number[]) => {
  const s = [...a].sort((u, v) => u - v);
  return s[s.length >> 1];
};

export interface Estimate {
  f: number; // tone frequency, Hz
  snrDb: number;
  edge: boolean; // coarse peak in the guard zone: the tone lies outside [lo, hi]
}

/** Strongest tone in [lo, hi] Hz of tone frequency, Hann-windowed. */
export function estimate(x: Float32Array, sr: number, lo: number, hi: number): Estimate {
  const n = x.length;
  const xw = new Float32Array(n);
  for (let i = 0; i < n; i++) xw[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

  const start = lo - GUARD;
  const coarse: number[] = [];
  for (let k = 0; start + k * COARSE <= hi + GUARD + 1e-9; k++) coarse.push(power(xw, start + k * COARSE, sr));
  const kc = argmax(coarse);
  const fc = start + kc * COARSE;

  const fine: number[] = [];
  for (let k = -FINE_HALF; k <= FINE_HALF; k++) fine.push(power(xw, fc + k * FINE, sr));
  const j = Math.min(2 * FINE_HALF - 1, Math.max(1, argmax(fine)));
  const [a, b, c] = [fine[j - 1], fine[j], fine[j + 1]].map(Math.log);
  const den = a - 2 * b + c;
  const p = den === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den));

  const floor = median(coarse.filter((_, k) => Math.abs(k - kc) * COARSE > LOBE));
  return {
    f: fc + (j - FINE_HALF + p) * FINE,
    snrDb: 10 * Math.log10(fine[j] / floor),
    edge: fc < lo - 1e-9 || fc > hi + 1e-9,
  };
}
