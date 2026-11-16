# Known limits

Stated plainly, so nobody finds them for us. Copy this section into the README before submission.

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
- No event in the seven-day script cuts level 5: only level 6 C and D go dark. So the demo family's sector
  stays powered, the district page's hum never falls silent, and the demo beat "Level 5 goes dark on the
  cross-section" does not happen on that page. The silent path is untested until a scripted cut reaches level 5.
- Grid, heat, power and tunnel results draw no randomness: they vary with the script and the parameters,
  not with the seed. Their uncertainty comes from parameter sweeps, not from seed intervals.
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

## Phone battery

- Phones run on their own batteries, so the app keeps working when the power is cut.
- A phone will not last a multi-day blackout by itself. During a cut the app stops hum tracking
  and wakes the microphone only in short bursts to catch messages.
- Phone charging is treated as a small guaranteed minimum in the fair-share rule.
- Battery relay boxes in stairwells are roadmap, not built.

## Sound messages

- Sound carries a few metres in one room. The live demo proves one hop. Multi-hop reach is simulated.
- A packet takes about 2 to 3 seconds. This is for status and short codes, not chat.
- Phones relay other families' messages without being able to check them, so well-formed junk can cost air time. Each phone relays any one message at most once and at most 4 hops, but an attacker can make endless new messages, and phones carry each one up to 4 hops of rooms beyond the attacker's speaker.
- Anyone who hears a message can replay it marked "no hops left", so phones that hear the replay first never pass the real message on.
- Public alerts are not signed. A grid alert is relayed only if the receiving phone hears the same stress or hears no hum at all, so during a cut, or far from any hum, a forged alert still travels.
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

## Results that go against us

- Lamps cannot feed a level: one person's daily calories need roughly 120 to 360 kWh of electricity.
- Shift-sharing of sleeping space raises contact rates.
- Shafts are not the limit on the return to the surface. Surface reception is.

## Surface

- The plan can show that a claim about the surface is false or unsupported. It cannot prove the
  surface is safe from inside a simulation.
- Mapping suits, domes and outposts onto respirator protection factors is our assumption.
