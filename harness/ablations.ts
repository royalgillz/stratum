// Ablations: STRATUM with one engine switched off at a time (plan: "Evidence"; mapping: docs/intent/adapters/adapters-design.md, "Ablations").
// An engine is off when its adapters run the Directorate's rule and every other adapter runs STRATUM's.
// Usage: npm run harness:ablations -- [--seeds 20] [--out public/evidence/ablations.json]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import type { AdapterId } from '../src/core/contracts.ts';
import type { Policy } from '../src/core/adapters/shared.ts';
import { runHeadless } from '../src/core/scenario/run.ts';
import { sevenDay } from '../src/core/scenario/seven-day.ts';
import { finals, paired, type Final } from './summary.ts';

const ENGINES = {
  witness: ['p01', 'p04', 'p09', 'p13', 'p14'],
  mesh: ['p07', 'p08', 'p10'],
  fairShare: ['p02', 'p03', 'p05', 'p06', 'p11', 'p12', 'p15'],
} as const satisfies Record<string, readonly AdapterId[]>;
type Engine = keyof typeof ENGINES;

// The mapping must cover p01 to p15 once each.
const mapped = Object.values(ENGINES).flat().sort();
if (mapped.join() !== Array.from({ length: 15 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`).join()) throw new Error(`engine mapping is not p01..p15 once each: ${mapped}`);

const { seeds: given = '20', out = 'public/evidence/ablations.json' } = parseArgs<{ seeds?: string; out?: string }>({ options: { seeds: { type: 'string' }, out: { type: 'string' } } }).values;
if (!/^[1-9]\d*$/.test(given)) {
  console.error('usage: npm run harness:ablations -- [--seeds <positive integer>] [--out <path>]');
  process.exit(2);
}
const seeds = Array.from({ length: Number(given) }, (_, i) => i + 1);
const CONDITIONS: Record<string, { title: string; policy: Policy; off: Engine | 'all' | null }> = {
  stratum: { title: 'STRATUM', policy: 'stratum', off: null },
  'no-witness': { title: 'STRATUM without Witness', policy: 'stratum', off: 'witness' },
  'no-mesh': { title: 'STRATUM without Mesh', policy: 'stratum', off: 'mesh' },
  'no-fair-share': { title: 'STRATUM without Fair Share', policy: 'stratum', off: 'fairShare' },
  directorate: { title: 'Directorate', policy: 'directorate', off: 'all' },
};
const perOf = (off: Engine | 'all' | null) => (off && off !== 'all' ? Object.fromEntries(ENGINES[off].map((id) => [id, 'directorate' as Policy])) : undefined);

console.log(`ablations: seven-day, seeds 1..${seeds.length}`);
const runs: Record<string, Partial<Record<AdapterId, Final>>> = {};
for (const [id, c] of Object.entries(CONDITIONS)) {
  const t0 = performance.now();
  runs[id] = finals(seeds.map((seed) => runHeadless(sevenDay, seed, c.policy, { check: false, per: perOf(c.off) }).series));
  console.log(`  ${id}: ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}

// What an engine adds: STRATUM minus STRATUM without it, paired by seed (same seed, same script, same streams).
const WITHOUT: Record<Engine, string> = { witness: 'no-witness', mesh: 'no-mesh', fairShare: 'no-fair-share' };
const contribution = Object.fromEntries((Object.keys(ENGINES) as Engine[]).map((e) => [e, Object.fromEntries(
  Object.entries(runs.stratum!).map(([id, s]) => [id, paired(s.final.values, runs[WITHOUT[e]]![id as AdapterId]!.final.values)]),
)]));

// No timestamp, so a rerun writes the same bytes.
const evidence = {
  script: sevenDay.name, days: sevenDay.days, seeds, check: false, generatedBy: 'harness/ablations.ts', label: 'SIMULATED',
  engines: ENGINES,
  conditions: Object.fromEntries(Object.entries(CONDITIONS).map(([id, c]) => [id, { ...c, metrics: runs[id] }])),
  contribution,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(evidence) + '\n');
console.log(`wrote ${out}`);
