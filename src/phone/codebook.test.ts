import { describe, expect, it } from 'vitest';
import { createDecoder, encode, type Decoded } from '../core/packet/codec.ts';
import { deriveKeys, publicKeys, type KeySet } from '../core/packet/keys.ts';
import { CODEBOOK, message, type KeyChoice } from './codebook.ts';

describe('phone codebook', () => {
  it('has unique code bytes, each 0 to 255', () => {
    const codes = CODEBOOK.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(Number.isInteger(c) && c >= 0 && c <= 255).toBe(true);
  });

  it('follows the packet design key-set rules: OK family only, NEED and REPORT the sender\'s choice', () => {
    for (const e of CODEBOOK) {
      if (e.type === 'OK') expect(e.keys).toEqual(['family']);
      if (e.type === 'NEED') expect(e.keys).toEqual(['family', 'public']); // default family
      if (e.type === 'REPORT') expect(e.keys).toEqual(['public', 'family']); // default public
    }
  });

  it('never sends alerts, routes or ledger heads from the citizen grid', () => {
    for (const e of CODEBOOK) expect(['OK', 'NEED', 'REPORT']).toContain(e.type);
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
      expect(m.keys).toBe(e.keys.includes(to) ? to : 'family'); // OK never goes public
      const bytes = await encode(m.keys === 'public' ? pub : fam, { type: m.type, minute, nonce: nonce++, hops: 3, payload: m.payload });
      const d = (await createDecoder([fam], pub)(bytes, now)) as Decoded;
      expect(d.keySet).toBe(m.keys === 'public' ? 'public' : 'fam');
      expect([d.type, d.payload.code, d.payload.member, d.payload.level, d.payload.sector]).toEqual([m.type, e.code, 7, 3, 2]);
      expect(d.payload.flags).toBe(e.power === true ? 1 : 0);
      expect(d.payload.value).toBe(e.count ? 4 : 0);
      if (m.keys === 'family') expect(await createDecoder([], pub)(bytes, now)).toHaveProperty('reject'); // no leak to the public
    }
  });

  it('sends power on from the box, 0 for an empty or invalid count', () => {
    const water = CODEBOOK.find((e) => e.label === 'Water looks wrong')!, sick = CODEBOOK.find((e) => e.label === 'People coughing or sick')!;
    const c = { member: 1, level: 1, sector: 0, power: true, count: '', to: 'public' as const };
    expect(message(water, c).payload.flags).toBe(1);
    expect(message(sick, c).payload.value).toBe(0);
  });
});
