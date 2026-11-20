import { describe, expect, it } from 'vitest';
import { createDecoder, encode, TYPES, type Decoded } from '../core/packet/codec.ts';
import { deriveKeys, publicKeys, type KeySet } from '../core/packet/keys.ts';
import { createRelay } from '../core/relay/relay.ts';
import { CODEBOOK, message, type KeyChoice } from './codebook.ts';

describe('phone codebook', () => {
  it('has unique code bytes, each 0 to 255', () => {
    const codes = CODEBOOK.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(Number.isInteger(c) && c >= 0 && c <= 255).toBe(true);
  });

  it('follows the packet design key-set rules: OK family only, NEED and REPORT the sender\'s choice, alerts public only', () => {
    for (const e of CODEBOOK) {
      if (e.type === 'OK') expect(e.keys).toEqual(['family']);
      if (e.type === 'NEED') expect(e.keys).toEqual(['family', 'public']); // default family
      if (e.type === 'REPORT') expect(e.keys).toEqual(['public', 'family']); // default public
      if (e.type === 'HOLD_WATER' || e.type === 'ROUTE') expect(e.keys).toEqual(['public']);
    }
  });

  it('sends HOLD WATER and ROUTE alerts, never grid alerts, codebooks or ledger heads, from the citizen grid', () => {
    for (const e of CODEBOOK) expect(['OK', 'NEED', 'REPORT', 'HOLD_WATER', 'ROUTE']).toContain(e.type);
    expect(CODEBOOK.filter((e) => e.type === 'HOLD_WATER').map((e) => e.label)).toEqual(['Water looks or smells wrong: hold, do not drink']);
    expect(CODEBOOK.filter((e) => e.type === 'ROUTE').map((e) => e.label)).toEqual(['Tunnel flooded or blocked here']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(CODEBOOK)).toBe(true);
    expect(CODEBOOK.every(Object.isFrozen)).toBe(true);
  });

  it('puts on air the type, code, place, power flag, count and key set the screen chose', async () => {
    const fam = (await deriveKeys('abandon ability able about above absent', 'fam')) as KeySet, pub = await publicKeys();
    const now = Date.now(), minute = Math.floor(now / 60000);
    let nonce = 0;
    for (const e of CODEBOOK) for (const to of ['family', 'public'] as KeyChoice[]) {
      const m = message(e, { member: 7, level: 3, sector: 2, power: false, count: '4', to });
      expect(m.keys).toBe(e.keys.includes(to) ? to : e.keys[0]); // OK never goes public, an alert never goes to a family
      const bytes = await encode(m.keys === 'public' ? pub : fam, { type: m.type, minute, nonce: nonce++, hops: 3, payload: m.payload });
      const d = (await createDecoder([fam], pub)(bytes, now)) as Decoded;
      expect(d.keySet).toBe(m.keys === 'public' ? 'public' : 'fam');
      expect([d.type, d.payload.code, d.payload.member, d.payload.level, d.payload.sector]).toEqual([m.type, e.code, 7, 3, 2]);
      expect(d.payload.flags).toBe(e.power === true ? 1 : 0);
      expect(d.payload.value).toBe(e.count ? 4 : 0);
      if (m.keys === 'family') expect(await createDecoder([], pub)(bytes, now)).toHaveProperty('reject'); // no leak to the public
    }
  });

  it('a HOLD WATER alert decodes as public with its place, and a phone that hears it relays it once', async () => {
    const pub = await publicKeys(), now = Date.now();
    const hold = CODEBOOK.find((e) => e.type === 'HOLD_WATER')!;
    const m = message(hold, { member: 9, level: 5, sector: 0, power: true, count: '', to: 'family' });
    expect(m.keys).toBe('public');
    const bytes = await encode(pub, { type: m.type, minute: Math.floor(now / 60000), nonce: 42, hops: 3, payload: m.payload });
    const d = (await createDecoder([], pub)(bytes, now)) as Decoded;
    expect([d.type, d.public, d.payload.code, d.payload.level, d.payload.sector]).toEqual([TYPES.HOLD_WATER, true, hold.code, 5, 0]);
    const relay = createRelay(() => 0.5); // slot 2: the send waits 6 s
    const a = relay.hear(bytes, d, { state: 'LIVE', tier: 'GREEN' }, now); // unlike a grid alert, no tracker check
    expect(a && 'send' in a && a.send[16]).toBe(2);
    expect(relay.hear(bytes, d, { state: 'LIVE', tier: 'GREEN' }, now)).toEqual({ cancel: (a as { id: string }).id }); // heard twice: silent
  });

  it('sends power on from the box, 0 for an empty or invalid count', () => {
    const water = CODEBOOK.find((e) => e.label === 'Water looks wrong')!, sick = CODEBOOK.find((e) => e.label === 'People coughing or sick')!;
    const c = { member: 1, level: 1, sector: 0, power: true, count: '', to: 'public' as const };
    expect(message(water, c).payload.flags).toBe(1);
    expect(message(sick, c).payload.value).toBe(0);
  });
});
