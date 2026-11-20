# Rung test: rungs 1 to 4

One Android phone and one laptop, in a quiet room. About 50 minutes. Each part says which rung it
checks. Do them in order: later parts reuse the setup of earlier ones.

Site: `https://stratum-nine-swart.vercel.app` (all links below start with it).

## Setup

1. Laptop: Chrome, volume about 70%, speakers on (no headphones).
2. Phone: Chrome, media volume about 70%, Do Not Disturb on, so notifications do not make sound.
3. Put the phone on the table, screen up, about 30 cm from the laptop speaker, with the phone's
   bottom edge (its microphone) facing the laptop.

## Part A (rung 1, hear): the phone hears the grid sag

1. Laptop: open `/src/district/judge.html`.
2. Phone: open `/src/phone/`.
3. Phone: tap the **Listen** tab, then **Start listening**. If Chrome asks, tap **Allow** for the
   microphone.
4. Laptop: click **Play the 90-second story**. Check that the button next to it says **Sound: on**. Do not press Skip: the listening phone needs the full 30 s calibration.
5. Watch the phone. Do not move it. Expected, roughly:
   - 0 to 30 s: CALIBRATING
   - about 34 s: GREEN
   - about 63 s: AMBER
   - about 75 s: RED
   - about 82 s: NO HUM (the story cuts the power)
6. Write down the times you saw each tier.

If the phone never leaves CALIBRATING: move it to 15 cm, raise the laptop volume, and play again.

## Part B (rung 2, speak): report, relay and ledger

Leave the phone listening from Part A (Listen tab, **Pass on messages for others** ticked).

1. Laptop: open `/src/phone/` in a new tab. This tab plays a second phone.
2. Laptop tab: tap **Report**. Set **Level** to `3` and **Sector** to `A`.
3. Laptop tab: click **Power cut here**. In the dialog choose **Everyone nearby**, then **Send now**.
   The laptop plays about 3 s of chirps.
4. Phone, within about 10 s: the Listen tab line under the box changes to
   **Passed on 1 message this session · LIVE**, and the phone plays its own short chirps (the relay hop).
5. Phone: tap **Ledger**. Expected: **Reports heard (LIVE): 0 from your family, 1 public.**, and a
   table of odds by level.

## Part C (rung 2): family board on the phone

1. Phone: tap the **Family** tab.
   - If it shows family words already: tap **Leave family** and confirm.
   - In the box under "Or join one", type `abandon ability able about above absent`, then tap
     **Join family**.
2. Laptop tab (the second phone): tap **Family**, join with the same six words.
3. Phone: tap **Listen** and check it is still listening (tap **Start listening** if not).
4. Laptop tab: tap **Report**, then **I am OK**, choose **Family only**, then **Send now**.
5. Phone: tap **Family**. Expected: under **Family board**, one row for the other member, with
   level 3, sector A and an age like "just now". The **Inbox** shows the OK.

## Part D (rung 2): Breath Count

1. Phone: tap **Care**.
2. **1. Child's age**: Years `1`, Months `0`. **2.** choose **Yes** (cough or difficult breathing).
   Leave **3. Danger signs** empty.
3. Tap **Start 60-second count**. Tap the big button about 50 times, steadily, over the minute.
4. Expected: a result card marked AMBER (fast breathing for this age, the threshold is 40 a minute)
   with the rate labelled LIVE and a short disclaimer, and a **Request medicine** button.
5. Tick **Convulsions (fits)** under 3. Expected: the card turns RED at once, with no count needed.

## Part E (rung 2): judge mode with no phone

1. Laptop: open `/src/district/judge.html`, click **Play the 90-second story**, mute the sound.
2. Expected: the drawn phone goes CALIBRATING, GREEN, AMBER, RED, NO HUM, and at about 85 s an OK
   arrives in its inbox. Every number on screen carries SIMULATED, LOOPBACK or LIVE.

## Part F (rung 3, district): the phone's OK reaches District 7

Close the laptop tab that played the second phone, so only the real phone sends.

1. Laptop: open `/src/district/` and press **Ctrl+Shift+R** once, so the newest version loads.
2. Laptop: scroll down to **Gateway: phones in this room**. In the **Family words** box, delete what is there and type
   the six words shown on the phone's **Family** tab (for example `marine artist crucial donate census craft`).
3. Laptop: click **Listen for phones**. If Chrome asks, click **Allow** for the microphone. The button greys out and the
   line under it says "Listening".
4. Phone: tap **Report**. Set **Level** to `5` and **Sector** to `B`.
5. Phone, 30 cm from the laptop: tap **I am OK**. In the dialog tap **Family only**, then **Send now**. Keep the phone
   still while it chirps (about 3 s).
6. Laptop, within about 5 s, two things (you do not need to press Play):
   - under **Heard**, a line `Verified OK from member <number> · LIVE`
   - under **Family board: the demo family** (just above the gateway), a row for that member marked LIVE
7. Laptop: scroll to the top and click **STRATUM rule**, scroll back down: the LIVE row is still on the board. Scroll up,
   click **Directorate rule**: still there. Click **Play**, wait 10 s: still there. Click **Pause**.

If the log says `Rejected: not this family`, the words in the laptop box differ from the phone's.

## Part G (rung 4, all fifteen): District 7 and the coverage matrix

Laptop first (about 10 minutes), then a short pass on the phone.

1. Laptop: on `/src/district/`, click **Restart** and scroll to **Results so far, fifteen problems**.
   - Fifteen rows numbered **1.** to **15.**
   - Under each title: "higher is better" or "lower is better", then "figure: SIMULATED · Tier:" and one or more badges
     (Live, Modelled, Roadmap).
   - The two value columns, **Directorate (shown)** and **STRATUM**, read "not started" before Play.
2. Scroll to the top and click **Play**. The clock line ("World time day 1, ...") starts running. Leave it about
   3 minutes, until the **Play** button reads **Week ended**. While it runs:
   - map cells change colour (yellow: power on; olive: trimmed; black: cut). Level 6 sectors C and D go black on day 2
   - for about a minute the caption reads **Level 5 goes dark: deepest first · REAL TIME**
   - each cell has a thin bar along its bottom edge (food store), and the **Surface:** line above L1 changes from
     "no reading yet" to a band
   - the table fills with numbers or words such as "no outbreak"
3. At the end: the caption reads **Week ended · press Restart to replay** and the clock **end of day 7**. Click
   **STRATUM rule**: the map and the table show the same week under STRATUM.
4. Click **Stress week**. The caption starts **Stress week: built so STRATUM also loses.** Click **Play** and wait for
   **Week ended** (about 3 minutes). Check in the table:
   - row **13**: STRATUM's value is worse than the Directorate's
   - row **14**: the two values are the same
5. Scroll to the top and click the **coverage matrix** link in the first paragraph (or open
   `/src/district/coverage.html`). Check:
   - fifteen cards, numbered 1 to 15, each with badges, **Mechanism:**, **Metric:** and a small table
   - the table rows are "Seven-day week, 20 seeds" and "Stress week, 20 seeds", each with a verdict under the name
     ("Directorate better", "STRATUM better" or "tie") and a value per rule; some have grey "beside it:" rows
   - cards **1** and **4** have a **REPLAY** paragraph (ENF-WHU and GECCO 2018)
   - card **9**'s first row is "30-day run, 20 seeds"
   - card **13**'s stress-week row says **Directorate better**
   - at the bottom of the page: **Results against us**
6. Phone: open `/src/district/` in Chrome. Scroll the whole page top to bottom. On the results table, put a finger on it
   and swipe left: the page must not slide sideways, and no text may be cut off at the right edge. Tap **Play**, watch
   20 s, tap **Pause**. Then open `/src/district/coverage.html` and do the same swipe test on two or three cards.

## Part H (should list): offline and install on the phone

1. Phone, with Wi-Fi or data on: open `/src/phone/` in Chrome. Wait 5 s, then pull down to reload, and reload once more.
   (The first visit saves the app on the phone; the reloads make sure the newest version is the one saved.)
2. Chrome's three-dot menu (top right): tap **Add to Home screen** or **Install app**. In the box that opens tap
   **Install** (or **Add**, then **Add** again). Go to the home screen: a STRATUM icon (blue square, white bars) is there.
3. Swipe down from the top of the screen and tap **Airplane mode**. Check that the Wi-Fi icon is off too (some phones
   keep Wi-Fi on in airplane mode: tap Wi-Fi off if so).
4. Tap the STRATUM icon on the home screen. Expected: the app opens with no address bar and shows the five tabs
   (Listen, Report, Family, Ledger, Care). It must not show Chrome's "No internet" dinosaur page.
5. Tap **Listen**, then **Start listening** (allow the microphone if asked). Expected: CALIBRATING, then NO HUM in a
   quiet room. Under it a grey line: "In a replay of 130 recordings of a real 50 Hz grid...". For a full check, play the
   judge story with sound on the laptop (Part A setup) and watch the tiers.
6. Tap **Family**: your family words and board are still there.
7. Turn Airplane mode off.

Phone model and Chrome version: Chrome three-dot menu, **Settings**, **About Chrome**.

## Part I (stretch): the fan-stop alert

You need a fan you can switch off: a desk fan, a box fan or a bathroom extractor. About 15 minutes.

1. Phone: open `/src/phone/`, pull down to reload twice, tap **Listen**, **Start listening**.
2. Quiet room first, fan off, phone on the table: wait 1 minute. Under the reading, the Air line says
   **Fan: listening for a steady fan · LIVE**. It must not say "running".
3. Switch the fan on, phone 1 m away, pointing at it. Within about 30 s the line says **Fan: running · LIVE**.
4. Switch the fan off at its switch. Note the time. Within 5 s the line turns red: **FAN STOPPED: ...** and the phone
   vibrates once. Note how many seconds it took.
5. Switch it back on: within about 5 s it says **Fan: running** again. Repeat steps 4 and 5 three times.
6. With the fan running, talk normally for 1 minute near the phone, close a door, put a cup down: no alert.
7. Switch the fan off while you keep talking: the alert should still come within about 5 s.
8. Open **Fan test log**, tap **Save fan log**, and send the CSV file with your notes (times of each switch).

## Part J (stretch, separate preview): the cough counter (experimental)

The cough counter is not on the live site yet. It goes live only if this test passes. It runs on a preview of its branch:
`https://stratum-git-air-cough-sehaj-gill-projects.vercel.app/src/phone/` (Vercel asks you to sign in once on the phone, with your Vercel account). About 12 minutes, with a second person to talk.

1. Phone: open the preview address above, sign in to Vercel if asked. Tap **Care**, scroll to **Cough count (experimental)**, tap
   **Start cough count**, allow the microphone. Wait until the line reads **Coughs heard: 0 ...**. If a line says
   "Warning: this browser kept some microphone processing on", write it down.
2. Phone on the table, microphone up, a fan running 1 to 3 m away. Do not touch it for 10 s. Keep the screen on and this tab
   in front for the whole test.
3. Stand 1 m from the phone. Cough 10 single times, about 5 s apart. Note the time of each, and the count 1 to 2 s later.
4. Then 5 minutes of normal talk by two people near the phone, with some laughing and "s" and "sh" words. During it, clap once
   and drop a book or a shoe once, 1 to 2 m away, and note when. Note any time the count goes up and what was happening.
5. Tap **Stop cough count**, open **Cough test log**, tap **Save cough log**, and send the CSV with your notes.

Pass: 8 or more of the 10 coughs counted, and at most 1 count during the 5 minutes (clap and drop included).

## Part K (judges' top asks): repeat sends and a short real-phone clip

Three judge reviews agreed on two gaps only you can close: the shipped codec has one send per distance (no success rate), and
the video never shows the real phone. About 20 minutes, same setup as Part F.

1. **Repeat sends.** Laptop: `/src/district/`, gateway words set, **Listen for phones**. Phone: Report, **I am OK**, **Family only**,
   **Send now**, 10 times at 1 m, then 10 times at 3 m, waiting for the chirps to end each time. Count the
   `Verified OK from member ...` lines in the gateway log (repeats say "Repeat of", count those too). Write "verified / sent"
   for each distance.
2. **Film two short clips** with a second phone or the laptop webcam, landscape, the Fold's screen readable:
   - about 15 s of Part A: the Fold on Listen going GREEN, AMBER, RED while judge mode plays with Sound on;
   - about 10 s of Part F: the Fold sending OK, then the laptop's District 7 board adding the LIVE row.
   Send the two files. I will splice them into the video in place of a screen shot, captioned "Filmed, Galaxy Z Fold 7, LIVE",
   keeping it under 3:00.

## Part L (stretch features on the phone): tap count, cut odds, public alerts, ledger digest

These four have passed in a browser only. About 17 minutes, same setup as Part A (phone on the table, screen up, 30 cm from the
laptop speaker, bottom edge facing it). L5 at the end is optional and takes 15 minutes more.

| Step | Device | Page | Minutes |
| --- | --- | --- | --- |
| L1 | Phone | `/src/phone/`, Care | 3 |
| L2 | Laptop and phone | `/src/district/judge.html` and `/src/phone/`, Listen | 3 |
| L3 | Laptop (three windows) and phone | `/src/phone/` on both, Report and Family | 7 |
| L4 | Laptop and phone | `/src/district/` and `/src/phone/`, Family | 4 |
| L5 (optional) | Laptop (three windows) and phone | as L2 and L3, then Ledger | 15 |

Before you start: phone, open `/src/phone/` and pull down to reload twice (the newest version, and an empty ledger: it lives
in the page's memory only).

### L1: the 60-second tap count (phone alone)

1. Phone: tap the **Care** tab. Under **1. Child's age** set **Years** to `1` (leave **Months** at "Optional").
2. Under **2.** tap **Yes**. Under **3. Danger signs** tick nothing (untick any left from Part D).
3. Tap **Start 60-second count**. The line reads **60 s left · 0 breaths · LIVE**. Tap the big **Tap once per breath**
   button about 50 times, steadily (a little under one a second), starting at once and keeping on until it reads **0 s left**.
   Do not tap **Stop**. Watch the breath count go up with each tap.
4. Expected when the minute ends: a card **▲ AMBER: fast breathing**, the line "Fast breathing. The child needs medicine and a
   health worker today. Send a medicine request.", then **Rate: N breaths per minute (fast is 40 or more at this age) · LIVE**,
   where N is the count the counter showed, and a **Request medicine** button below. Do not press it. Write down N.
5. Tap **Count again**. This time tap about 30 times, one every 2 seconds, again from the first second to the last.
6. Expected: **● GREEN: breathing not fast**, **Rate: N breaths per minute (fast is 40 or more at this age) · LIVE**, and no
   Request medicine button.

Pass: AMBER at N of 40 or more, GREEN at N under 40, and each N matches the counter. If the rate line ends with
"K double taps ignored", N is the counter minus K; that still passes. If the card says **↻ RECOUNT** ("Some breaths
seem to be missing"), you started late or stopped early: tap **Count again** and tap from the first second to the last.

### L2: cut odds on the Listen tab at AMBER and RED

1. Phone: tap **Report**. Set **Level** to `3` and **Sector** to `A`. (The odds line shows only once a level is chosen.)
2. Phone: tap **Listen**, then **Start listening** (allow the microphone if asked). Untick **Pass on messages for others** for
   the rest of Part L, so the phone's own relay chirps do not talk over the laptop.
3. Laptop: open `/src/district/judge.html`, check the button says **Sound: on**, click **Play the 90-second story**. Do not
   press Skip.
4. Watch the phone. Under the tier and the "mHz below normal" line:
   - at GREEN (about 34 s): no odds line;
   - at AMBER (about 63 s): **Level 3: no data yet (needs reports from 3 phones)**;
   - at RED (about 75 s): the same line;
   - at NO HUM (about 82 s): the line goes away.

Pass: the line appears at AMBER and at RED, names level 3, and is gone at GREEN and NO HUM. "no data yet" is right here: a
number needs three phones' power reports in a stress event that has ended (L5 shows one).

### L3: HOLD WATER and ROUTE alerts, with a sender count

The inbox counts the different member numbers that sent the same alert at the same place, and says "unconfirmed" below three.
One laptop can act as three senders, because each browser window below gets its own member number:

- **Window 1**: Chrome, a normal new tab, `/src/phone/`.
- **Window 2**: Chrome incognito (**Ctrl+Shift+N**), `/src/phone/`.
- **Window 3**: Microsoft Edge (or a Chrome Guest window), `/src/phone/`.

Leave the phone listening from L2 (it keeps listening on every tab). Phone: tap **Family**, scroll down to **Inbox**.

1. Laptop, in each of the three windows: tap **Family** and note "You are member N." The three numbers must differ (if two
   match, close that window and open it again). Then tap **Report**, set **Level** `3` and **Sector** `A`.
2. Window 1: under **Public alerts** click **⛔ Water looks or smells wrong: hold, do not drink**. The dialog says
   "Level 3, sector A." and "Goes to everyone nearby." Click **Send now**. The laptop chirps about 3 s; the window then says
   **✔ Sent "Water looks or smells wrong: hold, do not drink" to everyone nearby at HH:MM.**
3. Phone, within about 10 s, a new row at the top of the inbox:
   **LIVE · HH:MM · ⚠ Water looks or smells wrong: hold, do not drink from member N · level 3, sector A · public · 1 sender, unconfirmed**
4. Window 1 again: send the same alert once more. Phone: a new row, still **1 sender, unconfirmed** (one phone sending twice
   does not count twice).
5. Window 2: send the same alert. Phone: **2 senders, unconfirmed**.
6. Window 3: send the same alert. Phone: **3 senders**, with no "unconfirmed".
7. Window 1: click **🚧 Tunnel flooded or blocked here**, **Send now**. Phone: a row
   **LIVE · HH:MM · ⚠ Tunnel flooded or blocked here from member N · level 3, sector A · public · 1 sender, unconfirmed**
   (a different alert has its own count).

Wait for the chirps to end before the next send. If the phone shows nothing within 10 s, send again from the same window: a
repeat from one window never raises the count. Keep the three windows open for L5.

Pass: the four HOLD WATER rows read 1, 1, 2 and 3 senders, "unconfirmed" on the first three only, and the ROUTE row reads
1 sender, unconfirmed. If you cannot open a third window (no Edge, no Guest), only the "unconfirmed" state can be shown
(1 and 2 senders): write that in the notes.

### L4: the ledger digest by sound from District 7

1. Laptop: open `/src/district/` in a new tab and press **Ctrl+Shift+R** once. Leave **Sound: off**: its hum
   would reach the listening phone and end the stress event L5 needs.
2. Click **Play**, wait about 20 s, click **Pause**.
3. Scroll to **Ledger: measured beside official**. On the line "Head digest, first 16 bytes of the measured chain:" write down
   the bold part (the first 12 characters).
4. Scroll down to **Gateway: phones in this room** and click **Send ledger digest** (no need to click Listen for phones). The
   line under it reads **Playing digest XXXXXXXXXXXX of the SIMULATED Directorate ledger…**, the laptop chirps about 3 s, then
   **Sent by sound: digest XXXXXXXXXXXX of the SIMULATED Directorate ledger. A listening phone shows it in its Family tab inbox.**
   If it says "Not sent: the Directorate rule has no measured entries yet", click **Play** again, wait longer, **Pause**, and send
   again.
5. Phone, still on **Family**, within about 10 s, a new row at the top of the inbox:
   **Public ledger digest heard: XXXXXXXXXXXX, compare with the District 7 screen · packet LIVE, sent HH:MM · public**

Pass: the 12 characters on the phone match the bold digest and the "Sent by sound" line. Write the 12 characters in the notes.

### L5 (optional, 15 minutes): a real odds number on Listen

Only if time is left. It needs three senders and a stress event that has ended: an event counts 10 minutes after the hum
falls back to GREEN. Do not reload the phone page during L5: the ledger is in its memory only.

1. The stress event from L2 is still open: the phone has heard no GREEN since the RED (no judge
   story, no District 7 sound). (If you replayed the story after L2, play
   it once more to the end, until the phone shows NO HUM.)
2. In each of the three windows from L3: **Report** (level 3, sector A), **🔌 Power cut here**, choose **Everyone nearby**,
   **Send now**, waiting for the chirps to end each time.
3. Phone: **Ledger**. Expected: **Reports heard (LIVE): ... 3 public** (more if you resent one).
4. Laptop: in the judge tab click **Play the story again** (Sound on). Phone: **Listen**. As soon as the phone shows **● GREEN: normal** (about 34 s), close
   the judge tab, before AMBER can come back. Note the time.
5. Wait 11 minutes. Keep the phone screen on (tap it now and then) with Chrome and this page in front.
6. Phone: **Ledger**. Expected: row **3**, under both **▲ AMBER** and **■ RED**: **67%** and "1 cut in 1 observed event". Other rows:
   "no data yet".
7. Laptop: open `/src/district/judge.html`, **Play the 90-second story**. Phone: **Listen**. At AMBER the line reads
   **Level 3: cut in 1 of 1 past AMBER event, odds 67% · LIVE**; at RED **Level 3: cut in 1 of 1 past RED event, odds 67% · LIVE**.

Pass: 67% on the Ledger tab and the same figure on the Listen line at AMBER and RED.

At the end of Part L: phone, **Listen**, tick **Pass on messages for others** again.

## Part M (optional, about 4 minutes): reports heard by District 7

District 7 tallies every report it hears by type and place, with the number of different senders. Phone 30 cm from the
laptop, as in Part F.

1. Laptop: open `/src/district/` and press **Ctrl+Shift+R** once. Scroll down to **Gateway: phones in this room** and click
   **Listen for phones** (click **Allow** if Chrome asks). The line under it says "Listening". Just below the gateway, the
   panel **Heard by sound: reports** reads "No reports heard yet."
2. Phone: tap **Report**. Set **Level** to `2` and **Sector** to `A`.
3. Phone: tap **🤒 People coughing or sick**. In the dialog tap **Everyone nearby**, type `3` in **How many people?**, tap
   **Send now**. Keep the phone still while it chirps (about 3 s).
4. Laptop, within about 5 s: under **Heard**, a line `Public REPORT from member N: not a family message, not added to the board · LIVE`,
   and in **Heard by sound: reports** a row:
   **People coughing or sick · level 2, sector A: 1 report from 1 sender, unconfirmed (fewer than 3 senders), newest sent HH:MM · LIVE**,
   with the line **Cases heard by sound: 3 people from 1 sender.** under it.
5. Phone: tap **🌡️ Fan stopped or air hot**, **Everyone nearby**, **Send now**.
6. Laptop: a new row at the top of the panel:
   **Fan stopped or air hot · level 2, sector A: 1 report from 1 sender, unconfirmed (fewer than 3 senders), newest sent HH:MM · LIVE**. The sick row is still there, second.

Pass: both rows appear, each says 1 sender and unconfirmed, and the sick row says 3 people.

## Part N (stretch, 2 minutes): the phone buzzes at AMBER and RED

1. Phone: **Listen**. Below the relay lines, check that **Vibrate on alerts** is ticked. Keep the screen on with
   this page in front (Chrome buzzes only for a visible page you have tapped).
2. Phone: tap **Start listening** if it is not listening already, then hold the phone in your hand, 30 cm from the laptop speaker.
3. Laptop: open `/src/district/judge.html`, **Play the 90-second story** with **Sound: on**. Do not press Skip.
4. Expected: one buzz when the phone shows **▲ AMBER** (about 63 s), three short buzzes at **■ RED**
   (about 75 s), and no buzz while a tier stays the same.

Pass: one buzz at AMBER and three at RED. If there is no buzz at all, turn Do Not Disturb off and play again; note it. (An iPhone has no web vibration: skip Part N on one.)

## Results to send back

Copy this table into the chat with your results. Paste the laptop's gateway log text under it.

| Part | Check | Distance | Pass / fail | Notes (times, tier, text seen) |
| --- | --- | --- | --- | --- |
| A | GREEN after calibration | 30 cm | | |
| A | AMBER | 30 cm | | |
| A | RED | 30 cm | | |
| A | NO HUM after the cut | 30 cm | | |
| B | Phone passed on the laptop's report | 30 cm | | |
| B | Ledger shows 1 public report | | | |
| C | Family board row for the other member | 30 cm | | |
| D | AMBER after about 50 taps | | | |
| D | RED at once on a danger sign | | | |
| E | Judge mode plays end to end | | | |
| F | OK verified, LIVE on board | 30 cm | | |
| F | OK verified | 1 m | | |
| F | OK verified | 3 m | | |
| F | Row stays when switching rule | | | |
| G | Fifteen rows, badges, labels (laptop) | | | |
| G | Week plays to the end (laptop) | | | |
| G | Stress week caption and losses | | | |
| G | Coverage matrix, fifteen cards | | | |
| G | Same pages on the phone, no sideways scroll | | | |
| H | Installed to the home screen | | | |
| H | Opens and listens in Airplane mode | | | |
| I | Quiet room: not "running" | | | |
| I | Fan on: "running" | 1 m | | |
| I | Fan off: alert within 5 s (x3) | 1 m | | |
| I | Talk and noise: no alert | 1 m | | |
| I | Fan off while talking: alert | 1 m | | |
| J | Coughs counted (of 10) | 1 m | | |
| J | False counts in 5 min of talk, clap, drop | 1 m | | |
| K | OK verified / sent | 1 m | | x / 10 |
| K | OK verified / sent | 3 m | | x / 10 |
| K | Clips filmed (A and F) | | | |
| L1 | Tap count: AMBER at about 50 taps | | | N = |
| L1 | Tap count: GREEN at about 30 taps | | | N = |
| L2 | Odds line at AMBER and RED ("no data yet"), gone at GREEN and NO HUM | 30 cm | | |
| L3 | HOLD WATER: 1 sender, unconfirmed | 30 cm | | |
| L3 | HOLD WATER: same window again, still 1 sender | 30 cm | | |
| L3 | HOLD WATER: 2 senders, unconfirmed | 30 cm | | |
| L3 | HOLD WATER: 3 senders, no "unconfirmed" | 30 cm | | |
| L3 | ROUTE: 1 sender, unconfirmed | 30 cm | | |
| L4 | Ledger digest: phone shows the same 12 characters | 30 cm | | digest = |
| L5 | Optional: 67% on Ledger and on the Listen line | 30 cm | | |
| M | Optional: sick report row, 3 people from 1 sender | 30 cm | | |
| M | Optional: fan stopped row, 1 sender, unconfirmed | 30 cm | | |
| N | Buzz once at AMBER, three times at RED | 30 cm | | |
