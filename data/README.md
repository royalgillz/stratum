# Data

Real recordings the evidence harness replays. The ENF-WHU audio is not committed (it is large); its licence is. The GECCO CSV (10.8 MB) is committed unchanged.

## ENF-WHU

- **What:** 130 real recordings (H1) made around Wuhan University on a 50 Hz grid, each with a reference recorded from the
  mains at the same time (H1_ref), plus 50 recordings with no grid signal (H0: 10 whole recordings O01 to O10 and 40 random
  crops of them, 01 to 40). Recordings are 16-bit mono PCM WAV at 8 kHz, 5 to 20 minutes; references are the mains waveform
  at 400 Hz, starting with the recording.
- **Source:** https://github.com/ghua-ac/ENF-WHU-Dataset
- **Licence:** MIT, copyright (c) 2023 HUA GUANG. Copy: [`ENF-WHU-LICENSE`](ENF-WHU-LICENSE).
- **Used by:** `npm run score:enf` (`harness/enf.ts`), which writes `public/evidence/enf-whu.json` (REPLAY): frequency error, NO HUM, and the tiers (`tiers`) against the same rule on the reference.
- **Fetch** (about 1.7 GB; skips the 1.9 GB one-day references and the MATLAB code, which the harness does not use), from the repo root:

```sh
git clone --depth 1 --filter=blob:none --sparse https://github.com/ghua-ac/ENF-WHU-Dataset data/enf-whu
git -C data/enf-whu sparse-checkout set ENF-WHU-Dataset/H0 ENF-WHU-Dataset/H1 ENF-WHU-Dataset/H1_ref
```

The harness expects `data/enf-whu/ENF-WHU-Dataset/{H0,H1,H1_ref}`; pass `--data <dir>` to read another copy.

## GECCO Industrial Challenge 2018 (drinking-water quality)

- File: `gecco2018/1_gecco2018_water_quality.csv`, unchanged from the source (MD5 `270bbe949b418e5d2d1dc47276fcc332`, 10.8 MB).
- Source: https://zenodo.org/records/3884398 (DOI 10.5281/zenodo.3884398).
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/.
- Attribution: Moritz, S., Rehbach, F., Chandrasekaran, S., Rebolledo, M. and Bartz-Beielstein, T. (2018). GECCO Industrial Challenge 2018 Dataset: A water quality dataset for the 'Internet of Things: Online Anomaly Detection for Drinking Water Quality' competition at the Genetic and Evolutionary Computation Conference 2018, Kyoto, Japan. Zenodo. Data provided by Thueringer Fernwasserversorgung and the IMProvT research project.
- Content: 139,566 rows, one per minute from 2016-08-03 11:49 to 2016-11-08 08:54 (local time, one DST step back on 2016-10-30). Columns `Time`, `Tp` (temperature, degrees C), `Cl` (chlorine dioxide, mg/L, station 1), `pH`, `Redox` (mV), `Leit` (conductivity, uS/cm), `Trueb` (turbidity, NTU), `Cl_2` (chlorine dioxide, mg/L, station 2), `Fm` and `Fm_2` (flow, m3/h), `EVENT` (TRUE or FALSE). Missing readings are `NA`. The organisers imputed some of the labelled events into the real series (challenge rules, in the Zenodo record).
- Used by: `npm run score:gecco` (`harness/gecco.ts`), which writes `public/evidence/gecco.json` (REPLAY).
- Fetch again: `curl -L -o data/gecco2018/1_gecco2018_water_quality.csv "https://zenodo.org/api/records/3884398/files/1_gecco2018_water_quality.csv/content"`
