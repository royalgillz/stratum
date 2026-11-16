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
| Key words | 6 of 2048 | words | packet | | true | 66 bits. Word list and its licence still to choose |
| Fast breathing, age 2 to 12 months | 50 | breaths/min | Breath Count | https://ncbi.nlm.nih.gov/books/NBK143752/ | false | WHO guidance for community health workers |
| Fast breathing, age 12 months to 5 years | 40 | breaths/min | Breath Count | https://ncbi.nlm.nih.gov/books/NBK143752/ | false | |
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

Mapping suits, domes and outposts onto respirator protection factors is an assumption. Label it in the UI.
