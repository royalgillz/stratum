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
