// District 7's scripted week (design: docs/intent/scenario/scenario-design.md, "The seven-day script").
// Values are SIMULATED inputs, listed in docs/params.md. The 30-day run is { ...sevenDay, days: 30 }.
import type { Script } from './types.ts';

// @spec SCEN-010
export const sevenDay: Script = {
  name: 'seven-day',
  days: 7,
  demo: { id: 'family', level: 5, sector: 1, members: 4 },
  acts: [
    { atH: 0, mode: 'timelapse', title: 'The network is down' },
    { atH: 60, mode: 'realtime', title: 'The hum sags: under a minute of warning, too short to count' },
    { atH: 60 + 90 / 3600, mode: 'timelapse', title: 'The week goes on' },
    { atH: 83.99, mode: 'realtime', title: 'A plant trip gives no warning' },
    { atH: 83.99 + 120 / 3600, mode: 'timelapse', title: 'The week goes on' },
  ],
  events: [
    { type: 'network-down', atH: 0, durH: 168 },
    { type: 'separate', atH: 2, away: 0.3 },
    { type: 'outbreak', atH: 6, sector: 20, cases: 10 },
    { type: 'outbreak', atH: 6, sector: 21, cases: 10 },
    { type: 'outbreak', atH: 6, sector: 22, cases: 10 },
    { type: 'outbreak', atH: 6, sector: 23, cases: 10 },
    { type: 'shortfall', atH: 30, from: 0.04, to: 0.08, rampH: 4, holdH: 6, recoverH: 2 },
    { type: 'contamination', atH: 52, level: 5, rampH: 0.5, durH: 12, delta: { cond: 60, toc: 5, turb: 1.5, biocide: -1.5 } },
    { type: 'shortfall', atH: 60, from: 0.0475, to: 0.0545, rampH: 75 / 3600, holdH: 2, recoverH: 1 },
    { type: 'trip', atH: 84, loss: 0.058, durH: 3 },
    { type: 'shortfall', atH: 100, from: 0.05, to: 0.1, rampH: 1, holdH: 12, recoverH: 2 },
    { type: 'flood', atH: 101, sector: 22, inflowM3h: 15, durH: 10 },
  ],
};
