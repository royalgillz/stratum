# Report tally specs

Prefix `TALLY`. Design: `tally-design.md`. The problems served are in brackets.

- [x] **TALLY-001** [2, 4, 5, 9]: `tally(heard)` shall count only packets of type REPORT (2), HOLD_WATER (5) or ROUTE (6) whose `duplicate` is false, and shall return one row per distinct `(type, code, level, sector)` among them.
- [x] **TALLY-002** [2, 4, 5, 9]: Each row shall hold `packets` (the packets counted in it), `senders` (the number of distinct payload member bytes), `people` (the sum over those senders of the value field of each sender's latest packet in the row, by largest minute, later in the array on a tie) and `newest` (the largest packet minute).
- [x] **TALLY-003** [2, 4, 5, 9]: A row shall be `confirmed` when its `senders` is at least `CONFIRM` = 3, and not confirmed otherwise.
- [x] **TALLY-004** [2, 4, 5, 9]: `tally` shall order rows by `newest` descending, then by type, code, level and sector ascending.
