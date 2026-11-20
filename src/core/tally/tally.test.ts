import { describe, expect, it } from 'vitest';
import { TYPES } from '../packet/codec.ts';
import { CONFIRM, tally } from './tally.ts';

const pkt = (type: number, member: number, minute: number, o: { code?: number; level?: number; sector?: number; value?: number; duplicate?: boolean } = {}) => ({
  type, minute, duplicate: o.duplicate ?? false,
  payload: { member, code: o.code ?? 0x14, level: o.level ?? 5, sector: o.sector ?? 1, flags: 0, value: o.value ?? 0 },
});

describe('tally', () => {
  // @spec TALLY-001
  it('counts only first hearings of REPORT, HOLD_WATER and ROUTE, one row per type, code, level and sector', () => {
    const rows = tally([
      pkt(TYPES.OK, 1, 10), pkt(TYPES.NEED, 2, 10), pkt(TYPES.LEDGER_HEAD, 3, 10),
      pkt(TYPES.REPORT, 4, 10), pkt(TYPES.REPORT, 4, 11, { duplicate: true }),
      pkt(TYPES.REPORT, 5, 10, { sector: 2 }), pkt(TYPES.HOLD_WATER, 6, 10, { code: 0x30 }), pkt(TYPES.ROUTE, 7, 10, { code: 0x31 }),
    ]);
    expect(rows.map((r) => [r.type, r.code, r.level, r.sector, r.packets])).toEqual([
      [TYPES.REPORT, 0x14, 5, 1, 1], [TYPES.REPORT, 0x14, 5, 2, 1], [TYPES.HOLD_WATER, 0x30, 5, 1, 1], [TYPES.ROUTE, 0x31, 5, 1, 1],
    ]);
    expect(tally([])).toEqual([]);
  });

  // @spec TALLY-002
  it('counts distinct senders, sums each sender\'s latest people count, and keeps the newest minute', () => {
    const [r] = tally([
      pkt(TYPES.REPORT, 9, 20, { code: 0x15, value: 3 }),
      pkt(TYPES.REPORT, 9, 25, { code: 0x15, value: 4 }), // a resend replaces, not adds
      pkt(TYPES.REPORT, 9, 22, { code: 0x15, value: 9 }), // older than 25: not the latest
      pkt(TYPES.REPORT, 8, 21, { code: 0x15, value: 2 }),
      pkt(TYPES.REPORT, 8, 21, { code: 0x15, value: 5 }), // same minute: later in the array wins
    ]);
    expect(r).toMatchObject({ packets: 5, senders: 2, people: 9, newest: 25 });
  });

  // @spec TALLY-003
  it('confirms a row at three different senders, not at three packets from one', () => {
    expect(CONFIRM).toBe(3);
    const one = tally([1, 2, 3].map((m) => pkt(TYPES.REPORT, 7, m)));
    expect(one[0]).toMatchObject({ senders: 1, confirmed: false });
    const two = tally([1, 2].map((m) => pkt(TYPES.REPORT, m, 5)));
    expect(two[0]!.confirmed).toBe(false);
    const three = tally([1, 2, 3].map((m) => pkt(TYPES.REPORT, m, 5)));
    expect(three[0]).toMatchObject({ senders: 3, confirmed: true });
  });

  // @spec TALLY-004
  it('orders rows newest first, then by type, code, level and sector', () => {
    const rows = tally([
      pkt(TYPES.ROUTE, 1, 30, { code: 0x31 }),
      pkt(TYPES.REPORT, 1, 30, { code: 0x13, level: 2, sector: 3 }),
      pkt(TYPES.REPORT, 1, 30, { code: 0x13, level: 2, sector: 0 }),
      pkt(TYPES.REPORT, 1, 30, { code: 0x12, level: 6 }),
      pkt(TYPES.REPORT, 1, 40, { code: 0x15 }),
      pkt(TYPES.REPORT, 1, 10, { code: 0x10 }),
    ]);
    expect(rows.map((r) => `${r.newest}:${r.type}:${r.code}:${r.level}:${r.sector}`)).toEqual([
      `40:2:${0x15}:5:1`, `30:2:${0x12}:6:1`, `30:2:${0x13}:2:0`, `30:2:${0x13}:2:3`, `30:6:${0x31}:5:1`, `10:2:${0x10}:5:1`,
    ]);
  });
});
