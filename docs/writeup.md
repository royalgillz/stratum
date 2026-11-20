# STRATUM

A citizen toolkit for the Hollow, built around one loop: **hear** what is really happening, **prove** it, **pass it on** without the network, and **share fairly** what there is.

- Live: https://stratum-nine-swart.vercel.app (the home page starts with **Judge mode**: 90 seconds, no microphone, works muted)
- Code, seeds and limits: https://github.com/royalgillz/stratum (MIT)
- Track: Life Underground, Patriot HackFest Fall 2026

Numbers below come from `public/evidence/*.json` and `docs/coverage.md`. Device results come from `docs/device-results.md`.

## Inspiration

The Directorate controls the network, the breakers and the numbers. It does not control the hum in the walls. Every powered machine hums at the grid frequency, and the pitch sags before supply runs out. A phone can hear that. A phone can pass a signed 25-byte packet by sound to a laptop 3 m away (device test, `docs/device-results.md`). And once people can see who gets cut, they can ask for a fairer rule. STRATUM starts from what a resident already carries: a phone with a microphone and a speaker.

## What it is

One loop, three engines, one test rig.

| Engine | What it does | What is real |
| --- | --- | --- |
| **Witness** | One change detector and one hash-chained ledger. Every disputed number is stored twice: what residents measured and what the Directorate announced | The hum tracker on the phone, scored on real recordings (REPLAY). The detector, scored on real drinking-water data (REPLAY). Residents' reports arrive as real packets. District 7's ledger panel shows measured beside official and sends the head digest by sound (tested in a browser only) |
| **Mesh** | One 25-byte authenticated packet, carried by sound from phone to phone, stored and passed on | The signed v3 packet with family words, from the shipped codec, verified phone to laptop at 30 cm, 1 m and 3 m (LIVE). The phone passed one report on (one relay hop). Earlier, spike code carried 25 bytes phone to laptop 20/20 |
| **Fair Share** | One allocation rule for every scarce thing: life floors first, then raise the worst-off, rotate what cannot be split | The rule is real code. The supplies it shares are simulated |

**District 7** (6 levels by 4 sectors) is a simulated test rig: coupled power, heat, air, water, sewage, disease, light, food and the surface. It exists to produce the signals the engines hear and to measure what changes when they act. It is labelled SIMULATED everywhere.

The honest claim for fair sharing: in the Hollow the Directorate holds the breakers, and STRATUM cannot seize them. It can prove the pattern of who gets cut, and it can run a fair plan over what a level does control.

## What is real and what is simulated

Every number on screen and in this write-up carries one of three labels:

- **LIVE**: measured on a real device in a real room.
- **REPLAY**: real public recordings run through the same code the phone uses.
- **SIMULATED**: District 7, or judge mode's drawn phone (which runs the real tracker and codec on a simulated hum, marked LOOPBACK).

Each problem also carries a tier, from `docs/coverage.md`: **Live** (runs on a real phone), **Modelled** (an algorithm in District 7, measured against the Directorate's rule), **Thin** (one rule or chart on assumed parameters), **Roadmap** (write-up only). No problem is Thin or Roadmap. The air half of problem 1 is a fan-stop alert on the phone: it hears the steady sound of a fan and warns when it stops. It is built and tested on synthetic traces and in Chromium with a synthetic microphone; the phone test is pending. District 7 does not score air warnings.

Device status (`docs/device-results.md`): the run sheet ran on a Samsung Galaxy Z Fold 7 (Android 17, Chrome 158) and a Windows laptop. Passed: the hum tiers at 30 cm, the phone's family OK verified by District 7 at 30 cm, 1 m and 3 m, a laptop tab's family OK on the phone's board, judge mode, District 7 and the coverage matrix. Also passed: the phone passing a report on (one relay hop), install to the home screen and use in Airplane mode, and on the phone a danger-sign RED whose medicine request the District 7 gateway verified. District 7's family board now lists verified requests too; that was not rerun with the phone. The 60-second tap count passed in a laptop browser only. Earlier, spikes T1 to T3 passed on one Android phone and a laptop (`docs/spikes.md`). No iPhone was tested.

## The fifteen problems

Every problem has a mechanism, a metric and a place on screen, with its tier printed. District 7 results are means over seeds 1 to 20 of the seven-day week ("7-day"); "stress" is the stress week, built so STRATUM also loses. D is the Directorate's rule, S is STRATUM's.

| # | Problem | Mechanism | Tier | Headline result |
| --- | --- | --- | --- | --- |
| 1 | Warn before power or air cuts | Tone bank on the 800 Hz hum, 30 s calibration, GREEN / AMBER / RED tiers; Shed Ledger gives cut odds per level from neighbours' reports, also on the Listen tab at AMBER and RED; air: a fan-stop alert on the Listen tab | Live (power); air: fan-stop alert built, phone test pending | Tracker on 129 of 130 ENF-WHU clips: median per-clip error 31.2 mHz (REPLAY). Cuts warned 10 min ahead, 7-day: D 0.00, S 0.40; stress: D 0.00, S 0.00 (SIMULATED) |
| 2 | Share power, water, food fairly | Fair Share: floors, then water-filling, debt rotates feeder cuts | Modelled; phone sends real reports | Worst-decile served fraction, 7-day: D 0.66, S 0.85; stress: D 0.50, S 0.63 (SIMULATED) |
| 3 | Keep lower levels livable | Fair Share steers cooling to where it removes most person-hours over the limit; refuge rooms | Modelled | Person-hours above 27.5 C wet-bulb, 7-day: D 64,904, S 9,336; stress: D 178,050, S 138,670 (SIMULATED) |
| 4 | Catch bad water before people drink it | Witness detector on recycler sensors; the level's water is held before bad water reaches the taps; a public HOLD WATER alert by sound from the phone | Modelled; real data; phone sends real reports | GECCO 2018, six sensors: 22/22 held-out events, precision 0.017; 21/29 on the first half (REPLAY). Person-hours of unsafe water drunk, 7-day: D 23,280, S 0 (SIMULATED) |
| 5 | Keep tunnels safe to live in and move through | Pump power first to the sections whose flooding would cut people off from the hub; a public ROUTE ("tunnel blocked") alert by sound from the phone | Modelled; phone sends real reports | Stranded person-hours, 7-day: D 6,082, S 0; stress: D 28,750, S 20,530 (SIMULATED) |
| 6 | Find, make or share space | Shift-shared sleeping space, families together, good shift rotated | Modelled | Sleeping m2 per sleeper (busiest shift), 7-day: D 2.00, S 5.39; cost: households per space D 1.00, S 3.00 (SIMULATED) |
| 7 | Organize without the network | 25-byte authenticated packets by sound; codebook; relay at most once, at most 4 hops | Live | Signed packets phone to laptop verified at 30 cm, 1 m and 3 m; one relay hop through the phone (LIVE, device test). Earlier, spike code: T2 20/20 at 1 m and 3 m, T3 20/20 with the hum playing. Delivered within 60 min, 7-day: D 0.00, S 0.48 (SIMULATED) |
| 8 | Reconnect families | OK beacons under a family key to a family board with the packet's own time | Live | The phone's OK verified by District 7 at 30 cm, 1 m and 3 m (LIVE, device test). Mean hours until status known, 7-day: D 3.9 h, S 2.2 h (SIMULATED) |
| 9 | Track the real outbreak, route supplies | Capture-recapture (Chapman) between residents' reports and the clinic list; medicine follows the estimate | Modelled; no case-report format yet | Case-count relative error, 30-day: D 0.80, S 0.08 (SIMULATED); the seven-day outbreak is too small to score |
| 10 | Basic care for people who cannot reach a clinic | Breath Count: 60 s tap count against WHO thresholds, five danger signs, medicine request as a packet, listed on District 7's family board when verified; couriers by triage | Live (danger-sign RED and medicine request tested on the phone), Modelled (delivery) | Median hours to first care (RED), 7-day: D 17.1 h, S 0.58 h; stress: D 22.5 h, S 1.20 h (SIMULATED) |
| 11 | Track and treat life without sunlight | Lamp-hours rationed by Fair Share with rotation. Treat only: no tracking of sleep, mood or health yet; one 4 h session at 250 lux melanopic counts as met (weaker than the recommendation) | Modelled | Share of person-days with 4 h of daytime light, 7-day: D 0.19, S 0.64; stress: D 0.17, S 0.57 (SIMULATED) |
| 12 | Grow and share neighbourhood food | Ration with a floor; transfers between levels stand for OFFER and NEED packets | Modelled; phone sends real requests | Days the food floor held after a farm cut-off, 7-day: D 3.00, S 5.55; stress: every level breaches after 5.00 days under S (SIMULATED) |
| 13 | Prove whether the surface is safe, tell everyone | Independent crews' readings, hash-chained in the ledger, quorum median, verdict as an exposure band (the simulation does not sign readings); District 7's ledger panel, and its head digest sent by sound to the phone's inbox | Modelled (digest packet built, not device-tested) | Wrong-band rate, 7-day: D 1.00, S 0.00; stress: D 0.00, S 1.00 (SIMULATED) |
| 14 | Which option works, who goes first | Required protection = measured level over limit; staged trials with stop rules; volunteers by lottery | Modelled | Protection factor proven in the planned 30-day trial (worked out on paper, the same on every seed): D 10,000, S 10 (lower is better); stress: tie at 10,000, S has 4 trial breaches (SIMULATED) |
| 15 | Plan the mass return | Slots = smaller of shaft throughput and surface reception; debt-weighted lottery, families together | Modelled | Worst level's mean wait, 7-day: D 22.8 days, S 14.4 days; levels 1 to 3 wait longer under S (SIMULATED) |

The full matrix, with 95% intervals, the cost shown beside each metric, and which rule did better, is on the live site under **Coverage matrix** and in `docs/coverage.md`. The matrix opens with "Results at a glance": STRATUM's wins and the six stress-week results against it.

## Evidence

### Real recordings (REPLAY)

**Hum tracker on ENF-WHU** (130 real recordings from a 50 Hz grid, each with a mains reference; `npm run score:enf`, `public/evidence/enf-whu.json`). The tracker runs its 50 Hz setting: same estimator code, different nominal frequency.

- Median of per-clip median errors: 31.2 mHz (129 clips scored). 30 clips at or under 10 mHz, 52 at or under 20 mHz, 87 at or under 50 mHz.
- Pooled over all scored readings: median 7.8 mHz, 95th percentile 1,231 mHz.
- **Against us:** 20 clips have a median error over 500 mHz: the tracker locks onto an interfering tone.
- **Against us:** on recordings that do have hum, the tracker says NO HUM on 56.5% of readings. It refuses rather than guesses, but it refuses often.
- On recordings with no grid signal at all, it correctly says NO HUM on 94.3% of readings (whole recordings) and 96.4% (crops).

**Witness detector on GECCO 2018** (real drinking-water quality, one reading a minute; `npm run score:gecco`, `public/evidence/gecco.json`). Detector settings were not tuned. Scored on the held-out second half: 22 labelled events over 6.9 weeks.

- All six quality sensors: 22/22 events caught, median delay 2 min.
- **Against us:** precision 0.017, about 159 false alarms a week, almost all from chlorine reported in 0.01 mg/L steps. Nobody would keep that alarm switched on.
- pH, Redox and conductivity, chosen on the first half: 22/22 at precision 0.88 (0.43 false alarms a week).
- **Against us:** that same set caught only 7 of 29 events on the first half it was chosen on, so its recall depends heavily on which events come up.
- On the first half, which the detector was also not tuned on, the six sensors caught 21 of 29 events (precision 0.019).

### Real devices (LIVE)

Device test of the shipped code on the live site, `docs/device-results.md`: a Samsung Galaxy Z Fold 7 (Android 17, Chrome 158) and a Windows laptop (Chrome):

- Hum tiers at 30 cm: the phone went CALIBRATING, GREEN, AMBER, RED and NO HUM as the laptop played judge mode's story.
- Signed family OK, phone to laptop: verified by the District 7 gateway at 30 cm, 1 m and 3 m and shown LIVE on the family board.
- Laptop to phone: a family OK reached the phone's family board, and a public power-cut report reached its inbox. The phone passed that report on (one relay hop). No third device listened for the relayed copy.
- Breath Count: on the phone a danger sign gave RED and its medicine request by sound was verified by the District 7 gateway; in a laptop browser, at age 1, 50 taps in 60 s gave AMBER.
- Offline: installed to the home screen, then opened and listened in Airplane mode.

Not yet tested on a phone: the fan-stop alert, the cut odds on the Listen tab, the HOLD WATER and ROUTE alerts, and the ledger digest by sound (all tested in a browser).

Earlier spikes, with spike code, not the shipped tracker or codec: one Android phone (Chrome) and one laptop (Edge), `docs/spikes.md`:

- T1 hum tracking at 30 cm: slow ramp followed with 0.6 mHz typical error, 4 mHz worst after a 5-reading median; a 100 mHz step half-way after 2.7 s. **Against us:** at 1 m with people moving, echoes made the reading wander by about 15 mHz.
- T2 sound packets, phone to laptop: 20/20 at 1 m and 20/20 at 3 m. Key derivation works in both browsers.
- T3 with the hum playing: 20/20 packets at 1 m; chirps add no measurable error to the tracker.

### District 7 against the Directorate (SIMULATED, 20 seeds)

`npm run harness -- --seeds 20` runs the seven-day script headless for seeds 1 to 20 under both rules and writes means with 95% intervals (Student t) to `public/evidence/seven-day.json`. The same command always writes the same bytes. The Directorate's baseline follows stated rules: deepest levels cut first, proportional rationing, daily lab tests, clinic counts, a daily bulletin. Where its figure follows from such a rule (no warnings, a daily lab, a daily bulletin), the gap shows the mechanism, not a measured gain. Both surface results (13, 14) are fixed by the scripted truth and are the same on every seed; they show the mechanism, not a measured gain.

Over 30 days (same script, 20 seeds; `npm run harness -- --seeds 20 --days 30`, `public/evidence/30-day.json`) the gaps narrow: worst-decile served D 0.85, S 0.89; messages within 60 min D 0.77, S 0.88 (SIMULATED).

Results are in the table above. Costs shown beside them, also SIMULATED:

- Space (6): the gain is arithmetic, three shifts share one floor. Households sleeping in one space a day go from 1.00 to 3.00, and living space stays 2.0 m2 under both.
- Food (12): while one level is cut off, the other levels give up store: 3.01 days left under the Directorate, 2.58 under STRATUM.
- Trials (14): in the planned 30-day trial STRATUM spends 7,304 exposure person-hours against the Directorate's 5,760.
- Return (15): levels 1 to 3 wait longer under STRATUM, by 12.6, 7.3 and 1.6 days. The metric rewards mixing levels, not depth priority.
- Heat (3): STRATUM's figure is above zero (9,336 person-hours), because, by design, the deep shortfall is expected to leave the main areas about 63% of their cooling (not measured).

### The stress week, where STRATUM loses (SIMULATED, 20 seeds)

`npm run harness -- --seeds 20 --script stress-week` writes `public/evidence/stress-week.json`. Supply falls below every life floor for a day, four levels lose their farms, and three of five surface crews lie.

- **Surface truth (13): STRATUM loses.** Wrong-band rate D 0.00, S 1.00. Three lying crews in five carry the quorum to `open` against a true `sealed`, while the Directorate's fixed verdict happens to be right.
- **Food (12): STRATUM loses.** Every level breaches the food floor after 5.00 days under STRATUM, with 0.00 days of store left on the other levels. Under the Directorate only the four cut-off levels breach (after 3.00 days) and the others keep 3.01 days. The headline metric still reads 5.00 against 3.00, which is why we report the cost beside it.
- **Trials (14): a tie, with harm.** Both prove nothing lighter than 10,000. STRATUM's staged trial has 4 breaches and 7,336 person-hours, against 0 and 5,760.
- **Warning (1): the gain is gone.** Cuts warned 10 min ahead: 0.00 under both.
- **Heat (3): the lead shrinks from 86% to 22%.** D 178,050, S 138,670 person-hours. With supply below every floor, the cooling pool cannot pay the refuge floors.
- **Tunnels (5): the zero is gone.** D 28,750, S 20,530 stranded person-hours.
- Still ahead, by less: worst-decile served (D 0.50, S 0.63), first care (D 22.5 h, S 1.20 h), daytime light (D 0.17, S 0.57).
- Mesh (7): no message is sent in the stress week, so there is no result.

### Ablations: what each engine adds (SIMULATED, 20 seeds)

`npm run harness:ablations -- --seeds 20` writes `public/evidence/ablations.json`. It runs the seven-day week five ways: STRATUM, the Directorate, and STRATUM with one engine switched off (that engine's adapters run the Directorate's rule). A contribution is STRATUM minus STRATUM without the engine, paired by seed, with a 95% interval. The coverage matrix charts each engine's contribution.

- Witness off: cuts warned 10 min ahead 0.40 to 0.00; unsafe water drunk 0 to 23,280 person-hours; case-count relative error 0.20 to 0.79; wrong-band rate 0.00 to 1.00; protection factor proven 10 to 10,000.
- Mesh off: messages delivered within 60 min 0.48 to 0.00; mean hours until status known 2.17 to 3.92; median hours to first care (RED) 0.58 to 17.1.
- Fair Share off: worst-decile served 0.85 to 0.66; heat 9,336 to 64,904 person-hours; stranded 0 to 6,082 person-hours; daylight share 0.64 to 0.19; food floor held 5.55 to 3.00 days; worst level's wait 14.4 to 22.8 days; cuts warned 0.40 to 0.15.

### Sweeps: one stress varied at a time (SIMULATED, 20 seeds)

`npm run harness:sweeps -- --seeds 20` writes `public/evidence/sweeps.json`. Each sweep changes one event of the seven-day script and no model constant, under both rules. The coverage matrix draws one chart per swept metric.

- Lying surface crews, 0 to 5 of 5: STRATUM's wrong-band rate is 0.00 up to 2 lying crews and 1.00 from 3. The Directorate's is 1.00 at every point.
- Depth of the hour-64 shortfall, 0.1 to 0.7 of capacity: heat under STRATUM rises from 0 to 42,009 person-hours, still below the Directorate at every point (40,237 to 97,010). Cuts warned fall from 0.40 to 0.20 from 0.5.
- Outbreak size, 2 to 40 cases in each of 4 level-6 sectors: STRATUM's case-count error falls from 0.30 to 0.11; the Directorate's stays 0.79 to 0.80.
- Not run: grid inertia and under-reporting. Both are model constants, not script events, so sweeping them needs a model change.

### Results we publish although they go against us

- Lamps cannot feed a level: one person's food-floor calories need about 210 kWh of electricity a day with lettuce and over 400 kWh with grain. Local growing buys days, not independence.
- Shafts are not the limit on the return. Surface reception is.
- A sudden plant trip gives no warning. The hum helps only with slow shortfalls; District 7 plays one such trip in real time.
- Shift-sharing sleeping space raises contacts.
- In this model staged trials never cost fewer exposure-hours than one direct 30-day trial.
- The engines barely interact (ablations). Almost every metric moves only when its own adapters switch, so the ablation shows each adapter's rule, not a loop worth more than its parts.
- Most of the warning gain comes from how Fair Share cuts (ablations). Without Fair Share, cuts warned fall from 0.40 to 0.15 (contribution 0.25, 95%: 0.245 to 0.250).
- Fair Share adds nothing to the case estimate (ablations): 0.16 without it against 0.20 with it (contribution 0.04, 95%: -0.06 to 0.13).
- From 3 lying crews in 5, the quorum carries the wrong band (sweeps). The staged trial still proves factor 10, at the cost of 1 breach and 8 more person-hours.
- Small outbreaks give a poor case estimate (sweeps): error 0.30 (95%: 0.20 to 0.40) at 2 cases a sector and 0.36 (95%: 0.14 to 0.57) at 5.

## How it works

- **Hum tracker.** Microphone processing off, one stream, a tone bank on the 800 Hz component (2 s window, 0.5 s hop), 30 s calibration, relative deviation smoothed over 5 readings. Below the signal threshold it shows NO HUM and never guesses. The in-world grid runs at 400 Hz so the hum sits where phone microphones hear well; hum and fan noise stay below 1.7 kHz, packets above 1.875 kHz.
- **Fan-stop alert.** The Listen tab hears a fan's steady sound in 150 Hz to 1.7 kHz, with the hum's harmonics left out. It says "Fan: running" or "FAN STOPPED" within 5 s of a stop, with one vibration. It cannot tell why a fan stopped.
- **Packet v3, 25 bytes.** Type, minute counter, nonce, a group tag that changes every minute (so a listener cannot follow a family), an encrypted payload, hops left, and an 8-byte HMAC. Keys come from six generated words through HKDF. Receivers remember each minute-and-nonce pair and show the packet's own time, so an old OK cannot look fresh.
- **Public alerts.** Power-cut reports, HOLD WATER and ROUTE alerts are public packets. For HOLD WATER and ROUTE alerts, the inbox shows how many different member numbers sent the same alert and marks it unconfirmed below three.
- **Fair Share.** x_i = max(f_i, min(d_i, lambda)) with the sum equal to the supply; if the supply is below the sum of floors, every floor is scaled by the same share. Debt from past shortfall rotates what cannot be split.
- **Cut odds.** P(cut | level, tier) = (c + 1) / (e + 2), from neighbours' power reports; a level counts as cut when three different senders report it. At AMBER and RED the Listen tab shows the chosen level's odds.
- **Outbreak.** Chapman estimate N = (n1 + 1)(n2 + 1) / (m + 1) - 1 between residents' reports and the clinic list.
- **Ledger digest.** District 7's ledger panel shows the latest measured value beside the official one, chain lengths and the head digest. "Send ledger digest" plays the digest's first 6 bytes as a public packet, which the phone's inbox shows.
- **One codebase.** The phone page, the District 7 worker and the Node harness import the same `src/core`, so the code scored on real data is the code in the demo. No backend, no account, no language model, no network call at run time.

## Limits

The full list is in `docs/limits.md`. The ones that matter most:

- District 7 is a simulation. Its heat, water, sewage, disease, food and surface values are model outputs.
- The hum says when the grid is stressed, not which level will be cut; the cut odds come from neighbours' reports, and anyone can send public reports.
- The tracker needs to be close to the hum: about 30 cm in a quiet room.
- Sound carries a few metres. The device test showed one hop, phone to a laptop gateway, at up to 3 m, and one relay hop through the phone. Multi-hop reach is simulated.
- Public alerts are not signed. A grid alert is relayed only if the receiving phone hears the same stress or no hum at all. Any phone can send a HOLD WATER or ROUTE alert; it is relayed with no check, and one sender's alert reaches the inbox, marked unconfirmed until three different member numbers send it (those numbers can be forged too).
- The fan-stop alert is tested on synthetic traces and in Chromium with a synthetic microphone, not on a phone with a real fan. Its quiet level is an assumption until the phone test. District 7 does not score air warnings.
- Breath Count is a decision aid that follows published thresholds for children under five. It is not a medical device. It asks five of the chart's eleven danger signs. The 60-second tap count passed in a laptop browser, not yet on the phone.
- The ledger digest (13) is sent by the District 7 page as one sound packet carrying its first 6 bytes, and the phone's inbox shows it; this is tested in a browser, not yet on a device. Case reports for the outbreak (9) are not designed yet. Reports sent from the phone are not analysed in District 7 yet.
- The grid-inertia and under-reporting sweeps were not run.
- The STRATUM rule needs to be adopted, or applied by levels to the loads they control. The Directorate holds the breakers.
- Android only. No iPhone was tested.
- Offline install works only after one visit with network; an update arrives on the next visit with network, and a page whose network takes more than 3 s opens the saved copy. Tested on a Galaxy Z Fold 7: installed to the home screen, then opened and listened in Airplane mode.

## Prior art and licences

- Electric network frequency (ENF) analysis, used in audio forensics: the ENF-WHU dataset (MIT) is our benchmark.
- ggwave (MIT) carries the packets as sound, vendored behind `src/audio/modem.ts`.
- GECCO Industrial Challenge 2018 water-quality data (CC BY 4.0), Moritz et al., Zenodo DOI 10.5281/zenodo.3884398.
- Red Cross "safe and well" tracing (family board), capture-recapture for under-reported outbreaks (CDC), the WHO/UNICEF chart booklet for community health workers (Breath Count), NIOSH IDLH values and OSHA assigned protection factors (surface), leximin allocation (Fair Share). Sources per parameter are in `docs/params.md`.

## What is next

Every gap we know of, in one list:

- An on-device sound model, for example to count coughs, is not shipped.
- No iPhone was tested.
- Multi-hop beyond one relay hop is not shown on devices. No third device has heard a relayed copy; multi-hop reach is simulated.
- The grid-inertia and under-reporting sweeps were not run.
- There is no case-report format, so Breath Count does not feed the outbreak estimate (9).
- District 7 does not score air warnings.
- The fan-stop alert's phone test (run sheet Part I) is pending.
- The 60-second tap count, the cut odds on Listen, the HOLD WATER and ROUTE alerts and the ledger digest are tested in a browser, not yet on a phone.
- Reports sent from the phone are not analysed in District 7 yet.
- Stairwell relays: cheap battery nodes so a message can cross levels.
- A real surface sniffer, instead of simulated crews' readings.
- A field test of the packets in a real tunnel.

## Try it

1. **Home page** (https://stratum-nine-swart.vercel.app): one result line with a loss beside it, the device-test line, and a QR code to the phone page.
2. **Judge mode** (`/src/district/judge.html`): click **Play the 90-second story**. A drawn phone runs the real tracker and codec on a simulated hum (LOOPBACK): CALIBRATING, GREEN, AMBER, RED, NO HUM, then an OK arrives by sound. Captions carry the whole story; the ending shows the headline result and links to the coverage matrix. Works muted.
3. **District 7** (`/src/district/`): click **Play**. The Directorate's rule is on the left and STRATUM's on the right. Switch between **Seven-day week** and **Stress week**. The ledger panel shows measured beside official, and **Send ledger digest** plays its head by sound.
4. **Coverage matrix** (`/src/district/coverage.html`): "Results at a glance", then fifteen cards with tiers, mechanism, the 20-seed results for both rules, the REPLAY figures, the ablation and sweep charts, and the results against us.
5. **Phone page** (`/src/phone/`, Android Chrome): **Listen** to a hum (play judge mode on a laptop 30 cm away), **Report** to send OK, a power cut, HOLD WATER or ROUTE by sound, **Family** to join with six words, **Ledger** for cut odds, **Care** for Breath Count. The click-by-click run sheet is `docs/rung-test.md`.
