---
parent: high-level-design
prefix: PKT
---

# Packet

## Context and design philosophy

Packet v3 is the one message format of the Mesh engine: 25 bytes carried by sound (ggwave, about 2–3 s on air), relayed hop by hop with no network. It serves problems 7 (organize without the network) and 8 (reconnect families), and carries the residents' reports for 2, 4, 5, 9, 10, 12 and 13.

Three properties matter more than features:
- a forged or altered packet is rejected;
- an old packet can never pass for a new one;
- a listener cannot tell which family sent it.

The codec is pure. Randomness (nonce, key words) and the current time come in from the caller, so the simulation can run the same codec from a seed. On phones the caller must supply nonces from a secure random source, because a repeated nonce within a minute repeats the keystream. Cryptography uses Web Crypto (`crypto.subtle`), which is identical in browsers, workers and Node, so the functions are async.

## Layout (25 bytes)

| Bytes | Field | Notes |
| --- | --- | --- |
| 0 | version (high 4 bits) and type (low 4 bits) | Version 3. Types in the table below |
| 1–2 | minute counter | Unix minute mod 65536, big-endian |
| 3–5 | nonce | 24 bits from the caller |
| 6–9 | group tag | First 4 bytes of HMAC(Ktag, M) |
| 10–15 | payload, encrypted | Payload XOR first 6 bytes of HMAC(Kenc, byte 0 ‖ M ‖ nonce) |
| 16 | hops left | Not covered by the MAC, so a relay lowers it without keys |
| 17–24 | MAC | First 8 bytes of HMAC(Kmac, M ‖ bytes 0–15) |

**M** is the full Unix minute as 4 bytes, big-endian. Only its low 16 bits travel. Because the full minute is bound into the tag, keystream and MAC, a packet replayed after the 16-bit counter wraps (about 45 days) resolves to a different minute and fails the MAC.

The payload is 6 bytes: member (1), status or codebook code (1), level 1–6 in the high 4 bits and sector within the level 0–3 in the low 4 bits (1), flags with bit 0 = power on (1), and a big-endian value (2). Adapters map level and sector to the `World.sectors` index as (level − 1) × 4 + sector.

| Type | Code | Key set |
| --- | --- | --- |
| OK | 0 | family only |
| NEED, REPORT, CODEBOOK | 1, 2, 3 | family or public, the sender's choice |
| GRID_ALERT, HOLD_WATER, ROUTE, LEDGER_HEAD | 4, 5, 6, 7 | public only |
| 8–15 | none | undefined, rejected |

## Keys

The first phone in a family generates six words from a 2,048-word list (66 bits) using random bytes from the caller. Other phones type the words once. Typed words are normalised: trimmed, whitespace collapsed to single spaces, lower-cased and Unicode NFKD. Any word not on the list is rejected before deriving keys, so a typo is caught at entry rather than giving a silently different key.

HKDF-SHA-256 derives three 32-byte keys (Ktag, Kenc, Kmac) from the UTF-8 normalised words, with salt `STRATUM-v3` and info strings `tag`, `enc` and `mac`.

**The public key set** is derived the same way from the published phrase `stratum public channel`. Anyone can read and forge public packets. The MAC still catches damage on air, and decode marks them `public`. Trust in public claims comes from elsewhere (tracker agreement, several distinct senders), not from this codec.

## Decode

A receiver holds its families' key sets plus the public set. Its current time comes from the caller as Unix milliseconds. Decode checks, in this order, and reports the first failure as its reason:

1. **Length:** the input must be exactly 25 bytes (`length`).
2. **Version:** byte 0's high 4 bits must be 3 (`version`).
3. **Age:** resolve the 16-bit minute to the absolute minute nearest the receiver's. It must be no more than 2 minutes ahead (`future`) and no more than 24 hours behind (`stale`).
4. **Tag:** collect every key set whose tag for that minute matches bytes 6–9 (`unknown-tag` if none).
5. **MAC:** the MAC must verify under one of them (`mac`).
6. **Type:** the type must be defined and allowed for the matched key set (`type`).
7. **Seen-set:** if (key set, minute, nonce) is already present, return the packet marked duplicate with the number of times heard.
8. **Payload:** decrypt it and return the fields with the packet's own minute, which is the time to display.

Decode never throws on bad bytes. Byte 16 is reported clamped to MAX_HOPS (4), so a raised hops byte cannot carry a packet further. The seen-set holds the 4,096 most recent verified packets and evicts the oldest first. A packet older than 24 hours is rejected anyway, so a forgotten entry cannot return as new.

## Interface

- `deriveKeys(words) → KeySet | { error: 'word-count' } | { error: 'unknown-word', word }`
- `generateWords(random: Uint8Array(9)) → string[6]`, reading bits most-significant first, 11 per word
- `encode(keys, { type, minute, nonce, hops, payload }) → Uint8Array(25)`. Throws RangeError for a field outside its range. It does not enforce which key set a type may use; decode does.
- `createDecoder(familyKeySets, publicKeys)` returns `decode(bytes, nowMs) → Decoded | { reject: reason }`. Each family key set carries a caller-chosen `id`; the public set's id is `public`.

`Decoded` holds:
- type;
- payload fields;
- `hops`;
- `minute`;
- the matched key set's id;
- `public`;
- `duplicate` and `timesHeard`, which counts the first hearing (so the first repeat reports 2).

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Authentication | Truncated HMAC (8-byte MAC) | ECDSA signature per packet | A P-256 signature is 64 bytes, more than twice the packet |
| Confidentiality | HMAC keystream XOR over 6 bytes | AES-GCM | GCM adds a 16-byte tag and a 12-byte IV; the HMAC keystream fits and reuses one primitive |
| Minute binding | Full 32-bit minute inside every HMAC | Only the 16-bit counter | The counter wraps every 45 days; binding the full minute makes old captures fail the MAC |
| Family privacy | Tag rotates every minute | Fixed family ID | A fixed ID lets any listener follow a family through the tunnels |
| Public messages | Same codec, published keys, types restricted per key set | Separate unauthenticated format | One decode path; per-type key rules stop a forged public OK |
| Seen-set key | (key set, minute, nonce) | (minute, nonce) | Two families can draw the same nonce in a minute; neither message may be lost |
| Randomness | Supplied by the caller | `crypto.getRandomValues` inside the codec | Keeps `src/core` deterministic for seeded simulation |
| Key material | Six generated words, validated on entry | User-chosen passphrase | People choose guessable passphrases; validation turns typos into errors instead of a silent wrong key |

## Open Questions & Future Decisions

### Deferred
1. The 2,048-word list and its licence (BIP-39 English is the candidate). Record it in `docs/params.md` before key generation ships.
2. A short check code shown on both phones to confirm they derived the same keys.
3. Clock skew between phones underground beyond the 2-minute future window: a known limit for now, to be listed in `docs/limits.md`.

## References

- `docs/plan.md` § Packet v3; `docs/spikes.md` T2 (HKDF and HMAC verified in Chrome on Android and in Edge)
- RFC 5869 (HKDF), RFC 2104 (HMAC)
