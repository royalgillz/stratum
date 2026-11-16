import type { LedgerEntry } from '../contracts.ts';
import { sha256 } from './sha256.ts';

export type Chain = 'measured' | 'official';
export type Fields = Omit<LedgerEntry, 'hash'>;

const utf8 = (s: string) => new TextEncoder().encode(s);
export const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16));

export const genesis = (chain: Chain) => sha256(utf8(`STRATUM-ledger-v1:${chain}`));

/** Throws RangeError unless every field can be hashed. */
export function validate(e: Fields): void {
  if (!Number.isFinite(e.t) || !Number.isFinite(e.value)) throw new RangeError('t and value must be finite');
  for (const s of [e.kind, e.where, e.source]) if (utf8(s).length > 65535) throw new RangeError('string over 65535 bytes');
}

// @spec WIT-006
export function hashEntry(prev: Uint8Array, e: Fields): Uint8Array {
  const parts = [prev, new Uint8Array(16), ...[e.kind, e.where, e.source].flatMap((s) => {
    const u = utf8(s);
    return [Uint8Array.of(u.length >> 8, u.length & 255), u];
  })];
  const dv = new DataView(parts[1]!.buffer);
  dv.setFloat64(0, e.t === 0 ? 0 : e.t); // -0 hashes as 0
  dv.setFloat64(8, e.value === 0 ? 0 : e.value);
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { bytes.set(p, o); o += p.length; }
  return sha256(bytes);
}

// @spec WIT-008
export function verifyChain(entries: readonly LedgerEntry[], chain: Chain): { ok: true } | { ok: false; index: number } {
  let prev = genesis(chain);
  for (let i = 0; i < entries.length; i++) {
    const h = hashEntry(prev, entries[i]!);
    if (hex(h) !== entries[i]!.hash) return { ok: false, index: i };
    prev = h;
  }
  return { ok: true };
}
