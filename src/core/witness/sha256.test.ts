import { describe, expect, it } from 'vitest';
import { rng } from '../rng.ts';
import { sha256 } from './sha256.ts';

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const utf8 = (s: string) => new TextEncoder().encode(s);

describe('sha256', () => {
  // @spec WIT-007
  it('matches the FIPS 180-4 vectors', () => {
    expect(hex(sha256(utf8('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(hex(sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    expect(hex(sha256(new Uint8Array(1_000_000).fill(0x61)))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  // @spec WIT-007
  it('equals crypto.subtle.digest on inputs of random length and content', async () => {
    const r = rng(7, 'sha-test');
    const lengths = [54, 55, 56, 57, 63, 64, 65, 119, 120, 128];
    for (let i = 0; i < 150; i++) lengths.push(Math.floor(r() * 400));
    for (const n of lengths) {
      const data = Uint8Array.from({ length: n }, () => Math.floor(r() * 256));
      const want = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
      expect(hex(sha256(data)), `length ${n}`).toBe(hex(want));
    }
  });
});
