# STRATUM

## Reproduce the evidence

Every simulated number in the demo comes from the harness. With Node 24 and `npm install` done:

```
npm run harness -- --seeds 20
```

This runs District 7's seven-day script headless for seeds 1 to 20 under both policies (Directorate and STRATUM)
and writes `public/evidence/seven-day.json`. For each policy and metric the file holds the final value of every
seed, their mean with a 95% interval (Student t), and the hourly mean across seeds. All of it is labelled SIMULATED.

Options: `--days 30` for the 30-day run (written to `public/evidence/30-day.json`, so the seven-day file is kept), `--out <path>` to write elsewhere, `--check` to run the kernel's write
checks as well (slower). The file has no timestamp, so the same command writes the same bytes.

Where a design asks for a cost beside a metric (households sharing a sleeping space, the food store other levels give up,
trial exposure-hours and breaches, each level's wait for the return), the file holds it under that metric's `beside`.

The stress week, built to show where STRATUM loses, writes `public/evidence/stress-week.json`:

```
npm run harness -- --seeds 20 --script stress-week
```

The two replays of real data (no simulation, labelled REPLAY). Fetch the ENF-WHU recordings first, as [data/README.md](data/README.md) says
(the GECCO file is committed):

```
npm run score:enf     # tracker on ENF-WHU hum recordings, writes public/evidence/enf-whu.json
npm run score:gecco   # Witness detector on GECCO 2018 water quality, writes public/evidence/gecco.json
```
