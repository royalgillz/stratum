---
parent: high-level-design
prefix: WIT
---

# Witness

## Context and design philosophy

Witness holds the evidence. It does two jobs with one small module: it notices when a measured quantity has changed, and it keeps a tamper-evident record of what residents measured beside what the Directorate announced. It serves problems 1 (neighbours' power reports), 4 (water), 9 (outbreak reports) and 13 (surface truth).

It is pure computation. Time comes in from the caller, there is no randomness and no storage: the caller owns the ledger arrays (`World.ledger`), and Witness appends to them. It prefers saying nothing to saying something wrong: with too little history, the detector reports no event and `gap` reports NaN.

## Change detector

One detector runs per stream, a stream being one `(kind, where)` pair, over measured observations only. Streams are independent, so conductivity at one sector never affects another.

- **Rolling baseline:** the last 48 admitted readings. Their median is the baseline and their median absolute deviation (MAD) gives the scale: `scale = max(1.4826 × MAD, 1% of |median|, 1e-9)`. The floor stops a flat series from making every wobble an alarm. Nothing is judged until 24 readings are admitted.
- **Residual:** `z = (x − median) / scale`. A reading is *exceeding* when `|z| ≥ 4`.
- **Persistence:** an event opens when 3 of the last 5 readings are exceeding. This removes single spikes and fires 3 readings after onset.
- **Admission:** an exceeding reading is not admitted to the baseline, and no reading is admitted while an event is open, so a long event cannot pull the baseline up to meet it.
- **An event** is `{ kind, where, tStart, tDetect, direction, peakZ }`. `tStart` is the time of the earliest exceeding reading among the last 5, `tDetect` the time of the reading that completed 3 of 5, `direction` the sign (+1 or −1) of that last reading's residual, `peakZ` the largest |z| among the event's exceeding readings. A median of an even count is the upper middle value. The last-5 window counts every reading after the first 24, admitted or not. `tDetect − tStart` is the detection delay that the HOLD WATER alert must beat. The event closes (`tEnd` set) after 5 consecutive non-exceeding readings, and admission resumes.

The water adapter combines the four channels by listening for an event on any of them. GECCO 2018 is scored by feeding its series through `observe` and comparing `events()` with its labels, so the scored code is the demoed code.

## Ledger

Two chains: `measured` and `official`. `observe` routes by `source`: a source equal to `official` or starting with `official:` goes to `official`, anything else (a crew id, a packet sender) to `measured`. Entries are the `LedgerEntry` of `contracts.ts`, appended in call order and never changed or removed.

**Hash, byte-exact.** For each chain, `prev` is 32 bytes: for the chain's first entry, the SHA-256 of the UTF-8 string `STRATUM-ledger-v1:measured` (or `:official`), the chain's *genesis*; afterwards the previous entry's hash as raw bytes. Then

`hash = SHA-256( prev ‖ t ‖ value ‖ lp(kind) ‖ lp(where) ‖ lp(source) )`

where `t` and `value` are 8-byte big-endian IEEE-754 doubles (`-0` written as `0`), and `lp(s)` is a 2-byte big-endian length followed by the UTF-8 bytes of `s`. The stored `hash` is the lowercase hex of the result. The *chain head* is the last entry's hash, or the genesis hex when the chain is empty. Another device holding the entries recomputes every hash with nothing else. `t` and `value` must be finite and each string at most 65535 UTF-8 bytes; otherwise `observe` throws RangeError and appends nothing.

**Synchronous SHA-256.** `observe` returns `void`, but Web Crypto digests are async. Witness therefore carries its own SHA-256 in about 40 lines of pure TypeScript, written to FIPS 180-4 and checked against the standard vectors and against `crypto.subtle` in Node. Every entry is complete the moment `observe` returns, in browsers, workers and the simulation, with no awaiting and no ordering races between simultaneous observations. SHA-256 is SHA-256 either way, so the chain equals one made with `crypto.subtle`.

## Measured beside official

`gap(kind)` is, over the `where` values that have both a measured and an official entry of that kind, the mean of (latest measured value − latest official value). It is in the kind's own unit, positive when residents measured more than was announced. With no such `where`, it is NaN: no pair is not a gap of zero.

## Ledger digest

`digest()` is the first 16 bytes of the **measured** chain head (32 hex characters). The `LEDGER_HEAD` packet carries its first 6 bytes, the whole packet payload (packet design). A device holding the same measured entries recomputes the head and compares; a mismatch means the two copies differ somewhere. The official chain's head is exposed beside it.

## Two small estimators

- **Capture-recapture (problem 9):** from two lists of sizes `n1`, `n2` with `m` cases on both, the Chapman estimate `N = (n1+1)(n2+1)/(m+1) − 1`, variance `(n1+1)(n2+1)(n1−m)(n2−m) / ((m+1)²(m+2))` and a 95% interval `N ± 1.96·√var`, the lower end not below `n1 + n2 − m`. A pure function. Inputs that cannot occur (negative, or `m` above either list) throw RangeError.
- **Quorum (problem 13):** from readings of one gas, take each crew's latest, compute the median, and count crews within 25% of it. If at least 3 distinct crews agree, the median is accepted with that count; otherwise the result is "no quorum" and no value. Signature checking happens before a reading reaches Witness (the packet decoder's key set is the crew identity); Witness trusts `source` as given. Turning the accepted median into an exposure band is the surface-return adapter's job.

## Interface

`createWitness({ now: () => number, ledger: World['ledger'] })` returns a `Witness` (`observe`, `gap`) plus:

- `events(): DetectorEvent[]`, ordered by `tDetect`;
- `head(chain): string` and `digest(): string` (32 hex characters, the first 16 bytes of the measured head).

Free functions: `sha256(bytes): Uint8Array`, `verifyChain(entries, chain): { ok: true } | { ok: false, index }`, `chapman(n1, n2, m)`, `quorum(readings)`. If `ledger` already holds entries (restored from storage), the head is read from the last entry; callers run `verifyChain` first. The detector's state is not stored: after a restart it rebuilds by replaying the measured entries through the detector.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Hashing under a synchronous `observe` | Own pure-TS SHA-256 | `crypto.subtle` with a deferred or async fill; queueing observations | The contract is synchronous and the arrays are read by the simulation at once. A deferred hash leaves entries without a hash, and promise ordering would make runs depend on scheduling. 40 lines of tested code is cheaper than either |
| Time | Injected `now()` | Time argument on `observe` (contract change); `Date.now` | The frozen contract has no time argument. Injection keeps core deterministic and lets the world clock drive it |
| Chains | One per list, separate genesis | One interleaved chain | `World.ledger` stores two arrays; each can be checked alone, with no merge order to agree on |
| Measured or official | By `source` prefix | An extra argument; two functions | Fits the frozen signature. Cost: a measured source may not start with `official` |
| Baseline | Median and MAD, 48 readings | Mean and standard deviation; EWMA | Median and MAD are not dragged by the event they detect, and are simple to state and test |
| Persistence | 3 of 5 | One exceedance; 2 of 3 | One exceedance alarms on every spike; 3 of 5 costs two extra readings of delay |
| Baseline during an event | Frozen | Keep adapting | Adapting teaches the baseline that the contamination is normal |
| `gap` with no pair | NaN | 0 | Never fake a reading |
| Digest | Measured head only | Hash of both heads | One chain head to compare, sent as its first bytes in a LEDGER_HEAD packet; officials are the Directorate's own public record |
| Float encoding in the hash | Big-endian float64 | Decimal text | Decimal text differs between languages and locales; bits do not |

## Open Questions & Future Decisions

### Deferred
1. A lasting level shift (a pipe re-plumbed) keeps its event open forever, with the baseline frozen. Needs a re-baseline rule once GECCO shows how often it happens.
2. `gap(kind)` averages over `where`, which hides a deep level that diverges alone. A per-`where` gap or a person-weighted mean are possible; decide when the Shed Ledger screen needs one.
3. A digest over both chains, if the official chain's rewrites should also be caught by the packet.
4. Detector constants (threshold, m of n, window) are assumptions; tune on GECCO, then record the chosen values and the scores in `docs/params.md`.
5. Signed readings: Witness trusts `source`. If crews need signatures that survive outside the mesh, that is a new decision (Web Crypto has no portable Ed25519 yet).

## References

- GECCO 2018 drinking-water data (CC BY 4.0): https://zenodo.org/records/3884398
- Chapman estimator: https://wwwnc.cdc.gov/eid/article/21/12/15-0756_article
- FIPS 180-4 (SHA-256); `docs/intent/packet/packet-design.md` (LEDGER_HEAD); `docs/plan.md` problems 1, 4, 9, 13
