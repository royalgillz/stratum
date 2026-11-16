// Water quality model (design: docs/intent/world/water/water-design.md). Constants: docs/params.md.
import type { WaterQuality } from '../../contracts.ts';
import type { Rng } from '../../rng.ts';
import type { ScenarioEvent } from '../../scenario/types.ts';

export const BASELINE: Readonly<WaterQuality> = Object.freeze({ cond: 150, toc: 0.5, turb: 0.2, biocide: 2.0 });
const NOISE = 0.02; // 1 sd, fraction of baseline
const PIPE_BASE = 60; // min
const PIPE_STEP = 20; // min per sector
const TOC_LIMIT = 3; // mg/L, ISS potable
const IODINE_MIN = 1; // mg/L, bottom of the biocidal range
const CHANNELS = ['cond', 'toc', 'turb', 'biocide'] as const; // draw order

type Contamination = Extract<ScenarioEvent, { type: 'contamination' }>;

function weight(e: Contamination, t: number): number {
  const a = e.atH * 3600;
  const r = e.rampH * 3600;
  if (t < a || t >= a + e.durH * 3600) return 0;
  return t < a + r ? (t - a) / r : 1; // a zero ramp never takes the first branch
}

// @spec WORLD-WATER-001, WORLD-WATER-002, WORLD-WATER-003, WORLD-WATER-006
export function outlet(level: number, t: number, events: readonly ScenarioEvent[], rng: Rng): WaterQuality {
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new RangeError(`invalid level ${level}`);
  if (!Number.isFinite(t)) throw new RangeError(`invalid t ${t}`);
  const cs = events.filter((e): e is Contamination => e.type === 'contamination');
  for (const e of cs) {
    // negated comparisons so NaN fails too; rampH <= durH also rejects a negative or NaN durH
    if (!Number.isFinite(e.atH) || !(e.rampH >= 0) || !(e.rampH <= e.durH)) {
      throw new RangeError(`invalid contamination timing at ${e.atH} h`);
    }
    if (!CHANNELS.every((c) => Number.isFinite(e.delta[c]))) throw new RangeError(`invalid contamination delta at ${e.atH} h`);
  }
  const q = { ...BASELINE };
  for (const c of CHANNELS) {
    const u1 = rng();
    const u2 = rng();
    const noise = NOISE * BASELINE[c] * Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
    const shift = cs.reduce((s, e) => (e.level === level ? s + weight(e, t) * e.delta[c] : s), 0);
    q[c] = Math.max(0, BASELINE[c] + shift + noise);
  }
  return q;
}

/** Pipe travel from the level's recycler to the tap in `sector` (0..3), in seconds. */
// @spec WORLD-WATER-004, WORLD-WATER-006
export function tapDelay(sector: number): number {
  if (!Number.isInteger(sector) || sector < 0 || sector > 3) throw new RangeError(`invalid sector ${sector}`);
  return (PIPE_BASE + PIPE_STEP * sector) * 60;
}

// @spec WORLD-WATER-005
export function unsafe(q: WaterQuality): boolean {
  return q.toc > TOC_LIMIT || q.biocide < IODINE_MIN;
}
