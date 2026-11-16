---
parent: high-level-design
prefix: BREATH
---

# Breath Count

## Context and design philosophy

Breath Count turns a one-minute count of a child's breaths, a yes/no for cough or difficult breathing and five yes/no danger signs into a colour card and, for RED and AMBER, a medicine request. It serves problem 10 (basic care for people who cannot reach a clinic). It does not yet feed problem 9: a medicine request is not a case report until a case-report format exists (open question 4). It is a decision aid that follows part of the WHO chart for community health workers, not a medical device: it asks five of the chart's eleven danger signs, and says so. It classifies children aged 2 months up to 5 years only.

It is pure computation: the phone supplies the tap times, the elapsed time and the label, and gets back one result. No clock, no randomness, no state. It prefers asking for a recount to guessing: a short count is never scaled up to a minute.

## Classification

Ages are in months, any finite number from 0. Tap times are milliseconds since the count started. The checks run in this order and the first that applies decides:

| # | Condition | Classification | Rate |
| --- | --- | --- | --- |
| 1 | Age 60 months or more | none (`null`) | null |
| 2 | Age under 2 months | `REFER_YOUNG` | null |
| 3 | Any danger sign is yes | `RED` | counted rate, or null if the count was short |
| 4 | No cough or difficult breathing | `NOT_ASSESSED` | counted rate, or null if the count was short |
| 5 | Count stopped before 60 s | `RECOUNT` (short) | null |
| 6 | Rate under 10 or over 120 per minute | `RECOUNT` (implausible) | counted rate |
| 7 | A gap over 3 median intervals (missed taps) | `RECOUNT` (gap) | counted rate |
| 8 | Rate at or above the age threshold | `AMBER` | counted rate |
| 9 | Otherwise | `GREEN` | counted rate |

**Danger signs:** chest indrawing, unable to drink or breastfeed, vomits everything, convulsions, unusually sleepy or unconscious. Only these five fields are read, and only the value `true` counts, so a phone that passes its whole form cannot trigger RED by accident. The chart's other six (cough 21 days or more, diarrhoea 14 days or more, blood in stool, fever 7 days or more, red on the MUAC strap, swelling of both feet) are not asked.

**Cough.** The chart says "If cough, count breaths in 1 minute", and its fast-breathing row is the pneumonia classification. Without cough or difficult breathing the aid gives `NOT_ASSESSED` and no request.

**Age threshold (fast breathing):** 50 per minute from 2 up to 12 months, 40 per minute from 12 up to 60 months. An age of exactly 12 months takes 40.

**Counting.** Only taps at `0 ≤ t < 60000` ms count. A tap less than 250 ms after the previous counted tap is a double tap and is dropped; `ignoredTaps` reports how many. The rate is the number of counted taps (breaths in 60 s), reported only when the count ran at least 60 s (`elapsedMs ≥ 60000`). Taps at 60 s or later are not counted. **Gaps:** the gaps are 0 to the first counted tap, each interval between counted taps, and the last counted tap to 60 s. A gap over 3 times the median interval (upper middle for an even number) means taps were missed, and the count is redone rather than read as a slow rate.

**Bad input** is a caller bug and throws `RangeError`: an age or `elapsedMs` that is negative or not finite, or a tap that is negative, not finite, later than `elapsedMs` or earlier than the tap before it.

## Cards

Each classification has one fixed plain-language card (`CARDS` in `breath.ts`). Cards hold no numbers, so the rate is shown by the phone beside its label. Every result also carries the fixed `DISCLAIMER`:

> Decision aid, not a medical device. It checks breathing and five danger signs only, from the WHO chart for community health workers, for children aged 2 months up to 5 years. The chart has other danger signs this aid does not ask about. If you are worried, take the child to a health worker.

## Medicine request (NEED packet)

After a RED or AMBER card the phone may send a NEED packet (type 1, existing codec, unchanged). Breath Count defines only the payload `code` and `value`; the phone fills member, level, sector and flags.

| Code | Meaning | `value` |
| --- | --- | --- |
| `0x10` | RED: urgent referral and medicine | rate, or 0 if the count was short |
| `0x11` | AMBER: fast breathing, medicine | rate |

`0x10` to `0x1F` are reserved for care requests. Other classifications give no request. These are medicine requests only, not case reports: the key set they go under, and how one child's repeated requests are merged, are open (question 4).

## Interface

- `classify({ ageMonths, cough, tapsMs, elapsedMs, signs, label }): BreathResult`, where `cough` is cough or difficult breathing, `signs` holds the five booleans and `label` is the caller's `Label`.
- `BreathResult` is `{ classification, rate, threshold, ignoredTaps, card, disclaimer, label }`. `threshold` is null outside 2 to 60 months.
- `needRequest(result): { code, value } | null`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
| --- | --- | --- | --- |
| Short count | No rate, recount | Extrapolate to 60 s | WHO counts a full minute; breathing is irregular in young children, so 20 s times 3 can cross a threshold either way |
| Under 2 months | Refer, no classification | WHO young-infant threshold of 60 | The cited chart booklet covers 2 months up to 5 years only and holds no young-infant threshold; referral is the safe default |
| Danger sign with a short count | RED | Recount first | A danger sign needs no rate; a recount delays an urgent referral |
| Double taps | Drop taps under 250 ms after the last counted one | No debounce; average intervals | 250 ms allows 240 per minute, above any real rate, and catches a finger bounce |
| Implausible rate | Recount outside 10 to 120 | Classify anyway | Under 10 is usually missed taps, and GREEN would be the dangerous error; over 120 is usually stray taps |
| Missed taps inside a full count | Recount on a gap over 3 median intervals | Fixed gap in seconds; no check | An abandoned count reads as a slow rate and a false GREEN; relative to the child's own rhythm, so it scales with age |
| Breaths without cough | `NOT_ASSESSED` | Classify any child | The chart counts breaths only if cough; fast breathing from crying or fever alone would give a false medicine request |
| Danger-sign check | The five named fields, exactly `true` | Any truthy field | A wider form object or a string "false" must not give RED and an urgent request |
| Danger signs asked | Five of eleven, stated in the disclaimer | All eleven | Keeps the tap screen short; the subset is stated, not hidden (open question 5) |
| Card text | Fixed strings, no numbers | Template with the rate | Numbers stay where the phone can label them LIVE, REPLAY or SIMULATED |
| Request codes | `0x10`, `0x11` in a reserved care block | Codes 1 and 2 | Leaves low codes free for food and water NEEDs (problem 12) |

## Open Questions & Future Decisions

### Deferred
1. Whether to add the WHO young-infant threshold (60 per minute) once its chart can be cited, in place of `REFER_YOUNG`.
2. Whether a rate over 120 should give AMBER (the safer colour) instead of a recount.
3. Whether the request should carry the age as well as the rate, for the outbreak estimate in problem 9.
4. A case-report format for problem 9: which key set (a family key hides it from an aggregator; the public key lets anyone read and forge it and tells listeners a sick child's level and sector), and how one child's recounts and re-sends (new nonce each time) are merged so capture-recapture does not double-count.
5. Whether to ask the chart's other six danger signs.

## References

- WHO and UNICEF, *Caring for the sick child in the community*, chart booklet for the community health worker (ISBN 978 92 4 154804 5), in *IMCI: caring for newborns and children in the community*, 2011: https://iris.who.int/handle/10665/44398 . Sections "Identify problems: ASK and LOOK" ("If cough, count breaths in 1 minute"), "Danger Signs" and "Sick but NO Danger Sign" ("50 breaths or more per minute" from 2 up to 12 months, "40 breaths or more per minute" from 12 months up to 5 years).
- `docs/intent/packet/packet-design.md` (payload layout)
