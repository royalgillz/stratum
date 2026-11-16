# STRATUM build plan


## The problem, clause by clause

Read closely, nine of the fifteen questions ask for two or three things, and STRATUM as written answers only one of them in most cases. The table lists every clause, the gap, and the repaired answer.

| # | What the question asks | Gap in STRATUM as written | Repaired answer | Target tier |
| --- | --- | --- | --- | --- |
| 1 | Warn before power **or air** cuts out | Frequency says when the grid is stressed, not which level is cut. The fix for that (the Shed Ledger) was optional. Air is simulated only | The hum says **when**. A ledger of neighbours' power reports says **who**. Time-to-limit on CO2 and heat covers **air**, plus fan-stop by sound if the audio model passes its test | Deep (power), Modelled (air) |
| 2 | Share power, **water and food** fairly | Labelled Deep but is a simulation. No rule when supply is below everyone's minimum. Silent on who holds the breakers | One allocator for all three: life floors first, then the worst-off, with rotation. An explicit floor-breach rule. An honest claim (see below the table) | Modelled, with real requests |
| 3 | Keep the lower levels livable | Sound as a model, but only one lever | The allocator steers fan and chiller power by need. When cooling cannot cover a level, it cools refuge rooms and rotates the hours | Modelled |
| 4 | Catch bad water **before** people drink it | Chlorine decay is the wrong analogue for a closed recycling loop. Tested only on its own simulated sensors | One detector on conductivity, organic carbon, turbidity and biocide, as on the ISS. HOLD WATER alert inside the pipe travel time. Residents' "water looks wrong" reports. The same detector scored on real utility data | Modelled, real data, real reports |
| 5 | Keep tunnels safe to **live in and move through**, when one flooded section isolates a neighbourhood | Routes around a flood after it happens | Find in advance the single sections whose loss isolates a neighbourhood, and give them pump power first. Forecast time-to-impassable. Broadcast detours | Modelled, real reports |
| 6 | **Find or make** space, or **share** it | Sharing only, and the result is arithmetic | Shift-shared sleeping space with families kept together and the good shift rotated. An occupancy census shows rooms idle by shift. The cost in contacts and the gain in peak power are both reported | Modelled |
| 7 | **Organize, share information, call for help** without the network | Status codes only. Public alerts anyone can forge. A flaw in the packet encryption | Authenticated packets by sound. A codebook for meetings, water points and medics. Store-and-forward relay | Deep |
| 8 | Reconnect families split across levels | Built on Tuesday, after two days of simulation work | Built Monday. Family board with authenticated, time-stamped beacons | Deep |
| 9 | **Track** the real outbreak **and get supplies** where needed | The nowcast recovers a number the simulation itself invented | Two independent lists (residents' breath-count reports and the clinic list) give a capture-recapture estimate with an interval. A wastewater signal at each recycler gives early warning. Supplies follow the estimate | Modelled, real reports |
| 10 | Get **basic care** to people who cannot reach a clinic | Logistics only. No care | Breath Count on the phone: breaths per minute against WHO thresholds, danger signs, a triage card and a medicine request. Couriers and pop-up care points allocated by triage | Deep (aid and request), Modelled (delivery) |
| 11 | **Track and treat** what a life without sunlight does | Nothing measures anything | Light dose per shift against published thresholds. Lamp-hours allocated by need. Grow rooms double as bright rooms. Optional sleep log on the phone | Modelled |
| 12 | **Grow and share** a neighbourhood's own food | Calorie-crop energy number unsourced | Ration the stock with a floor, pick crops by calories per kWh, share by OFFER and NEED. Report plainly that lamps cannot replace the farms | Modelled, real requests |
| 13 | **Prove** whether the surface is safe **and get the answer to everyone** | Placeholder limits. No account of who builds the probes. No "everyone" | Signed readings from independent crews, a quorum, and a verdict stated as an exposure band against real limits. The ledger's digest goes out over the mesh | Modelled, real digest packet |
| 14 | Which option **works**, and **who** goes first | The bandit converges on a number the author chose. People are ranked by health data | The option follows from the measured band, using respirator protection-factor logic. Staged trials with stop rules. Volunteers by lottery with exposure caps | Modelled |
| 15 | **Plan** the move of hundreds of millions | Assumed throughput | Return slots allocated by the same fair-share rule. Capacity from real hoist figures. Surface reception shown as the true limit | Modelled |

**The honest claim for problem 2.** In the Hollow the Directorate holds the breakers. STRATUM cannot seize them. It can prove the pattern of who gets cut, and it can run a fair plan over what a level does control: its own loads, its shared water point and its food stock.

**Three facts in the world text that no plan had used:**

- **The Directorate controls movement between levels.** Relays therefore cross levels through stairwell nodes and through people who are allowed to move, such as couriers.
- **Light is a utility you pay for.** Lamp-hours become one more rationed good in the allocator.
- **The way up is overrun by machines.** Surface sniffers are small canisters raised through disused ventilation raises, and they sample intake air before the Directorate's filters. This is a labelled assumption.

## The repaired concept: one loop, three engines, one district

STRATUM becomes a citizen toolkit with one loop: hear what is really happening, prove it, pass it on, and share what there is fairly. Three engines run that loop, and a simulated district is the rig that tests them.

```
1 Hear  --->  2 Prove  --->  3 Pass on  --->  4 Share fairly  ---> (what changes is heard again: back to 1)
   |             |              |                 |
   +-- Witness engine --+   Mesh engine     Fair Share engine
       one detector,        one 25-byte     one allocation rule
       one hash-chained     packet
       ledger
   |                            |                 |
   +------- District 7 test rig (simulated): 6 levels, 24 sectors -------+
```

Read it left to right, then down: each step is run by an engine, and the district underneath exists to test the engines.

### The three engines

| Engine | What it is | What is real today |
| --- | --- | --- |
| **Witness** | One change detector and one hash-chained ledger. Every disputed number in the Hollow is stored twice: what residents measured, and what the Directorate announced. The gap between the two is a metric | The hum tracker on a phone, scored on real recordings. Residents' reports arriving as packets. The detector scored on real water data |
| **Mesh** | One 25-byte authenticated packet, carried by sound from phone to phone, stored and passed on | Real packets between real devices, with real cryptography |
| **Fair Share** | One allocation rule for every scarce thing: meet life floors first, then raise the worst-off, and rotate what cannot be split | The rule is real code and runs on real requests from phones. The supplies are simulated |

### How the fifteen problems map onto the loop

| # | Hear and prove (Witness) | Pass on (Mesh) | Share (Fair Share) |
| --- | --- | --- | --- |
| 1 | Hum, neighbours' power reports, fan sound, CO2 | Grid and air alerts |  |
| 2 | Shed Ledger shows who is cut | Requests | Power, water, food |
| 3 | Temperature, fan state | Heat alerts | Fan and chiller power, refuge-room hours |
| 4 | Recycler sensors, "water looks wrong" reports | HOLD WATER | Clean water |
| 5 | Sump levels, flooding reports | Route closed, use B | Pump power |
| 6 | Occupancy census | Shift notices | Sleeping space by shift |
| 7 |  | All message types |  |
| 8 |  | OK beacons |  |
| 9 | Breath-count reports, clinic list, wastewater | Case reports | Medical supplies |
| 10 | Breath Count triage | Medicine requests | Courier visits, care points |
| 11 | Light dose, sleep log |  | Lamp-hours |
| 12 | Food stock | OFFER and NEED | Rations, lamp energy between crops |
| 13 | Signed surface readings | Ledger digest to everyone |  |
| 14 | Trial outcomes | Calls for volunteers | Trial places by lottery |
| 15 | Surface reception capacity | Slot notices | Return slots |

### Why a simulated district at all

Nobody can test a rationing rule on two billion people. District 7 is the test rig: six levels, 24 sectors, and coupled power, heat, air, water, sewage, disease, light and food. Its job is to produce the signals the engines hear and to measure what changes when they act. It is labelled SIMULATED everywhere.

### Which path

A combination, weighted towards sustaining life underground. Problems 1 to 12 keep people alive now. Problems 13 to 15 reuse the same three engines for the way up, so the surface path costs configuration, not a second product.

## Final mechanism per problem, with real anchors

Each problem gets one mechanism built from the three engines, one real anchor where a public source exists, and one metric against the Directorate baseline. Labels say what a judge is looking at: LIVE (real device), REPLAY (real recorded data) or SIMULATED.

| # | What runs | Anchored in | Metric and label |
| --- | --- | --- | --- |
| 1 Warning | Tone bank on the 800 Hz component, relative deviation after a 30 s calibration, tiers from deviation and rate of change. Shed Ledger gives each level's odds of being cut at the current tier. Air: time-to-limit for CO2 and wet-bulb | [ENF-WHU](https://github.com/ghua-ac/ENF-WHU-Dataset): 130 real recordings, 8 kHz, 5 to 20 minutes, MIT licence. Thresholds are design choices and are labelled so | Tracker error on real clips (REPLAY). Lead time before a cut and share of cuts warned (SIMULATED). Phone tier change (LIVE) |
| 2 Fair sharing | Fair Share on power, water and food: floors, then the worst-off, with a debt memory that rotates feeder cuts | Cape Town's 2018 rationing levels and the leximin literature, both from the earlier reports and not re-checked today | Worst-decile served fraction, floor-breach person-days, Jain index (SIMULATED, with LIVE requests) |
| 3 Heat | Heat balance per sector. Fair Share steers fan and chiller power to where it removes the most person-hours over the limit. Refuge rooms with rotated hours | South African deep-mine wet-bulb limits of 27.5 °C and 32.5 °C, from the earlier report | Person-hours above 27.5 °C wet-bulb (SIMULATED) |
| 4 Water | Witness detector on conductivity, organic carbon, turbidity and biocide. HOLD WATER alert inside the pipe travel time. Clustering of residents' reports | ISS practice: in-line conductivity, total organic carbon limit 3 mg/L, iodine biocide at 1 to 4 mg/L ([NASA](https://ntrs.nasa.gov/api/citations/20170001718/downloads/20170001718.pdf)). EPA [customer complaint surveillance](https://19january2021snapshot.epa.gov/sites/static/files/2015-06/documents/water_quality_sureveillance_and_response_system_primer.pdf). [GECCO 2018](https://zenodo.org/records/3884398) real drinking-water data, CC BY 4.0 | Precision and recall on GECCO events (REPLAY). People exposed before the alert, false alarms per week (SIMULATED) |
| 5 Tunnels | Water level per tunnel node. Bridge-finding marks the sections whose loss isolates a neighbourhood. Pump power ranked by people isolated per kW. Detours by shortest safe path | Graph analysis is exact. Hydraulic parameters are assumptions | Stranded person-hours, isolating events (SIMULATED, with LIVE flood reports) |
| 6 Space | Households assigned to sleep shifts, families together, preferred shift rotated. Census of occupancy by sector and shift | Sphere minimum of 3.5 m² covered space per person and submarine bunk-sharing, from the earlier report | Sleeping m² per person against 3.5, change in peak load, change in contact rate (SIMULATED) |
| 7 Mesh | Packet v3, a codebook of standard messages, relay that stays silent once it has heard a message twice | [ggwave](https://github.com/ggerganov/ggwave), MIT licence | Packet success at 1 m and 3 m (LIVE). Delivery fraction and delay with the network down (SIMULATED) |
| 8 Families | OK beacon to a family board that shows the beacon's own authenticated time | Red Cross "safe and well" tracing, from the earlier report | Time until every member has a known status (LIVE and SIMULATED) |
| 9 Outbreak | Per-sector epidemic model tied to ventilation and crowding. Wastewater signal at each recycler. Capture-recapture between residents' reports and the clinic list. Supplies follow the estimate | Capture-recapture for under-reported Ebola ([CDC](https://wwwnc.cdc.gov/eid/article/21/12/15-0756_article)). Wastewater leading reported cases by roughly 2 to 8 days in [reviewed studies](https://pmc.ncbi.nlm.nih.gov/articles/PMC8282235) | Error of our estimate against the official figure's error, days of lead, infections averted (SIMULATED, with LIVE reports) |
| 10 Care | Breath Count: taps over 60 s give a rate. Fast breathing is 50 or more a minute at 2 to 12 months and 40 or more at 12 months to 5 years. Chest indrawing or a danger sign means RED. Couriers and care points by Fair Share | [WHO guidance](https://ncbi.nlm.nih.gov/books/NBK143752/) for community health workers | Median time to first care for RED cases, stock-out days in deep levels (LIVE aid and request, SIMULATED delivery) |
| 11 Sunlight | Light dose per shift against published thresholds. Fair Share allocates bright lamp-hours. Grow rooms count as bright rooms | Daytime 250 lux melanopic or more, under 10 before sleep, under 1 asleep, from the earlier report | Share of residents meeting the daytime threshold at equal kWh (SIMULATED) |
| 12 Food | Days of food from stock and ration. Crops chosen by calories per kWh. Fair Share on the stock. OFFER and NEED packets | Lettuce at about 10 to 20 kWh per kg ([Ritchie](https://hannahritchie.substack.com/p/vertical-farming)). Grain at about 650 kWh per kg, a modelled figure ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC11961353)) | Days until the food floor is breached after a cut-off (SIMULATED, with LIVE requests) |
| 13 Surface truth | Readings signed by each crew and chained by hash. The median is accepted when enough crews agree. The verdict is an exposure band, not yes or no | NIOSH "immediately dangerous" values: carbon monoxide 1,200 ppm, ozone 5 ppm, sulfur dioxide 100 ppm ([NIOSH](https://www.cdc.gov/niosh/idlh/intridl4.html)) | Wrong-band rate with some crews falsified, readings needed to decide (SIMULATED). Ledger digest packet (LIVE) |
| 14 Pioneers | Required protection = measured level divided by the long-term limit. The option must meet it. Trials step from 1 hour to 30 days and stop on any breach. Volunteers by lottery | OSHA assigned protection factors: half mask 10, full facepiece 50, powered full facepiece 1,000, pressure-demand breathing apparatus 10,000 ([OSHA](https://obis.osha.gov/dte/library/respirators/presentation/slide33.html)) | Exposure-hours spent to reach a 30-day verdict, breaches (SIMULATED) |
| 15 Return | Slots per day are the smaller of shaft throughput and surface reception. Fair Share by debt-weighted lottery, families together | One platinum-mine shaft winds 1,070 people an hour ([study](https://911metallurgist.com/wp-content/uploads/2015/12/An-investigation-into-the-optimization-of-personnel-transportation-to-level-15-and-below-at-Khuseleka-No-1-shaft-Anglo-Platinum.pdf)). One cage holds up to 145 ([Daily Maverick](https://www.dailymaverick.co.za/article/2023-11-29-failure-of-emergency-protocol-led-to-death-of-11-miners-after-rapid-descent-of-conveyance-cage/)) | Longest wait by level against "upper levels first", total duration (SIMULATED) |

### Three results to publish even though they go against us

- **Lamps cannot feed a level.** 2,000 kcal is 2.3 kWh of food energy. At 0.65% to 2% conversion from electricity to edible calories, one person's daily food needs roughly 120 to 360 kWh. Local growing buys days, not independence.
- **Shafts are not the limit on the return.** At 1,070 people an hour for 20 hours a day, one shaft lifts 21,400 people a day. Two billion people is about 93,500 shaft-days, or roughly 93 days with a thousand shafts. Surface reception is the real constraint.
- **A sudden plant trip gives no warning.** The hum warns of slow shortfalls. The demo shows one case where the warning comes too late.

### The formulas the engines use

```latex
\text{Fair Share: } x_i = \max\big(f_i,\ \min(d_i,\ \lambda)\big), \quad \sum_i x_i = S \qquad \text{if } S < \sum_i f_i:\ x_i = f_i \cdot \frac{S}{\sum_j f_j}
```

```latex
\text{Chapman estimate: } \hat N = \frac{(n_1 + 1)(n_2 + 1)}{m + 1} - 1
```

```latex
\text{Cut odds: } P(\text{cut} \mid \text{level}, \text{tier}) = \frac{c + 1}{e + 2} \qquad \text{Hazard ratio: } HR = \frac{C_{\text{measured}}}{C_{\text{limit}}}, \quad APF \ge HR
```

In Fair Share, f is the life floor, d the demand, S the supply and λ the water level that uses the supply exactly. In the Chapman estimate, n₁ and n₂ are the sizes of the two lists and m is the number of cases on both. In the cut odds, c counts cuts of that level at that tier and e counts stress events at that tier.

## Architecture

Two pages, one worker and no server: a phone page that hears and speaks, a district page that simulates and listens, and a headless harness that produces the evidence. All three import the same core code, so the code scored on real data is the code in the demo.

### Components

- **Phone page** (installable, works offline): Listen (hum tracker, tier, cut odds), Report (OK, NEED and REPORT buttons that send packets), Breath Count, Family board.
- **District page** (laptop): simulation worker, cross-section, emitter (hum, fan noise, outgoing chirps), mesh gateway that decodes packets from the room and injects them, charts, judge mode.
- **Harness** (Node): seeds by scenarios by ablations, written to JSON and drawn as charts.
- **Core** (plain TypeScript, no browser APIs): tracker, packet codec, Witness, Fair Share, world models.

### Two clocks

- **World clock.** Simulated time, running at real speed or as a time-lapse of one simulated hour per real second.
- **Audio clock.** Always real time. The emitter integrates grid frequency at real speed from the district's current supply gap, so the hum is always physically paced.
- **Scripted acts.** A scenario file lists acts, each marked time-lapse or real time. A shortfall or a cut is always a real-time act of 60 to 90 seconds. The mode is shown on screen.
- **Harness.** Ignores audio and runs the world clock flat out.

### Audio frequency plan

| Band | Use | Rule |
| --- | --- | --- |
| 350 to 450 Hz | Hum fundamental | Tracker's secondary input |
| 750 to 850 Hz | Hum second harmonic, the strongest component | Tracker's primary input |
| 1,150 to 1,700 Hz | Weaker third and fourth harmonics, and the fan-noise bed | Emitter is low-passed at 1.7 kHz |
| 1,875 to about 6,330 Hz | Sound packets: 96 tones spaced 46.875 Hz apart | Nothing else emits here |

Echo cancellation, noise suppression and automatic gain are off on every microphone. Each device opens one microphone stream and feeds both the tracker and the decoder from it. A device pauses its tracker while it transmits. If spike T3 shows interference, the laptop lowers the hum by 12 dB while a packet arrives.

### Packet v3, 25 bytes

| Bytes | Field | Notes |
| --- | --- | --- |
| 0 | Version and type | OK, NEED, REPORT, CODEBOOK, GRID\_ALERT, HOLD\_WATER, ROUTE, LEDGER\_HEAD |
| 1 to 2 | Minute counter | The sender's clock, shown to the reader as the message time |
| 3 to 5 | Nonce | Random per packet, so the keystream never repeats |
| 6 to 9 | Group tag | HMAC of the minute under the family key. It changes every minute, so a listener cannot follow a family |
| 10 to 15 | Payload, encrypted | Member, status or code, level and sector, flags including power on or off, two value bytes. XOR with HMAC(key, type, minute, nonce) |
| 16 | Hops left | Not covered by the MAC. Each relay lowers it |
| 17 to 24 | MAC | First 8 bytes of HMAC-SHA-256 over bytes 0 to 15 |

At the 8 to 16 bytes a second ggwave states, one packet is about 2 to 3 seconds of sound.

- **Keys.** The first phone generates six random words from a 2,048-word list (66 bits). Other family phones type the words once. HKDF derives separate tag, encryption and MAC keys. Nobody chooses a passphrase.
- **Replay.** Receivers remember each minute-and-nonce pair and show the packet's own time, so an old OK cannot look fresh. Packets dated more than two minutes ahead are dropped.
- **Public packets** (alerts, HOLD WATER, routes, ledger digests) use the same header with a plain payload. A grid alert is relayed only if the receiving phone's tracker agrees or hears no hum. Other claims show how many different senders reported them and count as confirmed at three. A ledger digest is the first 16 bytes of the chain head, which anyone can compare with their own copy.

### Judge mode

- The landing page shows District 7 and one button: "Play the 90-second story". One click starts the sound, because browsers block audio until a user gesture, and no microphone is needed.
- A phone drawn on the page runs the same tracker and codec, fed by an internal audio connection in place of a microphone. It is labelled LOOPBACK.
- A QR code opens the phone page for anyone with a second device. Microphone permission is asked there, after a tap, with one sentence on why.
- The page works muted and reads on a phone screen.

### Stack

| Layer | Choice | Status |
| --- | --- | --- |
| Language and build | TypeScript, Vite 8, Vitest 5 | Versions 8.3.8 and 5.1 were confirmed in the earlier audit. Pin on Saturday with `npm view <pkg> version` |
| Rendering | Canvas 2D, hand-written SVG charts | Built in |
| Audio | Web Audio with an AudioWorklet | Built in. Test on iPhone before relying on it |
| Sound packets | ggwave 0.4.0, vendored behind `modem.ts` | MIT. Unmaintained on npm since 2022, so the fallback is defined |
| Cryptography | WebCrypto: HMAC-SHA-256, HKDF, SHA-256, ECDSA P-256 | Built in. HKDF on iOS Safari is unverified; spike T2 checks it |
| Storage | IndexedDB for the ledger and the seen-set | Built in |
| Sound model | `@mediapipe/tasks-audio`, pinned, with the YAMNet file hosted in the repo and loaded on demand | Optional until spike T4 passes |
| Offline | Service worker with a versioned cache | Hand-written, about 40 lines |
| Hosting | Vercel, static, Hobby plan | Switched from Cloudflare Pages on Nov 14 (human decision). HTTPS is required for the microphone |

Cost is $0. There is no backend, no account, no analytics and no network call at run time.

### Privacy and safety by design

- Audio is processed on the device, never stored and never sent. Listening starts only when the user taps.
- Reports carry a level and sector, never an address. The ledger aggregates per level.
- Group tags rotate every minute, and every message shows its authenticated time.
- Breath Count is labelled a decision aid that follows published charts, not a medical device.

## Scope ladder and schedule

The build is a ladder of five rungs, and each rung from the second up is a project you could submit. At about 10 focused hours a day it totals 58 hours through Friday morning, with the real phone slice finished by Monday night.

### The ladder

| Rung | Gate | What exists at the gate | If the gate is missed |
| --- | --- | --- | --- |
| 0 Ground | Sat 22:00 | Repo, contracts on main, a deployed page, spike results | Choose the fallbacks tonight, not tomorrow |
| 1 Hear | Sun 22:00 | The phone turns AMBER then RED from the laptop's hum. One authenticated packet crosses the room | Monday morning finishes it, and the report grid shrinks to OK and NEED |
| 2 Speak | Mon 22:00 | Report grid, family board, Shed Ledger, Breath Count, one relay hop, judge mode. Tagged `v0-real` and deployed. Problems 1, 2, 7, 8 and 10 have something real; 4, 5, 9 and 12 take real reports | Tuesday finishes the real slice. The district shrinks to five world models, and problems 6, 11, 12, 14 and 15 become roadmap panels |
| 3 District | Tue 22:00 | A scripted seven-day scenario runs end to end with a Directorate or STRATUM switch. A phone's OK appears in the district. Evidence runs start overnight | Ship the real slice with static charts from the harness, and skip cross-section polish |
| 4 All fifteen | Wed 22:00, freeze | Remaining adapters on screen (6, 10 delivery, 11, 12, 13, 14, 15), the coverage matrix, the sound model if T4 passed, reviewer fixes | Anything not on screen at 18:00 is cut and listed as roadmap |
| 5 Ship | Thu night, final Fri before 23:00 | README, write-up, video, clean-browser test, submission | No video by Thu 20:00: a 90-second screen cut plus one phone clip |

### Spike tests and pass marks

| Test | When | What | Pass | If it fails |
| --- | --- | --- | --- | --- |
| T1 Hum tracking | Sat | Laptop plays 400 and 800 Hz. Phone at 1 m, after a 30 s calibration | A 0.1 Hz step is seen within 3 s, and a slow ramp is tracked within 5 mHz | Raise the level, then move the tracked tone to 1 kHz as a "grid sync tone" |
| T2 Sound packets | Sat | 20 packets of 25 bytes, phone to laptop, at 1 m and 3 m | 18 of 20 at 1 m, 14 of 20 at 3 m, and key derivation works in the browser | QR codes as optical packets behind the same adapter |
| T3 Coexistence | Sat | T2 with the hum playing, and T1 with chirps playing | 16 of 20 at 1 m, and no false tier change | Lower the hum while receiving |
| T5 Speed | Sun | 30 simulated days, headless | Under 10 s | Fewer sectors or coarser steps |
| T4 Sound model | Mon | 10 real coughs, then 5 minutes of fan noise and speech | 8 of 10 coughs counted with at most 1 false count, and a fan stop noticed within 5 s | Cough count becomes a manual tap, and the air warning stays simulated |

Run T1 and T2 on the Android phone first. If the iPhone fails either, drop it from the plan without further debugging.

### Hour budget

| --- | --- | --- | --- |
| Sun 15 | 10 | Tracker and tier screen on the phone (4). Emitter with a scripted trace (1.5). Packet send and receive on both devices (3). Review and merge (1.5) | ENF-WHU scoring harness. World models for grid, heat and air, water, tunnels, epidemic |
| Mon 16 | 10 | Report grid, family board, Shed Ledger, Breath Count (4.5). Relay and gateway (2). Judge mode (2). T4 (0.5). Review and merge (1) | World models for light and food, space, care delivery, surface and return. GECCO scoring harness. Experiment harness |
| Tue 17 | 10 | Kernel, two clocks, scripted scenario (2.5). Cross-section and overlays (4.5). Phone packets into the district (1.5). Review and merge (1.5) | Chart components, per-problem adapters and metrics, tests. Evidence runs overnight |
| Thu 19 | 10 | Fix list (2). README, write-up, screenshots (2). Film the phones (1.5). Screen capture (1). Edit and captions (2.5). Submit a draft and test in a clean browser (1) | Final check of README claims against the code |
| Fri 20 | 2 | Final check, and submission by 23:00 (hard deadline 11:00 PM) |  |

Explicit slack is 5.5 hours, about 10%: Wednesday's sound-model box and Thursday's fix list. The real protection is the ladder, because every gate has a cut rule. If you have fewer hours on weekdays, keep the order and stop at the highest gate you reach by Wednesday night.

### Scope

- **Must:** rungs 0 to 3 and the coverage matrix.
- **Should, in this order:** the remaining adapters of rung 4, the on-device sound model, the ENF-WHU error overlay in the live screen, offline install.
- **Could:** sleep log on the phone, more than five codebook messages, a real 120 Hz mains clip, Hum Witness.
- **Cut:** 3D, PixiJS, any language model, backend, accounts, maps, Bluetooth, WebRTC, hardware, per-agent epidemic, scenario editor.

If the rubric, once published, names AI or model integration, the sound model moves ahead of the remaining adapters. Problems 11, 14 and 15 are then the ones that become roadmap panels.

## Evidence, demo script and judge Q&A

The evidence is two scores on real public data, one live physical loop, and a 20-seed comparison against the Directorate's policy. The video spends most of its time on what is real.

### Evidence

| Evidence | What it shows | Label |
| --- | --- | --- |
| Tracker on ENF-WHU clips | Error in millihertz against the dataset's reference traces, and how often it correctly says NO HUM. The clips come from a 50 Hz grid, so the tracker runs in its 50 Hz setting: same estimator code, different nominal frequency | REPLAY |
| Detector on GECCO water data | Precision, recall and false alarms per week on labelled events | REPLAY |
| Packets in the room | Success rate at 1 m and 3 m, with and without the hum | LIVE |
| Directorate against STRATUM | One metric per problem, 20 seeds, with 95% intervals | SIMULATED |
| Ablations | Each engine switched off alone, to show what each one contributes | SIMULATED |
| Stress cases | Network cut, falsified official numbers, farm cut-off | SIMULATED |
| Sweeps | Grid inertia, under-reporting, share of falsified surface crews | SIMULATED |
| Results against us | Lamps cannot feed a level, shift-sharing raises contacts, a sudden trip gives no warning | SIMULATED |

The matrix is 5 conditions by 4 scenarios by 20 seeds, which is 400 runs, plus about 360 sweep runs. At up to 10 seconds each that is roughly two hours on one core. The README states the seeds and the command that reproduces every chart.

### Demo script, 2:45

| Time | On screen | Words |
| --- | --- | --- |
| 0:00 to 0:12 | Filmed. A dark room, a phone on a table, a low hum. The phone shows GREEN | "Level 5. The network has been down for two days." |
| 0:12 to 0:35 | The hum sags. The phone turns AMBER, then RED, with a countdown and Level 5's cut odds | "The Directorate controls the network. It doesn't control the hum in the walls. Any phone can hear the grid failing, and our neighbours' reports say who gets cut first." |
| 0:35 to 1:00 | Level 5 goes dark on the cross-section. A thumb taps "We're OK": a chirp, the laptop decodes it, the family board turns green with a verified time. Breath Count, sped up: a RED card, a medicine request chirps, a courier route bends round a flooded tunnel | "No network. The message travels as sound, signed with a family key. A breath count becomes a request for medicine." |
| 1:00 to 1:25 | Pull back to District 7 in time-lapse. The loop appears once. The ledger shows the official figure beside the witnessed estimate, and a water alert firing before the taps | "One loop. Hear it, prove it, pass it on, share it fairly. Residents' numbers sit beside the Directorate's." |
| 1:25 to 1:55 | A switch between Directorate policy and Fair Share. Three charts: worst-off served fraction, person-hours above the heat limit, floor breaches | "Same supply. Different rule." |
| 1:55 to 2:20 | Signed readings from independent crews, the band verdict, the protection it requires, return slots by level | "Is the surface safe? Not a yes or a no. A measured band, signed by crews the Directorate doesn't control. The band decides the protection, and the deepest levels go first." |
| 2:20 to 2:33 | Coverage matrix: 15 rows with tier badges | "Fifteen problems, one loop. Four run on real phones today. Eleven run in District 7 with published seeds." |
| 2:33 to 2:45 | A card: real (phones, mesh, algorithms, two public datasets) and simulated (the district). Repo address | "Code, seeds and limits are public." |

Every number shown or spoken comes from harness output or a live reading. None is written into the script in advance.

### Judge Q&A

- **Is this just a simulation?** The district is. The warning, the packets, the ledger and the allocator are real code on real phones, and two of them are scored on real public data.
- **Does it really cover fifteen problems?** Every problem has a mechanism, a metric and a place on screen, with its tier printed. Four are live and eleven are modelled. We claim no more.
- **Is the phone just a tuner?** A tuner shows pitch. This tracks millihertz changes in a hum, rejects windows with no signal, and is scored against reference traces on 130 real recordings.
- **Frequency is the same everywhere. How does it warn my level?** Alone, it doesn't. The hum says when. The ledger of neighbours' power reports says who. A steady hum while your level is dark is the evidence.
- **Can the Directorate forge messages?** Family messages carry a 64-bit authentication code under a key that never travels. A grid alert is passed on only if the receiving phone hears the same stress.
- **Why trust the numbers?** Twenty seeds per condition, intervals shown, every parameter listed with a source or marked as an assumption, and three results published that go against us.
- **Who enforces the fair plan?** Nobody can force the Directorate. The tool proves the pattern and lets a level share fairly what it controls.
- **Is Breath Count medical advice?** No. It applies published thresholds for community health workers and tells you when to seek help.
- **What comes next?** Cheap stairwell nodes, a real surface sniffer, and a field test of the packets in a real tunnel.

If the sound model does not ship, the answer to "Where is the AI?" becomes: almost none, on purpose, because every part of this must run with the network off and be checkable by hand.

### Submission checklist

- [ ] Video of 2:45 or less, with captions and no third-party music
- [ ] Public repo with an MIT licence and the data licences listed (ENF-WHU: MIT. GECCO 2018: CC BY 4.0. ggwave: MIT)
- [ ] Live address tested in a private window on a laptop and on a phone
- [ ] Five screenshots: phone at RED, family board, cross-section, fairness chart, coverage matrix
- [ ] Write-up: inspiration, what it does, how it works, evidence, real against simulated, prior art, limits, what is next
- [ ] Draft submitted Thursday night, confirmed Friday morning
