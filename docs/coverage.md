# Coverage: 15 problems

The coverage-auditor agent rewrites this table from the code. Until then it holds the targets.
Tiers: **Live** (real device), **Modelled** (algorithm in simulated District 7, measured against
the Directorate baseline), **Thin** (one rule or chart on assumed parameters), **Roadmap** (write-up only).

Claim wording: every problem has a mechanism, a metric and a place on screen, with its tier printed.
Never write "solves".

| # | Problem | Target tier | Mechanism file | Spec IDs | Metric and value | On screen | Label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Warn before power or air cuts | Live (power), Modelled (air) | src/core/tracker/tracker.ts, src/core/shed/shed.ts | TRACK-001 to TRACK-012, SHED-001 to SHED-012 | T1 at 30 cm: ramp error 0.6 mHz typical, 4 mHz worst after smoothing; step seen in 2.7 s | Phone page not built yet | LIVE (spike) |
| 2 | Share power, water, food fairly | Modelled, real requests | src/core/shed/shed.ts (who gets cut) | SHED-004 to SHED-012 | Shed Ledger code only; no screen yet | Not yet | |
| 1 | Warn before power or air cuts | Live (power), Modelled (air) | src/core/tracker/tracker.ts, src/core/relay/relay.ts (grid alerts) | TRACK-001 to TRACK-012, RELAY-007 | T1 at 30 cm: ramp error 0.6 mHz typical, 4 mHz worst after smoothing; step seen in 2.7 s | Phone page not built yet | LIVE (spike) |
| 2 | Share power, water, food fairly | Modelled, real requests | | | | | |
| 3 | Keep lower levels livable | Modelled | | | | | |
| 4 | Catch bad water before people drink it | Modelled, real data, real reports | | | | | |
| 5 | Keep tunnels safe to live in and move through | Modelled, real reports | | | | | |
| 6 | Find, make or share space | Modelled | | | | | |
| 7 | Organize without the network | Live | src/core/packet/codec.ts, keys.ts, src/core/relay/relay.ts | PKT-001 to PKT-012, RELAY-001 to RELAY-009 | T2: 20/20 at 1 m and 3 m; T3: 20/20 with hum playing | Phone page not built yet | LIVE (spike) |
| 8 | Reconnect families | Live | src/core/packet/codec.ts, keys.ts, src/core/relay/relay.ts | PKT-001 to PKT-012 (OK beacons, family keys), RELAY-001 to RELAY-009 (relay through strangers' phones) | Codec only; family board not built yet | Not yet | |
| 9 | Track the real outbreak, route supplies | Modelled, real reports | | | | | |
| 10 | Basic care for people who cannot reach a clinic | Live (aid and request), Modelled (delivery) | | | | | |
| 11 | Track and treat life without sunlight | Modelled | | | | | |
| 12 | Grow and share neighbourhood food | Modelled, real requests | | | | | |
| 13 | Prove whether the surface is safe, tell everyone | Modelled, real digest packet | | | | | |
| 14 | Which option works, who goes first | Modelled | | | | | |
| 15 | Plan the mass return | Modelled | | | | | |

If behind, problems drop to Thin or Roadmap in this order: 14, 15, 11, then 6, 12.
Problems 1, 7 and 8 never drop.
