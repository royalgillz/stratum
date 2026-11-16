// The stress week: built to show where STRATUM loses (design: docs/intent/scenario/scripts/scripts-design.md,
// "The stress week"). Values are SIMULATED inputs, listed in docs/params.md.
import { sevenDay } from './seven-day.ts';
import type { Script } from './types.ts';

// @spec SCEN-SCRIPT-007, SCEN-SCRIPT-008
export const stressWeek: Script = {
  name: 'stress-week',
  days: 7,
  demo: sevenDay.demo,
  acts: [{ atH: 0, mode: 'timelapse', title: 'A week below the floor' }],
  vary: { shiftH: 1, scale: 0.2 },
  events: [
    { type: 'network-down', atH: 0, durH: 168, fixed: true },
    ...[3, 4, 5, 6].map((level) => ({ type: 'farm-cut' as const, atH: 0, level, durH: 168, fixed: true })),
    { type: 'care', atH: 0, durH: 168, red: 12, amber: 24 },
    ...[20, 21, 22, 23].map((sector) => ({ type: 'outbreak' as const, atH: 6, sector, cases: 10, fixed: true })),
    { type: 'shortfall', atH: 12, from: 0.1, to: 0.8, rampH: 2, holdH: 24, recoverH: 2, fixed: true },
    { type: 'flood', atH: 14, sector: 13, inflowM3h: 20, durH: 18 },
    { type: 'surface', atH: 24, co: 1500, o3: 2, so2: 20, crews: 5, falsified: 3, bias: 0.01, fixed: true },
  ],
};
