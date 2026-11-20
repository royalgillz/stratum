# Known limits

Stated plainly, so nobody finds them for us.

## What is simulated

- District 7 is a simulation. Its heat, water, sewage, disease, food and surface values are
  model outputs, not measurements.
- The in-world grid runs at 400 Hz. That is a design choice that puts the hum where phone
  microphones hear well. The tracker is scored on real recordings from a 50 Hz grid.

## District 7 model

- The STRATUM policy shows what the same supply does under the fair rule. In the Hollow the Directorate
  holds the breakers, so that outcome needs the rule to be adopted, or applied by levels to the loads
  they control.
- The Directorate baseline follows stated rules (deepest levels cut first, proportional rationing,
  daily lab tests, clinic counts, a daily bulletin). A different Directorate would give different numbers.
- The world steps once a simulated minute. A plant trip collapses the hum at once, but the shed that
  follows lands on the next step, so in a real-time act the hum stays collapsed for up to a minute.
- The grid model is linear and valid only inside the tracker band. A shortfall above 1.25% of load
  would push the hum more than 2.5 Hz down, where a phone shows NO HUM. The scripted plant trip stays
  inside the band, so a phone shows RED.
- The real-time act "The hum sags" shows the hum falling, but the cut follows under a minute later.
  That is too short to count as warned, and the metric counts it as unwarned.
- Level 5 goes dark under the Directorate in one real-time act of the seven-day script, when a deep
  shortfall carries deepest-first down to the demo family's sector. Once shedding has begun, the hum stays
  steady while deeper sectors go dark: the hum warns when stress begins, not of each later cut.
- Grid, heat, power and tunnel results draw no randomness of their own. Each seed varies the script
  (event times by up to 1 h, sizes and durations by up to 20%), so their seed intervals show the spread of
  the script, not model noise. The events the demo's acts show do not vary.
- People never move between sectors. Shift sharing changes when people sleep; the return is a plan.
- Each sector's ten tracked households stand for all its 500 people when space, light, trials and the
  return are shared out by household.
- Where the Directorate's figure follows from a stated rule (no warnings, a daily lab, a daily bulletin,
  clinic capture), the gap between policies shows the mechanism, not a measured gain.
- Humidity is held at 70% as air warms, which assumes wet rock and seepage keep the air near saturation.
  At constant moisture the uncooled deep levels would stay below 27.5 deg C wet-bulb, and the heat metric
  would be 0 under both policies.
- Uncooled levels 5 and 6 reach a wet-bulb of about 34 and 37 deg C at that humidity, near or past the
  roughly 35 deg C limit of human survival. The model counts exposure, not harm.
- Cooling and pump power are modelled as plants that shrink with the grid's served fraction, not as part
  of each sector's power allocation.
- Water is drunk at a steady rate by everyone; exposure counts people, not litres.
- The outbreak never crosses levels, and each case lands on the clinic list and the residents' list
  independently. Real lists are not independent, which biases capture-recapture.
- Transmission rises with the rebreathed fraction of air, applied to all transmission and capped at five
  times the ventilated rate. The published relation covers ordinary indoor air, not fans switched off.
- The grid steps every 60 s and its time constant 2H/D is 1 to 9 s for any plausible inertia, so the
  frequency settles inside one step: the grid-inertia sweep moves no figure, and the model says nothing
  about the first seconds after a trip, where inertia matters.
- With fewer than 7 people on both lists, the capture-recapture estimate is noise. The seven-day outbreak
  is small, so the outbreak result comes from the 30-day run.
- Simulated messages do not collide on air, and sound follows the tunnels one sector at a time. A
  simulated hop crosses from one sector to the next, which assumes phones at every sector boundary; real
  sound reaches a few metres. With 4 hops, a message cannot cross the whole district, so about a third of
  separated family members are out of mesh reach and wait for the daily bulletin, as they would without
  the toolkit. There are no stairwell relays or couriers yet.
- Every ledger entry the district writes, measured or official, is SIMULATED. The district's ledger view
  carries that label.
- A run that receives a live packet from a phone is no longer reproducible from its seed alone.
- Shift sharing counts sleeping floor only. People awake still crowd the common rooms, and the extra
  contacts from sharing a sleeping space are counted by the census, not fed into the outbreak model.
  Peak power by shift is not modelled.
- The space gain is arithmetic: three shifts share one floor. Sleeping floor per sleeper rises, but
  living space per person does not, so it does not meet the Sphere living-space standard.
- Care requests come at scripted rates, not from the outbreak. Couriers carry no medicine stock, and a
  pop-up point moves without travel time. A request reaches a care point over the mesh within 4 hops,
  each hop succeeding with the same 90% as messages, decided once when it is sent; a dropped request
  waits for the bulletin.
- A live NEED from a phone reaches the family board; no simulated courier answers it.
- No scripted flood leaves a detour, so no courier route is seen bending round a flood.
- A person meets the daytime light threshold with one 4 h session at 250 lux melanopic or more. That
  is a weaker test than the recommendation, which asks for that level through the day. Evening and
  sleep light are not modelled. Grow rooms count as bright rooms only if their LEDs are white or
  blue-rich; red and blue only grow lamps may fall below 250 lux melanopic.
- Food transfers between levels stand for OFFER and NEED packets and couriers; no packet is simulated.
  Crops are counted by calories only, not nutrition, and only two crops have a sourced energy cost.
- Crews' readings carry uniform noise of 10%, and falsified crews report a fixed share of the truth.
  The Directorate's verdict never changes. The ledger digest is not passed over the simulated mesh.
- In the seven-day week both surface results (wrong-band rate and proven protection) are fixed by the
  scripted truth on every seed. The wrong-band rate counts an over-cautious verdict the same as an unsafe one.
- Air-purifying respirators do not filter carbon monoxide, so when it is above its long-term limit only
  supplied air counts.
- A trial option fails exactly when it protects less than the surface requires; real fit varies from
  person to person. Trials and the return are plans, not events run in world time.
- Surface reception of 500 people a day for District 7 is an assumption, and it sets the length of the move.
- Every model constant is an assumption unless `docs/params.md` gives a source.

## What the warning cannot do

- The hum shows when the grid is stressed. It cannot say which level will be cut. The ledger of
  neighbours' power reports estimates that.
- A sudden plant trip collapses the grid in seconds. The warning only helps with slow shortfalls.
- The cut odds come from neighbours' reports. A level counts as cut in a stress event when three different
  senders report it without power during the event, but anyone can send public reports, and one person can
  pose as three. A level already dark before the event counts too. A level with fewer than three phones
  reporting never gets odds: with no past stress event observed from that level the odds read "no data yet".
- After the power is cut, the room has no hum to hear. The warning works before a cut, not during one.
- The tracker needs to be close to the hum. With the phone 30 cm from the source it followed a slow
  ramp within 4 mHz. At 1 m in a room where people moved, echoes made the reading wander by
  ±15 mHz even after smoothing, so the warning levels sit well above that.
- On real recordings (ENF-WHU, REPLAY) the tiers show AMBER or RED on 9.1% of readings while the real grid is GREEN: 37.3 false warnings an hour. They come from 40 of the 68 recordings compared, and eight of those give just over half.
- A hum-quality gate is not shipped. It is a harness experiment (`npm run score:enf`, field `gateExperiment` in `public/evidence/enf-whu.json`): a reading may change the shown tier only when its SNR is at least 18 dB and its frequency moved at most 30 mHz since the previous reading, otherwise the last tier is held. Thresholds were chosen on the odd-numbered recordings and scored on the even-numbered ones (7 of them with a real sag). There it cut false warnings from 34.4 to 20.6 an hour, but the false share only from 8.7% to 7.7% of GREEN readings, raised the miss share from 6.3% to 7.5%, and held the shown tier on 19% of readings. It would need a device retest before it could ship.

## Air watch (fan-stop alert)

- It hears a fan by its steady broadband sound (150 Hz to 1.7 kHz, the hum's frequencies left out) and alerts when that sound drops by 6 dB or more. It cannot tell why: a fan switched off for the night alerts the same as a power cut.
- How loud a quiet room sounds depends on the phone's microphone. The quiet level is an assumption (−100 dB on the analyser's scale) until a phone test sets it: a phone with a loud quiet room may show "Fan: running" with no fan.
- Unbroken talk louder than the fan hides a stop while the talk lasts; the alert comes in the pauses.
- Tested on synthetic traces and in Chromium with a synthetic microphone; not yet on a phone with a real fan.
- District 7 scores air warnings beside problem 1 on three scripted fan stops (seven-day week only): the Directorate warns at its 06:00 bulletin, STRATUM warns an assumed 50% of residents near a listening phone 5 s after the stop and the rest at the bulletin. The assumed share sets the gain. The stops do not raise CO2 in the air model, and a fan stopped by a power cut is not counted.

## Phone battery

- Phones run on their own batteries, so the app keeps working when the power is cut.
- A phone will not last a multi-day blackout by itself. During a cut the app stops hum tracking
  and wakes the microphone only in short bursts to catch messages.
- Phone charging is treated as a small guaranteed minimum in the fair-share rule.
- Battery relay boxes in stairwells are roadmap, not built.
- Offline works only after one visit with network, and an update is picked up on the next visit with network; a page whose network takes more than 3 s to answer opens the saved copy instead.

## Sound messages

- Sound carries a few metres in one room. The device test showed one hop, phone to a laptop gateway, at up to 3 m (`docs/device-results.md`). Each distance was one send with the shipped codec, not a repeated trial; the 20/20 counts are from the earlier spike code (docs/spikes.md). The phone also passed a laptop tab's report on (one relay hop). Multi-hop reach is simulated.
- A packet takes about 2 to 3 seconds. This is for status and short codes, not chat.
- Phones relay other families' messages without being able to check them, so well-formed junk can cost air time. Each phone relays any one message at most once and at most 4 hops, but an attacker can make endless new messages, and phones carry each one up to 4 hops of rooms beyond the attacker's speaker.
- Anyone who hears a message can replay it marked "no hops left", so phones that hear the replay first never pass the real message on.
- Public alerts are not signed. A grid alert is relayed only if the receiving phone hears the same stress or hears no hum at all, so during a cut, or far from any hum, a forged alert still travels.
- Any phone can send a public HOLD WATER ("hold, do not drink") or ROUTE ("tunnel blocked") alert. Phones relay it with no check, up to its hop count, and show it from a single sender. The inbox counts the different member numbers that sent the same alert at the same place and marks it unconfirmed below three, but one attacker can claim several member numbers, so the count is a hint, not proof.
- Public reports are not signed either. District 7's **Heard by sound** panel counts the different member numbers behind each report at each place and marks it unconfirmed below three, the same rule as the inbox, so it inherits the same weakness: one phone can pose as several senders. The reverse can happen too: each phone picks its member number at random (1 in 256 per pair), so two real phones can share one and count as a single sender. Its "cases heard by sound" figure adds each sender's latest people count, so two neighbours reporting the same sick people count them twice; it is an upper count, not a head count. A sender's latest report replaces its earlier one even when the latest gives no count, so a sender who resends without a count adds 0 people, and the row can say "no count given" although a count was heard; "from M senders" counts every sender, including those who gave no count. No outbreak estimate is made from it: a Chapman estimate needs a clinic list for the same place and the people on both lists, and the page has neither live.
- A public ledger digest names no sender: anyone can send one. The phone shows it only to compare with the District 7 screen.
- Messages carry their send time from the sender's clock. A receiver whose clock runs more than
  2 minutes behind the sender rejects fresh messages as from the future. Phones underground have no
  time signal, so clocks can drift apart over a long blackout.
- Messages older than 24 hours are rejected.

## Fair sharing

- The Directorate holds the breakers. The tool proves the pattern of who gets cut and lets a level
  share fairly what it controls. It cannot force anyone.

## Health

- Breath Count is a decision aid that follows published thresholds for children under five.
  It is not a medical device and gives no verdict for adults.
- Breath Count asks only five of the chart's eleven danger signs (chest indrawing, unable to drink
  or feed, vomits everything, convulsions, unusually sleepy or unconscious). It does not ask about
  long cough, long diarrhoea, blood in stool, long fever, the MUAC strap or swollen feet, so a GREEN
  card does not rule those out. The disclaimer says so.
- Breath Count counts breaths only for a child with cough or difficult breathing, as the chart does.
- A count with missed taps spread evenly through the minute still reads low. Only a gap over three
  breath intervals is caught.
- Medicine requests are not yet case reports for outbreak tracking (problem 9).
- Sound cannot detect contaminated water. The detector reads sensor values and residents' reports.

## Who it leaves out, and who it could put at risk

- The app must be installed once while the network is up. Spreading it phone to phone with no network is not built.
- Family words must be agreed in person before a split, like a meeting place.
- Tiers show a shape as well as colour (● GREEN, ▲ AMBER, ■ RED), and sound transfer needs no hearing from the user.
  In Chrome on Android the phone also vibrates while the page is on screen (not with the screen off; not yet tried
  on a phone, run sheet Part N): once at AMBER, three times at RED, once for a fan stop, a family need or the first
  public water or route alert at a place (**Vibrate on alerts** on the Listen tab). A screen reader announces the
  same events on any tab, a public alert with its sender count (`src/phone/alerts.ts`). iPhone browsers and Firefox
  for Android have no web vibration. The app was not tested with
  deaf, blind or non-reading users.
- People without a phone depend on a neighbour's phone or a shared laptop gateway.
- Sending is audible: anyone within a few metres hears that someone sent a message. A family message's
  contents and sender are encrypted and its group tag changes every minute, but its type (OK, NEED and
  so on) and send time are in the clear, and public alerts are readable by anyone.
- The family words are stored on the phone. Anyone holding the unlocked phone can read and send as the
  family; **Leave family** deletes them (`src/phone/app.ts`, `leave()`).
- The app is in English only, announcements included. It was not translated or tested with non-English readers.

## Results that go against us

- Lamps cannot feed a level: one person's food-floor calories need about 210 kWh of electricity a day
  with lettuce and over 400 kWh with grain, against 1 kW of base load per person.
- Shift-sharing of sleeping space raises contact rates.
- Shafts are not the limit on the return to the surface. Surface reception is.
- Sharing food at the floor lowers everyone's ration while one level is cut off, and when supply is
  below everyone's floor, everyone breaches, later but together.
- When most surface crews lie, the quorum is confidently wrong. In the stress week STRATUM's verdict
  is wrong in every round, on all 20 seeds, while the Directorate's fixed verdict happens to be right.
- In this model staged trials never cost fewer exposure-hours than one direct 30-day trial: a breach is
  caught in the first hour either way. Their real value, catching harm that shows only after longer
  exposure, is not modelled.
- When supply is below every life floor, Fair Share breaches every floor equally, so STRATUM's heat
  result is above zero (about 9,300 person-hours in the seven-day week, about 139,000 in the stress
  week, against the Directorate's 65,000 and 178,000).

## Surface

- The plan can show that a claim about the surface is false or unsupported. It cannot prove the
  surface is safe from inside a simulation.
- Mapping suits, domes and outposts onto respirator protection factors is our assumption.
