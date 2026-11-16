import { describe, expect, it } from 'vitest';
import { createDecoder, encode, TYPES, type Decoded, type EncodeInput, type Reject } from '../packet/codec.ts';
import { deriveKeys, publicKeys, type KeySet } from '../packet/keys.ts';
import { rng as seeded } from '../rng.ts';
import { createRelay, type TrackerView } from './relay.ts';

const MIN = 29_000_000;
const T = MIN * 60_000 + 30_000; // mid-minute, in ms
const A = (await deriveKeys('abandon ability able about above absent', 'A')) as KeySet;
const PUB = await publicKeys();
const NO_HUM = { state: 'NO_HUM' } as const;

const pkt = (over: Partial<EncodeInput> = {}): EncodeInput => ({
  type: TYPES.OK, minute: MIN, nonce: 0x123456, hops: 3,
  payload: { member: 7, code: 2, level: 5, sector: 3, flags: 1, value: 1234 },
  ...over,
});
// Rng stub returning the given values in turn, counting calls.
const stub = (...vals: number[]) => {
  const f = Object.assign(() => { f.calls++; return vals.shift() ?? 0; }, { calls: 0 });
  return f;
};
const hex = (b: Uint8Array) => Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');

// Decode with a phone that holds family A (member) or no family (stranger), then return what hear() needs.
async function heard(over: Partial<EncodeInput> = {}, keys = A, member = true) {
  const bytes = await encode(keys, pkt(over));
  return { bytes, decoded: await createDecoder(member ? [A] : [], PUB)(bytes, T) };
}
const hear = (r: ReturnType<typeof createRelay>, h: { bytes: Uint8Array; decoded: Decoded | Reject }, now = T, tracker: TrackerView = NO_HUM) =>
  r.hear(h.bytes, h.decoded, tracker, now);
// A foreign type 0 packet with its own identity for each i (0 to 65,535).
const fill = (i: number) => {
  const b = new Uint8Array(25);
  b[0] = 0x30; b[16] = 1; b[3] = i >> 8; b[4] = i & 255; b[5] = 0xee;
  return { bytes: b, decoded: { reject: 'unknown-tag' as const } };
};

describe('relay', () => {
  // @spec RELAY-001
  it('forwards verified and foreign unknown-tag packets of types 0 to 3, nothing else', async () => {
    const r = createRelay(stub());
    const foreign = await heard({}, A, false);
    expect(foreign.decoded).toEqual({ reject: 'unknown-tag' });
    expect(hear(r, foreign)).toMatchObject({ atMs: T });
    expect(hear(r, await heard({ type: TYPES.NEED, nonce: 1 }, A, false))).not.toBeNull();
    expect(hear(r, await heard({ type: TYPES.CODEBOOK, nonce: 6 }, A, false))).not.toBeNull(); // highest foreign type
    expect(hear(r, await heard({ type: TYPES.GRID_ALERT, nonce: 2 }, A, false))).toBeNull(); // public-only type, unknown tag: forged
    expect(hear(r, await heard({ type: 9, nonce: 3 }, A, false))).toBeNull(); // undefined type
    expect(hear(r, await heard({ nonce: 4, minute: MIN - 2 * 24 * 60 }))).toBeNull(); // stale

    // The same bytes, first rejected (say for clock skew), then verified: the reject was not counted.
    const good = await heard({ nonce: 5 });
    expect(hear(r, { bytes: good.bytes, decoded: { reject: 'mac' } })).toBeNull();
    expect(hear(r, { bytes: good.bytes, decoded: { reject: 'future' } })).toBeNull();
    expect(hear(r, good)).not.toBeNull();
  });

  // @spec RELAY-002
  it('identifies a packet by all bytes but byte 16 and keeps the 4,096 most recent identities', async () => {
    const r = createRelay(stub(0.9, 0.9, 0.9));
    const h = await heard({ hops: 4 });
    const first = hear(r, h) as { id: string };
    const zeroed = h.bytes.slice();
    zeroed[16] = 0;
    expect(first.id).toBe(hex(zeroed));
    expect(first.id).toMatch(/^[0-9a-f]{50}$/);

    const forged = h.bytes.slice();
    forged[24] ^= 1; // other MAC: a different identity, so it does not suppress the real one
    expect(hear(r, { bytes: forged, decoded: { reject: 'unknown-tag' } })).toMatchObject({ send: expect.any(Uint8Array) });

    const copy = h.bytes.slice();
    copy[16] = 2; // same message, fewer hops left
    expect(hear(r, { bytes: copy, decoded: h.decoded }, T + 1000)).toEqual({ cancel: first.id });

    // A fresh relay: h, then 4,095 other identities fill it to exactly 4,096.
    const lru = createRelay(stub());
    expect(hear(lru, h)).not.toBeNull();
    for (let i = 0; i < 4095; i++) hear(lru, fill(i));
    expect(hear(lru, h, T + 60_000)).toBeNull(); // still held at 4,096, and now the most recently heard
    hear(lru, fill(4095)); // evicts fill(0), the least recently heard, not h, the first inserted
    expect(hear(lru, h, T + 60_000)).toBeNull();
    expect(hear(lru, fill(0), T + 60_000)).toMatchObject({ send: expect.any(Uint8Array) }); // evicted, so heard as new
  });

  // @spec RELAY-003
  it('sends a new copy with byte 16 lowered by one and leaves the heard bytes alone', async () => {
    const r = createRelay(stub(0.5));
    const h = await heard({ hops: 3 });
    const before = h.bytes.slice();
    const a = hear(r, h) as { send: Uint8Array };
    expect(a.send).not.toBe(h.bytes);
    expect(a.send).toHaveLength(25);
    expect(a.send[16]).toBe(2);
    expect([...a.send.subarray(0, 16), ...a.send.subarray(17)]).toEqual([...before.subarray(0, 16), ...before.subarray(17)]);
    expect(h.bytes).toEqual(before);

    const raised = hear(createRelay(stub()), await heard({ hops: 200, nonce: 9 })) as { send: Uint8Array };
    expect(raised.send[16]).toBe(3); // clamped to 4, then lowered
  });

  // @spec RELAY-004
  it('never relays at hops 0 but counts the hearing', async () => {
    const rand = stub();
    const r = createRelay(rand);
    const h = await heard({ hops: 0 });
    expect(hear(r, h)).toBeNull();
    const fresh = h.bytes.slice();
    fresh[16] = 3;
    expect(hear(r, { bytes: fresh, decoded: h.decoded })).toBeNull(); // second hearing: silent
    expect(rand.calls).toBe(0);
  });

  // @spec RELAY-005
  it('draws one random value per scheduled send and backs off in 3 s slots', async () => {
    const draws = [0, 0.24, 0.25, 0.5, 0.74, 0.99]; // 0.24 and 0.74 round up but floor down
    const slots = [0, 0, 1, 2, 2, 3];
    const rand = stub(...draws);
    const r = createRelay(rand);
    for (let n = 0; n < draws.length; n++) {
      expect(hear(r, await heard({ nonce: 1 + n }))).toMatchObject({ atMs: T + slots[n] * 3000 });
    }
    expect(rand.calls).toBe(6);
    hear(r, await heard({ nonce: 3 }));
    hear(r, await heard({ nonce: 40, hops: 0 }));
    hear(r, await heard({ nonce: 50, type: TYPES.GRID_ALERT }, PUB), T, { state: 'LIVE', tier: 'GREEN' });
    hear(r, await heard({ type: 9, nonce: 60 }, A, false)); // not forwardable
    expect(rand.calls).toBe(6);
  });

  // @spec RELAY-006
  it('cancels a pending send when a copy is heard before it fires, and stays silent after', async () => {
    const r = createRelay(stub(0.5, 0));
    const h = await heard();
    const { id } = hear(r, h) as { id: string };
    expect(hear(r, h, T + 1000)).toEqual({ cancel: id });
    expect(hear(r, h, T + 2000)).toBeNull(); // nothing left to cancel
    expect(hear(r, h, T + 9000)).toBeNull();

    const g = await heard({ nonce: 7 });
    hear(r, g); // fires at T (slot 0)
    expect(hear(r, g, T)).toBeNull(); // heard at the send time: too late to cancel
  });

  // @spec RELAY-007
  it('relays a grid alert only when the tracker agrees or hears no hum', async () => {
    const r = createRelay(stub());
    const alert = (nonce: number) => heard({ type: TYPES.GRID_ALERT, nonce }, PUB);
    expect(hear(r, await alert(1), T, { state: 'LIVE', tier: 'GREEN' })).toBeNull();
    expect(hear(r, await alert(2), T, { state: 'CALIBRATING' })).toBeNull();
    expect(hear(r, await alert(3), T, { state: 'LIVE' })).toBeNull();
    expect(hear(r, await alert(4), T, { state: 'LIVE', tier: 'AMBER' })).not.toBeNull();
    expect(hear(r, await alert(5), T, { state: 'LIVE', tier: 'RED' })).not.toBeNull();
    expect(hear(r, await alert(6), T, NO_HUM)).not.toBeNull();

    const once = await alert(1);
    expect(hear(r, once, T + 1000, NO_HUM)).toBeNull(); // counted at its first hearing, so silent now

    // The rule is for verified grid alerts only: other packets go out whatever the tracker reads.
    let nonce = 10;
    for (const tracker of [{ state: 'LIVE', tier: 'GREEN' }, { state: 'CALIBRATING' }] as TrackerView[]) {
      expect(hear(r, await heard({ nonce: nonce++ }), T, tracker)).not.toBeNull(); // verified OK
      expect(hear(r, await heard({ type: 0, nonce: nonce++ }, A, false), T, tracker)).not.toBeNull(); // foreign type 0
      for (const type of [TYPES.HOLD_WATER, TYPES.ROUTE, TYPES.LEDGER_HEAD]) { // other verified public types
        expect(hear(r, await heard({ type, nonce: nonce++ }, PUB), T, tracker)).not.toBeNull();
      }
    }
  });

  // @spec RELAY-008
  it('never relays an echo of its own packet', async () => {
    const r = createRelay(stub());
    const h = await heard();
    r.own(h.bytes);
    const echo = h.bytes.slice();
    echo[16] = 2;
    expect(hear(r, { bytes: echo, decoded: h.decoded })).toBeNull();
    expect(() => r.own(new Uint8Array(24))).toThrow(RangeError);
    expect(() => r.own(new Uint8Array(26))).toThrow(RangeError);
  });

  // @spec RELAY-009
  it('is deterministic from its Rng and rejects a bad clock or random value', async () => {
    const run = async () => {
      const r = createRelay(seeded(42, 'relay'));
      const out = [];
      for (let n = 0; n < 5; n++) out.push(hear(r, await heard({ nonce: n })));
      return out;
    };
    expect(await run()).toEqual(await run());

    const h = await heard();
    expect(() => hear(createRelay(stub()), h, NaN)).toThrow(RangeError);
    expect(() => hear(createRelay(stub(1)), h)).toThrow(RangeError);
    expect(() => hear(createRelay(stub(-0.1)), h)).toThrow(RangeError);
    expect(() => hear(createRelay(stub(NaN)), h)).toThrow(RangeError);

    // A throw changes no count: the same packet is then heard for the first time.
    const r = createRelay(stub(1, 0.5));
    expect(() => hear(r, h)).toThrow(RangeError);
    expect(() => hear(r, h, NaN)).toThrow(RangeError);
    expect(hear(r, h)).toMatchObject({ atMs: T + 6000 });

    // A forwardable result paired with bytes that are not 25 long.
    const foreign = { reject: 'unknown-tag' as const };
    const short = createRelay(stub());
    for (const n of [24, 26]) {
      const b = new Uint8Array(n);
      b.set(h.bytes.subarray(0, Math.min(n, 25)));
      expect(() => hear(short, { bytes: b, decoded: foreign })).toThrow(RangeError);
      expect(() => hear(short, { bytes: b, decoded: h.decoded })).toThrow(RangeError);
    }
    expect(hear(short, { bytes: h.bytes.subarray(0, 24), decoded: { reject: 'length' } })).toBeNull();

    // A length throw inserts nothing: h plus 4,095 others still fit in 4,096, so h is not evicted.
    const lru = createRelay(stub());
    expect(hear(lru, h)).not.toBeNull();
    const long = new Uint8Array(26);
    long.set(h.bytes);
    expect(() => hear(lru, { bytes: long, decoded: foreign })).toThrow(RangeError);
    for (let i = 0; i < 4095; i++) hear(lru, fill(i));
    expect(hear(lru, h, T + 60_000)).toBeNull(); // still counted
  });
});
