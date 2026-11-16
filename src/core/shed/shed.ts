// Shed Ledger: each level's odds of being cut at a tier (design: docs/intent/shed/shed-design.md).
// Pure: the caller supplies every time. No clock, no randomness.
import type { Label, Tier } from '../contracts.ts';
import { TYPES, type Decoded } from '../packet/codec.ts';

export type StressTier = 'AMBER' | 'RED';
export type ShedReport = Pick<Decoded, 'type' | 'payload' | 'minute' | 'keySet' | 'duplicate'>;
export interface CutOdds { p: number; cuts: number; events: number; label: Label }

// Every value below is listed in docs/params.md.
const WINDOW_MIN = 10, CONFIRM_SENDERS = 3, LEVELS = 6;
const RANK: Record<Tier, number> = { GREEN: 0, AMBER: 1, RED: 2 };
const LABELS: readonly Label[] = ['LIVE', 'REPLAY', 'SIMULATED'];

// @spec SHED-010
export function createShedLedger({ label }: { label: Label }) {
  if (!LABELS.includes(label)) throw new RangeError(`label ${label}`);
  const starts: Record<StressTier, number[]> = { AMBER: [], RED: [] }; // event minutes, ascending
  // shortcut: reports are kept for the object's life; cap them before a phone runs for weeks.
  const cuts: { minute: number; level: number; sender: string }[] = [];
  let last: Tier = 'GREEN', lastMs = -Infinity;

  // @spec SHED-001, SHED-002, SHED-003
  function tier(nowMs: number, t: Tier): void {
    if (!Number.isFinite(nowMs) || nowMs < lastMs || !Object.hasOwn(RANK, t)) throw new RangeError(`tier ${t} at ${nowMs}`);
    const m = Math.floor(nowMs / 60000);
    for (const s of ['AMBER', 'RED'] as const) {
      const ev = starts[s];
      if (RANK[last] < RANK[s] && RANK[t] >= RANK[s] && !(ev.length && m - ev[ev.length - 1] < WINDOW_MIN)) ev.push(m);
    }
    last = t;
    lastMs = nowMs;
  }

  // @spec SHED-004
  function report(r: ShedReport): boolean {
    const { level, flags, member } = r.payload;
    if ((r.type !== TYPES.OK && r.type !== TYPES.REPORT) || r.duplicate || flags & 1) return false;
    if (!Number.isInteger(r.minute) || !Number.isInteger(level) || level < 1 || level > LEVELS) return false;
    cuts.push({ minute: r.minute, level, sender: `${member}:${r.keySet}` }); // member is numeric, so no collisions
    return true;
  }

  // @spec SHED-005, SHED-006, SHED-007, SHED-008, SHED-009
  function odds(level: number, t: StressTier, nowMs: number): CutOdds {
    if (!Number.isInteger(level) || level < 1 || level > LEVELS || !Object.hasOwn(starts, t) || !Number.isFinite(nowMs)) {
      throw new RangeError(`odds ${level} ${t} ${nowMs}`);
    }
    const closed = starts[t].filter((m) => (m + WINDOW_MIN) * 60000 <= nowMs);
    const mine = cuts.filter((x) => x.level === level);
    const c = closed.filter((m) => new Set(mine.filter((x) => x.minute >= m && x.minute < m + WINDOW_MIN).map((x) => x.sender)).size >= CONFIRM_SENDERS).length;
    return { p: (c + 1) / (closed.length + 2), cuts: c, events: closed.length, label };
  }

  return { tier, report, odds };
}
