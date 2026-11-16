// Shed Ledger: each level's odds of being cut at a tier (design: docs/intent/shed/shed-design.md).
// Pure: the caller supplies every time. No clock, no randomness.
import type { Label, Tier } from '../contracts.ts';
import { TYPES, type Decoded } from '../packet/codec.ts';

export type StressTier = 'AMBER' | 'RED';
export type ShedReport = Pick<Decoded, 'type' | 'payload' | 'minute' | 'keySet' | 'duplicate'>;
export interface CutOdds { p: number; cuts: number; events: number; label: Label }

// Every value below is listed in docs/params.md.
const GRACE_MIN = 10, CONFIRM_SENDERS = 3, LEVELS = 6;
const RANK: Record<Tier, number> = { GREEN: 0, AMBER: 1, RED: 2 };
const WEAK: Record<Label, number> = { LIVE: 0, REPLAY: 1, SIMULATED: 2 };

// @spec SHED-010, SHED-012
export function createShedLedger({ label }: { label: Label }) {
  const badLabel = (l: Label) => !Object.hasOwn(WEAK, l);
  if (badLabel(label)) throw new RangeError(`label ${label}`);
  // Events in start order; end is the first minute after the window, Infinity while open.
  const events: Record<StressTier, { start: number; end: number }[]> = { AMBER: [], RED: [] };
  // shortcut: reports are kept for the object's life; cap them before a phone runs for weeks.
  const reports: { minute: number; level: number; sender: string; off: boolean }[] = [];
  let last: Tier = 'GREEN', lastMs = -Infinity, worst = label;
  const weaken = (l: Label) => { if (WEAK[l] > WEAK[worst]) worst = l; };

  // @spec SHED-001, SHED-002, SHED-003, SHED-011
  function tier(nowMs: number, t: Tier, l: Label = label): void {
    if (!Number.isFinite(nowMs) || nowMs < lastMs || !Object.hasOwn(RANK, t) || badLabel(l)) throw new RangeError(`tier ${t} at ${nowMs}`);
    const m = Math.floor(nowMs / 60000);
    for (const s of ['AMBER', 'RED'] as const) {
      const ev = events[s], cur = ev[ev.length - 1];
      if (RANK[last] < RANK[s] && RANK[t] >= RANK[s]) {
        if (cur && m < cur.end) cur.end = Infinity; // back before the end: same event
        else ev.push({ start: m, end: Infinity });
      } else if (RANK[last] >= RANK[s] && RANK[t] < RANK[s]) cur.end = m + GRACE_MIN;
    }
    last = t;
    lastMs = nowMs;
    weaken(l);
  }

  // @spec SHED-004
  function report(r: ShedReport, l: Label = label): boolean {
    if (badLabel(l)) throw new RangeError(`label ${l}`);
    const { level, flags, member } = r.payload;
    if ((r.type !== TYPES.OK && r.type !== TYPES.REPORT) || r.duplicate) return false;
    if (!Number.isInteger(r.minute) || !Number.isInteger(level) || level < 1 || level > LEVELS) return false;
    reports.push({ minute: r.minute, level, sender: `${member}:${r.keySet}`, off: !(flags & 1) }); // member is numeric, so no collisions
    weaken(l);
    return true;
  }

  // @spec SHED-005, SHED-006, SHED-007, SHED-008, SHED-009
  function odds(level: number, t: StressTier, nowMs: number): CutOdds {
    if (!Number.isInteger(level) || level < 1 || level > LEVELS || !Object.hasOwn(events, t) || !Number.isFinite(nowMs)) {
      throw new RangeError(`odds ${level} ${t} ${nowMs}`);
    }
    const mine = reports.filter((x) => x.level === level);
    const senders = (e: { start: number; end: number }, offOnly: boolean) =>
      new Set(mine.filter((x) => x.minute >= e.start && x.minute < e.end && (x.off || !offOnly)).map((x) => x.sender)).size;
    const seen = events[t].filter((e) => e.end * 60000 <= nowMs && senders(e, false) >= CONFIRM_SENDERS);
    const c = seen.filter((e) => senders(e, true) >= CONFIRM_SENDERS).length;
    return { p: (c + 1) / (seen.length + 2), cuts: c, events: seen.length, label: worst };
  }

  return { tier, report, odds };
}
