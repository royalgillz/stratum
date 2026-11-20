# Device results

The run sheet `docs/rung-test.md`, run by the human on Thu Nov 19 2026 (evening ET) against the live site https://stratum-nine-swart.vercel.app.

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
| C | Family board row for the other member | not reported | Pass | Laptop tab and phone in one family (words chosen by the human). The laptop tab's "I am OK" (family only) reached the phone's Family board and inbox, LIVE, signed with the family key by the shipped codec |
| D | AMBER after about 50 taps | | Pass, in a browser | Age 1 year, cough yes, 50 taps in 60 s gave AMBER (fast is 40 or more), labelled LIVE. Run in the laptop browser, not on the phone |
| D | RED at once on a danger sign | | Pass, in a browser | Ticking Convulsions turned it RED at once. Laptop browser, not the phone |
| E | Judge mode plays end to end | | Pass | On the laptop: the drawn phone went through every tier and the OK arrived in its inbox. The real phone showed NO HUM during E because judge mode was muted, as expected |
| F | OK verified, LIVE on board | 30 cm | Pass | The phone's "I am OK" (family only), a signed v3 packet from the shipped codec, verified by the District 7 gateway on the laptop: "Verified OK from member 232 · LIVE". The LIVE row appeared on "Family board: the demo family" while the run was paused |
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

## Not run on a device

- The 60-second tap count on the phone (it passed in a laptop browser).
- A third device hearing a relayed copy.
- The T4 sound model: dropped, so the air warning stays Roadmap.
