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
| AMBER threshold | -50 (enter), -30 (leave) | mHz | tracker, grid | | true | Leave above -30 mHz for 10 s. About 3x the 1 m room noise |
| AMBER fall trigger | 50 in 10 | mHz in s | tracker | | true | A fast fall warns before the level threshold |
| RED threshold | -150 (enter), -130 (leave) | mHz | tracker, grid | | true | Leave above -130 mHz for 10 s |
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
| Wet-bulb limit, working areas (WB_LIMIT) | 27.5 | deg C | air-heat, adapters | | true | South African deep-mine thermal-stress practice, from the earlier report (docs/plan.md). Source URL to add; treated as an assumption until then |
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
| Kernel world time step | 60 | s | kernel | | true | Fixed; 43,200 steps for 30 simulated days |
| Kernel time-lapse scale | 3600 | world s per real s | kernel | | true | One simulated hour per real second, from docs/plan.md |
| Kernel steps per advance, cap | 600 | steps | kernel | | true | Excess owed time is dropped so a stalled tab cannot freeze on resume |
| Kernel overhead budget | 10 | % of T5 budget | kernel | | true | 1 s of the 10 s in spike T5 (docs/spikes.md) |

Mapping suits, domes and outposts onto respirator protection factors is an assumption. Label it in the UI.

## District 7 models, adapters and scenario

All values below are SIMULATED inputs. Each is defined once in its model or adapter module.

| Parameter | Value | Unit | Module | Source URL | Assumption | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Levels, sectors per level | 6, 4 | - | world | | true | From docs/plan.md |
| People per sector (PEOPLE) | 500 | people | world | | true | 12,000 in District 7 |
| Tracked households per sector (HH_PER_SECTOR) | 10 | households | scenario | | true | A sample of families for the board, not every household |
| Household members | 2 to 6 | people | scenario | | true | Uniform, drawn from the `world` stream |
| Demo household | id `family`, level 5 sector 1, 4 members | - | scenario | | true | Sector 1 within level 5, so sector index 17. Id matches the key set id the phone and judge pages use |
| Grid inertia constant (H) | 4 | s | grid | | true | Typical thermal plants 2 to 9 s (Kundur 1994) |
| Load damping (D) | 2 | per unit / per unit | grid | | true | Typical 1 to 2 (Kundur 1994). With H gives a 4 s time constant |
| Base load per person (BASE_KW) | 1.0 | kW | adapters | | true | Lighting, ventilation, appliances. Pumps and cooling are separate plants, not grid load (see limits.md) |
| Life floor per person (LIFE_KW) | 0.3 | kW | adapters | | true | Ventilation fans, medical, phone charging |
| Capacity margin (CAP_MARGIN) | 1.05 | x full demand | grid, adapters | | true | Nominal plant capacity |
| Shed threshold (SHED_HZ) | 1.0 | Hz below 400 | adapters | | true | Kept inside the tracker band of 2.5 Hz so a phone hears the whole sag |
| Shed reserve (RESERVE) | 2 | % | adapters | | true | Target load is capacity / 1.02 while shedding |
| Warning lead (WARN_LEAD) | 10 | min | adapters | | true | A cut counts as warned with at least this much AMBER or RED before it |
| Rock temperature at level 1 (ROCK_TOP) | 25 | deg C | air-heat | | true | |
| Rock temperature step (ROCK_STEP) | 3 | deg C per level | air-heat | | true | About 30 deg C/km with 100 m per level |
| Internal heat gain (GAIN) | 2 | deg C | air-heat | | true | People and equipment |
| Cooling setpoint (SETPOINT) | 24 | deg C | air-heat | | true | |
| Cooling demand (COOL_KW) | 0.05 | kW per person per deg C | air-heat | | true | Above the setpoint. Cooling plant output, not grid load |
| Heat time constant (TAU_HEAT_S) | 21600 | s | air-heat | | true | Six hours. Thermal mass of rock and air |
| Relative humidity (RH) | 70 | % | air-heat | | true | Held at 70% as air warms, which assumes wet rock and seepage keep air near saturation. At constant moisture the uncooled deep levels stay below 27.5 deg C wet-bulb. Swept at 50, 70 and 90% |
| Wet-bulb formula | Stull 2011 | - | air-heat | https://doi.org/10.1175/JAMC-D-11-0143.1 | false | Valid 5 to 99% humidity, -20 to 50 deg C |
| Refuge share (REFUGE) | 25 | % of people, % of cooling demand | adapters | | true | STRATUM cooling floor; people rotate through the refuge |
| Intake CO2 (C_OUT) | 420 | ppm | air-heat, epidemic | https://gml.noaa.gov/ccgg/trends/ | false | Global mean, about 420 ppm in 2024 |
| CO2 exhaled per person (G) | 0.0052 | L/s | air-heat | https://doi.org/10.1111/ina.12383 | false | Adult, sedentary |
| Fresh air per person (Q) | 10 | L/s | air-heat | | true | Order of ventilation design guides |
| Leakage with fans off (LEAK) | 5 | % of Q | air-heat | | true | |
| Air volume per person (VOL_L) | 30000 | L | air-heat | | true | 30 m3; 50 min time constant with fans on |
| CO2 limit (CO2_LIMIT) | 5000 | ppm | air-heat | https://www.osha.gov/chemicaldata/183 | false | OSHA permissible exposure limit, an 8 h time-weighted average, not an instant threshold |
| Ventilated CO2 reference (CO2_REF) | about 940 | ppm | air-heat, epidemic | | true | Derived in code as C_OUT + 1e6 x G / Q, not set; follows any change to G or Q |
| Ventilation cap on transmission (BETA_CAP) | 5 | x beta at CO2_REF | epidemic | | true | Beta scales with the rebreathed fraction, applied to all transmission, up to this cap. Rudnick and Milton cover ordinary indoor CO2; fans off would give about 20 x without it |
| Exhaled-breath CO2 (C_EXHALED) | 38000 | ppm | epidemic | https://doi.org/10.1034/j.1600-0668.2003.00189.x | false | Rudnick and Milton 2003, rebreathed fraction |
| Water baseline | cond 150, toc 0.5, turb 0.2, iodine 2.0 | uS/cm, mg/L, NTU, mg/L | water | | true | Iodine inside the 1 to 4 mg/L biocidal range |
| Water sensor noise (NOISE) | 2 | % of baseline, 1 sd | water | | true | |
| Pipe travel (PIPE_BASE, PIPE_STEP) | 60, 20 | min, min per sector | water | | true | The window HOLD WATER must beat |
| HOLD WATER notify delay (NOTIFY) | 10 | min | adapters | | true | Covers mesh relay to the level |
| Directorate grab sample | daily 06:00, 24 h lab turnaround | - | adapters | | true | Directorate rule |
| Contamination in sevenDay | toc +5, cond +60, turb +1.5, iodine -1.5 | mg/L, uS/cm, NTU, mg/L | scenario | | true | Organics consume iodine |
| Sump capacity (SUMP_CAP) | 200 | m3 | tunnels | | true | |
| Seepage (SEEP_TOP, SEEP_STEP) | 2, 1 | m3/h, m3/h per level | tunnels | | true | Deeper seeps more |
| Pump capacity (PUMP_CAP) | 15 | m3/h | tunnels | | true | At full pump power |
| Pump power (PUMP_KW) | 20 | kW per sector | tunnels, adapters | | true | |
| Initial sump level (SUMP_START) | 0.3 | fraction | scenario | | true | |
| Sump recovery level (RECOVER) | 0.9 | fraction | tunnels | | true | A flooded node is passable again below this |
| Flood in sevenDay | 15 m3/h for 10 h, sector 22, hour 101 | - | scenario | | true | During the hour-100 shortfall, on a sector the Directorate cuts |
| Network cut in sevenDay | 168 h from hour 0 | - | scenario | | true | |
| Separation in sevenDay | hour 2 | - | scenario | | true | |
| Outbreak in sevenDay | 10 cases in each of sectors 20 to 23, hour 6 | - | scenario | | true | Large and early enough for capture-recapture to see cases |
| Slow shortfall in sevenDay | hour 30: loss 4% to 8% over 4 h, hold 6 h, recover 2 h | loss fraction of nominal | scenario | | true | 1% per hour: warned |
| Contamination timing in sevenDay | hour 52, level 5, 30 min ramp, 12 h | - | scenario | | true | |
| Fast shortfall in sevenDay | hour 60: loss 4.75% to 5.45% over 75 s, hold 2 h, recover 1 h | loss fraction of nominal | scenario | | true | Shed lands on the next 60 s step |
| Plant trip in sevenDay | hour 84: 5.8% lost for 3 h | loss fraction of nominal | scenario | | true | About 1.1% of load unserved, -2.2 Hz: inside the tracker band |
| Late shortfall in sevenDay | hour 100: loss 5% to 10% over 1 h, hold 12 h, recover 2 h | loss fraction of nominal | scenario | | true | Starts above the AMBER point |
| Basic reproduction number (R0) | 2.5 | - | epidemic | | true | At the ventilated CO2 reference |
| Latent period (1/sigma) | 3 | days | epidemic | | true | |
| Infectious period untreated, treated (1/gamma, 1/gammaT) | 5, 2 | days | epidemic | | true | |
| Within-level mixing (MIX) | 10 | % | epidemic | | true | No mixing between levels |
| Epidemic step (EPI_DT) | 1 | h | epidemic | | true | |
| Clinic list capture (CLIN_TOP, CLIN_STEP) | 0.6, 0.08 | probability, per level | epidemic | | true | 0.6 at level 1, 0.2 at level 6 |
| Residents' report capture (P_REPORT) | 0.5 | probability | epidemic | | true | Same on every level |
| Medicine supply (MED_SUPPLY) | 20 | courses/day | adapters | | true | |
| Initial medicine stock (MED_START) | 5 | courses per sector | scenario | | true | |
| Case window (CASE_WINDOW) | 5 | days | adapters | | true | Recent cases that set medicine demand |
| Water floor (WATER_FLOOR) | 15 | L/person/day | adapters | https://spherestandards.org/handbook/ | false | Sphere minimum for drinking, cooking and hygiene |
| Water demand (WATER_DEMAND) | 50 | L/person/day | adapters | | true | |
| Recycler output (RECYCLE_LPD) | 40 | L/person/day | adapters | | true | At full grid supply; below demand, so water is always rationed |
| Food floor (FOOD_FLOOR) | 2100 | kcal/person/day | adapters | https://spherestandards.org/handbook/ | false | Sphere planning figure |
| Food demand (FOOD_DEMAND) | 2500 | kcal/person/day | adapters | | true | |
| Food deliveries (FOOD_SUPPLY) | 2300 | kcal/person/day | adapters | | true | |
| Worst-off share | 10 | % of people | adapters | | true | Definition of the worst decile |
| Sleeping area (SLEEP_M2) | 2.0 | m2 per person | scenario | | true | Placeholder until the rung 4 space model; below the Sphere 3.5 |
| Mesh hop success (P_HOP) | 0.9 | probability | adapters | | true | One hop crosses from one sector to the next, which assumes phones at every sector boundary. Spike T2 had 20 of 20 at 3 m in a quiet room, not a sector-to-sector hop |
| Mesh air time per hop (AIR) | 3 | s | adapters | | true | Top of the 2 to 3 s packet length |
| Delivery window (DELIVER_WINDOW) | 60 | min | adapters | | true | |
| Directorate bulletin | daily 06:00 | - | adapters | | true | Delivers every held message |
| Away share in sevenDay (away) | 30 | % of members | scenario | | true | Member 0 always home |
| First beacon window (FIRST_WINDOW) | 30 | min | adapters | | true | |
| Beacon interval (BEACON_EVERY) | 6 | h | adapters | | true | |
| Headless sample interval | 3600 | s | scenario | | true | A positive multiple of 60 that divides the run length |
| Headless speed budget | 3 s for 7 days, 10 s for 30 days | s | scenario | | true | Spike T5 |
