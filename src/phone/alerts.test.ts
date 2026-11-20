import { describe, expect, it } from 'vitest';
import { TYPES, type Decoded } from '../core/packet/codec.ts';
import { fanCue, ONE, packetCue, THREE, tierCue } from './alerts.ts';

const pkt = (type: number, code: number, extra: Partial<Decoded> = {}): Decoded => ({
  type, hops: 3, minute: 29_000_000, keySet: 'family', public: false, duplicate: false, timesHeard: 1,
  payload: { member: 7, code, level: 5, sector: 0, flags: 0, value: 2 }, ...extra,
});

describe('tierCue', () => {
  it('buzzes once into AMBER and three times into RED, from any other tier or none', () => {
    expect(tierCue('GREEN', 'AMBER')).toMatchObject({ buzz: ONE, urgent: false });
    expect(tierCue(undefined, 'AMBER')?.buzz).toBe(ONE);
    expect(tierCue('AMBER', 'RED')).toMatchObject({ buzz: THREE, urgent: true });
    expect(tierCue('GREEN', 'RED')?.buzz).toBe(THREE);
    expect(tierCue('RED', 'AMBER')?.buzz).toBe(ONE);
  });

  it('stays quiet while the tier stays the same, and on GREEN or no hum', () => {
    for (const t of ['GREEN', 'AMBER', 'RED'] as const) expect(tierCue(t, t)).toBeNull();
    expect(tierCue('AMBER', 'GREEN')).toBeNull();
    expect(tierCue('RED', undefined)).toBeNull();
  });
});

describe('fanCue', () => {
  it('fires once when the fan stops, not again while it stays stopped', () => {
    expect(fanCue('RUNNING', 'STOPPED')).toMatchObject({ buzz: ONE, urgent: true });
    expect(fanCue('STOPPED', 'STOPPED')).toBeNull();
    expect(fanCue('LISTENING', 'RUNNING')).toBeNull();
    expect(fanCue('STOPPED', undefined)).toBeNull();
  });
});

describe('packetCue', () => {
  it('fires for a family need and a public HOLD WATER or ROUTE alert, politely', () => {
    expect(packetCue(pkt(TYPES.NEED, 0x21), 1)).toMatchObject({ buzz: ONE, urgent: false, say: 'Family message: Needs help: Clean water (2 people)' });
    expect(packetCue(pkt(TYPES.HOLD_WATER, 0x30, { public: true, keySet: 'public' }), 1)?.say).toMatch(/^Public alert: .*, not confirmed$/);
    expect(packetCue(pkt(TYPES.HOLD_WATER, 0x30, { public: true, keySet: 'public' }), 1, 'row · 1 sender, unconfirmed')?.say).toBe('Public alert: row · 1 sender, unconfirmed');
    expect(packetCue(pkt(TYPES.ROUTE, 0x31, { public: true, keySet: 'public' }), 1)?.buzz).toBe(ONE);
  });

  it('stays quiet for a repeat, this phone\'s own echo, and every other message', () => {
    expect(packetCue(pkt(TYPES.NEED, 0x21, { duplicate: true, timesHeard: 2 }), 1)).toBeNull();
    expect(packetCue(pkt(TYPES.NEED, 0x21), 7)).toBeNull();
    expect(packetCue(pkt(TYPES.NEED, 0x21, { public: true, keySet: 'public' }), 1)).toBeNull();
    expect(packetCue(pkt(TYPES.OK, 0), 1)).toBeNull();
    expect(packetCue(pkt(TYPES.REPORT, 0x10, { public: true }), 1)).toBeNull();
  });
});
