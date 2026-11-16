// Store-and-forward relay for packet v3 (design: docs/intent/relay/relay-design.md).
// Pure: the caller supplies bytes, their decode result, the tracker reading, time and an Rng.
import type { Tier } from '../contracts.ts';
import { MAX_HOPS, SEEN_MAX, TYPES, type Decoded, type Reject } from '../packet/codec.ts';
import type { Rng } from '../rng.ts';
import type { TrackerState } from '../tracker/tracker.ts';

export interface TrackerView { state: TrackerState; tier?: Tier } // a tracker Reading fits
export type RelayAction = { id: string; send: Uint8Array; atMs: number } | { cancel: string };

// Every value below is listed in docs/params.md.
const SLOTS = 4, SLOT_MS = 3000;

const identity = (b: Uint8Array) => Array.from(b, (v, i) => (i === 16 ? '00' : v.toString(16).padStart(2, '0'))).join('');

// @spec RELAY-009
export function createRelay(rng: Rng) {
  const heard = new Map<string, { n: number; atMs: number }>(); // insertion order = least recently heard first

  // Counts one hearing; returns the identity's entry.
  const count = (id: string) => {
    const e = heard.get(id) ?? { n: 0, atMs: -Infinity };
    e.n++;
    heard.delete(id);
    heard.set(id, e);
    if (heard.size > SEEN_MAX) heard.delete(heard.keys().next().value!);
    return e;
  };

  // @spec RELAY-001, RELAY-002, RELAY-003, RELAY-004, RELAY-005, RELAY-006, RELAY-007
  function hear(bytes: Uint8Array, decoded: Decoded | Reject, tracker: TrackerView, nowMs: number): RelayAction | null {
    if (!Number.isFinite(nowMs)) throw new RangeError(`nowMs ${nowMs} is not finite`);
    const verified = !('reject' in decoded);
    if (!verified && !(decoded.reject === 'unknown-tag' && (bytes[0] & 15) <= TYPES.CODEBOOK)) return null;
    if (bytes.length !== 25) throw new RangeError(`packet has ${bytes.length} bytes, not 25`);

    const id = identity(bytes);
    if (heard.has(id)) {
      const e = count(id);
      if (e.atMs <= nowMs) return null;
      e.atMs = -Infinity;
      return { cancel: id };
    }
    const hops = Math.min(bytes[16], MAX_HOPS);
    const silent = hops === 0 || (verified && decoded.type === TYPES.GRID_ALERT && tracker.state !== 'NO_HUM' &&
      !(tracker.state === 'LIVE' && (tracker.tier === 'AMBER' || tracker.tier === 'RED')));

    // Draw and check before counting, so a throw changes no state.
    const r = silent ? 0 : rng();
    if (!(r >= 0 && r < 1)) throw new RangeError(`rng() returned ${r}, outside [0, 1)`);
    const e = count(id);
    if (silent) return null;
    const send = bytes.slice();
    send[16] = hops - 1;
    e.atMs = nowMs + Math.floor(r * SLOTS) * SLOT_MS;
    return { id, send, atMs: e.atMs };
  }

  // @spec RELAY-008
  function own(bytes: Uint8Array) {
    if (bytes.length !== 25) throw new RangeError(`packet has ${bytes.length} bytes, not 25`);
    count(identity(bytes));
  }

  return { hear, own };
}
