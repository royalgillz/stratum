# Breath Count specs

Prefix `BREATH`. Design: `breath-design.md`. The problems served are in brackets. "In range" means an age of at least 2 and under 60 months. "A full count" means `elapsedMs ≥ 60000`. "Counted taps" are defined by BREATH-004.

- [x] **BREATH-001** [10]: Before classifying, `classify` shall throw a `RangeError` when `ageMonths` or `elapsedMs` is negative or not finite, or when any tap time is negative, not finite, greater than `elapsedMs`, or less than the tap time before it.
- [x] **BREATH-002** [10]: When `ageMonths` is 60 or more, `classify` shall return classification `null`, rate `null`, threshold `null` and the out-of-range card, whatever the taps and danger signs.
- [x] **BREATH-003** [10]: When `ageMonths` is under 2, `classify` shall return classification `REFER_YOUNG`, rate `null`, threshold `null` and the too-young card, whatever the taps and danger signs.
- [x] **BREATH-004** [9, 10]: `classify` shall count, in time order, each tap with `0 ≤ t < 60000` ms whose time is at least 250 ms after the previous counted tap, shall report the number of taps in that interval not counted as `ignoredTaps`, and shall leave taps at 60000 ms or later out of both.
- [x] **BREATH-005** [9, 10]: When the age is in range and the count is full, `classify` shall report the rate as the number of counted taps in breaths per minute; when the count is not full, it shall report rate `null` and shall not scale a partial count to a minute.
- [x] **BREATH-006** [10]: When the age is in range, `classify` shall report a threshold of 50 breaths per minute for ages under 12 months and 40 for ages of 12 months or more.
- [x] **BREATH-007** [9, 10]: When the age is in range and any of the five danger signs (chest indrawing, unable to drink or breastfeed, vomits everything, convulsions, unusually sleepy or unconscious) is true, `classify` shall return `RED` and the RED card, with the rate given by BREATH-005, whether or not the count is full.
- [x] **BREATH-008** [10]: When the age is in range, no danger sign is true and the count is not full, `classify` shall return `RECOUNT` and the short-count card.
- [x] **BREATH-009** [10]: When the age is in range, no danger sign is true, the count is full and the rate is under 10 or over 120, `classify` shall return `RECOUNT` and the implausible-rate card, with the rate reported.
- [x] **BREATH-010** [9, 10]: When the age is in range, no danger sign is true, the count is full and the rate is from 10 to 120 inclusive, `classify` shall return `AMBER` and the AMBER card if the rate is at or above the threshold, and `GREEN` and the GREEN card otherwise.
- [x] **BREATH-011** [10]: Every result of `classify` shall carry the fixed `DISCLAIMER`, the caller's label, `ignoredTaps` and exactly one card from `CARDS`, with no digit in the card text, and the same input shall always give the same result.
- [x] **BREATH-012** [9, 10]: `needRequest` shall return `{ code: 0x10, value }` for a `RED` result and `{ code: 0x11, value }` for an `AMBER` result, where `value` is the rate or 0 when the rate is `null`, and `null` for any other classification.
