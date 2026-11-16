import type { SurfaceReading } from '../contracts.ts';

const CREWS = 3;
const BAND = 0.25; // of the median

/** Median of each crew's latest reading of `gas`, accepted when at least 3 crews lie within 25% of it. */
// @spec WIT-012
export function quorum(readings: readonly SurfaceReading[], gas: string): { value: number; agreeing: number } | null {
  const latest = new Map<string, SurfaceReading>();
  for (const r of readings) {
    const prev = latest.get(r.crew);
    if (r.gas === gas && (!prev || r.t >= prev.t)) latest.set(r.crew, r);
  }
  const ppm = [...latest.values()].map((r) => r.ppm).sort((a, b) => a - b);
  if (ppm.length < CREWS) return null;
  const value = ppm[Math.floor(ppm.length / 2)]!;
  const agreeing = ppm.filter((p) => Math.abs(p - value) <= BAND * Math.abs(value)).length;
  return agreeing >= CREWS ? { value, agreeing } : null;
}
