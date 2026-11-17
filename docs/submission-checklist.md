# Submission checklist

Deadline: Fri Nov 20 2026, 11:00 PM (assume ET), no extensions. Judging on the organizers' platform, Nov 21 to 24. `docs/problem-statement.md` gives the track and the fifteen problems but no rubric and no submission format; the one judging hint it gives is that one well-connected solution addressing several problems can strengthen a project. Sources for the items below: rung 5 of the ladder and the submission checklist in `docs/plan.md`.

Status as of Mon Nov 16. `[x]` done, `[ ]` not yet.

## Before the freeze (Wed Nov 18, 22:00 ET)

- [ ] Rung test on a real Android phone and laptop (`docs/rung-test.md`), results pasted back. The write-up and video wait on it for problems 1, 7, 8 and 10.
- [x] Offline install (service worker and manifest; Playwright offline tests pass; install on a real phone not yet tried).

## The submission (rung 5)

- [x] Public repo with an MIT licence: https://github.com/royalgillz/stratum
- [x] Data licences listed (ENF-WHU: MIT, GECCO 2018: CC BY 4.0, ggwave: MIT) in `data/README.md` (datasets) and `README.md` (datasets and ggwave)
- [x] Live address deployed: https://stratum-nine-swart.vercel.app
- [x] Video script drafted (`docs/video-script.md`): 3:00 and 90-second shot lists, plus the fallback
- [ ] Write-up final: DRAFT mark removed, rung-test results in, "pending" lines resolved
- [ ] Video filmed and edited: 2:45 or less if the platform allows no more than that, captions burned in, no third-party music
- [ ] Fallback if there is no video by Thu Nov 19, 20:00: the 90-second judge-mode screen cut plus one phone clip (`docs/video-script.md`)
- [ ] Five screenshots: phone at RED, family board, District 7 cross-section, the fairness result, coverage matrix
- [ ] Clean-browser test: the live address in a private window on a laptop and on a phone (home, judge mode, District 7, coverage matrix, phone page), with no sideways scroll on the phone
- [ ] Final check of README and write-up claims against `docs/coverage.md` and `public/evidence/*.json` after the last evidence run
- [ ] Draft submitted on the platform Thu Nov 19 night
- [ ] Final submission confirmed Fri Nov 20, before 23:00

## Links to paste into the submission

- Live site: https://stratum-nine-swart.vercel.app (judge mode: `/src/district/judge.html`)
- Repo: https://github.com/royalgillz/stratum
- Write-up: `docs/writeup.md` in the repo
- Video: (pending)
