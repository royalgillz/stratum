# Parameters

Every number a model or engine uses is listed here. A parameter has either a source URL
or `assumption: true`. The science-reviewer agent checks this file before a module merges.

| Parameter | Value | Unit | Module | Source URL | Assumption | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Grid nominal frequency | 400 | Hz | tracker, grid | | true | In-world design choice. Track the 800 Hz component |
| Tracker harmonic | 2 | - | tracker | | true | 800 Hz at a 400 Hz grid; spike T1 passed on it |
| Tracker band half-width | 2.5 (phone), 1.5 (ENF-WHU) | Hz (grid) | tracker | | true | Tone band at least ±3 Hz so the noise floor lies outside the Hann main lobe |
| Tracker noise-floor exclusion | 1 | Hz (tone) | tracker | | true | Coarse bins within 1 Hz of the peak are left out of the noise median |
| Tracker window, hop | 2, 0.5 | s | tracker | | true | From docs/handoff.md |
| Tracker NO HUM threshold | 13 | dB | tracker | | true | Spike T1: noise alone 6 to 7 dB, hum 33 to 59 dB |
| Tracker calibration length | 30 | s | tracker | | true | 60 readings; reference is their median |
| Tracker smoothing | 5 | readings | tracker | | true | Spike T1: ramp within 4 mHz, 100 mHz step half-way in 2.7 s |
| AMBER threshold | -50 | mHz | tracker | | true | Leave above -30 mHz for 10 s. About 3x the 1 m room noise |
| AMBER fall trigger | 50 in 10 | mHz in s | tracker | | true | A fast fall warns before the level threshold |
| RED threshold | -150 | mHz | tracker | | true | Leave above -130 mHz for 10 s |
| Tier entry confirmation | 2 | readings | tracker | | true | 1 s |
| Packet MAC length | 8 | bytes | packet | | true | Truncated HMAC-SHA-256, fits 25 bytes |
| Packet future window | 2 | min | packet | | true | Packets dated further ahead are rejected |
| Packet seen-set size | 4096 | packets | packet | | true | Keyed by (key set, minute, nonce); oldest evicted first |
| Packet stale limit | 24 | h | packet | | true | Older packets are rejected |
| Packet MAX_HOPS | 4 | hops | packet | | true | Hops byte is reported clamped to this |
| Relay back-off slot | 3000 | ms | relay | | true | Assumes air time (2 to 3 s) plus decode latency stays under 3 s, so a later slot hears an earlier relay's whole packet. Unmeasured: at 3 s air time suppression between neighbouring slots fails. Measure in the one-hop demo |
| Relay back-off slots | 4 | slots | relay | | true | Delay is floor(rng() x 4) x 3 s, so 0 to 9 s. Tune in the multi-hop simulation |
| Relay identities kept | 4096 | packets | relay | | true | Same as the packet seen-set; least recently heard evicted first |
| Relay silence count | 2 | hearings | relay | | true | From docs/plan.md: a relay stays silent once it has heard a message twice |
| Key words | 6 of 2048 | words | packet | | true | 66 bits. Word list and its licence still to choose |
| Fast breathing, age 2 to 12 months | 50 | breaths/min | care/breath | https://iris.who.int/handle/10665/44398 | false | WHO/UNICEF chart booklet for the community health worker (ISBN 978 92 4 154804 5), "Sick but NO Danger Sign": "In a child age 2 months up to 12 months, 50 breaths or more per minute" |
| Fast breathing, age 12 months to 5 years | 40 | breaths/min | care/breath | https://iris.who.int/handle/10665/44398 | false | Same chart: "In a child age 12 months up to 5 years, 40 breaths or more per minute". An age of exactly 12 months takes 40 |
| Breath count length | 60 | s | care/breath | https://iris.who.int/handle/10665/44398 | false | Same chart, "Identify problems: ASK and LOOK": "If cough, count breaths in 1 minute". A shorter count gives no rate (no extrapolation) |
| Breath Count youngest age | 2 | months | care/breath | https://iris.who.int/handle/10665/44398 | false | Same chart, title page: "child age 2 months up to 5 years"; younger infants are referred |
| Breath Count oldest age (exclusive) | 60 | months | care/breath | https://iris.who.int/handle/10665/44398 | false | Same chart (up to 5 years) and CLAUDE.md (under five only); no classification at 60 months or more |
| Breath tap debounce | 250 | ms | care/breath | | true | A tap closer than this to the last counted tap is a double tap; allows up to 240 per minute |
| Breath plausible rate | 10 to 120 | breaths/min | care/breath | | true | Outside this band, without a danger sign, the card asks for a recount |
| Breath missed-tap gap | 3 | median intervals | care/breath | | true | A longer gap (start, between taps, or to 60 s) in a full count asks for a recount |
| Wet-bulb limit, working areas | 27.5 | deg C | air-heat | | false | From the earlier report. Add the source URL before use |
| Total organic carbon limit | 3 | mg/L | water | https://ntrs.nasa.gov/api/citations/20170001718/downloads/20170001718.pdf | false | ISS potable water |
| Iodine biocide, biocidal range | 1 to 4 | mg/L | water | https://ntrs.nasa.gov/api/citations/20170001718/downloads/20170001718.pdf | false | |
| Carbon monoxide, immediately dangerous | 1200 | ppm | surface-return | https://www.cdc.gov/niosh/idlh/intridl4.html | false | NIOSH IDLH |
| Ozone, immediately dangerous | 5 | ppm | surface-return | https://cdc.gov/niosh/idlh/10028156.html | false | NIOSH IDLH |
| Sulfur dioxide, immediately dangerous | 100 | ppm | surface-return | https://www.cdc.gov/niosh/idlh/intridl4.html | false | NIOSH IDLH |
| Protection factor, half mask | 10 | ratio | surface-return | https://obis.osha.gov/dte/library/respirators/presentation/slide33.html | false | OSHA Table 1 |
| Protection factor, full facepiece | 50 | ratio | surface-return | https://obis.osha.gov/dte/library/respirators/presentation/slide33.html | false | |
| Protection factor, powered full facepiece | 1000 | ratio | surface-return | https://obis.osha.gov/dte/library/respirators/presentation/slide33.html | false | |
| Protection factor, pressure-demand breathing apparatus | 10000 | ratio | surface-return | https://obis.osha.gov/dte/library/respirators/presentation/slide33.html | false | |
| Shaft throughput | 1070 | people/hour | surface-return | https://911metallurgist.com/wp-content/uploads/2015/12/An-investigation-into-the-optimization-of-personnel-transportation-to-level-15-and-below-at-Khuseleka-No-1-shaft-Anglo-Platinum.pdf | false | One real platinum-mine shaft |
| Grain energy cost under lamps | 650 | kWh/kg | light-food | https://pmc.ncbi.nlm.nih.gov/articles/PMC11961353 | false | Modelled figure from a review |
| Lettuce energy cost under lamps | 10 to 20 | kWh/kg | light-food | https://hannahritchie.substack.com/p/vertical-farming | false | |
| Fair Share lottery base weight | 1 | - | fairshare | | true | Claim weight is 1 + debt, so a claim with no debt still has a chance |
| Fair Share debt update | reset to 0 if served in full, else + shortfall | units | fairshare | | true | Owed turns accumulate for claims passed over |
| Fair Share sum tolerance | 1e-9 | relative | fairshare | | true | Shares plus surplus equal supply within 1e-9 x max(1, supply) |
| Shed event grace | 10 | min | shed | | true | An event lasts while the tier holds plus 10 min after it falls below; a rise back within those 10 min continues the same event, so events of one tier never overlap |
| Shed confirmation | 3 | distinct senders | shed | | true | From docs/plan.md: public claims count as confirmed at three senders. Sender = (key set id, member byte). Also the reporters needed for a level to count as observed in an event |
| Shed cut-odds prior | (c + 1) / (e + 2) | - | shed | https://en.wikipedia.org/wiki/Rule_of_succession | false | Laplace rule of succession; 1/2 with no data, shown as "no data yet" |
| Witness baseline window | 48 | readings | witness | | true | Per (kind, where) stream. Tune on GECCO |
| Witness minimum baseline | 24 | readings | witness | | true | No judgement before this many are admitted |
| Witness residual threshold | 4 | scale units | witness | | true | Exceeding when abs(x - median) / scale >= 4 |
| Witness persistence | 3 of 5 | readings | witness | | true | The m-of-n rule |
| Witness event clear | 5 | readings | witness | | true | Consecutive non-exceeding readings to close an event |
| Witness relative scale floor | 1 | % of abs(median) | witness | | true | Stops a flat series alarming on every wobble |
| Witness absolute scale floor | 1e-9 | kind's unit | witness | | true | Avoids division by zero |
| MAD to standard deviation factor | 1.4826 | ratio | witness | https://en.wikipedia.org/wiki/Median_absolute_deviation | false | For normal data |
| Quorum crews | 3 | crews | witness | | true | Same as the packet's "confirmed at three" |
| Quorum agreement band | 25 | % of median | witness | | true | A crew agrees if within this of the median |
| Chapman interval | 1.96 | sd | witness | https://wwwnc.cdc.gov/eid/article/21/12/15-0756_article | false | Normal 95% interval on the Chapman variance |
| Ledger hash | SHA-256 | | witness | https://csrc.nist.gov/pubs/fips/180-4/upd1/final | false | FIPS 180-4. Genesis strings STRATUM-ledger-v1:measured and :official |
| Ledger digest length | 16 | bytes | witness, packet | | true | First 16 bytes of the measured chain head, as in the packet design |

Mapping suits, domes and outposts onto respirator protection factors is an assumption. Label it in the UI.
| Kernel world time step | 60 | s | kernel | | true | Fixed; 43,200 steps for 30 simulated days |
| Kernel time-lapse scale | 3600 | world s per real s | kernel | | true | One simulated hour per real second, from docs/plan.md |
| Kernel steps per advance, cap | 600 | steps | kernel | | true | Excess owed time is dropped so a stalled tab cannot freeze on resume |
| Kernel overhead budget | 10 | % of T5 budget | kernel | | true | 1 s of the 10 s in spike T5 (docs/spikes.md) |
