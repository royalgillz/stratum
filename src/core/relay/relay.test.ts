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

describe('relay', () => {
  // @spec RELAY-001
  it('forwards verified and foreign unknown-tag packets of types 0 to 3, nothing else', async () => {
    const r = createRelay(stub());
    const foreign = await heard({}, A, false);
    expect(foreign.decoded).toEqual({ reject: 'unknown-tag' });
    expect(hear(r, foreign)).toMatchObject({ atMs: T });
    expect(hear(r, await heard({ type: TYPES.NEED, nonce: 1 }, A, false))).not.toBeNull();
    expect(hear(r, await heard({ type: TYPES.GRID_ALERT, nonce: 2 }, A, false))).toBeNull(); // public-only type, unknown tag: forged
    expect(hear(r, await heard({ type: 9, nonce: 3 }, A, false))).toBeNull(); // undefined type
    expect(hear(r, await heard({ nonce: 4, minute: MIN - 2 * 24 * 60 }))).toBeNull(); // stale

    const good = await heard({ nonce: 5 });
    const bad = { bytes: good.bytes.slice(), decoded: { reject: 'mac' as const } };
    bad.bytes[12] ^= 1;
    expect(hear(r, bad)).toBeNull();
    expect(hear(r, good)).not.toBeNull(); // the rejected copy was not counted
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

    for (let i = 0; i < 4096; i++) {
      const b = new Uint8Array(25);
      b[0] = 0x30; b[16] = 0; b[3] = i >> 8; b[4] = i & 255; b[5] = 0xee;
      r.hear(b, { reject: 'unknown-tag' }, NO_HUM, T);
    }
    expect(hear(r, h, T + 60_000)).toMatchObject({ id: first.id }); // evicted, so heard as new
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
    const rand = stub(0, 0.5, 0.99);
    const r = createRelay(rand);
    expect(hear(r, await heard({ nonce: 1 }))).toMatchObject({ atMs: T });
    expect(hear(r, await heard({ nonce: 2 }))).toMatchObject({ atMs: T + 6000 });
    expect(hear(r, await heard({ nonce: 3 }))).toMatchObject({ atMs: T + 9000 });
    expect(rand.calls).toBe(3);
    hear(r, await heard({ nonce: 3 }));
    hear(r, await heard({ nonce: 4, hops: 0 }));
    hear(r, await heard({ nonce: 5, type: TYPES.GRID_ALERT }, PUB), T, { state: 'LIVE', tier: 'GREEN' });
    expect(rand.calls).toBe(3);
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
  });
});
