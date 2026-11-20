import { describe, expect, it } from 'vitest';
import { digestPayload, TYPES, type Decoded } from '../../core/packet/codec.ts';
import { boardRows, ledgerLine, power, says, senders } from './family.ts';

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
    expect(says(with_(5, 0))).toBe('Hold water'); // a code this phone does not know: the type alone
    expect(says(with_(5, 0x30)) + power(with_(5, 0x30))).toBe('⚠ Water looks or smells wrong: hold, do not drink');
    expect(says(with_(6, 0x31)) + power(with_(6, 0x31))).toBe('⚠ Tunnel flooded or blocked here');
    expect(says(with_(2, 0x30))).toBe('Report'); // the alert's code under another type is not the alert
    expect(says(with_(1, 0x20, 5))).toBe('Needs help: Medicine (5 people)'); // the count from the Report dialog
    expect(says(with_(2, 0x15, 1))).toBe('Report: People coughing or sick (1 person)');
    expect(says(with_(2, 0x13, 9))).toBe('Report: Flooding or route blocked'); // a code with no count ignores the value
  });
});

describe('ledgerLine', () => {
  it('shows a ledger digest as its 12 hex characters, the packet LIVE, with no sender claimed, member or place', () => {
    const d = pkt(0, T, { type: TYPES.LEDGER_HEAD, keySet: 'public', public: true, payload: digestPayload('c0ffee00beef') });
    expect(ledgerLine(d)).toMatch(/^Public ledger digest heard: c0ffee00beef, compare with the District 7 screen · packet LIVE, sent .+ · public$/);
    expect(ledgerLine({ ...d, duplicate: true, timesHeard: 2 })).toMatch(/ · public · heard 2×$/);
  });
});

describe('senders', () => {
  it('counts the different members who sent one public alert at one place, unconfirmed below three', () => {
    const seen = new Map<string, Set<number>>();
    const hold = (member: number, sector = 0) => pkt(member, T, { type: TYPES.HOLD_WATER, keySet: 'public', public: true, payload: { member, code: 0x30, level: 5, sector, flags: 0, value: 0 } });
    expect(senders(seen, hold(9))).toBe(' · 1 sender, unconfirmed');
    expect(senders(seen, { ...hold(9), duplicate: true, timesHeard: 2 })).toBe(' · 1 sender, unconfirmed'); // a relayed copy is not a second sender
    expect(senders(seen, hold(4, 1))).toBe(' · 1 sender, unconfirmed'); // another sector is another alert
    expect(senders(seen, hold(4))).toBe(' · 2 senders, unconfirmed');
    expect(senders(seen, hold(5))).toBe(' · 3 senders');
    expect(senders(seen, pkt(1, T, { type: TYPES.REPORT }))).toBe(''); // only the public alerts are counted
  });
});
