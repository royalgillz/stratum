// Pure statistics and the evidence JSON shape for harness/run.ts (plan: "Harness", "Evidence").
import type { AdapterId, Label } from '../src/core/contracts.ts';
import type { Policy } from '../src/core/adapters/shared.ts';
import type { Series } from '../src/core/scenario/run.ts';
import type { Beside } from './beside.ts';

export interface Summary {
  name: string;
  unit: string;
  label: Label;
  final: { mean: number; lo: number; hi: number; values: number[] };
  hourly: { t: number[]; mean: number[] };
  // Figures the designs report beside the metric (harness/beside.ts), final value per seed; absent for most adapters.
  beside?: Record<string, { name: string; unit: string; mean: number; lo: number; hi: number; values: number[] }>;
}

export interface Evidence {
  script: string;
  days: number;
  seeds: number[];
  check: boolean;
  generatedBy: 'harness/run.ts';
  label: 'SIMULATED';
  policies: Record<Policy, Partial<Record<AdapterId, Summary>>>;
}

// Two-sided 95% Student t critical values, df 1..30 (standard tables).
const T95 = [12.7062, 4.3027, 3.1824, 2.7764, 2.5706, 2.4469, 2.3646, 2.306, 2.2622, 2.2281, 2.201, 2.1788, 2.1604, 2.1448, 2.1314,
  2.1199, 2.1098, 2.1009, 2.093, 2.086, 2.0796, 2.0739, 2.0687, 2.0639, 2.0595, 2.0555, 2.0518, 2.0484, 2.0452, 2.0423];

export function t95(df: number): number {
  if (df <= T95.length) return T95[df - 1]!;
  // Cornish-Fisher expansion around z; within 1e-4 of the table beyond df 30.
  const z = 1.959964;
  return z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df ** 2);
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// 95% interval of the mean; with one value there is no spread to estimate, so lo = hi = mean.
export function interval(xs: number[]): { mean: number; lo: number; hi: number } {
  const m = mean(xs);
  const n = xs.length;
  if (n < 2) return { mean: m, lo: m, hi: m };
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1));
  const half = (t95(n - 1) * sd) / Math.sqrt(n);
  return { mean: m, lo: m - half, hi: m + half };
}

// runs: one series map per seed, all from the same script and policy, so every seed has the same ids and sample times.
// extras: the beside figures of each run, in the same order, with the same keys on every seed.
export function summarise(runs: Partial<Record<AdapterId, Series>>[], extras: Beside[] = []): Partial<Record<AdapterId, Summary>> {
  const out: Partial<Record<AdapterId, Summary>> = {};
  for (const id of Object.keys(runs[0] ?? {}).sort() as AdapterId[]) {
    const all = runs.map((r) => r[id]!);
    const { name, unit, label, t } = all[0]!;
    const values = all.map((s) => s.value[s.value.length - 1]!);
    const sum: Summary = (out[id] = { name, unit, label, final: { ...interval(values), values }, hourly: { t, mean: t.map((_, i) => mean(all.map((s) => s.value[i]!))) } });
    const keys = extras[0]?.[id];
    if (keys) {
      sum.beside = Object.fromEntries(Object.entries(keys).map(([k, { name, unit }]) => {
        const vs = extras.map((e) => e[id]![k]!.value);
        return [k, { name, unit, ...interval(vs), values: vs }];
      }));
    }
  }
  return out;
}
