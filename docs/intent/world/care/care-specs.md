# Care delivery model specs

Prefix `WORLD-CARE`. Design: `care-design.md`. The problems served are in brackets. Event times are hours; request times are world seconds.

- [x] **WORLD-CARE-001** [10]: `careRequests(events, rng)` shall, for each `care` event in script order, make `round(red × durH / 24)` RED requests then `round(amber × durH / 24)` AMBER requests, each with exactly two draws, time `atH × 3600 + u × durH × 3600` then sector `floor(u × 24)`, ignore events of other types, and return the requests sorted by time with ties in draw order.
- [x] **WORLD-CARE-002** [10]: `firstCareMin(hops)` shall return `hops × HOP_MIN` and `busyMin(hops)` shall return `2 × hops × HOP_MIN + VISIT_MIN`.
- [x] **WORLD-CARE-003** [10]: Given the same events and the same `rng` sequence, `careRequests` shall return identical requests.
- [x] **WORLD-CARE-004** [10]: The care functions shall throw a RangeError for hops that are not a non-negative integer, or a `care` event with a non-finite `atH` or a negative or non-finite `durH`, `red` or `amber`.
