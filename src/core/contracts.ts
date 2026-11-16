// Frozen boundary for src/core. Change only with the human's approval .
// Units are in the field comments. No browser APIs here: this compiles for phone, worker and Node.

import type { Rng } from './rng.ts';

/** Where a number came from. Every number shown in a UI carries one. */
export type Label = 'LIVE' | 'REPLAY' | 'SIMULATED';

export type Tier = 'GREEN' | 'AMBER' | 'RED';

export interface WaterQuality {
  cond: number; // conductivity, µS/cm
  toc: number; // total organic carbon, mg/L
  turb: number; // turbidity, NTU
  biocide: number; // iodine, mg/L
}

export interface Sector {
  level: number; // 1 (top) .. 6 (deepest)
  temp: number; // dry-bulb, °C
  wetBulb: number; // °C
  co2: number; // ppm
  water: WaterQuality;
  sumpLevel: number; // fraction of sump capacity, 0..1
  people: number;
  sleepM2: number; // sleeping area per person, m²
  lightDose: number; // melanopic lux-hours this day
  foodKcal: number; // stored food, kcal
  stock: number; // medicine stock, treatment courses
}

export interface TunnelEdge {
  a: number; // node index
  b: number; // node index
  passable: boolean;
}

export interface Household {
  id: string;
  members: number;
  level: number;
  sector: number; // index into World.sectors
  shift: number; // sleep shift, 0..2
}

/** A 25-byte packet v3 as it travels; `at` is arrival time in world seconds. */
export interface MeshMessage {
  at: number;
  bytes: Uint8Array;
}

/** One stored observation: the same quantity as measured by residents and as announced. */
export interface LedgerEntry {
  t: number; // world seconds
  kind: string;
  where: string; // level and sector, never an address
  value: number;
  source: string;
  hash: string; // hex SHA-256 chained to the previous entry
}

export interface SurfaceReading {
  crew: string;
  gas: string;
  ppm: number;
  t: number;
}

export type Allocation = Record<string, number>; // claim id -> share, in the good's own unit

export interface World {
  t: number; // world seconds since scenario start
  seed: number;
  clock: { mode: 'realtime' | 'timelapse'; scale: number }; // scale = world seconds per real second
  grid: { f: number; rocof: number; gapMW: number; tier: Tier }; // f in Hz, rocof in Hz/s
  sectors: Sector[]; // 24 = 6 levels x 4 sectors
  tunnels: { nodes: number; edges: TunnelEdge[] };
  households: Household[];
  ledger: { measured: LedgerEntry[]; official: LedgerEntry[] };
  mesh: { inbox: MeshMessage[]; delivered: MeshMessage[] };
  alloc: {
    power: Allocation;
    water: Allocation;
    food: Allocation;
    cooling: Allocation;
    pumps: Allocation;
    lampHours: Allocation;
    medicine: Allocation;
    bunks: Allocation;
    trialSlots: Allocation;
    returnSlots: Allocation;
  };
  surface: { readings: SurfaceReading[]; band: string };
}

// Engines

export interface Witness {
  observe(kind: string, where: string, value: number, source: string): void;
  /** Measured minus official for this kind, in the kind's own unit. */
  gap(kind: string): number;
}

export interface Mesh {
  send(packet: Uint8Array): void;
  inject(packet: Uint8Array): void;
}

export interface Claim {
  id: string;
  floor: number; // life floor, in the good's unit
  demand: number; // in the good's unit, >= floor
  debt: number; // accumulated shortfall from earlier rounds, used to rotate indivisible goods
}

export type FairShare = (supply: number, claims: Claim[]) => Allocation;

// Adapters: one per problem

export type AdapterId =
  | 'p01' | 'p02' | 'p03' | 'p04' | 'p05' | 'p06' | 'p07' | 'p08'
  | 'p09' | 'p10' | 'p11' | 'p12' | 'p13' | 'p14' | 'p15';

export interface Metric {
  name: string;
  value: number;
  unit: string;
  label: Label;
}

export interface Adapter {
  id: AdapterId;
  reads: readonly (keyof World)[];
  writes: readonly (keyof World)[]; // an adapter writes only what it declares here
  step(world: World, dt: number, rng: Rng): void; // dt in world seconds
  metric(world: World): Metric;
}
