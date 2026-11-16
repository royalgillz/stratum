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

export type ScenarioEvent =
  | { type: 'shortfall'; atH: number; from: number; to: number; rampH: number; holdH: number; recoverH: number }
  | { type: 'trip'; atH: number; loss: number; durH: number }
  | { type: 'contamination'; atH: number; level: number; rampH: number; durH: number; delta: WaterDelta }
  | { type: 'flood'; atH: number; sector: number; inflowM3h: number; durH: number }
  | { type: 'outbreak'; atH: number; sector: number; cases: number }
  | { type: 'separate'; atH: number; away: number }
  | { type: 'network-down'; atH: number; durH: number };

/** The household the district page's gateway speaks for; `sector` is 0..3 within `level`. */
export interface Demo {
  id: string;
  level: number;
  sector: number;
  members: number;
}

export interface Script {
  name: string;
  days: number;
  demo: Demo;
  acts: Act[];
  events: ScenarioEvent[];
}
