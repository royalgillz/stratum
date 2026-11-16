import { describe, expect, it } from 'vitest';
import { CODEBOOK } from './codebook.ts';

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
});
