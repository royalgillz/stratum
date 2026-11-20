---
parent: high-level-design
prefix: TALLY
---

# Report tally

## Context and design philosophy

The phone sends public reports by sound (power cut, water looks wrong, flooding, fan stopped, people coughing or sick) and the public HOLD WATER and ROUTE alerts. A listener that only logs them line by line leaves the reader to count. The tally turns every report packet heard into one row per claim and place, so the District 7 page can say how many reports, from how many different senders, and whether the claim is confirmed. It serves problems 2, 4, 5 and 9 (the reports those problems ask residents to send). Food requests (12) are NEED packets, not reports, so the tally does not count them.

It is a pure function over decoded packets. It never reads a clock, keeps no state and does no I/O; the caller keeps the packets it heard and passes them all each time. Labels (the codebook's words) belong to the phone, so a row carries the type and code bytes and the page names them.

## Rows

A **report packet** is a verified packet (codec `Decoded`) of type REPORT (2), HOLD_WATER (5) or ROUTE (6) that is not a repeat (`duplicate` false). Other packets are ignored. One row exists per `(type, code, level, sector)`.

Each row holds the number of packets, the **senders** (distinct payload member bytes), the **people** (for each sender, the value field of its latest packet in that row, summed over senders; 0 means no count was given), and the **newest** packet minute (the sender's clock, as the phone inbox shows it).

**Confirmed** is the phone inbox's rule for public alerts: a claim counts as confirmed at 3 different senders. Public packets are not signed by a person, and member bytes are chosen by the sender, so one person can pose as several; the rule inherits that limit (`docs/limits.md`). Two senders may also count the same sick people, so `people` is an upper count, not a head count.

Rows are ordered newest first; equal minutes by type, code, level, then sector, ascending, so the order never depends on arrival.

## Decisions and alternatives

| Decision | Why | Alternative not taken |
| --- | --- | --- |
| Sender is the member byte alone | The phone inbox counts senders that way; one rule on both screens | (key set, member) as the Shed Ledger does: a family-keyed and a public report from one phone would count twice |
| People from each sender's latest packet, summed | A sender who updates a count replaces it rather than adding to it | Sum of every packet: a resent report would double its people |
| No Chapman estimate from heard reports | Chapman needs a second list and the overlap between the two lists; heard reports carry no names to match against a clinic list | Pair the count with the SIMULATED clinic count: mixes a LIVE and a SIMULATED list and still has no overlap |
