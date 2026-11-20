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
4. Laptop: click **Play the 90-second story**. Check that the button next to it says **Sound: on**.
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
