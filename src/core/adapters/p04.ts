// p04 water (design: docs/intent/adapters/evidence/evidence-design.md, "p04: water"). Constants: docs/params.md.
import type { Adapter, WaterQuality } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { createDetector } from '../witness/detector.ts';
import { createWitness } from '../witness/witness.ts';
import { BASELINE, outlet, tapDelay, unsafe } from '../world/water/water.ts';
import type { Policy } from './shared.ts';

export const NOTIFY = 600; // s, HOLD WATER notify delay
const MAX_DELAY = tapDelay(3); // s, the longest pipe
const SAMPLE_AT = 6 * 3600; // s, the Directorate's daily grab sample at 06:00
const DAY = 86400;
const LEVELS = [1, 2, 3, 4, 5, 6];
const CHANNELS = ['cond', 'toc', 'turb', 'biocide'] as const;

/** The first time `at + k × period` (k whole) at or after `t`. */
const next = (t: number, at: number, period: number) => at + period * Math.ceil((t - at) / period);

export function createP04(policy: Policy, script: Script): Adapter {
  let s: {
    witness: ReturnType<typeof createWitness>;
    detector: ReturnType<typeof createDetector>;
    history: { t: number; out: WaterQuality[] }[]; // outlets by level index, oldest first
    pending: { due: number; i: number; q: WaterQuality }[]; // grab samples at the lab
    official: boolean[]; // per level index
    holdFrom: (number | undefined)[]; // detector hold start per level index, undefined when no hold
  } | undefined;
  let drunk = 0; // person-h

  return {
    id: 'p04',
    reads: ['sectors'],
    writes: ['sectors', 'ledger'],
    // @spec ADAPT-EVIDENCE-001
    step(world, dt, rng) {
      s ??= {
        witness: createWitness({ now: () => world.t, ledger: world.ledger }),
        detector: createDetector(),
        history: [],
        pending: [],
        official: LEVELS.map(() => false),
        holdFrom: LEVELS.map(() => undefined),
      };
      const { t } = world;
      const out = LEVELS.map((l) => outlet(l, t, script.events, rng));

      // @spec ADAPT-EVIDENCE-003, ADAPT-EVIDENCE-004
      const sampled = next(t, SAMPLE_AT, DAY);
      if (sampled < t + dt) out.forEach((q, i) => s!.pending.push({ due: sampled + DAY, i, q }));
      while (s.pending.length && s.pending[0]!.due < t + dt) {
        const p = s.pending.shift()!;
        s.witness.observe('water.toc', `L${p.i + 1}`, p.q.toc, 'official');
        s.official[p.i] = unsafe(p.q);
      }

      // @spec ADAPT-EVIDENCE-002
      if (policy === 'stratum') {
        const hourly = next(t, 0, 3600) < t + dt;
        out.forEach((q, i) => {
          const where = `L${i + 1}`;
          for (const c of CHANNELS) s!.detector.push(`water.${c}`, where, t, q[c]);
          if (hourly) s!.witness.observe('water.toc', where, q.toc, `sensor:${where}`);
          const evs = s!.detector.events.filter((e) => e.where === where);
          const open = evs.filter((e) => e.tEnd === undefined);
          if (open.length) s!.holdFrom[i] ??= Math.min(...open.map((e) => e.tDetect)) + NOTIFY;
          else if (s!.holdFrom[i] !== undefined && t >= Math.max(...evs.map((e) => e.tEnd!)) + MAX_DELAY) s!.holdFrom[i] = undefined;
        });
      }

      s.history.push({ t, out });
      while (s.history.length > 1 && s.history[1]!.t <= t - MAX_DELAY) s.history.shift();
      const taps = [0, 1, 2, 3].map((j) => {
        let h: WaterQuality[] | undefined;
        for (const e of s!.history) if (e.t <= t - tapDelay(j)) h = e.out;
        return h;
      });
      // @spec ADAPT-EVIDENCE-005
      world.sectors.forEach((sec, k) => {
        const i = sec.level - 1;
        sec.water = { ...(taps[k % 4]?.[i] ?? BASELINE) };
        const held = s!.official[i] || (s!.holdFrom[i] !== undefined && t >= s!.holdFrom[i]!);
        if (unsafe(sec.water) && !held) drunk += (sec.people * dt) / 3600;
      });
    },
    metric: () => ({ name: 'person-hours of unsafe water drunk', value: drunk, unit: 'person-h', label: 'SIMULATED' }),
  };
}
