# Submission checklist

Deadline: Fri Nov 20 2026, 11:59 PM ET on the event platform, no extensions. Judging on the organizers' platform, Nov 21 to 24. `docs/problem-statement.md` gives the track and the fifteen problems but no rubric and no submission format; the one judging hint it gives is that one well-connected solution addressing several problems can strengthen a project. Sources for the items below: rung 5 of the ladder and the submission checklist in `docs/plan.md`.

Status as of Fri Nov 20. `[x]` done, `[ ]` not yet.

## Before the freeze (Wed Nov 18, 22:00 ET)

- [x] Rung test on a real Android phone (Galaxy Z Fold 7) and laptop (`docs/rung-test.md`), Thu Nov 19; results in `docs/device-results.md`. Parts A to H passed, including the relay hop and offline install, except the Part B Ledger check (not reported) and Part D (laptop browser only; on the phone, a danger-sign RED and its medicine request, verified by the gateway, passed in an extra check). Part I (fan) was not run.
- [x] Offline install (service worker and manifest; Playwright offline tests pass; installed and used in Airplane mode on the Galaxy Z Fold 7).

## The submission (rung 5)

- [x] Public repo with an MIT licence: https://github.com/royalgillz/stratum
- [x] Data licences listed (ENF-WHU: MIT, GECCO 2018: CC BY 4.0, ggwave: MIT) in `data/README.md` (datasets) and `README.md` (datasets and ggwave)
- [x] Live address deployed: https://stratum-nine-swart.vercel.app
- [x] Video script drafted (`docs/video-script.md`): 2:55 and 90-second shot lists, plus the fallback
- [x] Write-up final: DRAFT mark removed, device results in, every known gap listed under "What is next"
- [ ] Video made and uploaded (YouTube Unlisted or Google Drive), link pasted into the form: the limit is 3:00, so the full cut ends by 2:55; captions burned in, no third-party music. Fallback: the 90-second judge-mode screen cut plus one phone clip (`docs/video-script.md`)
- [x] Five screenshots: phone at RED, family board, District 7 cross-section, the fairness result, coverage matrix (`docs/screenshots/`)
- [x] Browser test of the live address on a laptop and on the phone (judge mode, District 7, coverage matrix, phone page), no sideways scroll on the phone (`docs/device-results.md`, Parts E and G, Nov 19, before the Nov 20 site audit; not in a private window)
- [x] Final check of README, write-up and submission text against `docs/coverage.md`, `docs/device-results.md` and `public/evidence/*.json` after the last evidence run (Nov 20)
- [ ] Final submission on the platform (text in `docs/submission.md`), confirmed before 23:59 ET Fri Nov 20

## Links to paste into the submission

- Live site (demo URL): https://stratum-nine-swart.vercel.app/ (judge mode: `/src/district/judge.html`)
- Repo: https://github.com/royalgillz/stratum
- Write-up: `docs/writeup.md` in the repo
- Video: (pending: upload video/stratum-video-v4.mp4, the 2:54 v4 cut, not v1 to v3)
