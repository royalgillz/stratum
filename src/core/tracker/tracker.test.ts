import { describe, expect, it } from 'vitest';
import { rng } from '../rng.ts';
import { createTracker, type Reading } from './tracker.ts';

const SR = 8000; // 800 Hz is well inside Nyquist; keeps the tests fast

/**
 * Phase-continuous hum: grid offset d(t) Hz moves the 400 Hz fundamental and the 800 Hz harmonic.
 * Where d(t) is null the segment is digital silence.
 */
function hum(seconds: number, d: (t: number) => number | null, t0 = 0, f0 = 400): Float32Array {
  const x = new Float32Array(Math.round(seconds * SR));
  const noise = rng(1, `hum-${t0}`);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < x.length; i++) {
    const off = d(t0 + i / SR);
    if (off === null) continue;
    p1 += (2 * Math.PI * (f0 + off)) / SR;
    p2 += (2 * Math.PI * 2 * (f0 + off)) / SR;
    x[i] = 0.15 * Math.sin(p1) + 0.3 * Math.sin(p2) + 0.01 * (noise() * 2 - 1);
  }
  return x;
}

/** Runs a piecewise scenario through one tracker; segments are [seconds, offset or null]. */
function run(segments: [number, number | null][], tracker = createTracker({ sampleRate: SR, label: 'LIVE' })) {
  const out: Reading[] = [];
  let t = 0;
  for (const [s, off] of segments) {
    out.push(...tracker.push(hum(s, () => off, t)));
    t += s;
  }
  return { out, tracker };
}

const live = (rs: Reading[]) => rs.filter((r) => r.tier !== undefined);

describe('tracker', () => {
  // @spec TRACK-001
  it('estimates the grid frequency from the 800 Hz harmonic within 1 mHz, and works for a 50 Hz grid', () => {
    const { out } = run([[10, 0.037]]);
    const hz = out.filter((r) => r.f !== undefined);
    expect(hz.length).toBeGreaterThan(10);
    for (const r of hz) expect(Math.abs(r.f! - 400.037)).toBeLessThan(0.001);

    const enf = createTracker({ sampleRate: SR, f0: 50, w: 1.5, label: 'REPLAY' });
    const rs = enf.push(hum(6, () => 0.021, 0, 50));
    for (const r of rs) expect(Math.abs(r.f! - 50.021)).toBeLessThan(0.001);
  });

  // @spec TRACK-002
  it('defaults to a 400 Hz grid on its 2nd harmonic and rejects a band narrower than ±3 Hz', () => {
    const { out } = run([[3, 0]]);
    expect(out[0].f).toBeCloseTo(400, 2);
    expect(() => createTracker({ sampleRate: SR, w: 1, label: 'LIVE' })).toThrow(RangeError);
    expect(() => createTracker({ sampleRate: SR, f0: 50, w: 1.5, label: 'REPLAY' })).not.toThrow();
  });

  // @spec TRACK-003
  it('emits the first reading at 2 s, then every 0.5 s, the same however samples are split', () => {
    const t = createTracker({ sampleRate: SR, label: 'LIVE' });
    const x = hum(10, () => 0);
    expect(t.push(x.subarray(0, 2 * SR - 1))).toHaveLength(0);
    const rest = t.push(x.subarray(2 * SR - 1));
    expect(rest).toHaveLength(17);
    expect(rest.map((r) => r.t)).toEqual(Array.from({ length: 17 }, (_, i) => 2 + i * 0.5));

    const blocks = createTracker({ sampleRate: SR, label: 'LIVE' });
    const split: Reading[] = [];
    for (let i = 0; i < x.length; i += 128) split.push(...blocks.push(x.subarray(i, i + 128)));
    const whole = createTracker({ sampleRate: SR, label: 'LIVE' }).push(x);
    expect(split).toEqual(whole);
  });

  // @spec TRACK-004
  it('reports NO_HUM for noise, digital silence and a tone outside the band', () => {
    const noise = rng(9, 'noise');
    const n = Float32Array.from({ length: 4 * SR }, () => 0.1 * (noise() * 2 - 1));
    const tone = (f: number) => Float32Array.from({ length: 4 * SR }, (_, i) => 0.3 * Math.sin((2 * Math.PI * f * i) / SR));
    for (const x of [n, new Float32Array(4 * SR), tone(806), tone(812)]) {
      const rs = createTracker({ sampleRate: SR, label: 'LIVE' }).push(x);
      expect(rs.length).toBe(5);
      for (const r of rs) {
        expect(r.state).toBe('NO_HUM');
        expect(r.f).toBeUndefined();
        expect(r.deviationMHz).toBeUndefined();
        expect(r.tier).toBeUndefined();
      }
    }
  });

  // @spec TRACK-005, TRACK-006
  it('skips 4 readings at start, then calibrates on 60 and reports the 60th as LIVE', () => {
    const { out } = run([[40, 0]]);
    const first = out.findIndex((r) => r.state === 'LIVE');
    expect(first).toBe(63); // 4 skipped + 60 counted, zero-based
    expect(out[first].tier).toBe('GREEN');
    expect(out.slice(0, first).every((r) => r.state === 'CALIBRATING')).toBe(true);
  });

  // @spec TRACK-006
  it('keeps calibration readings counted before a NO_HUM gap', () => {
    const { out } = run([[20, 0], [4, null], [40, 0]]);
    const lastGap = out.map((r) => r.state).lastIndexOf('NO_HUM');
    const first = out.findIndex((r) => r.state === 'LIVE');
    expect(lastGap).toBeGreaterThan(0);
    expect(first).toBeLessThan(lastGap + 4 + 60); // a reset would need 60 fresh readings after the gap
  });

  // @spec TRACK-007
  it('reports deviation as a smoothed offset from the reference, in mHz', () => {
    const { out } = run([[35, 0], [8, 0.1]]);
    const end = out.at(-1)!;
    expect(end.deviationMHz).toBeGreaterThan(98);
    expect(end.deviationMHz).toBeLessThan(102);
  });

  // @spec TRACK-008
  it('enters RED at -150 mHz, AMBER at -50 mHz or on a 50 mHz fall, and never for over-frequency', () => {
    const tierAfter = (segments: [number, number | null][]) => live(run(segments).out).at(-1)!.tier;
    expect(tierAfter([[35, 0], [6, -0.2]])).toBe('RED');
    expect(tierAfter([[35, 0], [6, -0.08]])).toBe('AMBER');
    expect(tierAfter([[35, 0], [6, 0.3]])).toBe('GREEN');
    // From +40 to -20 mHz: above -50, but a 60 mHz fall inside 10 s.
    expect(tierAfter([[35, 0], [10, 0.04], [5, -0.02]])).toBe('AMBER');
  }, 30_000); // times out at 5 s when the machine is busy

  // @spec TRACK-009
  it('leaves RED and AMBER only after 20 readings clear of the exit threshold', () => {
    const { out } = run([[35, 0], [6, -0.2], [20, -0.1], [20, 0]]);
    const ls = live(out);
    const firstClear = ls.findIndex((r, i) => i > 0 && ls[i - 1].tier === 'RED' && r.deviationMHz! > -130);
    expect(ls[firstClear + 18].tier).toBe('RED');
    expect(ls[firstClear + 19].tier).toBe('AMBER');
    const firstGreenOk = ls.findIndex((r, i) => i > firstClear + 19 && r.deviationMHz! > -30);
    expect(ls[firstGreenOk + 18].tier).toBe('AMBER');
    expect(ls[firstGreenOk + 19].tier).toBe('GREEN');
  });

  // @spec TRACK-010
  it('keeps the reference through a NO_HUM gap and restarts the tier at GREEN', () => {
    const { out } = run([[35, 0], [6, -0.2], [4, null], [8, -0.2]]);
    const lastGap = out.map((r) => r.state).lastIndexOf('NO_HUM');
    const after = out.slice(lastGap + 1);
    expect(after.slice(0, 4).every((r) => r.state === 'LIVE' && r.tier === undefined)).toBe(true);
    expect(after[4].tier).toBe('GREEN');
    expect(after.at(-1)!.tier).toBe('RED');
    expect(after.at(-1)!.deviationMHz).toBeLessThan(-190); // same reference, no recalibration
  });

  // @spec TRACK-011
  it('recalibrates on request', () => {
    const { tracker } = run([[35, 0], [6, -0.2]]);
    tracker.recalibrate();
    const next = tracker.push(hum(31, () => -0.2, 41));
    expect(next[0].state).toBe('CALIBRATING');
    expect(next[0].deviationMHz).toBeUndefined();
    const first = next.findIndex((r) => r.state === 'LIVE');
    expect(first).toBe(59);
    expect(Math.abs(next.at(-1)!.deviationMHz!)).toBeLessThan(2);
    expect(next.at(-1)!.tier).toBe('GREEN');
  });

  // @spec TRACK-012
  it('carries t, state, snr and label on every reading, and f, deviation and tier only where defined', () => {
    const tr = createTracker({ sampleRate: SR, label: 'SIMULATED' });
    const { out } = run([[3, null], [40, 0]], tr);
    for (const r of out) {
      expect(r.label).toBe('SIMULATED');
      expect(typeof r.t).toBe('number');
      expect(typeof r.snrDb).toBe('number');
      if (r.state === 'NO_HUM') expect(r.f).toBeUndefined();
      else expect(r.f).toBeGreaterThan(399);
      if (r.state !== 'LIVE') expect(r.deviationMHz ?? r.tier).toBeUndefined();
    }
    expect(out[0].t).toBe(2);
  });
});
