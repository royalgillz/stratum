import { describe, expect, it } from 'vitest';
import { createDecoder, encode, TYPES, type Decoded, type EncodeInput } from './codec.ts';
import { deriveKeys, publicKeys, type KeySet } from './keys.ts';

const MIN = 29_000_000; // a Unix minute in 2025
const now = (m: number) => m * 60_000 + 30_000; // mid-minute, in ms
const utf8 = (s: string) => new TextEncoder().encode(s);

const fam = async (words: string, id: string) => (await deriveKeys(words, id)) as KeySet;
const A = await fam('abandon ability able about above absent', 'A');
const B = await fam('zoo zone zero youth young you', 'B');
const PUB = await publicKeys();

const pkt = (over: Partial<EncodeInput> = {}): EncodeInput => ({
  type: TYPES.OK, minute: MIN, nonce: 0xabcdef, hops: 3,
  payload: { member: 7, code: 2, level: 5, sector: 3, flags: 1, value: 1234 },
  ...over,
});
const decoder = () => createDecoder([A, B], PUB);
const ok = (r: unknown) => r as Decoded;

// Independent re-derivation of one HMAC key, straight from the spec text.
async function rawKey(material: string, info: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', utf8(material), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: utf8('STRATUM-v3'), info: utf8(info) }, base, 256);
  return crypto.subtle.importKey('raw', bits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
const hmac = async (k: CryptoKey, ...parts: Uint8Array[]) => {
  const data = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { data.set(p, o); o += p.length; }
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
};
const be32 = (m: number) => new Uint8Array([m >>> 24, (m >>> 16) & 255, (m >>> 8) & 255, m & 255]);

describe('packet codec', () => {
  // @spec PKT-001
  it('encodes 25 bytes with version, type, minute, nonce and hops in place', async () => {
    const b = await encode(A, pkt({ type: TYPES.NEED }));
    expect(b).toHaveLength(25);
    expect(b[0]).toBe(0x31);
    expect((b[1] << 8) | b[2]).toBe(MIN & 0xffff);
    expect([b[3], b[4], b[5]]).toEqual([0xab, 0xcd, 0xef]);
    expect(b[16]).toBe(3);
  });

  // @spec PKT-002
  it('computes tag, keystream and MAC over the full 32-bit minute with HKDF keys as specified', async () => {
    const words = 'abandon ability able about above absent';
    const b = await encode(A, pkt());
    const M = be32(MIN);
    expect(b.slice(6, 10)).toEqual((await hmac(await rawKey(words, 'tag'), M)).slice(0, 4));
    expect(b.slice(17, 25)).toEqual((await hmac(await rawKey(words, 'mac'), M, b.slice(0, 16))).slice(0, 8));
    const ks = (await hmac(await rawKey(words, 'enc'), b.slice(0, 1), M, b.slice(3, 6))).slice(0, 6);
    const plain = b.slice(10, 16).map((v, i) => v ^ ks[i]);
    expect(Array.from(plain)).toEqual([7, 2, 0x53, 1, 0x04, 0xd2]);
  });

  // @spec PKT-005
  it('is deterministic for the same inputs and rejects out-of-range fields', async () => {
    expect(await encode(A, pkt())).toEqual(await encode(A, pkt()));
    await expect(encode(A, pkt({ nonce: 1 << 24 }))).rejects.toThrow(RangeError);
    await expect(encode(A, pkt({ type: 16 }))).rejects.toThrow(RangeError);
    await expect(encode(A, pkt({ payload: { ...pkt().payload, level: 16 } }))).rejects.toThrow(RangeError);
    await expect(encode(A, pkt({ payload: { ...pkt().payload, value: 65536 } }))).rejects.toThrow(RangeError);
  });

  // @spec PKT-006
  it('checks length, then version, then age, then tag, then MAC, without throwing', async () => {
    const d = decoder();
    const b = await encode(A, pkt());
    expect(await d(b.slice(0, 24), now(MIN))).toEqual({ reject: 'length' });
    const v = b.slice(); v[0] = 0x21;
    expect(await d(v, now(MIN))).toEqual({ reject: 'version' });
    const late = b.slice(); late[17] ^= 1; // bad MAC and in the future: age is checked first
    expect(await d(late, now(MIN - 5))).toEqual({ reject: 'future' });
    expect(await d(new Uint8Array(25).fill(0x30), now(MIN))).toMatchObject({ reject: expect.any(String) });
  });

  // @spec PKT-007
  it('resolves the 16-bit minute near the receiver clock and rejects future, stale and wrapped packets', async () => {
    const d = decoder();
    expect(ok(await d(await encode(A, pkt({ minute: MIN + 2 })), now(MIN))).minute).toBe(MIN + 2);
    expect(await d(await encode(A, pkt({ minute: MIN + 3 })), now(MIN))).toEqual({ reject: 'future' });
    expect(ok(await d(await encode(A, pkt({ minute: MIN - 1440 })), now(MIN))).minute).toBe(MIN - 1440);
    expect(await d(await encode(A, pkt({ minute: MIN - 1441 })), now(MIN))).toEqual({ reject: 'stale' });
    // Replayed one full counter wrap later: resolves to the new minute, and the tag no longer matches.
    expect(await d(await encode(A, pkt()), now(MIN + 65536))).toEqual({ reject: 'unknown-tag' });
  });

  // @spec PKT-008
  it('finds the right family, ignores the hops byte and rejects any other change', async () => {
    const d = decoder();
    const b = await encode(B, pkt({ nonce: 1 }));
    expect(ok(await d(b, now(MIN))).keySet).toBe('B');
    const relayed = b.slice(); relayed[16] = 1;
    expect(ok(await d(relayed, now(MIN))).keySet).toBe('B');
    const tampered = (await encode(B, pkt({ nonce: 2 }))).slice(); tampered[12] ^= 0x40;
    expect(await d(tampered, now(MIN))).toEqual({ reject: 'mac' });
    const stranger = await fam('wolf woman wonder wood wool word', 'C');
    expect(await d(await encode(stranger, pkt()), now(MIN))).toEqual({ reject: 'unknown-tag' });
  });

  // @spec PKT-009
  it('rejects types the key set may not carry, and undefined types', async () => {
    const d = decoder();
    expect(await d(await encode(PUB, pkt({ type: TYPES.OK, nonce: 10 })), now(MIN))).toEqual({ reject: 'type' });
    expect(await d(await encode(A, pkt({ type: TYPES.GRID_ALERT, nonce: 11 })), now(MIN))).toEqual({ reject: 'type' });
    expect(await d(await encode(A, pkt({ type: 9, nonce: 12 })), now(MIN))).toEqual({ reject: 'type' });
    expect(ok(await d(await encode(PUB, pkt({ type: TYPES.NEED, nonce: 13 })), now(MIN))).type).toBe(TYPES.NEED);
    expect(ok(await d(await encode(A, pkt({ type: TYPES.REPORT, nonce: 14 })), now(MIN))).type).toBe(TYPES.REPORT);
  });

  // @spec PKT-010
  it('marks repeats as duplicates with a count, keyed by key set, and forgets the oldest past 4,096', async () => {
    const d = decoder();
    const b = await encode(A, pkt());
    expect(ok(await d(b, now(MIN)))).toMatchObject({ duplicate: false, timesHeard: 1 });
    const relayed = b.slice(); relayed[16] = 0;
    expect(ok(await d(relayed, now(MIN)))).toMatchObject({ duplicate: true, timesHeard: 2 });
    expect(ok(await d(b, now(MIN)))).toMatchObject({ duplicate: true, timesHeard: 3 });
    // Same minute and nonce from another family is a different message.
    expect(ok(await d(await encode(B, pkt()), now(MIN)))).toMatchObject({ duplicate: false });

    const d2 = decoder();
    const first = await encode(A, pkt({ nonce: 0 }));
    const bad = first.slice(); bad[20] ^= 1;
    expect(await d2(bad, now(MIN))).toEqual({ reject: 'mac' });
    expect(ok(await d2(first, now(MIN))).duplicate).toBe(false); // the rejected copy did not enter the seen-set
    for (let n = 1; n <= 4096; n++) await d2(await encode(A, pkt({ nonce: n })), now(MIN));
    expect(ok(await d2(first, now(MIN))).duplicate).toBe(false); // evicted, oldest first
  }, 60_000); // 4,096 encode + decode rounds of Web Crypto HMAC

  // @spec PKT-011
  it('marks packets under the public key set as public', async () => {
    const r = ok(await decoder()(await encode(PUB, pkt({ type: TYPES.HOLD_WATER })), now(MIN)));
    expect(r.public).toBe(true);
    expect(r.keySet).toBe('public');
    expect(ok(await decoder()(await encode(A, pkt()), now(MIN))).public).toBe(false);
  });

  // @spec PKT-012
  it('returns the type, payload fields, clamped hops and the packet minute', async () => {
    const r = ok(await decoder()(await encode(A, pkt({ type: TYPES.REPORT, hops: 200 })), now(MIN + 1)));
    expect(r).toMatchObject({
      type: TYPES.REPORT, hops: 4, minute: MIN, keySet: 'A', public: false,
      payload: { member: 7, code: 2, level: 5, sector: 3, flags: 1, value: 1234 },
    });
  });
});
