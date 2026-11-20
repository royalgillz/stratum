// Scenario script types (design: docs/intent/scenario/scenario-design.md, "Script").
// Times are hours from the start; hour 0 is midnight at the start of day 1.

export interface Act {
  atH: number;
  mode: 'realtime' | 'timelapse';
  scale?: number; // timelapse only, default 3600; realtime is always 1
  title: string; // caption on screen
}

export interface WaterDelta {
  cond: number;
  toc: number;
  turb: number;
  biocide: number;
}

/** `fixed: true` keeps an event exactly as written under seed variation (docs/intent/scenario/scripts). */
export type ScenarioEvent = { fixed?: boolean } & (
  | { type: 'shortfall'; atH: number; from: number; to: number; rampH: number; holdH: number; recoverH: number }
  | { type: 'trip'; atH: number; loss: number; durH: number }
  | { type: 'contamination'; atH: number; level: number; rampH: number; durH: number; delta: WaterDelta }
  | { type: 'flood'; atH: number; sector: number; inflowM3h: number; durH: number }
  | { type: 'outbreak'; atH: number; sector: number; cases: number }
  | { type: 'separate'; atH: number; away: number }
  | { type: 'network-down'; atH: number; durH: number }
  | { type: 'farm-cut'; atH: number; level: number; durH: number }
  | { type: 'care'; atH: number; durH: number; red: number; amber: number } // requests per day
  | { type: 'surface'; atH: number; co: number; o3: number; so2: number; crews: number; falsified: number; bias: number } // ppm
);

/** The household the district page's gateway speaks for; `sector` is 0..3 within `level`. */
export interface Demo {
  id: string;
  level: number;
  sector: number;
  members: number;
}

/** A ventilation fan stopped on `level` (1..6) for `durH` hours from `atH`. */
export interface FanStop {
  atH: number;
  level: number;
  durH: number;
}

export interface Script {
  name: string;
  days: number;
  demo: Demo;
  acts: Act[];
  events: ScenarioEvent[];
  vary?: { shiftH: number; scale: number }; // seed variation bounds; absent, the concrete script is the script
  model?: { gridH?: number; capture?: number }; // model constants a sweep changes; absent, the defaults H and capture 1
  fanStops?: FanStop[]; // read only by p01's airUnwarned, never by a world model or the kernel; never varied by seed
}
