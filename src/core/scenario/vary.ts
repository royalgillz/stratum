// Seed variation: the concrete script a seed runs (design: docs/intent/scenario/scripts/scripts-design.md, "Seed variation").
import { rng } from '../rng.ts';
import type { Script, ScenarioEvent } from './types.ts';

// The design's table: fields scaled by the size factor and by the duration factor, per event type.
const SIZE: Record<string, readonly string[]> = {
  shortfall: ['from', 'to'], trip: ['loss'], flood: ['inflowM3h'], outbreak: ['cases'], separate: ['away'],
  care: ['red', 'amber'], surface: ['co', 'o3', 'so2', 'bias'],
};
const DURATION: Record<string, readonly string[]> = {
  shortfall: ['rampH', 'holdH', 'recoverH'], trip: ['durH'], contamination: ['rampH', 'durH'], flood: ['durH'],
  'network-down': ['durH'], 'farm-cut': ['durH'], care: ['durH'],
};
const FRACTIONS = new Set(['from', 'to', 'loss', 'away']);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The concrete script for `seed`: unfixed events moved and scaled within `script.vary`. Draws only from rng(seed, 'script'). */
// @spec SCEN-SCRIPT-002, SCEN-SCRIPT-003
export function varyScript(script: Script, seed: number): Script {
  const r = rng(seed, 'script');
  const { vary } = script;
  const events = script.events.map((e): ScenarioEvent => {
    // Three draws per event, fixed or not, so one event's flag never shifts another's draws.
    const u1 = r(), u2 = r(), u3 = r();
    if (!vary || e.fixed === true) return e;
    const size = 1 + (2 * u2 - 1) * vary.scale;
    const dur = 1 + (2 * u3 - 1) * vary.scale;
    const v: Record<string, unknown> = { ...e, atH: clamp(e.atH + (2 * u1 - 1) * vary.shiftH, 0, script.days * 24) };
    const was = e as unknown as Record<string, number>;
    for (const f of SIZE[e.type] ?? []) v[f] = FRACTIONS.has(f) ? clamp(was[f]! * size, 0, 1) : was[f]! * size;
    for (const f of DURATION[e.type] ?? []) v[f] = was[f]! * dur;
    if (e.type === 'outbreak') v.cases = Math.round(e.cases * size);
    if (e.type === 'contamination') v.delta = { cond: e.delta.cond * size, toc: e.delta.toc * size, turb: e.delta.turb * size, biocide: e.delta.biocide * size };
    return v as unknown as ScenarioEvent;
  });
  return { ...script, events };
}
