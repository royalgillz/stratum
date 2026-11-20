// Pure parts of the ENF-WHU scoring for harness/enf.ts: WAV decoding, reference frequency, time alignment, error statistics.
import type { Tier } from '../src/core/contracts.ts';
import type { Reading } from '../src/core/tracker/tracker.ts';

/** Decodes a 16-bit mono PCM WAV, the only format in ENF-WHU; anything else is rejected rather than misread. */
export function parseWav(bytes: Uint8Array): { sampleRate: number; x: Float32Array } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a RIFF WAVE file');
  let sampleRate = 0;
  for (let o = 12; o + 8 <= bytes.length; ) {
    const id = tag(o), size = v.getUint32(o + 4, true), body = o + 8;
    if (id === 'fmt ') {
      if (v.getUint16(body, true) !== 1 || v.getUint16(body + 2, true) !== 1 || v.getUint16(body + 14, true) !== 16) throw new Error('only 16-bit mono PCM WAV is supported');
      sampleRate = v.getUint32(body + 4, true);
    } else if (id === 'data') {
      if (!sampleRate) throw new Error('data chunk before fmt chunk');
      const x = new Float32Array(Math.min(size, bytes.length - body) >> 1);
      for (let i = 0; i < x.length; i++) x[i] = v.getInt16(body + 2 * i, true) / 32768;
      return { sampleRate, x };
    }
    o = body + size + (size & 1);
  }
  throw new Error('no data chunk');
}

/**
 * Frequency of a clean tone over x[a, b): rising zero crossings (mean removed), each placed by a cubic through the four
 * samples around it, then the period as the least-squares slope of crossing time against crossing number.
 * Independent of the tracker's estimator on purpose, so the reference does not share its biases. NaN with fewer than two crossings.
 */
export function zeroCrossingHz(x: Float32Array, sr: number, a: number, b: number): number {
  let mean = 0;
  for (let i = a; i < b; i++) mean += x[i];
  mean /= b - a;
  const ts: number[] = [];
  for (let i = a + 2; i + 1 < b; i++) {
    const [y0, y1, y2, y3] = [x[i - 2], x[i - 1], x[i], x[i + 1]].map((y) => y - mean);
    if (!(y1 < 0 && y2 >= 0)) continue;
    // Linear interpolation alone is off by up to 1.3 mHz at 8 samples per cycle; Newton on the cubic brings it under 0.25.
    const cubic = (s: number) => (-y0 * s * (s - 1) * (s - 2) + 3 * y1 * (s + 1) * (s - 1) * (s - 2) - 3 * y2 * (s + 1) * s * (s - 2) + y3 * (s + 1) * s * (s - 1)) / 6;
    let u = y1 / (y1 - y2);
    for (let k = 0; k < 4; k++) u -= (2e-6 * cubic(u)) / (cubic(u + 1e-6) - cubic(u - 1e-6));
    ts.push(i - 1 + u);
  }
  const n = ts.length, tm = ts.reduce((s, t) => s + t, 0) / n;
  let cov = 0, vk = 0;
  ts.forEach((t, k) => { cov += (k - (n - 1) / 2) * (t - tm); vk += (k - (n - 1) / 2) ** 2; });
  return n < 2 ? NaN : (sr * vk) / cov;
}

/**
 * |tracker f - reference f| in mHz for every reading that has a frequency, the reference measured over the same window
 * ([t - winS, t], recording and reference starting together). Readings past the reference's end, or whose reference
 * is not within 1 Hz of f0 (a dropout), are left out.
 */
export function errorsMHz(readings: Reading[], ref: Float32Array, refSr: number, winS: number, f0: number): number[] {
  const out: number[] = [];
  for (const r of readings) {
    if (r.f === undefined) continue;
    const fr = refHzAt(r.t, ref, refSr, winS, f0);
    if (fr !== undefined) out.push(Math.abs(r.f - fr) * 1000);
  }
  return out;
}

/** Reference grid frequency over [t - winS, t]; undefined past the reference's end or on a dropout (not within 1 Hz of f0). */
export function refHzAt(t: number, ref: Float32Array, refSr: number, winS: number, f0: number): number | undefined {
  const a = Math.round((t - winS) * refSr), b = Math.round(t * refSr);
  if (a < 0 || b > ref.length) return undefined;
  const fr = zeroCrossingHz(ref, refSr, a, b);
  return Math.abs(fr - f0) <= 1 ? fr : undefined;
}

/**
 * The tracker's tier rule (src/core/tracker/tracker.ts, docs/intent/tracker/tracker-design.md) replayed on a series of
 * per-reading frequencies in Hz, undefined meaning NO HUM: 4 readings skipped after a gap, a 60-reading median baseline,
 * median-of-5 smoothing, the 10 s fall and the hold counts. Every mHz threshold is multiplied by scale. With scale 1 it
 * gives exactly the tracker's own tiers on the tracker's own frequencies (harness/enf.ts asserts this on every recording).
 * undefined where the tracker reports no tier.
 */
export function tiersOf(fs: (number | undefined)[], scale = 1): (Tier | undefined)[] {
  const [RED_IN, RED_OUT, AMBER_IN, AMBER_OUT, FALL] = [-150, -130, -50, -30, 50].map((m) => m * scale);
  const median = (a: number[]) => [...a].sort((u, v) => u - v)[a.length >> 1];
  let skip = 4, cal: number[] = [], base: number | null = null;
  let smooth: number[] = [], hist: number[] = [], tier: Tier = 'GREEN';
  let redIn = 0, amberIn = 0, redOut = 0, amberOut = 0;
  const clear = () => { smooth = []; hist = []; tier = 'GREEN'; redIn = amberIn = redOut = amberOut = 0; };
  return fs.map((f) => {
    if (f === undefined) { skip = 4; clear(); return undefined; }
    if (skip > 0) { skip--; return undefined; }
    if (base === null) {
      cal.push(f);
      if (cal.length < 60) return undefined;
      base = median(cal);
      clear();
    }
    smooth = [...smooth, f].slice(-5);
    const dev = (median(smooth) - base) * 1000;
    hist = [...hist, dev].slice(-20);
    const fall = Math.max(...hist) - dev;
    redIn = dev <= RED_IN ? redIn + 1 : 0;
    amberIn = dev <= AMBER_IN || fall >= FALL ? amberIn + 1 : 0;
    redOut = dev > RED_OUT ? redOut + 1 : 0;
    amberOut = dev > AMBER_OUT && fall < FALL ? amberOut + 1 : 0;
    if (redIn >= 2) tier = 'RED';
    else if (tier === 'GREEN' && amberIn >= 2) tier = 'AMBER';
    else if (tier === 'RED' && redOut >= 20) tier = 'AMBER';
    else if (tier === 'AMBER' && amberOut >= 20) tier = 'GREEN';
    return tier;
  });
}

/** Nearest-rank percentile (p in (0, 1]); null for no values. */
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((u, v) => u - v);
  return s[Math.max(0, Math.ceil(p * s.length) - 1)];
}

// 0.1 mHz is far below anything the tracker resolves, and fixed rounding keeps the evidence file byte-stable.
export const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);
