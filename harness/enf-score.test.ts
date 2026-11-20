import { describe, expect, it } from 'vitest';
import { createTracker, type Reading } from '../src/core/tracker/tracker.ts';
import { errorsMHz, gateTiers, parseWav, percentile, refHzAt, tiersOf, zeroCrossingHz } from './enf-score.ts';

const wav = (samples: number[], sr: number, channels = 1, bits = 16) => {
  const b = new Uint8Array(44 + 2 * samples.length);
  const v = new DataView(b.buffer);
  const put = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  put(0, 'RIFF'); v.setUint32(4, b.length - 8, true); put(8, 'WAVE');
  put(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2 * channels, true); v.setUint16(32, 2 * channels, true); v.setUint16(34, bits, true);
  put(36, 'data'); v.setUint32(40, 2 * samples.length, true);
  samples.forEach((s, i) => v.setInt16(44 + 2 * i, s, true));
  return b;
};

// A clean 50 Hz-grid reference at 400 Hz sampling (the H1_ref format), frequency fAt(t) in Hz, phase integrated.
const tone = (seconds: number, sr: number, fAt: (t: number) => number) => {
  const x = new Float32Array(seconds * sr);
  let ph = 0.3;
  for (let i = 0; i < x.length; i++) {
    x[i] = 0.5 * Math.sin(ph) + 0.01;
    ph += (2 * Math.PI * fAt(i / sr)) / sr;
  }
  return x;
};

const reading = (t: number, f?: number): Reading => ({ t, f, state: f === undefined ? 'NO_HUM' : 'LIVE', snrDb: 0, label: 'REPLAY' });

describe('ENF-WHU scoring', () => {
  it('decodes 16-bit mono PCM and rejects other formats', () => {
    const { sampleRate, x } = parseWav(wav([0, 16384, -32768], 400));
    expect(sampleRate).toBe(400);
    expect([...x]).toEqual([0, 0.5, -1]);
    expect(() => parseWav(wav([0, 0], 400, 2))).toThrow(/mono/);
    expect(() => parseWav(wav([0], 400, 1, 8))).toThrow(/16-bit/);
    expect(() => parseWav(new Uint8Array(44))).toThrow(/RIFF/);
  });

  it('measures a clean reference tone to well under 1 mHz over 2 s, with a DC offset', () => {
    const x = tone(4, 400, () => 50.0371);
    expect(Math.abs(zeroCrossingHz(x, 400, 0, 800) - 50.0371) * 1000).toBeLessThan(0.5);
    expect(zeroCrossingHz(new Float32Array(800), 400, 0, 800)).toBeNaN();
  });

  it('scores each reading against the reference over the same window, ending at t', () => {
    // Reference steps from 50.00 to 50.10 Hz at 10 s. A reading ending at 9 s sees only 50.00, one ending at 13 s only 50.10.
    const ref = tone(20, 400, (t) => (t < 10 ? 50 : 50.1));
    const e = errorsMHz([reading(9, 50.002), reading(13, 50.095), reading(5), reading(21, 50)], ref, 400, 2, 50);
    expect(e).toHaveLength(2); // NO_HUM and past-the-end readings are not scored
    expect(e[0]).toBeCloseTo(2, 0);
    expect(e[1]).toBeCloseTo(5, 0);
    // 0.5 s after the step the window is mixed, so a half-hop misalignment either way changes the error.
    const [mixed] = errorsMHz([reading(10.5, 50.1)], ref, 400, 2, 50);
    expect(mixed).toBeCloseTo(84.8, 0); // 100 if the window were 0.5 s early, 50.2 if 0.5 s late
  });

  it('leaves out windows where the reference has dropped out', () => {
    const ref = tone(10, 400, () => 50);
    ref.fill(0, 1600, 2400);
    expect(errorsMHz([reading(3, 50), reading(6, 50)], ref, 400, 2, 50)).toHaveLength(1);
    // A finite reference 1.5 Hz off f0 is not the grid either.
    expect(errorsMHz([reading(3, 48.5)], tone(10, 400, () => 48.5), 400, 2, 50)).toHaveLength(0);
  });

  it('replays the tracker tier rule exactly on the frequencies the tracker read, gaps included', () => {
    // 100 Hz tone (h 2 of a 50 Hz grid) at 2 kHz: steady, a 200 mHz sag from 60 s, back by 120 s, a 3 s gap at 140 s.
    const sr = 2000, grid = (t: number) => (t < 60 ? 50 : t < 80 ? 50 - 0.01 * (t - 60) : t < 110 ? 49.8 : t < 120 ? 49.8 + 0.02 * (t - 110) : 50);
    const x = tone(170, sr, (t) => 2 * grid(t));
    x.fill(0, 140 * sr, 143 * sr);
    const rs = createTracker({ sampleRate: sr, f0: 50, h: 2, w: 1.5, label: 'REPLAY' }).push(x);
    const tiers = tiersOf(rs.map((r) => r.f));
    expect(tiers).toEqual(rs.map((r) => r.tier));
    expect(tiers).toContain('AMBER');
    expect(tiers).toContain('RED');
  });

  it('scales every threshold: a 10 mHz dip is GREEN as shipped and AMBER at 50/400', () => {
    const fs = [...Array(100).fill(50), ...Array(20).fill(49.99), ...Array(30).fill(50)];
    expect(tiersOf(fs)).not.toContain('AMBER');
    const scaled = tiersOf(fs, 50 / 400);
    expect(scaled.slice(0, 64)).toEqual([...Array(63).fill(undefined), 'GREEN']); // 4 skipped, 59 calibrating, LIVE at the 60th
    expect(scaled.slice(100, 104)).toEqual(['GREEN', 'GREEN', 'GREEN', 'AMBER']); // median of 5 reaches -10 mHz on the 3rd dip reading, held 2
    // A gap mid-AMBER: 4 readings skipped, then GREEN again with the baseline kept.
    expect(tiersOf([...fs.slice(0, 110), undefined, ...fs.slice(111)], 50 / 400).slice(109, 116)).toEqual(['AMBER', undefined, undefined, undefined, undefined, undefined, 'GREEN']);
  });

  it('measures the reference per reading, undefined past its end or on a dropout', () => {
    const ref = tone(10, 400, () => 50.02);
    expect(refHzAt(4, ref, 400, 2, 50)! - 50.02).toBeCloseTo(0, 3);
    expect(refHzAt(1, ref, 400, 2, 50)).toBeUndefined();
    expect(refHzAt(11, ref, 400, 2, 50)).toBeUndefined();
    expect(refHzAt(4, tone(10, 400, () => 48.5), 400, 2, 50)).toBeUndefined();
  });

  it('gates the shown tier on hum quality: holds the last tier on a weak or jumpy reading, clears on a gap', () => {
    const tiers = [undefined, 'GREEN', 'AMBER', 'AMBER', 'RED', undefined, 'AMBER', 'GREEN'] as const;
    const snr = [0, 30, 15, 30, 30, 0, 15, 30];
    const fs = [undefined, 50, 50, 50, 50.1, undefined, 50, 50];
    // Reading 2 is weak (15 dB < 20): GREEN held. Reading 4 jumps 100 mHz (> 20): AMBER held. After the gap, reading 6 is
    // weak with nothing shown since the gap, so it shows no tier rather than an old one.
    expect(gateTiers([...tiers], snr, fs, 20, 20)).toEqual({ tiers: [undefined, 'GREEN', 'GREEN', 'AMBER', 'AMBER', undefined, undefined, 'GREEN'], held: 3 });
    // An open gate gives back the shipped tiers, including where the previous frequency is unknown.
    expect(gateTiers([...tiers], snr, fs, -Infinity, Infinity)).toEqual({ tiers: [...tiers], held: 0 });
  });

  it('takes nearest-rank percentiles', () => {
    const xs = Array.from({ length: 20 }, (_, i) => 20 - i);
    expect(percentile(xs, 0.5)).toBe(10);
    expect(percentile(xs, 0.95)).toBe(19);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([], 0.5)).toBeNull();
  });
});
