# Packet specs

Prefix `PKT`. Design: `packet-design.md`. The problems served are in brackets.

- [ ] **PKT-001** [7, 8]: When encoding, the codec shall produce exactly 25 bytes laid out as version and type, low 16 bits of the Unix minute, nonce, group tag, encrypted payload, hops left and MAC, as in the layout table of `packet-design.md`.
- [ ] **PKT-002** [7, 8]: The codec shall compute the group tag as HMAC(Ktag, M), the keystream as HMAC(Kenc, byte 0 ‖ M ‖ nonce) and the MAC as HMAC(Kmac, M ‖ bytes 0–15), where M is the full Unix minute as 4 bytes big-endian, each truncated to 4, 6 and 8 bytes.
- [ ] **PKT-003** [7, 8]: When deriving a key set, the codec shall normalise the words (trim, collapse whitespace, lower-case, Unicode NFKD), return an `unknown-word` error naming any word not on the 2,048-word list, and otherwise derive Ktag, Kenc and Kmac with HKDF-SHA-256 over the UTF-8 words, salt `STRATUM-v3` and info `tag`, `enc` and `mac`.
- [ ] **PKT-004** [8]: When generating a family's words, the codec shall map the first 66 bits of 9 caller-supplied random bytes to six words of the 2,048-word list.
- [ ] **PKT-005** [7, 8]: The encoder shall take type, Unix minute, nonce, hops and payload from its caller and shall not generate randomness or read a clock itself.
- [ ] **PKT-006** [7, 8]: When decoding, the codec shall check length, version, age, tag, MAC, type and seen-set in that order and return the first failure as reason `length`, `version`, `future`, `stale`, `unknown-tag`, `mac` or `type`, without throwing.
- [ ] **PKT-007** [7, 8]: When decoding, the codec shall resolve the 16-bit minute to the absolute Unix minute nearest the caller-supplied current time, and reject the packet as `future` if that minute is more than 2 minutes ahead or as `stale` if it is more than 24 hours behind.
- [ ] **PKT-008** [7, 8]: When decoding, the codec shall try the MAC under every held key set whose tag matches bytes 6–9 for the resolved minute, accept the first that verifies, and ignore byte 16 (hops left) in that check.
- [ ] **PKT-009** [1, 4, 5, 7, 8, 13]: If a verified packet's type is undefined (8–15), or is OK under the public key set, or is GRID_ALERT, HOLD_WATER, ROUTE or LEDGER_HEAD under a family key set, then the decoder shall reject it with reason `type`.
- [ ] **PKT-010** [7, 8]: When a verified packet's (key set, minute, nonce) is already in the seen-set (the 4,096 most recent verified packets, oldest evicted first), the decoder shall return it marked duplicate with the number of times heard instead of as a new message; rejected packets shall not enter the seen-set.
- [ ] **PKT-011** [1, 4, 5, 13]: When a packet verifies under the public key set (derived from the phrase `stratum public channel`), the decoder shall mark it `public`.
- [ ] **PKT-012** [2, 4, 5, 7, 8, 9, 10, 12]: When a packet verifies, the decoder shall return its type, decrypted payload fields (member, code, level, sector, flags, value), hops left clamped to 4, resolved minute, the matched key set's id, and the duplicate flag and count.
