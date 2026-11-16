import { describe, expect, it } from 'vitest';
import type { Decoded } from '../../core/packet/codec.ts';
import { boardRows } from './family.ts';

const T = 29_000_000; // a Unix minute
const pkt = (member: number, minute: number, extra: Partial<Decoded> = {}): Decoded => ({
  type: 0, hops: 3, minute, keySet: 'family', public: false, duplicate: false, timesHeard: 1,
  payload: { member, code: 0, level: 5, sector: 0, flags: 1, value: 0 }, ...extra,
});

describe('boardRows', () => {
  it('keeps the latest packet per member by its own minute, newest first', () => {
    const rows = boardRows([pkt(1, T - 5), pkt(2, T - 1), pkt(1, T - 2), pkt(3, T - 9), pkt(1, T - 4)], T * 60000);
    expect(rows.map((r) => [r.d.payload.member, r.d.minute])).toEqual([[2, T - 1], [1, T - 2], [3, T - 9]]);
    expect(rows.map((r) => r.ago)).toEqual([1, 2, 9]);
  });

  it('is not stale at exactly 30 min, and is stale past it', () => {
    const at = (s: number) => boardRows([pkt(1, T)], (T + 30) * 60000 + s * 1000)[0];
    expect(at(0)).toMatchObject({ ago: 30, stale: false });
    expect(at(59)).toMatchObject({ ago: 30, stale: false });
    expect(at(60)).toMatchObject({ ago: 31, stale: true });
  });

  it('ignores repeats of a packet, so a repeat of an older one never hides a newer one', () => {
    const rows = boardRows([pkt(1, T, { type: 0 }), pkt(1, T, { type: 1 }), pkt(1, T, { type: 0, duplicate: true, timesHeard: 2 })], T * 60000);
    expect(rows).toHaveLength(1);
    expect(rows[0].d.type).toBe(1);
  });

  it('shows a sender clock running ahead as 0 min ago', () => {
    expect(boardRows([pkt(1, T + 2)], T * 60000)[0]).toMatchObject({ ago: 0, stale: false });
  });
});
