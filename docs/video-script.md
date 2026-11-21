> **DRAFT.** Shot lists for the submission video. Site: `https://stratum-nine-swart.vercel.app` (paths below start with it).

# Video script

Two cuts: the full video (2:55, under the platform's 3:00 limit) and a 90-second cut. Both lead with what is real, then show the simulated district, then say plainly what goes against us. Every number spoken or shown comes from `public/evidence/*.json`, `docs/coverage.md` or a live reading, and carries its label on screen (LIVE, REPLAY or SIMULATED). Never say "solves".

## Before filming

- Run `docs/rung-test.md` first. Film a real-phone shot only if its part passed: Part A (tiers), Part C (family board), Part D (Breath Count), Part F (OK reaches District 7). The 60-second tap count (Part L1), the danger-sign RED and the medicine request all passed on the phone. If a part failed, use the fallback shot given in that row and change the narration as noted.
- Phone: Android Chrome, Do Not Disturb on, media volume about 70%, about 30 cm from the laptop speaker, microphone edge facing it. Laptop: Chrome, volume about 70%, speakers on.
- Phone joined to the demo family: **Family** tab, type `abandon ability able about above absent`, **Join family**. The District 7 gateway uses the same words by default.
- Phone **Report** tab: **Level** `5`, **Sector** `B` (the demo family's sector on the cross-section).
- Captions burned in for every narration line. No third-party music. Film the phone with a second phone or a camera; screen-record the laptop.
- The platform limit is 3:00. The full cut ends by 2:55 to leave a margin.

## Full video, 2:55

| # | Time | On screen | Page and click | Narration |
| --- | --- | --- | --- | --- |
| 1 | 0:00 to 0:12 | Filmed. A dim room, a phone on a table beside a laptop, a low hum. The phone shows GREEN. Caption: "LIVE: real phone, real microphone. The grid is SIMULATED, played by the laptop." | Phone: `/src/phone/`, **Listen**, **Start listening**. Laptop: `/src/district/judge.html`, **Play the 90-second story**, button reads **Sound: on**. Cut the 30 s CALIBRATING stretch in the edit, with a caption "30 s calibration cut" | "Level 5. The network has been down for two days." |
| 2 | 0:12 to 0:35 | Filmed, close on the phone: AMBER (about 63 s into the story), then RED (about 75 s), then NO HUM (about 82 s) | Same setup, no clicks. Keep the laptop's caption out of frame or blurred | "The Directorate controls the network. It doesn't control the hum in the walls. The phone hears the grid sag: amber, then red. Then the power goes, and it says no hum. When it can't hear the hum, it says so." |
| 3 | 0:35 to 1:00 | Split screen. Phone: Report, the OK chirps. Laptop: District 7, the gateway log line `Verified OK from member ...`, then **Family board: the demo family** gains a row labelled LIVE | Laptop: `/src/district/`, **Play**, scroll to **Gateway: phones in this room**, **Listen for phones**, **Allow**. Phone: **Report**, **I am OK** (the dialog says "Goes to your family only"), **Send now** | "No network. The message is twenty-five bytes of sound, signed with a family key. The laptop runs District 7 and checks the packet with the same code. The OK lands on the family board, marked live." |
| 4 | 1:00 to 1:15 | Filmed, sped up 4x: Breath Count, taps over the minute, the AMBER card with the rate labelled LIVE, then a danger sign ticked and the card turns RED, **Request medicine** visible | Phone: **Care**, age Years `1` Months `0`, cough **Yes**, **Start 60-second count**, tap about 50 times; then tick **Convulsions (fits)** | "Breath Count follows the WHO chart for children under five. A decision aid, not a medical device. A red card can be sent as a medicine request." |
| 5 | 1:15 to 1:45 | Screen. District 7 cross-section in time-lapse, the caption "Level 5 goes dark: deepest first" (the real-time act), the starred demo family. Switch rules; the metrics table changes | `/src/district/`, **Play** (already running), wait for the act, then **STRATUM rule**, then **Directorate rule** | "District 7 is simulated, and labelled so on every number. It's the test rig: six levels, twenty-four sectors, with power, heat, water, tunnels, disease, food and the surface coupled. Same supply. Different rule." |
| 6 | 1:45 to 2:15 | Screen. Coverage matrix: card 1 (REPLAY ENF-WHU line), card 4 (REPLAY GECCO line), card 2 (20-seed result, both rules) | `/src/district/coverage.html`, scroll to cards 1, 4 and 2 | "Fifteen problems, one loop, each with its tier printed. On a hundred and twenty-nine real grid recordings, the tracker's median error is thirty-one millihertz, but on twenty clips it locks onto the wrong tone. On real drinking-water data, the detector catches all twenty-two held-out events and twenty-one of twenty-nine on the first half, but with all six sensors it raises a hundred and fifty-nine false alarms a week. Over twenty simulated seeds, the worst-off tenth gets eighty-five percent of its need under the fair rule, sixty-six under the Directorate's." |
| 7 | 2:15 to 2:40 | Screen. District 7 switches to the stress week, caption "Stress week: built so STRATUM also loses."; then the coverage matrix, a stress-week row reading **Directorate better**, then **Results against us** | `/src/district/`, **Stress week**. Then `/src/district/coverage.html`, card 13, then scroll to **Results against us** | "And here is where we lose. In the stress week, three of five surface crews lie, and the quorum is confidently wrong. Sharing food at the floor means every level runs out together. Lamps cannot feed a level. And a sudden plant trip gives no warning." |
| 8 | 2:40 to 2:55 | Closing card: "Real: phone hum tracker, sound packets, ledger, allocator, two public datasets. Simulated: District 7." The live address and the repo address | Static card, then the home page `/` | "Four problems have a part tested on a real phone today. Eleven are modelled in District 7, with published seeds. Every number carries its label. Code, seeds and limits are public." |

Fallback shots, if a rung-test part failed:

- Part A failed (no tiers on the real phone): shots 1 and 2 become a screen recording of judge mode (`/src/district/judge.html`, **Play the 90-second story**), where the drawn phone is labelled LOOPBACK and SIMULATED. Narration in shot 2: "This is the real tracker on a simulated hum."
- Part F failed (OK does not reach District 7): shot 3 shows the phone-to-phone OK from Part C instead (**Family** tab, the row for the other member), and drops "The laptop runs District 7" from the narration.
- Part D failed: drop shot 4 and give its 15 s to shot 6.
- Any Live shot dropped: change the shot 8 line to the number of problems whose real-phone part passed.

## 90-second cut

| # | Time | On screen | Page and click | Narration |
| --- | --- | --- | --- | --- |
| 1 | 0:00 to 0:20 | Filmed: the phone goes GREEN, AMBER, RED, NO HUM (shot 2 of the full video, cut tight). Caption: "LIVE phone. SIMULATED grid." | Phone `/src/phone/` **Listen**; laptop `/src/district/judge.html` **Play the 90-second story** | "The Directorate controls the network. Not the hum in the walls. A phone hears the grid sag before the power goes, and says no hum when it can't hear." |
| 2 | 0:20 to 0:40 | Split screen: the phone's OK chirps, the gateway log `Verified OK from member ...`, the LIVE row on the family board | Phone **Report**, **I am OK** (the dialog says "Goes to your family only"), **Send now**; laptop `/src/district/` gateway **Listen for phones** | "No network. Twenty-five signed bytes of sound reach the family board." |
| 3 | 0:40 to 0:55 | District 7, the switch between rules | `/src/district/`, **STRATUM rule**, **Directorate rule** | "District 7 is a simulated test rig. Same supply, different rule." |
| 4 | 0:55 to 1:15 | Coverage matrix: card 1 REPLAY line, card 2 result, card 13 **Directorate better** | `/src/district/coverage.html` | "Thirty-one millihertz median error on a hundred and twenty-nine real recordings, though on twenty clips it locks onto the wrong tone. Eighty-five percent for the worst-off against sixty-six, over twenty simulated seeds. And in the stress week, when most surface crews lie, our verdict is wrong." |
| 5 | 1:15 to 1:30 | Closing card with the live address | Static card | "Fifteen problems, one loop, every number labelled. Start with judge mode." |

## Fallback: no video by Thursday 20:00

From the plan's rung 5: a 90-second screen cut plus one phone clip.

1. Screen-record judge mode end to end: `/src/district/judge.html`, **Play the 90-second story**, sound on. The story runs 90 s and its captions carry it, so no narration is needed.
2. Film one phone clip of 15 to 20 s: the real phone on **Listen** going AMBER then RED from the laptop's hum (rung test Part A). Caption: "LIVE phone. SIMULATED grid."
3. Join them, add the closing card from shot 8 and burned-in captions. Upload that, and keep the full script for a later replacement if the platform allows one before the deadline.

## Recorded cut

v2, made Nov 20 2026 against the live site at commit 93bd64a. Files are outside the repo, in `video/` beside it: `stratum-video-v2.mp4` (full cut, 2:53.9) and `stratum-video-v2-90s.mp4` (90-second cut, 1:05.8), both 1280x720, 30 fps, H.264 with AAC 48 kHz stereo, loudness -16.0 LUFS (full) and -16.1 LUFS (90-second) integrated, true peak -1.5 dBFS. The first cut (`stratum-video.mp4`, `stratum-video-90s.mp4`) is kept.

How it was made: `video/scripts/record.js` records the live pages with Playwright (`video/rec2/`) and burns in a caption bar; `video/scripts/tts.py` voices the narration with edge-tts (en-US-AndrewNeural, rate -5%; only the narration text is sent); `video/scripts/assemble.py` cuts each shot to its voice line plus 1.6 s (0.5 s before, 1.1 s after) and mixes; `video/narration.md` has the full shot list with timings and captions. Frames every 3 s are in `video/review-frames/v2/`.

What it shows and how it is labelled:

- Judge mode is a drawn phone (LOOPBACK, SIMULATED), not a filmed phone. Its caption keeps "drawn phone" and SIMULATED through AMBER, RED and NO HUM; only when the voice reaches the Fold 7 sentence does it change to "Drawn phone, SIMULATED. The same tracker read these tiers on a real Galaxy Z Fold 7 at 30 cm (LIVE, device test Nov 19 2026)."
- The two device stills are real screenshots from the device test, captioned "Real screenshot, device test on a Galaxy Z Fold 7, Nov 19 2026."; the gateway one carries the side label "The laptop's District 7 gateway, verifying the Fold 7's signed OK."
- Breath Count is a screen recording in a laptop browser (automated taps, sped up), labelled SCREEN RECORDING, NOT A PHONE. Its caption says the danger-sign RED and its medicine request were tested on the Fold 7 and the tap count on the phone (Part L1, Nov 20).
- The ledger digest is shown with its caption "tested in a browser; phone retest pending", written before the phone retest; it passed on the phone on Nov 20 (run sheet Part L4, digest fd297d64609f, packet LIVE). The fan-stop alert is not shown.
- No third-party music. Voice: synthetic (text to speech), said on the closing card.

### Full cut, 2:53.9

| # | Time | On screen | Narration |
| --- | --- | --- | --- |
| 1 | 0:00.0 to 0:09.4 | Home page (/): the premise of the Hollow, then the Start here: Judge mode button is outlined and clicked. | "In the Hollow, a city underground, the Directorate holds the breakers and the network. The network is down. Start here." |
| 2 | 0:09.4 to 0:25.1 | Judge mode (/src/district/judge.html), Play the 90-second story: the drawn phone (LOOPBACK, SIMULATED) at GREEN with the page's own captions, then AMBER, RED and NO HUM, then the ending with the headline result and the Next button. 30 s calibration cut. | "Judge mode runs the real hum tracker on a drawn phone. The hum sags: amber, then red. Then the power goes, and it says no hum. The same tracker read these tiers on a real Galaxy Z Fold 7." |
| 3 | 0:25.1 to 0:42.0 | Still: video/assets/device-gateway-verified.png, slow zoom. Gateway log 'Verified OK from member 232 · LIVE', LIVE row on 'Family board: the demo family'. Side label: the laptop's District 7 gateway, verifying the Fold 7's signed OK. | "No network. The OK is twenty-five bytes of sound, signed with a family key. The laptop runs District 7 and checks the packet with the same code. It verified the phone's OK at thirty centimetres, one metre and three metres." |
| 4 | 0:42.0 to 0:53.9 | Still: video/assets/device-phone-family-board.png, slow pan. Phone Family board and inbox: signed OK and public reports from the laptop, LIVE. | "The other way, the laptop's OK lands on the phone's family board, marked live. The app also installs to the home screen, and opens and listens in airplane mode." |
| 5 | 0:53.9 to 1:10.9 | Screen recording of the phone page (/src/phone/, Care) at phone size in a laptop browser, automated taps, sped up: Breath Count, AMBER with the rate labelled LIVE, then Convulsions ticked, RED, Request medicine visible. | "Breath Count follows the W.H.O. chart for children under five. A decision aid, not a medical device. On the phone, a danger sign turned the card red, and its medicine request, sent by sound, was verified by the gateway." |
| 6 | 1:10.9 to 1:28.0 | District 7 (/src/district/): time-lapse overview with the results table (Directorate column left, STRATUM right), the act 'Level 5 goes dark: deepest first' (REAL TIME) under the Directorate rule until the starred demo family's sector shows 0%, then STRATUM rule (level 5 lit). | "District 7 is simulated, and labelled so on every number: six levels, twenty-four sectors, every system coupled. Under the Directorate's rule, level 5 goes dark, deepest first. Same supply, STRATUM's rule." |
| 7 | 1:28.0 to 1:38.8 | District 7, the panel 'Ledger: measured beside official' (SIMULATED) after the week has played: rows of measured against official, chain lengths, the head digest; Send ledger digest clicked. | "The ledger keeps what was measured beside what was announced, each chained by hash. Its head digest can be sent by sound, so anyone can check it." |
| 8 | 1:38.8 to 1:54.1 | Coverage matrix (/src/district/coverage.html): 'Results at a glance', then the dumbbell chart 'STRATUM against the Directorate, seven-day week', rows 1 and 2 outlined. | "Over twenty simulated weeks, STRATUM warned forty percent of power cuts at least ten minutes ahead. The Directorate's rule, zero. The worst-off tenth gets eighty-five percent of its need, against sixty-six." |
| 9 | 1:54.1 to 2:08.4 | Coverage matrix, 'What each engine contributes' (SIMULATED): the Fair Share off list with the heat line outlined, then the 'Against STRATUM: the engines barely interact' paragraph. | "Switch Fair Share off, and dangerous heat goes from about nine thousand person-hours to about sixty-five thousand. But the engines barely interact: almost every change stays in that engine's own problems." |
| 10 | 2:08.4 to 2:21.8 | Coverage matrix, card 1, the REPLAY ENF-WHU line outlined. Other cards faded. | "Some cards replay real data. Across a hundred and twenty-nine real grid clips, the tracker's median error is thirty-one point two millihertz, but on twenty of them it locks onto the wrong tone." |
| 11 | 2:21.8 to 2:38.4 | District 7, Stress week (caption 'Stress week: built so STRATUM also loses.'); coverage matrix 'Results at a glance', the stress-week list with rows 1 and 13 outlined; then 'Results against us'. | "And here is where we lose. In the stress week, the warning gain is gone: zero against zero. When three of five surface crews lie, STRATUM's verdict is wrong in every round. And a sudden plant trip gives no warning." |
| 12 | 2:38.4 to 2:53.9 | Closing card: what was tested on a real phone (problems 1, 7, 8, 10), what is modelled (eleven, District 7, SIMULATED), the labels, the live address, the repo, 'Voice: synthetic (text to speech).' | "Four problems have a part tested on a real phone. Eleven are modelled in District 7, with published seeds. Every number carries its label. Code, seeds and limits are public." |

### 90-second cut, 1:05.8

| # | Time | On screen | Narration |
| --- | --- | --- | --- |
| 1 | 0:00.0 to 0:07.2 | Home page (/): the premise, then Start here: Judge mode clicked. | "In the Hollow, the Directorate holds the breakers and the network. The network is down." |
| 2 | 0:07.2 to 0:17.8 | Judge mode, cut tight: GREEN, AMBER, RED, NO HUM on the drawn phone (LOOPBACK, SIMULATED), with the page's own captions. | "The Directorate controls the network. Not the hum in the walls. A phone hears the grid sag before the power goes, and says no hum when it can't hear." |
| 3 | 0:17.8 to 0:28.8 | Stills: device-phone-family-board.png, then device-gateway-verified.png (labelled: the laptop's District 7 gateway, verifying the Fold 7's signed OK). | "No network. Twenty-five signed bytes of sound reach the family board. On a real phone, verified at up to three metres." |
| 4 | 0:28.8 to 0:36.8 | District 7, the switch between rules (Directorate column left, STRATUM right). | "District 7 is a simulated test rig. Same supply, different rule." |
| 5 | 0:36.8 to 0:56.8 | Coverage matrix: the dumbbell rows 1 and 2, 'What each engine contributes' (engines barely interact), then the stress-week list in 'Results at a glance' (rows 1 and 13 outlined). | "Over twenty simulated weeks, forty percent of power cuts warned against zero, and eighty-five percent of need for the worst-off against sixty-six. The engines barely interact. And in the stress week, the warning gain is gone, and our surface verdict is wrong in every round." |
| 6 | 0:56.8 to 1:05.8 | Closing card with the live address and the repo. | "Four problems have a part tested on a real phone. Every number is labelled. Start with judge mode." |

### Numbers in the cut and their sources

| Number (spoken or shown) | Label | Source |
| --- | --- | --- |
| Power cuts warned at least 10 min ahead: 40% STRATUM, 0% Directorate (7 days, 20 seeds) | SIMULATED | `public/evidence/seven-day.json` p01; `docs/coverage.md` row 1 |
| Worst-off tenth: 85% vs 66% of need | SIMULATED | `seven-day.json` p02 (0.849, 0.662); `docs/coverage.md` row 2 |
| Fair Share off: heat 9,336 to 64,904 person-hours (page shows 9,340 and 64,900; spoken as about nine thousand and about sixty-five thousand) | SIMULATED | `public/evidence/ablations.json` (stratum and no-fair-share, p03); `docs/coverage.md` Ablations |
| The engines barely interact | SIMULATED | `docs/coverage.md` Ablations, "What goes against us"; coverage page, "What each engine contributes" |
| Stress week: warning gain gone, 0% vs 0%; STRATUM's surface verdict wrong in every round (wrong-band rate 1.00 vs 0.00), three of five crews lying | SIMULATED | `public/evidence/stress-week.json` p01 and p13; `docs/coverage.md` rows 1 and 13 |
| Tracker median error 31.2 mHz over the 129 clips with a median (of 130 recordings); 20 lock onto another tone | REPLAY | `public/evidence/enf-whu.json` (withHum.clipMedians); `docs/coverage.md` row 1 |
| OK of 25 bytes; verified at 30 cm, 1 m and 3 m; family board both ways; installed and listening in Airplane mode; danger-sign RED and its medicine request on the phone | LIVE | `docs/device-results.md` |
| Four problems with a part tested on a real phone (1, 7, 8, 10); eleven modelled in District 7 | LIVE, SIMULATED | `docs/coverage.md` tiers; `docs/device-results.md` |
