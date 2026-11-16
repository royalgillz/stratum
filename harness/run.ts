// Evidence harness: runs District 7 headless over seeds 1..N under both policies and writes the summary as JSON.
// Usage: npm run harness -- --seeds 20 [--days 7] [--script seven-day|stress-week] [--out <path>] [--check]
// Default out: public/evidence/seven-day.json for 7 days, public/evidence/<days>-day.json otherwise, so a 30-day run never overwrites the 7-day file;
// the stress week writes public/evidence/stress-week.json (stress-week-<days>-day.json for other lengths).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import type { Policy } from '../src/core/adapters/shared.ts';
import { runHeadless } from '../src/core/scenario/run.ts';
import { sevenDay } from '../src/core/scenario/seven-day.ts';
import { stressWeek } from '../src/core/scenario/stress-week.ts';
import { varyScript } from '../src/core/scenario/vary.ts';
import { NO_PROOF } from '../src/core/adapters/p14.ts';
import { beside, replayP14, type Beside } from './beside.ts';
import { summarise, type Evidence } from './summary.ts';

const USAGE = 'usage: npm run harness -- --seeds <positive integer> [--days <positive integer>] [--script seven-day|stress-week] [--out <path>] [--check]';
const positive = (s: string) => (/^[1-9]\d*$/.test(s) ? Number(s) : NaN);
const SCRIPTS = { 'seven-day': sevenDay, 'stress-week': stressWeek };

let args: { seeds: string; days: string; script: string; out?: string; check: boolean };
try {
  args = parseArgs<typeof args>({ options: { seeds: { type: 'string', default: '20' }, days: { type: 'string', default: '7' }, script: { type: 'string', default: 'seven-day' }, out: { type: 'string' }, check: { type: 'boolean', default: false } } }).values;
} catch (e) {
  console.error(`${(e as Error).message}\n${USAGE}`);
  process.exit(2);
}
const n = positive(args.seeds);
const days = positive(args.days);
const given = Object.hasOwn(SCRIPTS, args.script) ? SCRIPTS[args.script as keyof typeof SCRIPTS] : undefined;
if (!Number.isSafeInteger(n) || !Number.isSafeInteger(days) || !given) {
  console.error(`bad --seeds ${args.seeds}, --days ${args.days} or --script ${args.script}\n${USAGE}`);
  process.exit(2);
}

const stem = given === sevenDay ? `${days === 7 ? 'seven' : days}-day` : days === 7 ? given.name : `${given.name}-${days}-day`;
const out = args.out ?? `public/evidence/${stem}.json`;
const seeds = Array.from({ length: n }, (_, i) => i + 1);
const script = { ...given, days };
const policies = {} as Evidence['policies'];
console.log(`harness: ${script.name}, ${days} days, seeds 1..${n}, check ${args.check}`);
for (const policy of ['directorate', 'stratum'] as Policy[]) {
  const extras: Beside[] = [];
  policies[policy] = summarise(seeds.map((seed) => {
    const t0 = performance.now();
    const { series, world } = runHeadless(script, seed, policy, { check: args.check });
    const concrete = varyScript(script, seed);
    const b = beside(world, concrete, seed, policy);
    // beside's level waits copy p15's plan: stop if they ever disagree with p15's own metric.
    const worst = Math.max(...Object.values(b.p15!).map((f) => f.value));
    if (Math.abs(worst - series.p15!.value.at(-1)!) > 1e-9) throw new Error(`level waits max ${worst} differs from p15 ${series.p15!.value.at(-1)} (${policy} seed ${seed})`);
    // beside's trial figures come from a replay of p14's plan: stop if its verdict ever disagrees with p14's own metric.
    const proven = replayP14(world, concrete, seed, policy)?.verified || NO_PROOF;
    if (proven !== series.p14!.value.at(-1)) throw new Error(`replayed p14 plan proves ${proven}, p14 reads ${series.p14!.value.at(-1)} (${policy} seed ${seed})`);
    extras.push(b);
    console.log(`  ${policy} seed ${seed}: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    return series;
  }), extras);
}

// No timestamp, so a rerun with the same arguments writes the same bytes.
const evidence: Evidence = { script: script.name, days, seeds, check: args.check, generatedBy: 'harness/run.ts', label: 'SIMULATED', policies };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(evidence) + '\n');
console.log(`wrote ${out}`);
