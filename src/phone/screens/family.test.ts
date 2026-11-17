import { describe, expect, it } from 'vitest';
import type { Decoded } from '../../core/packet/codec.ts';
import { boardRows, power, says } from './family.ts';

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

  it('puts members not heard for over 30 min first, so the one to worry about is on top', () => {
    const rows = boardRows([pkt(1, T - 1), pkt(2, T - 45), pkt(3, T - 2)], T * 60000);
    expect(rows.map((r) => [r.d.payload.member, r.stale])).toEqual([[2, true], [1, false], [3, false]]);
  });

  it('shows a sender clock running ahead as 0 min ago', () => {
    expect(boardRows([pkt(1, T + 2)], T * 60000)[0]).toMatchObject({ ago: 0, stale: false });
  });
});

describe('says', () => {
  it('names messages in plain words, with power only for OK and REPORT', () => {
    const with_ = (type: number, code: number, value = 0) => pkt(1, T, { type, payload: { member: 1, code, level: 5, sector: 0, flags: 0, value } });
    expect(says(with_(0, 0)) + power(with_(0, 0))).toBe('I am OK · power off');
    expect(says(with_(1, 0x20)) + power(with_(1, 0x20))).toBe('Needs help: Medicine');
    expect(says(with_(2, 0x13)) + power(with_(2, 0x13))).toBe('Report: Flooding or route blocked · power off');
    expect(says(with_(1, 0x10))).toBe('■ RED: medicine request (danger sign)'); // a breath code, not the REPORT code 0x10
    expect(says(with_(1, 0x11, 52))).toBe('▲ AMBER: medicine request, 52 breaths per minute');
    expect(says(with_(5, 0))).toBe('Save water');
    expect(says(with_(1, 0x20, 5))).toBe('Needs help: Medicine (5 people)'); // the count from the Report dialog
    expect(says(with_(2, 0x15, 1))).toBe('Report: People coughing or sick (1 person)');
    expect(says(with_(2, 0x13, 9))).toBe('Report: Flooding or route blocked'); // a code with no count ignores the value
  });
});
