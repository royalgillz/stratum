import { describe, expect, it } from 'vitest';
import { TYPES, type Decoded } from '../core/packet/codec.ts';
import { AMBER_BUZZ, FAN_BUZZ, fanCue, MESSAGE_BUZZ, packetCue, RED_BUZZ, REPEAT_MS, repeatBuzz, tierCue } from './alerts.ts';

const pkt = (type: number, code: number, extra: Partial<Decoded> = {}): Decoded => ({
  type, hops: 3, minute: 29_000_000, keySet: 'family', public: false, duplicate: false, timesHeard: 1,
  payload: { member: 7, code, level: 5, sector: 0, flags: 0, value: 2 }, ...extra,
});

describe('tierCue', () => {
  it('buzzes one long pulse into AMBER and the urgent pattern into RED, from any other tier or none', () => {
    expect(tierCue('GREEN', 'AMBER')).toMatchObject({ buzz: AMBER_BUZZ, urgent: false });
    expect(tierCue(undefined, 'AMBER')?.buzz).toBe(AMBER_BUZZ);
    expect(tierCue('AMBER', 'RED')).toMatchObject({ buzz: RED_BUZZ, urgent: true });
    expect(tierCue('GREEN', 'RED')?.buzz).toBe(RED_BUZZ);
    expect(tierCue('RED', 'AMBER')?.buzz).toBe(AMBER_BUZZ);
  });

  it('stays quiet while the tier stays the same, and on GREEN or no hum', () => {
    for (const t of ['GREEN', 'AMBER', 'RED'] as const) expect(tierCue(t, t)).toBeNull();
    expect(tierCue('AMBER', 'GREEN')).toBeNull();
    expect(tierCue('RED', undefined)).toBeNull();
  });
});

describe('fanCue', () => {
  it('fires once when the fan stops, not again while it stays stopped', () => {
    expect(fanCue('RUNNING', 'STOPPED')).toMatchObject({ buzz: FAN_BUZZ, urgent: true });
    expect(fanCue('STOPPED', 'STOPPED')).toBeNull();
    expect(fanCue('LISTENING', 'RUNNING')).toBeNull();
    expect(fanCue('STOPPED', undefined)).toBeNull();
  });
});

describe('packetCue', () => {
  it('fires for a family need and a public HOLD WATER or ROUTE alert, politely', () => {
    expect(packetCue(pkt(TYPES.NEED, 0x21), 1)).toMatchObject({ buzz: MESSAGE_BUZZ, urgent: false, say: 'Family message: Needs help: Clean water (2 people)' });
    expect(packetCue(pkt(TYPES.HOLD_WATER, 0x30, { public: true, keySet: 'public' }), 1)?.say).toMatch(/^Public alert: .*, not confirmed$/);
    expect(packetCue(pkt(TYPES.HOLD_WATER, 0x30, { public: true, keySet: 'public' }), 1, 'row · 1 sender, unconfirmed')?.say).toBe('Public alert: row · 1 sender, unconfirmed');
    expect(packetCue(pkt(TYPES.ROUTE, 0x31, { public: true, keySet: 'public' }), 1)?.buzz).toBe(MESSAGE_BUZZ);
  });

  it('stays quiet for a repeat, this phone\'s own echo, and every other message', () => {
    expect(packetCue(pkt(TYPES.NEED, 0x21, { duplicate: true, timesHeard: 2 }), 1)).toBeNull();
    expect(packetCue(pkt(TYPES.NEED, 0x21), 7)).toBeNull();
    expect(packetCue(pkt(TYPES.NEED, 0x21, { public: true, keySet: 'public' }), 1)).toBeNull();
    expect(packetCue(pkt(TYPES.OK, 0), 1)).toBeNull();
    expect(packetCue(pkt(TYPES.REPORT, 0x10, { public: true }), 1)).toBeNull();
  });
});

describe('patterns and repeats', () => {
  it('gives each alert its own pattern and flash', () => {
    expect(new Set([AMBER_BUZZ, RED_BUZZ, MESSAGE_BUZZ, FAN_BUZZ].map((p) => p.join())).size).toBe(4);
    expect(tierCue('GREEN', 'AMBER')?.flash).toBe('AMBER');
    expect(tierCue('GREEN', 'RED')?.flash).toBe('RED');
    expect(fanCue('RUNNING', 'STOPPED')?.flash).toBe('RED');
  });

  it('repeats RED and a fan stop every 30 s until Seen or the state clears', () => {
    expect(repeatBuzz('RED', 'RUNNING', false, REPEAT_MS)).toBe(RED_BUZZ);
    expect(repeatBuzz('GREEN', 'STOPPED', false, REPEAT_MS + 1)).toBe(FAN_BUZZ);
    expect(repeatBuzz('RED', 'STOPPED', false, REPEAT_MS)).toBe(RED_BUZZ); // the tier pattern wins when both are on
    expect(repeatBuzz('RED', 'RUNNING', false, REPEAT_MS - 1)).toBeNull(); // not yet 30 s
    expect(repeatBuzz('RED', 'STOPPED', true, REPEAT_MS * 5)).toBeNull(); // Seen
    expect(repeatBuzz('AMBER', 'RUNNING', false, REPEAT_MS * 5)).toBeNull(); // cleared
    expect(repeatBuzz(undefined, undefined, false, REPEAT_MS)).toBeNull();
  });
});
