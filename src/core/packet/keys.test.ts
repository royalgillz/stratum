import { describe, expect, it } from 'vitest';
import { deriveKeys, generateWords, type KeySet } from './keys.ts';
import { encode } from './codec.ts';

const SIX = 'abandon ability able about above absent';
const input = { type: 0, minute: 29_000_000, nonce: 0x123456, hops: 3, payload: { member: 1, code: 2, level: 5, sector: 3, flags: 1, value: 500 } };

describe('keys', () => {
  // @spec PKT-003
  it('normalises typed words, so spacing and case do not change the keys', async () => {
    const a = (await deriveKeys(SIX, 'fam')) as KeySet;
    const b = (await deriveKeys('  Abandon\tABILITY able   about above ABSENT ', 'fam')) as KeySet;
    expect(await encode(b, input)).toEqual(await encode(a, input));
    const other = (await deriveKeys('abandon ability able about above zoo', 'fam')) as KeySet;
    expect(await encode(other, input)).not.toEqual(await encode(a, input));
  });

  // @spec PKT-003
  it('rejects a wrong word count and words not on the list', async () => {
    expect(await deriveKeys('abandon ability able about above', 'f')).toEqual({ error: 'word-count' });
    expect(await deriveKeys('abandon ability able about above xylophonez', 'f')).toEqual({ error: 'unknown-word', word: 'xylophonez' });
  });

  // @spec PKT-004
  it('maps 66 random bits, most-significant first, to six words', () => {
    expect(generateWords(new Uint8Array(9))).toEqual(Array(6).fill('abandon'));
    expect(generateWords(new Uint8Array(9).fill(0xff))).toEqual(Array(6).fill('zoo'));
    const r = new Uint8Array(9);
    r[1] = 0x20; // first 11 bits = 00000000001 -> word 1
    expect(generateWords(r)[0]).toBe('ability');
    expect(() => generateWords(new Uint8Array(8))).toThrow(RangeError);
  });
});
