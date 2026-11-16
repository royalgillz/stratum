// Checks a scenario script before a run (design: docs/intent/scenario/scenario-design.md, "Script").
import type { Script } from './types.ts';

/** Tracked households per sector; the generated ids are h<s>-<n> for n below this. */
export const HH_PER_SECTOR = 10;

const SECTORS = 24;

type Check = (v: number) => boolean;
const any: Check = () => true;
const nonNeg: Check = (v) => v >= 0;
const fraction: Check = (v) => v >= 0 && v <= 1;
const int = (lo: number, hi: number): Check => (v) => Number.isInteger(v) && v >= lo && v <= hi;
const level = int(1, 6);
const sector = int(0, SECTORS - 1);

// Required number fields per event type (atH is checked for every event), with the range each must hold.
const FIELDS: Record<string, Record<string, Check>> = {
  shortfall: { from: fraction, to: fraction, rampH: nonNeg, holdH: nonNeg, recoverH: nonNeg },
  trip: { loss: fraction, durH: nonNeg },
  contamination: { level, rampH: nonNeg, durH: nonNeg },
  flood: { sector, inflowM3h: any, durH: nonNeg },
  outbreak: { sector, cases: any },
  separate: { away: fraction },
  'network-down': { durH: nonNeg },
};
const DELTA = ['cond', 'toc', 'turb', 'biocide'];

/** Throws a RangeError naming `field` unless `v` is a finite number that passes `ok`. */
function num(field: string, v: unknown, ok: Check) {
  if (typeof v !== 'number' || !Number.isFinite(v) || !ok(v)) throw new RangeError(`script.${field} is missing or out of range: ${String(v)}`);
}

/** Throws a RangeError naming the first bad field of `script`. */
// @spec SCEN-001
export function validateScript(script: Script): void {
  num('days', script.days, int(1, Infinity));
  const inRun = (v: number) => v >= 0 && v <= script.days * 24;

  const { demo } = script;
  const generated = Array.from({ length: SECTORS * HH_PER_SECTOR }, (_, i) => `h${Math.floor(i / HH_PER_SECTOR)}-${i % HH_PER_SECTOR}`);
  if (typeof demo.id !== 'string' || demo.id === '' || generated.includes(demo.id)) throw new RangeError(`script.demo.id is empty or taken: ${demo.id}`);
  num('demo.level', demo.level, level);
  num('demo.sector', demo.sector, int(0, 3));
  num('demo.members', demo.members, int(1, Infinity));

  if (script.acts.length === 0) throw new RangeError('script.acts[0].atH: the first act must start at 0');
  script.acts.forEach((a, i) => {
    const prev = script.acts[i - 1];
    num(`acts[${i}].atH`, a.atH, (v) => inRun(v) && (prev ? v > prev.atH : v === 0));
    if (a.mode === 'realtime') num(`acts[${i}].scale`, a.scale ?? 1, (v) => v === 1);
    else if (a.mode === 'timelapse') num(`acts[${i}].scale`, a.scale ?? 3600, (v) => v > 0);
    else throw new RangeError(`script.acts[${i}].mode is unknown: ${String(a.mode)}`);
  });

  let separates = 0;
  script.events.forEach((e, i) => {
    const at = `events[${i}]`;
    const fields = FIELDS[e.type];
    if (!fields) throw new RangeError(`script.${at}.type is unknown: ${String(e.type)}`);
    if (e.type === 'separate' && ++separates > 1) throw new RangeError(`script.${at}.type: at most one separate event`);
    num(`${at}.atH`, e.atH, inRun);
    const rec = e as unknown as Record<string, unknown>;
    for (const [k, ok] of Object.entries(fields)) num(`${at}.${k}`, rec[k], ok);
    if (e.type === 'contamination') {
      if (typeof e.delta !== 'object' || e.delta === null) throw new RangeError(`script.${at}.delta is missing`);
      for (const k of DELTA) num(`${at}.delta.${k}`, (e.delta as unknown as Record<string, unknown>)[k], any);
      if (e.rampH > e.durH) throw new RangeError(`script.${at}.rampH is above its durH`);
    }
  });
}
