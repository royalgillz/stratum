import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '../contracts.ts';
import { createWitness } from './witness.ts';
import { verifyChain } from './ledger.ts';
import { sha256 } from './sha256.ts';

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const utf8 = (s: string) => new TextEncoder().encode(s);
const fresh = () => ({ measured: [] as LedgerEntry[], official: [] as LedgerEntry[] });
const cat = (...p: Uint8Array[]) => Uint8Array.from(p.flatMap((x) => [...x]));
const f64 = (v: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b; };
const lp = (s: string) => { const u = utf8(s); return cat(Uint8Array.of(u.length >> 8, u.length & 255), u); };

// An independent byte-by-byte reference of the documented layout, hashed by Web Crypto.
async function ref(prev: Uint8Array, e: Omit<LedgerEntry, 'hash'>) {
  const bytes = cat(prev, f64(e.t), f64(e.value), lp(e.kind), lp(e.where), lp(e.source));
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

describe('ledger', () => {
  // @spec WIT-005
  it('stamps time from the injected clock and routes by source before returning', () => {
    let t = 5;
    const l = fresh();
    const w = createWitness({ now: () => t, ledger: l });
    w.observe('cond', 'L2S1', 400, 'crew-1');
    t = 6;
    w.observe('cond', 'L2S1', 380, 'official');
    t = 7;
    w.observe('cond', 'L2S1', 381, 'official:directorate');
    w.observe('cond', 'L2S1', 382, 'officialish');
    expect(l.measured.map((e) => [e.t, e.value, e.source])).toEqual([[5, 400, 'crew-1'], [7, 382, 'officialish']]);
    expect(l.official.map((e) => [e.t, e.value])).toEqual([[6, 380], [7, 381]]);
    expect(l.measured[0]).toMatchObject({ kind: 'cond', where: 'L2S1' });
  });

  // @spec WIT-005
  it('throws RangeError and appends nothing for a non-finite value or time, or an oversize string', () => {
    const l = fresh();
    let t = 1;
    const w = createWitness({ now: () => t, ledger: l });
    expect(() => w.observe('k', 'w', NaN, 's')).toThrow(RangeError);
    expect(() => w.observe('k', 'w', Infinity, 's')).toThrow(RangeError);
    expect(() => w.observe('k'.repeat(65536), 'w', 1, 's')).toThrow(RangeError);
    expect(() => w.observe('é'.repeat(32768), 'w', 1, 's')).toThrow(RangeError); // 65536 bytes
    t = NaN;
    expect(() => w.observe('k', 'w', 1, 's')).toThrow(RangeError);
    expect(l.measured).toHaveLength(0);
    t = 1;
    w.observe('k'.repeat(65535), 'w', 1, 's');
    expect(l.measured).toHaveLength(1);
  });

  // @spec WIT-006
  it('hashes the documented bytes: genesis, chaining, float64, length prefixes, -0', async () => {
    const l = fresh();
    let t = 12.5;
    const w = createWitness({ now: () => t, ledger: l });
    w.observe('température', 'L5S2', -0, 'crew é');
    t = 13;
    w.observe('toc', 'L5S2', 2.75, 'crew é');
    w.observe('toc', 'L5S2', 3.1, 'official');
    const gM = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8('STRATUM-ledger-v1:measured')));
    const gO = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8('STRATUM-ledger-v1:official')));
    const h0 = await ref(gM, { t: 12.5, kind: 'température', where: 'L5S2', value: 0, source: 'crew é' });
    expect(l.measured[0]!.hash).toBe(hex(h0));
    expect(l.measured[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
    const h1 = await ref(h0, { t: 13, kind: 'toc', where: 'L5S2', value: 2.75, source: 'crew é' });
    expect(l.measured[1]!.hash).toBe(hex(h1));
    expect(l.official[0]!.hash).toBe(hex(await ref(gO, { t: 13, kind: 'toc', where: 'L5S2', value: 3.1, source: 'official' })));
    expect(hex(sha256(utf8('STRATUM-ledger-v1:measured')))).toBe(hex(gM));
  });

  // @spec WIT-008
  it('never alters earlier entries, and verifyChain finds the first altered one', () => {
    const l = fresh();
    const w = createWitness({ now: () => 1, ledger: l });
    for (let i = 0; i < 5; i++) w.observe('k', 'w', i, 's');
    const before = [...l.measured];
    w.observe('k', 'w', 9, 's');
    expect(l.measured.slice(0, 5)).toEqual(before);
    expect(l.measured.every(Object.isFrozen)).toBe(true);
    expect(verifyChain(l.measured, 'measured')).toEqual({ ok: true });
    expect(verifyChain([], 'official')).toEqual({ ok: true });
    const bad = l.measured.map((e) => ({ ...e }));
    bad[3]!.value = 99;
    expect(verifyChain(bad, 'measured')).toEqual({ ok: false, index: 3 });
    expect(verifyChain(l.measured, 'official')).toEqual({ ok: false, index: 0 });
    expect(verifyChain(l.measured.slice(1), 'measured')).toEqual({ ok: false, index: 0 });
  });
});
