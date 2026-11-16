// Grid hum tracker (design: docs/intent/tracker/tracker-design.md). Pure: samples in, readings out.
import type { Label, Tier } from '../contracts.ts';
import { estimate } from './tonebank.ts';

export type TrackerState = 'NO_HUM' | 'CALIBRATING' | 'LIVE';

export interface Reading {
  t: number; // seconds of audio received up to the end of this reading's window
  state: TrackerState;
  snrDb: number;
  label: Label;
  f?: number; // grid frequency, Hz (absent under NO_HUM)
  deviationMHz?: number; // LIVE only
  tier?: Tier; // LIVE only
}

export interface TrackerConfig {
  sampleRate: number;
  f0?: number; // nominal grid frequency, Hz
  h?: number; // harmonic tracked
  w?: number; // band half-width in grid terms, Hz
  label: Label;
}

// Every value below is listed in docs/params.md.
const WIN_S = 2, HOP_S = 0.5, MIN_SNR_DB = 13;
const SKIP = 4, CAL_N = 60, SMOOTH_N = 5, FALL_N = 20;
const ENTER_N = 2, LEAVE_N = 20;
const RED_IN = -150, RED_OUT = -130, AMBER_IN = -50, AMBER_OUT = -30, FALL = 50; // mHz

const median = (a: number[]) => {
  const s = [...a].sort((u, v) => u - v);
  return s[s.length >> 1];
};

// @spec TRACK-001, TRACK-002, TRACK-003, TRACK-004, TRACK-005, TRACK-006, TRACK-007, TRACK-008, TRACK-009, TRACK-010, TRACK-011, TRACK-012
export function createTracker({ sampleRate: sr, f0 = 400, h = 2, w = 2.5, label }: TrackerConfig) {
  if (h * w < 3) throw new RangeError(`band ±${h * w} Hz of tone frequency is narrower than ±3 Hz`);
  const n = Math.round(WIN_S * sr), hop = Math.round(HOP_S * sr);
  const lo = h * (f0 - w), hi = h * (f0 + w);
  const ring = new Float32Array(n);
  let pos = 0, total = 0, due = n;

  let skip = SKIP, cal: number[] = [], ref: number | null = null;
  let smooth: number[] = [], hist: number[] = [], tier: Tier = 'GREEN';
  let redIn = 0, amberIn = 0, redOut = 0, amberOut = 0;
  const clearTrend = () => {
    smooth = []; hist = []; tier = 'GREEN';
    redIn = amberIn = redOut = amberOut = 0;
  };

  function read(): Reading {
    const win = new Float32Array(n);
    win.set(ring.subarray(pos));
    win.set(ring.subarray(0, pos), n - pos);
    const e = estimate(win, sr, lo, hi);
    const f = e.f / h;
    const base = { t: total / sr, snrDb: e.snrDb, label };

    if (!(e.snrDb >= MIN_SNR_DB) || !Number.isFinite(f) || e.edge) {
      skip = SKIP; // the next windows still overlap the gap
      clearTrend();
      return { ...base, state: 'NO_HUM' };
    }
    if (skip > 0) {
      skip--;
      return { ...base, state: ref === null ? 'CALIBRATING' : 'LIVE', f };
    }
    if (ref === null) {
      cal.push(f);
      if (cal.length < CAL_N) return { ...base, state: 'CALIBRATING', f };
      ref = median(cal);
      clearTrend();
    }

    smooth = [...smooth, f].slice(-SMOOTH_N);
    const dev = (median(smooth) - ref) * 1000;
    hist = [...hist, dev].slice(-FALL_N);
    const fall = Math.max(...hist) - dev;

    redIn = dev <= RED_IN ? redIn + 1 : 0;
    amberIn = dev <= AMBER_IN || fall >= FALL ? amberIn + 1 : 0;
    redOut = dev > RED_OUT ? redOut + 1 : 0;
    amberOut = dev > AMBER_OUT && fall < FALL ? amberOut + 1 : 0;
    if (redIn >= ENTER_N) tier = 'RED';
    else if (tier === 'GREEN' && amberIn >= ENTER_N) tier = 'AMBER';
    else if (tier === 'RED' && redOut >= LEAVE_N) tier = 'AMBER';
    else if (tier === 'AMBER' && amberOut >= LEAVE_N) tier = 'GREEN';

    return { ...base, state: 'LIVE', f, deviationMHz: dev, tier };
  }

  return {
    push(samples: Float32Array): Reading[] {
      const out: Reading[] = [];
      for (let i = 0; i < samples.length; i++) {
        ring[pos] = samples[i];
        pos = (pos + 1) % n;
        if (++total === due) {
          out.push(read());
          due += hop;
        }
      }
      return out;
    },
    recalibrate() {
      cal = [];
      ref = null;
      skip = 0;
      clearTrend();
    },
  };
}
