> **DRAFT.** Shot lists for the submission video. Site: `https://stratum-nine-swart.vercel.app` (paths below start with it).

# Video script

Two cuts: the full video (2:55, under the platform's 3:00 limit) and a 90-second cut. Both lead with what is real, then show the simulated district, then say plainly what goes against us. Every number spoken or shown comes from `public/evidence/*.json`, `docs/coverage.md` or a live reading, and carries its label on screen (LIVE, REPLAY or SIMULATED). Never say "solves".

## Before filming

- Run `docs/rung-test.md` first. Film a real-phone shot only if its part passed: Part A (tiers), Part C (family board), Part D (Breath Count), Part F (OK reaches District 7). Part D's 60-second tap count passed only in a laptop browser; the danger-sign RED and the medicine request ran on the phone. If a part failed, use the fallback shot given in that row and change the narration as noted.
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
