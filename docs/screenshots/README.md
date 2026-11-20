# Screenshots

Five submission screenshots, light theme, taken with Playwright (Chromium) from a local build of this repo on Thu Nov 19 2026. None is from a real phone: the phone-sized ones are Chromium at a phone viewport.

| File | What it shows | Label |
| --- | --- | --- |
| `phone-red.png` | Judge mode (`/src/district/judge.html`), story played muted at real speed: the drawn phone at RED, 76 s into the 90-second story. 1280 x 800 | SIMULATED (LOOPBACK); the tracker's ENF-WHU line is REPLAY |
| `family-board.png` | Phone page, Family tab, 412 x 915, with a caption burned in at the top: "Test packets injected in Chromium; not a device reading." Below it, a created family and two board rows (one heard 2 min ago, one stale after 45 min). The two packets were injected through the app's packet event, as `e2e/family-board.spec.ts` does, not heard by a microphone | The page shows LIVE, as it labels any heard packet; the packets are test input, so the caption says so |
| `district.png` | District 7 (`/src/district/`), 1366 x 768, seven-day week, Directorate rule, seed 1, paused on day 2 in the hour-30 shortfall: level 6 sectors C and D cut | SIMULATED |
| `fairness.png` | Coverage matrix cards 2 (share power, water, food fairly: worst-off tenth 66% against 85%) and 3 (heat), 20 seeds, seven-day and stress week | SIMULATED |
| `coverage.png` | Coverage matrix (`/src/district/coverage.html`), top of the page, 1280 x 800: tier key and cards 1 to 3 | SIMULATED; card 1's tracker line is REPLAY |
