# STRATUM

A citizen toolkit for the Hollow (Patriot HackFest Fall 2026, track "Life Underground") with one loop: hear, prove, pass on, share fairly. A phone hears the grid's hum sag before a power cut, passes short signed messages by sound with no network, and a fair-share rule divides what there is. District 7, a simulated district of 6 levels by 4 sectors, tests all of it against the Directorate's rule.

Write-up: [docs/writeup.md](docs/writeup.md).

## Try it

Live: https://stratum-nine-swart.vercel.app

1. **Judge mode** first (`/src/district/judge.html`): the 90-second story, no microphone, works muted.
2. **District 7** (`/src/district/`): a SIMULATED week under both rules, fifteen problems, and a **Stress week** built so STRATUM also loses.
3. **Coverage matrix** (`/src/district/coverage.html`): each problem's tier, mechanism, 20-seed results and the results against us.
4. **Phone page** (`/src/phone/`, Android Chrome): Listen, Report, Family, Ledger, Care.

Works offline: open the phone page once with network and it then opens and runs with none, and Chrome on Android can install it to the home screen (Add to Home screen) (tested in Chromium with Playwright, not yet on a phone). An update arrives on the next visit with network.

The Listen screen shows how the same hum tracker did on real grid recordings (ENF-WHU, REPLAY): typically 31 mHz off, with 16% of the 129 recordings locked onto another tone. Tap "How sure is this?" for the per-clip and pooled medians.

On a real phone and laptop, follow the run sheet [docs/rung-test.md](docs/rung-test.md) (about 45 minutes).

## What is real

Every number on screen carries a label: **LIVE** (real device), **REPLAY** (real public recordings) or **SIMULATED** (District 7, and judge mode's drawn phone).

- Real code: the hum tracker, the 25-byte sound packets and their cryptography, the relay, the ledger and the allocator.
- Tested on a real phone so far: the hum tracker and 25 bytes by sound from phone to laptop (spikes T1 to T3 on one Android phone and a laptop, spike code, not the shipped tracker or codec, [docs/spikes.md](docs/spikes.md)); the full app's run sheet is pending. No iPhone was tested.
- Scored on real data (REPLAY): the tracker on 130 ENF-WHU grid recordings, the water detector on GECCO 2018.
- Simulated: District 7 and everything in it.

| Tier | Problems |
| --- | --- |
| Live (a part runs on a real phone) | 1 (power warning), 7 (messages without the network), 8 (families, device test pending), 10 (Breath Count and the medicine request, device test pending) |
| Modelled (algorithm in District 7 against the Directorate's rule) | 2, 3, 4, 5, 6, 9, 10 (delivery), 11, 12, 13, 14, 15 |
| Thin or Roadmap | 1 (air warning: no rule warns before an air cut) |

The phone sends real reports for 2, 4, 5, 9 and 12, but District 7 does not analyse them yet. Each row, its metric, its value and its label: [docs/coverage.md](docs/coverage.md). Known limits: [docs/limits.md](docs/limits.md).

## Run it

Node 24.

```
npm install
npm run dev          # local site
npm test             # unit tests
npm run typecheck
npm run check        # spec links, src/core rules, no em-dashes
npm run e2e          # Playwright on six viewports
```

## Reproduce the evidence

Every simulated number comes from the harness:

```
npm run harness -- --seeds 20                         # seven-day week, seeds 1 to 20, both rules -> public/evidence/seven-day.json
npm run harness -- --seeds 20 --script stress-week    # the stress week -> public/evidence/stress-week.json
npm run harness -- --seeds 20 --days 30               # 30 days -> public/evidence/30-day.json
```

Each file holds every seed's final value, the mean with a 95% interval (Student t) and the hourly mean, per rule and metric, all labelled SIMULATED. Costs shown beside a metric are under its `beside`. The files have no timestamp, so the same command writes the same bytes. `--check` adds the kernel's write checks (slower); `--out <path>` writes elsewhere.

The two replays of real data (REPLAY). Fetch the ENF-WHU recordings first, as [data/README.md](data/README.md) says (the GECCO file is committed):

```
npm run score:enf     # tracker on ENF-WHU, writes public/evidence/enf-whu.json
npm run score:gecco   # Witness detector on GECCO 2018, writes public/evidence/gecco.json
```

Both report figures that go against us: the tracker says NO HUM on 56.5% of readings that have hum, and the detector on all six water sensors raises about 159 false alarms a week.
