---
parent: high-level-design
prefix: BREATH
---

# Breath Count

## Context and design philosophy

Breath Count turns a one-minute count of a child's breaths and five yes/no danger signs into a colour card and, for RED and AMBER, a medicine request. It serves problem 10 (basic care for people who cannot reach a clinic) and feeds problem 9 (outbreak reports): each request is also a case report. It is a decision aid that follows the WHO chart for community health workers, not a medical device. It classifies children aged 2 months up to 5 years only.

It is pure computation: the phone supplies the tap times, the elapsed time and the label, and gets back one result. No clock, no randomness, no state. It prefers asking for a recount to guessing: a short count is never scaled up to a minute.

## Classification

Ages are in months, any finite number from 0. Tap times are milliseconds since the count started. The checks run in this order and the first that applies decides:

| # | Condition | Classification | Rate |
| --- | --- | --- | --- |
| 1 | Age 60 months or more | none (`null`) | null |
| 2 | Age under 2 months | `REFER_YOUNG` | null |
| 3 | Any danger sign is yes | `RED` | counted rate, or null if the count was short |
| 4 | Count stopped before 60 s | `RECOUNT` (short) | null |
| 5 | Rate under 10 or over 120 per minute | `RECOUNT` (implausible) | counted rate |
| 6 | Rate at or above the age threshold | `AMBER` | counted rate |
| 7 | Otherwise | `GREEN` | counted rate |

**Danger signs:** chest indrawing, unable to drink or breastfeed, vomits everything, convulsions, unusually sleepy or unconscious.

**Age threshold (fast breathing):** 50 per minute from 2 up to 12 months, 40 per minute from 12 up to 60 months. An age of exactly 12 months takes 40.

**Counting.** Only taps at `0 ≤ t < 60000` ms count. A tap less than 250 ms after the previous counted tap is a double tap and is dropped; `ignoredTaps` reports how many. The rate is the number of counted taps (breaths in 60 s), reported only when the count ran at least 60 s (`elapsedMs ≥ 60000`). Taps at 60 s or later are not counted.

**Bad input** is a caller bug and throws `RangeError`: an age or `elapsedMs` that is negative or not finite, or a tap that is negative, not finite, later than `elapsedMs` or earlier than the tap before it.

## Cards

Each classification has one fixed plain-language card (`CARDS` in `breath.ts`). Cards hold no numbers, so the rate is shown by the phone beside its label. Every result also carries the fixed `DISCLAIMER`:

> Decision aid, not a medical device. It follows the WHO chart for community health workers, for children aged 2 months up to 5 years. If you are worried, take the child to a health worker.

## Medicine request (NEED packet)

After a RED or AMBER card the phone may send a NEED packet (type 1, existing codec, unchanged). Breath Count defines only the payload `code` and `value`; the phone fills member, level, sector and flags.

| Code | Meaning | `value` |
| --- | --- | --- |
| `0x10` | RED: urgent referral and medicine | rate, or 0 if the count was short |
| `0x11` | AMBER: fast breathing, medicine | rate |

`0x10` to `0x1F` are reserved for care requests. Other classifications give no request.

## Interface

- `classify({ ageMonths, tapsMs, elapsedMs, signs, label }): BreathResult`, where `signs` holds the five booleans and `label` is the caller's `Label`.
- `BreathResult` is `{ classification, rate, threshold, ignoredTaps, card, disclaimer, label }`. `threshold` is null outside 2 to 60 months.
- `needRequest(result): { code, value } | null`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
| --- | --- | --- | --- |
| Short count | No rate, recount | Extrapolate to 60 s | WHO counts a full minute; breathing is irregular in young children, so 20 s times 3 can cross a threshold either way |
| Under 2 months | Refer, no classification | WHO young-infant threshold of 60 | The 60 threshold belongs to the young-infant chart, which could not be cited from the source in hand; referral is the safe default |
| Danger sign with a short count | RED | Recount first | A danger sign needs no rate; a recount delays an urgent referral |
| Double taps | Drop taps under 250 ms after the last counted one | No debounce; average intervals | 250 ms allows 240 per minute, above any real rate, and catches a finger bounce |
| Implausible rate | Recount outside 10 to 120 | Classify anyway | Under 10 is usually missed taps, and GREEN would be the dangerous error; over 120 is usually stray taps |
| Card text | Fixed strings, no numbers | Template with the rate | Numbers stay where the phone can label them LIVE, REPLAY or SIMULATED |
| Request codes | `0x10`, `0x11` in a reserved care block | Codes 1 and 2 | Leaves low codes free for food and water NEEDs (problem 12) |

## Open Questions & Future Decisions

### Deferred
1. Whether to add the WHO young-infant threshold (60 per minute) once its chart can be cited, in place of `REFER_YOUNG`.
2. Whether a rate over 120 should give AMBER (the safer colour) instead of a recount.
3. Whether the request should carry the age as well as the rate, for the outbreak estimate in problem 9.

## References

- WHO, *Caring for the sick child in the community* (IMCI chart for community health workers): https://ncbi.nlm.nih.gov/books/NBK143752/
- `docs/intent/packet/packet-design.md` (payload layout)
