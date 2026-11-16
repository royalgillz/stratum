// Packet v3: 25 authenticated bytes (design: docs/intent/packet/packet-design.md).
// Pure: the caller supplies nonce, minute and current time. Never throws on received bytes.
import type { KeySet } from './keys.ts';

export const TYPES = { OK: 0, NEED: 1, REPORT: 2, CODEBOOK: 3, GRID_ALERT: 4, HOLD_WATER: 5, ROUTE: 6, LEDGER_HEAD: 7 } as const;

export interface Payload {
  member: number; // 0–255
  code: number; // status or codebook code, 0–255
  level: number; // 1–6 (4 bits)
  sector: number; // within the level, 0–3 (4 bits)
  flags: number; // bit 0 = power on
  value: number; // 0–65535
}

export interface EncodeInput {
  type: number;
  minute: number; // full Unix minute
  nonce: number; // 24 bits, from a secure random source on phones
  hops: number;
  payload: Payload;
}

export interface Decoded {
  type: number;
  payload: Payload;
  hops: number; // clamped to MAX_HOPS
  minute: number; // the packet's own time: show this, not the arrival time
  keySet: string;
  public: boolean;
  duplicate: boolean;
  timesHeard: number; // counts the first hearing
}

export type Reject = { reject: 'length' | 'version' | 'future' | 'stale' | 'unknown-tag' | 'mac' | 'type' };

// Every value below is listed in docs/params.md.
const VERSION = 3, MAX_HOPS = 4, FUTURE_MIN = 2, STALE_MIN = 24 * 60, SEEN_MAX = 4096;

const be32 = (m: number) => new Uint8Array([m >>> 24, (m >>> 16) & 255, (m >>> 8) & 255, m & 255]);
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const hmac = async (key: CryptoKey, ...parts: Uint8Array[]) =>
  new Uint8Array(await crypto.subtle.sign('HMAC', key, cat(...parts)));
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

function check(name: string, v: number, max: number) {
  if (!Number.isInteger(v) || v < 0 || v > max) throw new RangeError(`${name} ${v} is outside 0..${max}`);
}

// @spec PKT-001, PKT-002, PKT-005
export async function encode(keys: KeySet, p: EncodeInput): Promise<Uint8Array> {
  const { member, code, level, sector, flags, value } = p.payload;
  for (const [name, v, max] of [
    ['type', p.type, 15], ['minute', p.minute, 0xffffffff], ['nonce', p.nonce, 0xffffff], ['hops', p.hops, 255],
    ['member', member, 255], ['code', code, 255], ['level', level, 15], ['sector', sector, 15],
    ['flags', flags, 255], ['value', value, 0xffff],
  ] as const) check(name, v, max);

  const M = be32(p.minute);
  const b = new Uint8Array(25);
  b[0] = (VERSION << 4) | p.type;
  b[1] = (p.minute >>> 8) & 255;
  b[2] = p.minute & 255;
  b.set([p.nonce >>> 16, (p.nonce >>> 8) & 255, p.nonce & 255], 3);
  b.set((await hmac(keys.tag, M)).subarray(0, 4), 6);
  const ks = await hmac(keys.enc, b.subarray(0, 1), M, b.subarray(3, 6));
  [member, code, (level << 4) | sector, flags, value >>> 8, value & 255].forEach((v, i) => (b[10 + i] = v ^ ks[i]));
  b[16] = p.hops;
  b.set((await hmac(keys.mac, M, b.subarray(0, 16))).subarray(0, 8), 17);
  return b;
}

// @spec PKT-006, PKT-007, PKT-008, PKT-009, PKT-010, PKT-011, PKT-012
export function createDecoder(families: KeySet[], publicSet: KeySet) {
  const sets = [...families, publicSet];
  const seen = new Map<string, number>(); // insertion order = age, for oldest-first eviction

  return async function decode(b: Uint8Array, nowMs: number): Promise<Decoded | Reject> {
    if (b.length !== 25) return { reject: 'length' };
    if (b[0] >> 4 !== VERSION) return { reject: 'version' };

    const now = Math.floor(nowMs / 60000);
    let diff = (((b[1] << 8) | b[2]) - (now & 0xffff) + 0x10000) & 0xffff;
    if (diff >= 0x8000) diff -= 0x10000;
    const minute = now + diff;
    if (minute - now > FUTURE_MIN) return { reject: 'future' };
    if (now - minute > STALE_MIN) return { reject: 'stale' };

    const M = be32(minute);
    const tagged: KeySet[] = [];
    for (const k of sets) if (same((await hmac(k.tag, M)).subarray(0, 4), b.subarray(6, 10))) tagged.push(k);
    if (!tagged.length) return { reject: 'unknown-tag' };
    let keys: KeySet | undefined;
    for (const k of tagged) {
      if (same((await hmac(k.mac, M, b.subarray(0, 16))).subarray(0, 8), b.subarray(17, 25))) { keys = k; break; }
    }
    if (!keys) return { reject: 'mac' };

    const type = b[0] & 15;
    const isPublic = keys === publicSet;
    if (type > 7 || (isPublic && type === TYPES.OK) || (!isPublic && type >= TYPES.GRID_ALERT)) return { reject: 'type' };

    const nonce = (b[3] << 16) | (b[4] << 8) | b[5];
    const id = `${keys.id}:${minute}:${nonce}`;
    const timesHeard = (seen.get(id) ?? 0) + 1;
    seen.delete(id); // re-insert so a repeat counts as recent
    seen.set(id, timesHeard);
    if (seen.size > SEEN_MAX) seen.delete(seen.keys().next().value!);

    const ks = await hmac(keys.enc, b.subarray(0, 1), M, b.subarray(3, 6));
    const x = b.subarray(10, 16).map((v, i) => v ^ ks[i]);
    return {
      type,
      payload: { member: x[0], code: x[1], level: x[2] >> 4, sector: x[2] & 15, flags: x[3], value: (x[4] << 8) | x[5] },
      hops: Math.min(b[16], MAX_HOPS),
      minute,
      keySet: keys.id,
      public: isPublic,
      duplicate: timesHeard > 1,
      timesHeard,
    };
  };
}
