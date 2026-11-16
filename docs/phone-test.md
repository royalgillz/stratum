# Phone test: rung 1 and the rung 3 gateway

Two checks with one Android phone and one laptop, in a quiet room. About 15 minutes.

- **Part A (rung 1, hear):** the phone turns AMBER, then RED, from the laptop's hum.
- **Part B (rung 1 and rung 3, speak):** the phone sends OK by sound. The laptop's District 7 page checks it with the family key and shows it on the family board as LIVE.

## Setup

1. Laptop: Chrome, volume about 70%, speakers on (no headphones).
2. Phone: Chrome, media volume about 70%, Do Not Disturb on, so notifications do not make sound.
3. Put the phone on the table, screen up, about 30 cm from the laptop speaker, with the phone's bottom edge (its microphone) facing the laptop.

## Part A: the phone hears the grid sag (judge mode hum)

1. Laptop: open `https://stratum-nine-swart.vercel.app/src/district/judge.html`.
2. Phone: open `https://stratum-nine-swart.vercel.app/src/phone/`.
3. Phone: tap the **Listen** tab, then tap **Start listening**. If Chrome asks, tap **Allow** for the microphone.
4. Laptop: click **Play the 90-second story**. Check that the button next to it says **Sound: on**.
5. Watch the phone. Do not move it. Expected, roughly:
   - 0 to 30 s: CALIBRATING
   - about 34 s: GREEN
   - about 63 s: AMBER
   - about 75 s: RED
   - about 82 s: NO HUM (the story cuts the power)
6. Write down the times you saw each tier in the table at the end.

If the phone never leaves CALIBRATING: move it to 15 cm from the speaker, raise the laptop volume, and play the story again.

## Part B: the phone's OK reaches District 7

1. Phone: tap the **Family** tab.
   - If it shows family words already: tap **Leave family** and confirm.
   - In the box under "Or join one", type `abandon ability able about above absent`, then tap **Join family**.
2. Phone: tap the **Report** tab. Set **Level** to `5` and **Sector** to `B`.
3. Laptop: open `https://stratum-nine-swart.vercel.app/src/district/`.
4. Laptop: click **Play**. The caption starts with "The network is down" and the world time runs.
5. Laptop: scroll to **Gateway: phones in this room**. Leave the family words as they are. Click **Listen for phones**, then **Allow** for the microphone. The status says it is listening.
6. Phone: on the **Report** tab, tap **I am OK**. In the dialog choose **Family only**, then tap **Send now**. The phone plays about 3 s of chirps.
7. Laptop, within about 5 s of the chirps ending:
   - the gateway log shows a line starting with `Verified OK from member`
   - **Family board: the demo family** shows a row for that member, labelled LIVE
8. Click **STRATUM rule** and then **Directorate rule**. The same LIVE row stays on the board under both rules.
9. Send OK twice more (steps 6 and 7), at 1 m and then 3 m from the laptop.

If the log says `Rejected: not this family`, the six words on the phone differ from the laptop's: check the spelling on the Family tab. If the log shows nothing, move the phone to 30 cm and send again.

## Results to send back

Copy this table into the chat with your results. Paste the laptop's gateway log text under it.

| Check | Distance | Result (pass / fail) | Notes (times, tier seen, log line) |
| --- | --- | --- | --- |
| A: GREEN after calibration | 30 cm | | |
| A: AMBER | 30 cm | | |
| A: RED | 30 cm | | |
| A: NO HUM after the cut | 30 cm | | |
| B: OK verified, LIVE on board | 30 cm | | |
| B: OK verified | 1 m | | |
| B: OK verified | 3 m | | |
| B: row stays when switching rule | | | |

Phone model and Chrome version:
