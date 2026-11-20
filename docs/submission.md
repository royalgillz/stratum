# Submission form text

Copy each block into the field of the same name. Each answer is at most 200 words (counted by script: whitespace-separated tokens that contain a letter or digit). Numbers come from `public/evidence/*.json`, `docs/coverage.md` and `docs/device-results.md`.

## Project name

STRATUM

## What is your project?

STRATUM is a free phone app that hears a blackout coming in the grid's hum and lets families say "I am OK" by sound.

It is for the Hollow, a city underground where the Directorate controls power and has cut the network. Cuts come without warning; families split across levels cannot tell who is safe.

Installed once while the network is up, it needs no signal or account. Families agree six secret words in person. Signed messages such as "I am OK" pass phone to phone by sound, encrypted, so a listener cannot read or follow them. A breathing-rate aid helps parents decide when a small child needs care.

One loop (hear, prove, pass on, share fairly) addresses all fifteen problems: four tested in part on a real phone, eleven modelled in District 7.

Real: on a Galaxy Z Fold 7, hum warnings at 30 cm; a signed "I am OK" verified 3 m away (LIVE, one trial).

In District 7 (SIMULATED, 20 runs): 40% of cuts warned 10 minutes ahead; the Directorate warns no one (0% by rule). The worst-off tenth gets 85% of its need, not 66%. Against us: a stress week erases the warning gain.

## How did you build it?

A TypeScript web app (Vite, no server) on Vercel, offline through a service worker. The phone page, the District 7 worker and the Node harness share one `src/core`, so the demo runs the code scored on real data. No AI, no network call at run time.

- Hearing: an AudioWorklet feeds a tone bank on the hum's 800 Hz component; the sag becomes GREEN, AMBER, RED or NO HUM. On 130 ENF-WHU grid recordings: median per-clip error 31.2 mHz (REPLAY). A second detector hears a fan stop (phone test pending).
- Messages: a 25-byte sound packet (ggwave). Six family words give keys through HKDF; each packet carries an 8-byte HMAC, its own time and a hop count. Phones relay each packet once, at most 4 hops. Public HOLD WATER and ROUTE alerts.
- Witness: one change detector and a hash-chained ledger. On GECCO 2018 water data: 22/22 held-out events caught, precision 0.017 (REPLAY).
- Fair Share: life floors first, then raise the worst-off, rotate what cannot be split.
- District 7: a seeded simulation, one adapter per problem. A harness runs 20 seeds per week, plus ablations and sweeps.

Tested on a Galaxy Z Fold 7.

## Why did you choose to build this? What was your thinking?

Governments do cut networks during unrest, as in Myanmar in 2021 and Iran in 2022, and power cuts rarely fall evenly.

The authorities control the infrastructure, so we started from what the Directorate cannot control: physics. Every powered machine hums at the grid frequency, and the pitch sags before supply runs out. Every phone has a microphone and a speaker. So a phone can hear trouble coming and talk to the next phone with no network.

We built one loop instead of fifteen apps: hear what is happening, prove it, pass it on, share fairly. One packet, one ledger and one fairness rule serve power, families, water, medicine, food and the return to the surface.

We cared most about honesty. Every number says where it came from: LIVE, REPLAY or SIMULATED. We built a stress week where STRATUM also loses, and show those losses beside the wins. We switched each engine off to see what it adds, and publish that the engines barely interact. We varied one stress at a time: from 3 lying surface crews in 5, STRATUM's surface verdict is wrong. A tool people rely on in a crisis must not oversell itself.

## Who built what? How did you collaborate?

Solo project. I conceived, designed and built STRATUM: the Hollow's story, the one loop and its three engines, the sources behind every mechanism, the phone app, District 7 and the evidence harness. I made every product and design decision and decided every cut. I ran every real-device test myself, on my own Android phone and laptop (the shipped code on a Galaxy Z Fold 7); the results are in `docs/device-results.md`.

## Submit your Github Repository Link

https://github.com/royalgillz/stratum

## Submit your Demo Video Link

(Paste the YouTube Unlisted or Google Drive "anyone with the link" address of video/stratum-video-v4.mp4 (2:54). Before pasting, open the link in a private window and check it plays and shows 2:54.)

## Submit a Demo URL

https://stratum-nine-swart.vercel.app/
