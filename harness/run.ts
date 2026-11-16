// Evidence harness: runs District 7 headless over seeds 1..N under both policies and writes the summary as JSON.
// Usage: npm run harness -- --seeds 20 [--days 7] [--out <path>] [--check]
// Default out: public/evidence/seven-day.json for 7 days, public/evidence/<days>-day.json otherwise, so a 30-day run never overwrites the 7-day file.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import type { Policy } from '../src/core/adapters/shared.ts';
import { runHeadless } from '../src/core/scenario/run.ts';
import { sevenDay } from '../src/core/scenario/seven-day.ts';
import { summarise, type Evidence } from './summary.ts';

const USAGE = 'usage: npm run harness -- --seeds <positive integer> [--days <positive integer>] [--out <path>] [--check]';
const positive = (s: string) => (/^[1-9]\d*$/.test(s) ? Number(s) : NaN);

let args: { seeds: string; days: string; out?: string; check: boolean };
try {
  args = parseArgs<typeof args>({ options: { seeds: { type: 'string', default: '20' }, days: { type: 'string', default: '7' }, out: { type: 'string' }, check: { type: 'boolean', default: false } } }).values;
} catch (e) {
  console.error(`${(e as Error).message}\n${USAGE}`);
  process.exit(2);
}
const n = positive(args.seeds);
const days = positive(args.days);
if (!Number.isSafeInteger(n) || !Number.isSafeInteger(days)) {
  console.error(`bad --seeds ${args.seeds} or --days ${args.days}\n${USAGE}`);
  process.exit(2);
}

const out = args.out ?? `public/evidence/${days === 7 ? 'seven' : days}-day.json`;
const seeds = Array.from({ length: n }, (_, i) => i + 1);
const script = { ...sevenDay, days };
const policies = {} as Evidence['policies'];
console.log(`harness: ${script.name}, ${days} days, seeds 1..${n}, check ${args.check}`);
for (const policy of ['directorate', 'stratum'] as Policy[]) {
  policies[policy] = summarise(seeds.map((seed) => {
    const t0 = performance.now();
    const { series } = runHeadless(script, seed, policy, { check: args.check });
    console.log(`  ${policy} seed ${seed}: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    return series;
  }));
}

// No timestamp, so a rerun with the same arguments writes the same bytes.
const evidence: Evidence = { script: script.name, days, seeds, check: args.check, generatedBy: 'harness/run.ts', label: 'SIMULATED', policies };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(evidence) + '\n');
console.log(`wrote ${out}`);
