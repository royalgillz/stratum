// Sweeps: one scripted stress varied at a time over the seven-day week, both policies (plan: "Evidence").
// Only the script changes: no model constant moves. Each sweep keeps the metrics its stress reaches, with their beside figures (harness/beside.ts).
// Usage: npm run harness:sweeps -- [--seeds 20] [--out public/evidence/sweeps.json]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import type { AdapterId } from '../src/core/contracts.ts';
import type { Policy } from '../src/core/adapters/shared.ts';
import { runHeadless } from '../src/core/scenario/run.ts';
import { sevenDay } from '../src/core/scenario/seven-day.ts';
import type { ScenarioEvent, Script } from '../src/core/scenario/types.ts';
import { varyScript } from '../src/core/scenario/vary.ts';
import { beside, type Beside } from './beside.ts';
import { finals, type Final } from './summary.ts';

const DEEP_AT = 64; // the hour-64 shortfall: "Level 5 goes dark"

interface Sweep {
  id: string; title: string; stress: string;
  x: { name: string; unit: string; values: number[] };
  metrics: AdapterId[];
  hits(e: ScenarioEvent): boolean;
  set(e: ScenarioEvent, x: number): ScenarioEvent;
}

const SWEEPS: Sweep[] = [
  {
    id: 'lying-crews', title: 'Surface crews that falsify their readings', stress: 'the day-6 surface campaign, 5 crews',
    x: { name: 'falsified crews', unit: 'crews of 5', values: [0, 1, 2, 3, 4, 5] }, metrics: ['p13', 'p14'],
    hits: (e) => e.type === 'surface', set: (e, x) => ({ ...e, falsified: x }),
  },
  {
    id: 'deep-shortfall', title: 'Depth of the deep shortfall', stress: `the hour-${DEEP_AT} shortfall, its deepest point`,
    x: { name: 'deepest shortfall', unit: 'share of capacity', values: [0.1, 0.2, 0.3, 0.5, 0.7] }, metrics: ['p01', 'p02', 'p03', 'p11'],
    hits: (e) => e.type === 'shortfall' && e.atH === DEEP_AT, set: (e, x) => ({ ...e, to: x }),
  },
  {
    id: 'outbreak', title: 'Size of the outbreak seed', stress: 'the hour-6 outbreak, 4 sectors of level 6',
    x: { name: 'cases seeded per sector', unit: 'cases', values: [2, 5, 10, 20, 40] }, metrics: ['p09'],
    hits: (e) => e.type === 'outbreak', set: (e, x) => ({ ...e, cases: x }),
  },
];

// The plan's other sweeps need a model constant changed, not the script, so they are not run.
const SKIPPED = [
  { id: 'grid-inertia', why: 'Grid inertia is the constant H in src/core/world/grid/grid.ts, not a script value.' },
  { id: 'under-reporting', why: 'Clinic and resident capture are the constants CLIN_TOP, CLIN_STEP and P_REPORT in src/core/world/epidemic/epidemic.ts, not script values.' },
];

const { seeds: given = '20', out = 'public/evidence/sweeps.json' } = parseArgs<{ seeds?: string; out?: string }>({ options: { seeds: { type: 'string' }, out: { type: 'string' } } }).values;
if (!/^[1-9]\d*$/.test(given)) {
  console.error('usage: npm run harness:sweeps -- [--seeds <positive integer>] [--out <path>]');
  process.exit(2);
}
const seeds = Array.from({ length: Number(given) }, (_, i) => i + 1);

console.log(`sweeps: seven-day, seeds 1..${seeds.length}`);
const sweeps = SWEEPS.map(({ hits, set, metrics, ...rest }) => ({
  ...rest, metrics,
  points: rest.x.values.map((x) => {
    const t0 = performance.now();
    if (!sevenDay.events.some(hits)) throw new Error(`${rest.id}: no event in the seven-day script to vary`);
    const s: Script = { ...sevenDay, events: sevenDay.events.map((e) => (hits(e) ? set(e, x) : e)) };
    const policies = Object.fromEntries((['directorate', 'stratum'] as Policy[]).map((p) => {
      const extras: Beside[] = [];
      const all = finals(seeds.map((seed) => {
        const { series, world } = runHeadless(s, seed, p, { check: false });
        extras.push(beside(world, varyScript(s, seed), seed, p));
        return series;
      }), extras);
      return [p, Object.fromEntries(metrics.map((id) => [id, all[id]!]))] as [Policy, Partial<Record<AdapterId, Final>>];
    }));
    console.log(`  ${rest.id} ${x}: ${((performance.now() - t0) / 1000).toFixed(0)} s`);
    return { x, policies };
  }),
}));

// No timestamp, so a rerun writes the same bytes.
const evidence = { script: sevenDay.name, days: sevenDay.days, seeds, check: false, generatedBy: 'harness/sweeps.ts', label: 'SIMULATED', sweeps, skipped: SKIPPED };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(evidence) + '\n');
console.log(`wrote ${out}`);
