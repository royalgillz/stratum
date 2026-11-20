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

/**
 * Hum-quality gate on the shown tier (an experiment for harness/enf.ts, not in the phone): a reading may change the shown
 * tier only when its SNR is at least minSnrDb and its frequency moved at most maxStepMHz since the previous reading (an
 * unknown step passes); otherwise the last shown tier is held. A gap (undefined tier) clears it, so nothing is held across
 * NO HUM, and a closed gate before any tier is shown shows none. held counts readings with a tier whose update was withheld.
 */
export function gateTiers(tiers: (Tier | undefined)[], snrDb: number[], fs: (number | undefined)[], minSnrDb: number, maxStepMHz: number): { tiers: (Tier | undefined)[]; held: number } {
  let shown: Tier | undefined, held = 0;
  const out = tiers.map((t, i) => {
    if (t === undefined) return (shown = undefined);
    const step = Math.abs(((fs[i] ?? NaN) - (fs[i - 1] ?? NaN)) * 1000);
    if (snrDb[i] >= minSnrDb && !(step > maxStepMHz)) return (shown = t);
    held++;
    return shown;
  });
  return { tiers: out, held };
}

/** Tier comparison counts for harness/enf.ts; see the comment on its `tiers` evidence field. */
export type Counts = { compared: number; refGreen: number; falseAlarm: number; refAlert: number; missed: number; trackerEntries: number; falseEntries: number; refOwnAlert: number };
export const alert = (t: string | undefined) => t === 'AMBER' || t === 'RED';
export function countTiers(tk: (Tier | undefined)[], rm: (Tier | undefined)[], refOwnAlert = 0): Counts {
  const c: Counts = { compared: 0, refGreen: 0, falseAlarm: 0, refAlert: 0, missed: 0, trackerEntries: 0, falseEntries: 0, refOwnAlert };
  tk.forEach((t, i) => {
    if (alert(t) && tk[i - 1] === 'GREEN') { c.trackerEntries++; if (rm[i] === 'GREEN') c.falseEntries++; }
    if (t === undefined || rm[i] === undefined) return;
    c.compared++;
    if (rm[i] === 'GREEN') { c.refGreen++; if (alert(t)) c.falseAlarm++; }
    else { c.refAlert++; if (t === 'GREEN') c.missed++; }
  });
  return c;
}

/** One recording for the gate experiment: tracker frequencies and SNR, the shipped tiers, and the reference's tiers. */
export type GateClip = { id: string; fs: (number | undefined)[]; snr: number[]; tk: (Tier | undefined)[]; rm: (Tier | undefined)[] };
const share3 = (part: number, whole: number) => Math.round((part / whole) * 1000) / 1000;

/**
 * Shipped tiers (open gate: minSnrDb -Infinity, maxStepMHz Infinity) or gated tiers scored against the reference. A reading
 * where the tracker had a tier but the gate shows none counts as no warning (GREEN), so shipped and gated are scored on
 * the same readings and a sag the gate hides counts as missed.
 */
export function gateScore(clips: GateClip[], minSnrDb: number, maxStepMHz: number, hopS: number) {
  let held = 0, withTier = 0;
  const cs = clips.map((c) => {
    const g = gateTiers(c.tk, c.snr, c.fs, minSnrDb, maxStepMHz);
    held += g.held;
    withTier += c.tk.filter((t) => t !== undefined).length;
    return countTiers(g.tiers.map((t, i) => (c.tk[i] === undefined ? undefined : (t ?? 'GREEN'))), c.rm);
  });
  const sum = (f: keyof Counts) => cs.reduce((s, r) => s + r[f], 0);
  const hours = (sum('compared') * hopS) / 3600;
  return {
    compared: sum('compared'), comparedHours: Math.round(hours * 100) / 100,
    refGreen: sum('refGreen'), falseAlarm: sum('falseAlarm'), falseAlarmShare: share3(sum('falseAlarm'), sum('refGreen')),
    refAlert: sum('refAlert'), missed: sum('missed'), missShare: sum('refAlert') ? share3(sum('missed'), sum('refAlert')) : null,
    falseEntries: sum('falseEntries'), falseEntriesPerHour: round1(sum('falseEntries') / hours),
    withTier, held, heldShare: share3(held, withTier),
    clipsRefAlertCompared: cs.filter((c) => c.refAlert > 0).length,
  };
}

/**
 * The gate experiment (not shipped): thresholds chosen on odd-numbered recordings, reported on even-numbered ones.
 * Selection: lowest false warnings an hour on the odd half with its miss share at most 2 points above the shipped
 * tracker's there, ties to fewer readings held. 13 dB is the tracker's own NO HUM floor, so 13 means no SNR gate;
 * maxStepMHz Infinity (null in JSON) means no step limit.
 */
export function gateExperimentOf(clips: GateClip[], hopS: number) {
  const GATE_SNR = Array.from({ length: 28 }, (_, i) => 13 + i), GATE_STEP = [Infinity, 50, 30, 20, 12, 8, 5, 3, 2];
  const train = clips.filter((c) => Number(c.id) % 2 === 1), test = clips.filter((c) => Number(c.id) % 2 === 0);
  const trainShipped = gateScore(train, -Infinity, Infinity, hopS);
  const chosen = GATE_SNR.flatMap((minSnrDb) => GATE_STEP.map((maxStepMHz) => ({ minSnrDb, maxStepMHz, train: gateScore(train, minSnrDb, maxStepMHz, hopS) })))
    .filter((g) => (g.train.missShare ?? 0) <= (trainShipped.missShare ?? 0) + 0.02)
    .sort((a, b) => a.train.falseEntriesPerHour! - b.train.falseEntriesPerHour! || a.train.heldShare - b.train.heldShare)[0];
  return {
    shipped: false,
    rule: 'a reading may change the shown tier only if its SNR is at least minSnrDb and its frequency moved at most maxStepMHz since the previous reading; otherwise the last shown tier is held (NO HUM gaps clear it). A reading the gate leaves with no tier is scored as no warning',
    split: { train: 'odd recording ids', test: 'even recording ids', trainClips: train.length, testClips: test.length },
    grid: { minSnrDb: GATE_SNR, maxStepMHz: GATE_STEP },
    selection: 'lowest false warnings an hour on the train half, with its miss share at most 0.02 above the shipped tracker on the train half; ties to fewer readings held',
    chosen: { minSnrDb: chosen.minSnrDb, maxStepMHz: chosen.maxStepMHz },
    train: { shipped: trainShipped, gated: chosen.train },
    test: { shipped: gateScore(test, -Infinity, Infinity, hopS), gated: gateScore(test, chosen.minSnrDb, chosen.maxStepMHz, hopS) },
  };
}

/** Nearest-rank percentile (p in (0, 1]); null for no values. */
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((u, v) => u - v);
  return s[Math.max(0, Math.ceil(p * s.length) - 1)];
}

// 0.1 mHz is far below anything the tracker resolves, and fixed rounding keeps the evidence file byte-stable.
export const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);
