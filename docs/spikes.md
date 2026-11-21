# Spike tests: results and decisions

Run T1 to T3 on Saturday, T5 on Sunday, T4 on Monday. Android phone first, then iPhone.
If the iPhone fails T1 or T2, drop it from the plan without further debugging.

## Devices

| Role | Device and browser | Notes |
| --- | --- | --- |
| Emitter and gateway | Laptop, Edge | Mic settings applied: echoCancellation, noiseSuppression, autoGainControl all false, 48 kHz |
| Phone A | Android phone, Chrome | Mic settings applied: all three false, 48 kHz. Volume at max for T2 |
| Phone B | None | No iPhone available: iPhone not tested, plan is Android-only |

## Results

| Test | What | Pass mark | Result | Pass? |
| --- | --- | --- | --- | --- |
| T1 Hum tracking | Laptop plays 400 and 800 Hz. Phone at 1 m, after a 30 s calibration | A 0.1 Hz step is seen within 3 s. A slow ramp is tracked within 5 mHz | Phone A: step went from about +12 to about +112 mHz in about 1.5 s (0.5 s readings, 293.3 s to 294.8 s). Signal-to-noise 41 to 59 dB. Steady jitter about ±1 mHz before the step, about ±3 mHz after it. Ramp run 1: inconclusive. Handling the phone for screenshots caused drops of 14 to 30 dB and spikes of 100 to 450 mHz. In clean stretches the ramp was followed within about 5 mHz (100 mHz total over about 60 s). Both sessions read about 12 to 15 mHz above calibration minutes later with the emitter at 0. Ramp run 2 (hands-off, exported logs, phone untouched): the hand-noise idea was wrong. Error against the emitter's real offset (median / 90th percentile): quiet 2 min at offset 0: 19 / 107 mHz. Ramp: 10 / 67 mHz. Hold at -100: 4 / 66 mHz. The readings swing smoothly over a few seconds while signal-to-noise stays at 30 to 55 dB; no single stray tone found. Calibration error only 2 mHz once start-up readings are dropped, so the earlier 12 to 15 mHz came from calibrating while the hum was starting. A median over 17 readings (8.5 s) brings the 90th percentile to 12 to 17 mHz, still not 5. Ramp run 3 (phone 30 cm from the speaker, only the emitter window open, nobody moving): ramp error 0.6 / 2.5 mHz, worst 9. Quiet 2 min: 0.7 / 3.7 mHz, drift -0.4 mHz per minute. Calibration error 1 mHz. With a 5-reading median (2.5 s): ramp worst 4 mHz, quiet 90th percentile 2.5 mHz, and the 100 mHz step is half-way after 2.7 s (raw: 1.7 s). So the run-2 wobble came from the room (echoes plus movement at 1 m), not the phone | Step: yes. Ramp: **yes at 30 cm**, no at 1 m with people moving |
| T2 Sound packets | 20 packets of 25 bytes, phone to laptop, at 1 m and 3 m | 18 of 20 at 1 m, 14 of 20 at 3 m. Key derivation works in the browser | Phone A to laptop: 20/20 at 1 m and 20/20 at 3 m, 0 bad. HKDF + HMAC OK on the laptop (Edge) and on Phone A (Chrome) | Yes (Android). iPhone not tested |
| T3 Coexistence | T2 with the hum playing, and T1 with chirps playing | 16 of 20 at 1 m. No false tier change | T3a (hum playing, phone to laptop, 1 m): 20/20, 0 bad. T3b run 1: confounded by phone handling. In handling-free stretches with chirps playing, about ±15 mHz. T3b run 2: with chirps playing the error was 15 / 88 mHz, no worse than without chirps (19 / 107). No NO HUM | T3a: yes. T3b: chirps add no measurable disturbance. "No false tier change" depends on the tier thresholds, which aren't set yet |
| T5 Speed | 30 simulated days, headless | Under 10 s | | |
| T4 Sound model | 10 real coughs, then 5 minutes of fan noise and speech | 8 of 10 coughs counted, at most 1 false count. A fan stop noticed within 5 s | | |

Also record from T1: the calibration offset between the two devices, in mHz.
Phone A against the laptop: -10.4 mHz.

## Fallbacks if a test fails

| Test | Fallback |
| --- | --- |
| T1 | Raise the level. Then move the tracked tone to 1 kHz as a "grid sync tone" |
| T2 | QR codes as optical packets behind the same adapter |
| T3 | Lower the hum by 12 dB while a packet arrives |
| T5 | Fewer sectors or coarser time steps |
| T4 | Cough count becomes a manual tap. The air warning stays simulated |

## Decisions

Write each decision here with the date, so nobody reopens it.

- Nov 15: T1 passes at 30 cm and fails at 1 m with people moving. In the demo the phone sits within about 30 cm of the hum source. The tracker takes a 5-reading median (2.5 s). Calibration skips start-up readings until the hum has filled a whole 2 s window.
- Nov 15: T2 passes, so no fallback. ggwave AUDIBLE_FAST stays; QR packets are not needed.
- Nov 15: T3 passes. The hum and the packets coexist, so there is no 12 dB ducking.
- Nov 15: No iPhone available. The plan is Android-only.
- Nov 15: Warning thresholds must sit well above about 15 mHz, the room noise at 1 m after smoothing. They are set in the tracker design.
- Hosting moved from Cloudflare Pages to Vercel (Nov 14).
