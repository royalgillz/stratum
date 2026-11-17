# Rung test: rungs 1 to 4

One Android phone and one laptop, in a quiet room. About 45 minutes. Each part says which rung it
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

1. Phone: tap **Report**. Set **Level** to `5` and **Sector** to `B`.
2. Laptop: open `/src/district/` and click **Play**. The caption starts with "The network is down"
   and the world time runs.
3. Laptop: scroll to **Gateway: phones in this room**. Leave the family words as they are. Click
   **Listen for phones**, then **Allow** for the microphone.
4. Phone: on **Report**, tap **I am OK**, choose **Family only**, then **Send now**.
5. Laptop, within about 5 s of the chirps ending:
   - the gateway log shows a line starting with `Verified OK from member`
   - **Family board: the demo family** shows a row for that member, labelled LIVE
6. Click **STRATUM rule**, then **Directorate rule**. The same LIVE row stays under both rules.
7. Send OK twice more (steps 4 and 5), at 1 m and then 3 m from the laptop.

If the log says `Rejected: not this family`, the six words on the phone differ from the laptop's.

## Part G (rung 4, all fifteen): District 7 and the coverage matrix

On the laptop first, then repeat steps 1 to 3 on the phone (its screen is narrow: check nothing is
cut off and the page does not scroll sideways).

1. `/src/district/`: the results table has fifteen numbered rows, **1.** to **15.**, each with
   "higher is better" or "lower is better", a tier badge and SIMULATED, and a value for both rules.
   Click **Play** and let it run to the end of the week (about 3 minutes; the real-time act
   "Level 5 goes dark: deepest first" plays at real pace).
2. On the cross-section: a thin food store bar along the bottom of each sector, and a **Surface:**
   line above level 1 ("no reading yet" until the first surface reading).
3. Click **Stress week**. The run restarts, and the caption says **Stress week: built so STRATUM also
   loses.** Let it run. Expected: on problem 13 (surface truth) STRATUM is worse, and on 14 the two
   rules tie.
4. Open `/src/district/coverage.html` (or **Coverage matrix** from the home page). Expected: fifteen
   cards, each with tier badges, mechanism, metric, the 20-seed result for both rules, and which rule
   did better. Card 1 and card 4 also show REPLAY figures (ENF-WHU and GECCO 2018). Card 9's first
   row is the 30-day run. At least one stress-week row says **Directorate better**. At the bottom:
   **Results against us**.

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

Phone model and Chrome version:
