# Parameters

Every number a model or engine uses is listed here. A parameter has either a source URL
or `assumption: true`. The science-reviewer agent checks this file before a module merges.

| Parameter | Value | Unit | Module | Source URL | Assumption | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Grid nominal frequency | 400 | Hz | tracker, grid | | true | In-world design choice. Track the 800 Hz component |
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
