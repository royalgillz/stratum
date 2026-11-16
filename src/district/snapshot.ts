// What the district worker posts to the page: one policy's run, reduced to what the screen draws.
// Pure: no browser APIs, so it is unit-tested in Node. Outside LID scope (reads core, writes nothing).
import type { AdapterId, MeshMessage, Metric, Tier } from '../core/contracts.ts';
import { served } from '../core/adapters/p03.ts';
import { familyBoard, type BoardEntry } from '../core/adapters/p08.ts';
import { powerDemand, sectorId } from '../core/adapters/shared.ts';
import type { Run } from '../core/scenario/run.ts';
import type { Act } from '../core/scenario/types.ts';
import { WB_LIMIT } from '../core/world/airheat/airheat.ts';
import { CAP_MARGIN, capacityAt, swing, tierOf } from '../core/world/grid/grid.ts';
import { RECOVER } from '../core/world/tunnels/tunnels.ts';
import { unsafe } from '../core/world/water/water.ts';

export interface Cell {
  served: number; // power served over demand, 0..1
  wetBulb: number; // deg C
  hot: boolean; // wet-bulb above the heat limit
  sump: number; // sump fill, 0..1
  flooded: boolean;
  unsafe: boolean; // the sector's tap water is unsafe (contamination)
  medicine: boolean; // medicine sent here today: cases are on the list the policy acts on
}

export interface View {
  t: number; // world seconds
  f: number; // grid frequency, Hz, on the audio clock in a REAL TIME act
  tier: Tier;
  cells: Cell[]; // 24, index s = (level - 1) * 4 + sector
  metrics: Partial<Record<AdapterId, Metric>>;
  board: Record<number, BoardEntry>; // the demo household's family board, by member
}

export interface Snapshot {
  seed: number;
  playing: boolean;
  done: boolean;
  act: Act;
  views: { directorate: View; stratum: View };
}

export type ToWorker =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'restart'; seed: number }
  | { type: 'speed'; n: number } // test knob: real seconds count n times over
  | { type: 'inject'; message: MeshMessage };

/** Grid frequency on the audio clock: `t` is the world time it last saw, `sub` the real seconds since that step. */
export interface AudioClock { t: number; sub: number; f: number; tier: Tier }

/**
 * Audio clock (docs/plan.md "Two clocks"): in a REAL TIME act, integrate f at real pace from the supply gap at
 * the current instant, so the hum sags as the act plays instead of once per 60 s world step. Null in a time-lapse,
 * where the world's own f is the reading.
 */
export function audioClock(run: Run, prev: AudioClock | null, realDt: number): AudioClock | null {
  const w = run.kernel.world;
  if (run.act().mode !== 'realtime') return null;
  const c = prev ?? { t: w.t, sub: 0, f: w.grid.f, tier: w.grid.tier };
  if (!(realDt > 0)) return c;
  const sub = Math.max(0, c.sub + realDt - (w.t - c.t)); // scale 1: a world step uses up its 60 real seconds
  const demand = w.sectors.reduce((a, x) => a + powerDemand(x.people), 0);
  const load = Object.values(w.alloc.power).reduce((a, p) => a + p, 0);
  const f = swing(c.f, capacityAt(run.script.events, w.t + sub, CAP_MARGIN * demand), load, realDt).f; // as p01, but at the instant
  return { t: w.t, sub, f, tier: tierOf(f, c.tier) };
}

export function view(run: Run, demoId: string, clock: AudioClock | null = null): View {
  const w = run.kernel.world;
  const edges = w.tunnels.edges;
  return {
    t: w.t,
    f: clock?.f ?? w.grid.f,
    tier: clock?.tier ?? w.grid.tier,
    cells: w.sectors.map((x, s) => ({
      served: served(w.alloc.power[sectorId(s)] ?? 0, powerDemand(x.people)),
      wetBulb: x.wetBulb,
      hot: x.wetBulb > WB_LIMIT,
      sump: x.sumpLevel,
      // p05's flood flag has hysteresis it keeps private: full, or still draining with its tunnels shut
      flooded: x.sumpLevel >= 1 || (x.sumpLevel >= RECOVER && edges.every((e) => (e.a !== s && e.b !== s) || !e.passable)),
      unsafe: unsafe(x.water),
      medicine: (w.alloc.medicine[sectorId(s)] ?? 0) > 0,
    })),
    metrics: run.kernel.metrics(),
    board: familyBoard(w)[demoId] ?? {},
  };
}
