import { TYPES, type Decoded } from '../packet/codec.ts';

/** Different senders at which a public claim counts as confirmed (member bytes can be forged, so this is a floor, not proof). */
export const CONFIRM = 3;

export interface TallyRow {
  type: number; code: number; level: number; sector: number;
  packets: number; senders: number; people: number; newest: number; confirmed: boolean;
}

const REPORTED = new Set<number>([TYPES.REPORT, TYPES.HOLD_WATER, TYPES.ROUTE]);

/** Every report packet heard, one row per claim and place: how many packets, from how many senders, newest first. */
// @spec TALLY-001, TALLY-002, TALLY-003, TALLY-004
export function tally(heard: readonly Pick<Decoded, 'type' | 'payload' | 'minute' | 'duplicate'>[]): TallyRow[] {
  const rows = new Map<string, { row: TallyRow; latest: Map<number, { minute: number; value: number }> }>();
  for (const d of heard) {
    if (d.duplicate || !REPORTED.has(d.type)) continue;
    const { member, code, level, sector, value } = d.payload, key = `${d.type}:${code}:${level}:${sector}`;
    const r = rows.get(key) ?? { row: { type: d.type, code, level, sector, packets: 0, senders: 0, people: 0, newest: d.minute, confirmed: false }, latest: new Map() };
    rows.set(key, r);
    r.row.packets++;
    r.row.newest = Math.max(r.row.newest, d.minute);
    const prev = r.latest.get(member);
    if (!prev || d.minute >= prev.minute) r.latest.set(member, { minute: d.minute, value });
  }
  return [...rows.values()]
    .map(({ row, latest }) => {
      const senders = latest.size;
      return { ...row, senders, people: [...latest.values()].reduce((s, x) => s + x.value, 0), confirmed: senders >= CONFIRM };
    })
    .sort((a, b) => b.newest - a.newest || a.type - b.type || a.code - b.code || a.level - b.level || a.sector - b.sector);
}
