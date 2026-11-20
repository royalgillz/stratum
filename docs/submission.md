# Submission form text

Copy each block into the field of the same name. Each answer is under the form's 200-word limit. Numbers come from
`public/evidence/*.json`, `docs/coverage.md` and `docs/device-results.md`.

## Project name

STRATUM

## What is your project?

STRATUM is a free phone toolkit for people living underground in the Hollow when the Directorate has cut the network.
It works with no signal, no app store and no account: open a web page once and it keeps working offline.

A phone listens to the hum of the power grid in the walls. When the hum sags, a cut is coming, and the phone warns its
owner before the lights go out. Families pick six secret words and send short signed messages by sound ("I am OK",
"we need medicine"), passed on from phone to phone. A breathing-rate aid helps a parent decide when a small child needs
medicine. Neighbours' power reports show which level is likely to be cut next.

To test the ideas without a real city, we built District 7, a simulated district of 24 sectors, and ran the same
supply under the Directorate's rule and under STRATUM's fair rule. Over 20 simulated weeks, 40% of power cuts are
warned 10 minutes ahead (0% today), and the worst-off tenth gets 85% of its need instead of 66%. We publish where we
lose too.

Start here, 90 seconds, works muted: https://stratum-nine-swart.vercel.app/src/district/judge.html

## How did you build it?

A TypeScript web app (Vite, no server) on Vercel, installable and offline through a service
worker.

- Hearing: an AudioWorklet feeds a pitch tracker that follows the grid hum and its second harmonic and turns the sag
  into GREEN, AMBER and RED. Scored on 130 real 50 Hz grid recordings (ENF-WHU): typically 31 mHz off.
- Messages: a 25-byte packet carried by sound with the ggwave modem. Six family words become keys with HKDF; every
  packet is signed with HMAC-SHA-256 and carries its own time and hop count. Phones relay strangers' packets at most
  4 hops, once each.
- Fair Share: one allocator for power, water, food, light, space and care: life floors first, then raise the
  worst-off, rotate what cannot be split.
- District 7: a seeded simulation in a Web Worker, with coupled grid, heat, air, water, disease, food and surface
  models and fifteen adapters, one per track problem. A harness runs 20 seeds per week.
- Real data: the water detector is scored on GECCO 2018 drinking-water data.

Tested on a Samsung Galaxy Z Fold 7. 419 unit tests, about 440 browser tests on six screen sizes, and 259 specs
linked to the code.

## Why did you choose to build this? What was your thinking?

The track asks how people live underground when the authorities control the infrastructure. We started from what the
Directorate cannot control: physics. Every powered machine hums at the grid frequency, and the pitch drops before the
supply runs out. Every phone has a microphone and a speaker. So a phone can hear trouble coming and talk to the next
phone without any network.

We chose one loop instead of fifteen separate apps: hear what is really happening, prove it, pass it on, and share
fairly what there is. The same packet, the same ledger and the same fairness rule serve power cuts, families, water,
medicine, food and the return to the surface.

We cared most about honesty. Every number on screen says where it came from: LIVE (a real phone), REPLAY (real public
recordings) or SIMULATED. We built a stress week designed so that STRATUM also loses, and we show those losses next to
the wins, because a tool people rely on in a crisis must not oversell itself.

## Who built what? How did you collaborate?

Solo project. I conceived, designed and built STRATUM: the Hollow's story, the one loop and its three engines, the sources behind every mechanism, the phone app, District 7 and the evidence harness. I made every product and design decision and decided every cut. I ran every real-device test myself, on my own Android phone and laptop (the shipped code on a Galaxy Z Fold 7); the results are in `docs/device-results.md`.

## Submit your Github Repository Link

https://github.com/royalgillz/stratum

## Submit your Demo Video Link

(Paste the YouTube Unlisted or Google Drive "anyone with the link" address of `stratum-video.mp4`.)

## Submit a Demo URL

https://stratum-nine-swart.vercel.app/
