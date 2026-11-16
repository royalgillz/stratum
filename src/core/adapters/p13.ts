// p13 surface truth (design: docs/intent/adapters/surface/surface-design.md, "p13: surface truth"). Constants: docs/params.md.
import type { Adapter, SurfaceReading } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { quorum } from '../witness/quorum.ts';
import { createWitness } from '../witness/witness.ts';
import { bandOf, crewRead, GASES, READ_EVERY, type Campaign, type Conc } from '../world/surface/surface.ts';
import type { Policy } from './shared.ts';

export const BANDS = ['open', 'mask', 'suit', 'sealed', 'closed']; // index = band index
export const OFFICIAL = 'sealed'; // the Directorate's verdict

/** A reading round: campaign index in start order, the campaign, reading time in world seconds. */
export interface Round { c: number; e: Campaign; r: number }

/** Every reading round of the script, in time order (ADAPT-SURFACE specs, preamble). */
export function rounds(script: Script): Round[] {
  // A stable sort keeps script order on a tie, so the later campaign runs, as in surfaceAt.
  const cs = script.events.filter((e): e is Campaign => e.type === 'surface').sort((a, b) => a.atH - b.atH);
  const out: Round[] = [];
  cs.forEach((e, c) => {
    const stop = Math.min(c + 1 < cs.length ? cs[c + 1]!.atH * 3600 : Infinity, script.days * 86400);
    for (let k = 0, r = e.atH * 3600; r < stop; r = e.atH * 3600 + ++k * READ_EVERY * 3600) out.push({ c, e, r });
  });
  return out;
}

/** The quorum value of each gas over campaign `e`'s readings up to round time `r`, or null when a gas has none. */
export function measured(readings: readonly SurfaceReading[], e: Campaign, r: number): Conc | null {
  const mine = readings.filter((x) => x.t >= e.atH * 3600 && x.t <= r);
  const v = { co: 0, o3: 0, so2: 0 };
  for (const g of GASES) {
    const q = quorum(mine, g);
    if (!q) return null;
    v[g] = q.value;
  }
  return v;
}

export function createP13(policy: Policy, script: Script): Adapter {
  const rs = rounds(script);
  let witness: ReturnType<typeof createWitness> | undefined;
  let done = 0, wrong = 0; // rounds processed, and those after which the band was wrong

  return {
    id: 'p13',
    reads: ['surface'],
    writes: ['surface', 'ledger'],
    // @spec ADAPT-SURFACE-001, ADAPT-SURFACE-002, ADAPT-SURFACE-003
    step(world, _dt, rng) {
      const { surface } = world;
      if (!witness) {
        witness = createWitness({ now: () => world.t, ledger: world.ledger });
        if (policy === 'directorate') surface.band = OFFICIAL;
      }
      for (; done < rs.length && rs[done]!.r <= world.t; done++) {
        const { e, r } = rs[done]!;
        witness.observe('surface.band', 'surface', BANDS.indexOf(OFFICIAL), 'official');
        if (policy === 'stratum') {
          for (const x of crewRead(e, r, rng)) {
            surface.readings.push(x);
            witness.observe(`surface.${x.gas}`, 'surface', x.ppm, `crew:${x.crew}`);
          }
          const v = measured(surface.readings, e, r);
          surface.band = v ? bandOf(v) : 'unknown';
          if (v) witness.observe('surface.band', 'surface', BANDS.indexOf(surface.band), 'estimate:quorum');
        }
        // @spec ADAPT-SURFACE-004
        if (surface.band !== bandOf(e)) wrong++;
      }
    },
    metric: () => ({ name: 'wrong-band rate', value: done ? wrong / done : 0, unit: 'share', label: 'SIMULATED' }),
  };
}
