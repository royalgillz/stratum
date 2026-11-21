# Device results

The run sheet `docs/rung-test.md`, run by the author on Thu Nov 19 2026 (evening ET) against the live site https://stratum-nine-swart.vercel.app.

Devices:

- Phone: Samsung Galaxy Z Fold 7 (SM-F966U1), Android 17, Chrome 158.0.8127.42.
- Laptop: Windows, Chrome.

"Shipped" means the code on the live site (`src/core` tracker and v3 codec), not the spike code of `docs/spikes.md`.

## Results

| Part | Check | Distance | Result | Notes |
| --- | --- | --- | --- | --- |
| A | GREEN after calibration | 30 cm | Pass | The phone, running the shipped tracker on `/src/phone/` Listen, went CALIBRATING then GREEN as the laptop played judge mode's 90-second story |
| A | AMBER | 30 cm | Pass | Tier times as expected |
| A | RED | 30 cm | Pass | Tier times as expected |
| A | NO HUM after the cut | 30 cm | Pass | NO HUM at about 80 s (the sheet said about 82 s) |
| B | Phone passed on the laptop's report | 30 cm | Pass | The phone received the laptop tab's public "Power cut here" report (inbox shows it, LIVE, public) and passed it on: its Listen tab showed "Passed on 1 message this session" (one relay hop). No third device was set up to hear the relayed copy |
| B | Ledger shows 1 public report | | Not reported | |
| C | Family board row for the other member | not reported | Pass | Laptop tab and phone in one family (words chosen by the author). The laptop tab's "I am OK" (family only) reached the phone's Family board and inbox, LIVE, signed with the family key by the shipped codec. See [screenshot](device/device-phone-family-board.png). |
| D | AMBER after about 50 taps | | Pass, in a browser | Age 1 year, cough yes, 50 taps in 60 s gave AMBER (fast is 40 or more), labelled LIVE. Run in the laptop browser, not on the phone |
| D | RED at once on a danger sign | | Pass, in a browser | Ticking Convulsions turned it RED at once. Laptop browser, not the phone. Later the same evening it also passed on the phone, with its medicine request verified by the gateway: see Extra checks |
| E | Judge mode plays end to end | | Pass | On the laptop: the drawn phone went through every tier and the OK arrived in its inbox. The real phone showed NO HUM during E because judge mode was muted, as expected |
| F | OK verified, LIVE on board | 30 cm | Pass | The phone's "I am OK" (family only), a signed v3 packet from the shipped codec, verified by the District 7 gateway on the laptop: "Verified OK from member 232 · LIVE". The LIVE row appeared on "Family board: the demo family" while the run was paused. See [screenshot](device/device-gateway-verified.png). |
| F | OK verified | 1 m | Pass | Same packet and gateway |
| F | OK verified | 3 m | Pass | Same packet and gateway |
| F | Row stays when switching rule | | Pass | The row stayed when switching STRATUM rule and Directorate rule, when playing, and after the week ended |
| G | Fifteen rows, badges, labels (laptop) | | Pass | Fifteen rows with direction, badges and SIMULATED |
| G | Week plays to the end (laptop) | | Pass | The seven-day week played to "Week ended" |
| G | Stress week caption and losses | | Pass | Stress week caption; row 13 worse for STRATUM, row 14 a tie |
| G | Coverage matrix, fifteen cards | | Pass | Fifteen cards, REPLAY on cards 1 and 4, card 9 starts with the 30-day run, card 13 "Directorate better", "Results against us" |
| G | Same pages on the phone, no sideways scroll | | Pass | Same checks on the phone, no sideways scroll |
| H | Installed to the home screen | | Pass | Installed from Chrome's menu; the STRATUM icon appeared on the home screen |
| H | Opens and listens in Airplane mode | | Pass | With Airplane mode on and Wi-Fi off, the icon opened the app and Listen started |

## Extra checks, same evening

| Check | Distance | Result | Notes |
| --- | --- | --- | --- |
| Medicine request by sound | 30 cm | Pass (gateway) | On the phone, Care: age 1, cough yes, Convulsions ticked gave RED; **Request medicine** sent a family NEED that the District 7 gateway verified twice ("Verified NEED from member 232 · LIVE"). The District 7 board did not list it then (it listed OKs only); the board now lists requests, not yet rerun on the phone |

## Second session, Fri Nov 20 2026 (evening ET)

The same phone and laptop, the live site at main `d0a9670`, run sheet Parts I to N.

| Part | Check | Distance | Result | Notes |
| --- | --- | --- | --- | --- |
| I | Quiet room: not "running" | | Pass | The fan was not switched on at first: the Air line stayed on "listening" |
| I | Fan on: "running" | 3 m | Pass | The fan was 3 m from the phone, not 1 m. Detected as running |
| I | Fan off: alert within 5 s | 3 m | Pass | The stop alert came about 5 s after the fan was switched off. The saved fan log (last 300 s) shows RUNNING at 199.2 s, STOPPED at 231.5 s, RUNNING at 248.6 s, STOPPED at 283.2 s |
| I | Talk and noise: no alert | | Not reported | |
| I | Fan off while talking: alert | | Not reported | |
| J | Coughs counted (of 10) | close range | Fail | About 2 of 10 coughs counted, even close to the phone. Preview of branch `air/cough-ready` only; not merged, it stays experimental |
| J | False counts in 5 min of talk, clap, drop | | Not reported | |
| K | OK verified / sent | 30 cm, 1 m, 3 m | Pass | 10 of 10 verified at 1 m and 10 of 10 at 3 m, with no rejects (shipped codec, District 7 gateway); sends at 30 cm were verified too. Gateway log below (one run) |
| K | Clips filmed (A and F) | | Done | `tiers.mp4`: the Fold on Listen during judge mode's story; `send.mp4`: the Fold sending OK and the District 7 board |
| L1 | Tap count: AMBER at about 50 taps | | Pass | AMBER at N = 47, on the phone |
| L1 | Tap count: GREEN at about 30 taps | | Pass | GREEN at N = 35, on the phone |
| L2 | Odds line at AMBER and RED ("no data yet"), gone at GREEN and NO HUM | 30 cm | Pass | "Level 3: no data yet (needs reports from 3 phones)" at AMBER and RED, gone at GREEN and NO HUM |
| L3 | HOLD WATER: 1 sender, unconfirmed | 30 cm | Pass | |
| L3 | HOLD WATER: same window again, still 1 sender | 30 cm | Pass | |
| L3 | HOLD WATER: 2 senders, unconfirmed | 30 cm | Pass | |
| L3 | HOLD WATER: 3 senders, no "unconfirmed" | 30 cm | Pass | Rows read 1, 1, 2 and 3 senders, "unconfirmed" on the first three only |
| L3 | ROUTE: 1 sender, unconfirmed | 30 cm | Pass | |
| L4 | Ledger digest: phone shows the same 12 characters | 30 cm | Pass | Under the STRATUM rule the laptop sent digest fd297d64609f of the SIMULATED STRATUM ledger ("Sent by sound: digest fd297d64609f ..."), and the phone's Family inbox showed "Public ledger digest heard: fd297d64609f, compare with the District 7 screen · packet LIVE, sent 07:27 PM · public". The first try used the Directorate rule, which keeps no measured record (its digest is the empty chain's start), so the page refused to send; the page's message and the run sheet now say STRATUM rule (commit `b1a31eb`). One retry missed only because the phone was open on an older preview build; on the live site the digest was heard at once |
| L5 | Optional: 67% on Ledger and on the Listen line | | Not run | |
| M | Sick report row, 3 people from 1 sender | 30 cm | Pass | "People coughing or sick · level 2, sector A: 1 report from 1 sender, unconfirmed ..." and "Cases heard by sound: 3 people from 1 sender" |
| M | Fan stopped row, 1 sender, unconfirmed | 30 cm | Pass | The fan row on top, the sick row second |
| N | Buzz once at AMBER, three times at RED | 30 cm | Pass | First run: felt but weak at 200 ms pulses. The pulses were lengthened to 500 ms (commit `b1a31eb`); retested the same evening: clearly felt, one buzz at AMBER and three at RED |

Gateway log, Part K (laptop, District 7): 10 consecutive lines "Verified OK from member 232 · LIVE", 5 s apart, from 6:59:28 pm to 7:00:18 pm, with no rejects.

Also seen: on District 7, at the end of day 7 the clock line ("World time end of day 7 · grid 400.000 Hz, GREEN · Directorate rule, seed 1 · SIMULATED") stops and takes a while to continue. Not investigated.

## Not run on a device

- A third device hearing a relayed copy.
- The fan-stop alert with talk and noise near the phone, and a stop while someone talks (run sheet Part I steps 6 and 7): not reported.
- Real odds on Listen (Part L5, optional): not run.
- The cough counter's false counts during talk (Part J): not reported; the counter failed its coughs check.
- The per-alert buzz patterns, the RED and fan-stop repeat until Seen, the screen flash and the screen kept awake while listening: tested in a browser only.
