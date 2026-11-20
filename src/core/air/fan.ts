// Air watch: says when a steady fan sound stops (problem 1, the air half). Design: docs/intent/air/fan-design.md.
// Pure: the caller passes one fan-band level (dB) with its time in seconds, about 10 times a second.
import type { Label } from '../contracts.ts';

export type FanState = 'LISTENING' | 'RUNNING' | 'STOPPED';
export interface FanReading {
  t: number;
  state: FanState;
  levelDb: number;
  baselineDb: number;
  floorDb: number;
  runningDb: number | null;
  steady: boolean;
  label: Label;
}
export interface FanWatch { push(t: number, level: number): FanReading | null }

const WINDOW_S = 20, BASE_Q = 0.2, STEADY_DB = 4, QUIET_DB = -100, ABOVE_DB = 10, RUN_S = 10;
const REF_S = 10, DROP_DB = 6, RECOVER_S = 5, GAP_S = 2;
// Stop test over the last 3 s: readings louder than R + 3 dB (talk, knocks) say nothing; 70% of the rest must be low, and lows at least 20% of all.
const STOP_WIN_S = 3, LOUD_DB = 3, STOP_FRAC = 0.7, MIN_LOW_FRAC = 0.2;

const pick = (sorted: number[], q: number) => sorted[Math.floor(q * (sorted.length - 1))];

// @spec AIR-FAN-001, AIR-FAN-002, AIR-FAN-003, AIR-FAN-004, AIR-FAN-005, AIR-FAN-006, AIR-FAN-007, AIR-FAN-008, AIR-FAN-009, AIR-FAN-010, AIR-FAN-011
export function createFanWatch({ label }: { label: Label }): FanWatch {
  if (!['LIVE', 'REPLAY', 'SIMULATED'].includes(label)) throw new RangeError(`unknown label ${label}`);
  let state: FanState = 'LISTENING';
  let last = -Infinity, floor = QUIET_DB, running: number | null = null;
  let win: { t: number; level: number }[] = [];
  let steadyB: { t: number; b: number }[] = [];
  // Start time of each unbroken run (null when broken); every run restarts on a change of state.
  let above: number | null = null, back: number | null = null;
  const enter = (s: FanState) => { state = s; above = back = null; };
  const held = (since: number | null, t: number, s: number) => since !== null && t - since >= s;

  return {
    push(t, level) {
      if (!Number.isFinite(t) || t < last) throw new RangeError(`bad time ${t}`);
      if (!Number.isFinite(level)) return null; // digital silence says nothing about the fan
      if (t - last > GAP_S) above = back = null; // readings far apart (a frozen or throttled tab) are not an unbroken run
      last = t;
      win.push({ t, level });

      if (state === 'STOPPED') {
        back = level > running! - DROP_DB ? (back ?? t) : null;
        if (held(back, t, RECOVER_S)) {
          const from = back!;
          enter('RUNNING');
          win = win.filter((x) => x.t >= from); // B and R follow the fan that came back, not the quiet before it
          steadyB = [];
        }
      }

      win = win.filter((x) => x.t > t - WINDOW_S);
      const sorted = win.map((x) => x.level).sort((a, b) => a - b);
      const b = pick(sorted, BASE_Q);
      const steady = pick(sorted, 0.5) - b <= STEADY_DB;
      floor = Math.min(floor, b);
      if (steady) steadyB.push({ t, b });
      steadyB = steadyB.filter((x) => x.t > t - REF_S);

      // R only from 10 s of readings: after a gap, the quiet of a fan that stopped unheard must not become the running level.
      // Written like held() so a 10 s run is always covered, whatever the rounding of t.
      const covered = t - win[0].t >= REF_S;
      if (state !== 'RUNNING') {
        above = steady && b >= floor + ABOVE_DB ? (above ?? t) : null;
        if (held(above, t, RUN_S)) enter('RUNNING');
      }
      if (state === 'RUNNING' && covered && steadyB.length) running = Math.max(...steadyB.map((x) => x.b));
      if (state === 'RUNNING') {
        const recent = win.filter((x) => x.t > t - STOP_WIN_S);
        const lows = recent.filter((x) => x.level <= running! - DROP_DB).length;
        const known = recent.filter((x) => x.level <= running! + LOUD_DB).length;
        if (lows >= STOP_FRAC * known && lows >= MIN_LOW_FRAC * recent.length) enter('STOPPED');
      }
      return { t, state, levelDb: level, baselineDb: b, floorDb: floor, runningDb: running, steady, label };
    },
  };
}
