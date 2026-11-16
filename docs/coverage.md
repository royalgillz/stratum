# Coverage: 15 problems

Tiers: **Live** (real device), **Modelled** (algorithm in simulated District 7, measured against
the Directorate baseline), **Thin** (one rule or chart on assumed parameters), **Roadmap** (write-up only).

Claim wording: every problem has a mechanism, a metric and a place on screen, with its tier printed.
Never write "solves".

| # | Problem | Target tier | Mechanism file | Spec IDs | Metric and value | On screen | Label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Warn before power or air cuts | Live (power), Modelled (air) | src/core/tracker/tracker.ts, src/core/shed/shed.ts, src/core/relay/relay.ts (grid alerts) | TRACK-001 to TRACK-012, SHED-001 to SHED-012, RELAY-007 | T1 at 30 cm: ramp error 0.6 mHz typical, 4 mHz worst after smoothing; step seen in 2.7 s | Phone Listen tab (tier), Ledger tab (cut odds per level); judge mode | LIVE (spike); judge mode SIMULATED |
| 2 | Share power, water, food fairly | Modelled, real requests | src/core/shed/shed.ts (who gets cut), src/core/fairshare | SHED-004 to SHED-012, FAIR-001 to FAIR-012 | Shed odds from real reports; allocation not yet run in the district | src/phone/codebook.ts, src/phone/screens/report.ts (sends real reports; no analysis yet); Ledger tab | LIVE (reports) |
| 3 | Keep lower levels livable | Modelled |  |  |  |  |  |
| 4 | Catch bad water before people drink it | Modelled, real data, real reports | src/core/witness (detector) | WIT-001 to WIT-004 | Detector not yet scored on GECCO 2018 | src/phone/codebook.ts, src/phone/screens/report.ts (sends real reports; no analysis yet) | LIVE (reports) |
| 5 | Keep tunnels safe to live in and move through | Modelled, real reports |  |  |  | src/phone/codebook.ts, src/phone/screens/report.ts (sends real reports; no analysis yet) | LIVE (reports) |
| 6 | Find, make or share space | Modelled |  |  |  |  |  |
| 7 | Organize without the network | Live | src/core/packet/codec.ts, keys.ts, src/core/relay/relay.ts | PKT-001 to PKT-012, RELAY-001 to RELAY-009 | T2: 20/20 at 1 m and 3 m; T3: 20/20 with hum playing | Phone Report tab (sends), Listen tab (relay on, count passed on) | LIVE (spike) |
| 8 | Reconnect families | Live | src/core/packet/codec.ts, keys.ts, src/core/relay/relay.ts | PKT-001 to PKT-012 (OK beacons, family keys), RELAY-001 to RELAY-009 (relay through strangers' phones) | Rung 1 phone test pending | Phone Family tab (board with staleness, inbox) | LIVE |
| 9 | Track the real outbreak, route supplies | Modelled, real reports | src/core/witness/chapman.ts | WIT-011 | Case-report format not designed yet (Breath Count medicine requests are not case reports) | src/phone/codebook.ts, src/phone/screens/report.ts (sends real reports; no analysis yet) | LIVE (reports) |
| 10 | Basic care for people who cannot reach a clinic | Live (aid and request), Modelled (delivery) | src/core/care/breath.ts | BREATH-001 to BREATH-012 | Classifier: 12 tests on synthetic taps; delivery not built yet | Phone Care tab (Breath Count, medicine request) | LIVE (aid) |
| 11 | Track and treat life without sunlight | Modelled |  |  |  |  |  |
| 12 | Grow and share neighbourhood food | Modelled, real requests |  |  |  | src/phone/codebook.ts, src/phone/screens/report.ts (sends real reports; no analysis yet) | LIVE (requests) |
| 13 | Prove whether the surface is safe, tell everyone | Modelled, real digest packet | src/core/witness (ledger, quorum) | WIT-005 to WIT-010, WIT-012 |  |  |  |
| 14 | Which option works, who goes first | Modelled | src/core/fairshare (lottery) | FAIR-009 to FAIR-011 |  |  |  |
| 15 | Plan the mass return | Modelled | src/core/fairshare (lottery) | FAIR-009 to FAIR-011 |  |  |  |

If behind, problems drop to Thin or Roadmap in this order: 14, 15, 11, then 6, 12.
Problems 1, 7 and 8 never drop.
