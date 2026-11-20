---
parent: high-level-design
prefix: AIR-FAN
---

# Air watch: fan stop

## Context and design philosophy

Deep levels breathe through fans. When a fan stops, the air stops moving, and nobody may notice until the air is bad. The air watch listens to the same microphone the Listen tab already opens and says when a steady fan sound stops. It serves problem 1 (warn before power **or air** cuts out). The time-to-limit on CO2 and heat stays in the SIMULATED air model; this is the part a phone can hear for real, LIVE.

It is a prompt, not a diagnosis: "a steady sound in the fan band stopped". It cannot tell a fan from a fridge or a pump, and it cannot measure air. It prefers saying nothing to raising a false alarm: it only watches a fan it has heard running steadily, and an alert needs most of the last 3 s to be quiet.

It is pure computation. The caller (`src/phone`) supplies one level reading with its time; the watch keeps no clock and uses no randomness.

## Signal

The caller reads the microphone spectrum 10 times a second (an `AnalyserNode` on the Listen stream, 2,048-point FFT, no smoothing) and sums the power of the bins from 150 Hz to 1,700 Hz, leaving out 4 bins (about 90 Hz) each side of every multiple of 400 Hz (the in-world hum at 400 and 800 Hz and its weaker harmonics at 1,200 and 1,600 Hz). The analyser's Blackman window spreads a pure tone over about ±3 bins; with 4-bin notches a hum tone leaks into the band 57 dB or more below its own level at 44.1 and 48 kHz. The sum in dB is the **level**. Sound packets start at 1,875 Hz, so they never enter it (frequency plan, `docs/plan.md`). Leaving out the hum means a power cut that silences the hum does not look like a fan stop; the hum tracker reports that.

Fan noise is broad and steady: its level in this band moves well under 1 dB from one reading to the next. Speech adds energy in bursts. A stop removes energy, falling by 10 dB or more within a second or two when the blades stop.

## Decision rule

Each reading `(t, level)`, `t` in seconds, updates:

- **Baseline `B`**: the 20th percentile of the levels in the last 20 s (sorted, index `floor(0.2 × (n − 1))`). Speech only adds energy and fills less than 80% of the time, so it does not lift `B`.
- **Steady**: the median of the same window is at most 4 dB above `B`. A fan is steady; music, a voice that never pauses and a spin-down are not.
- **Quiet floor `F`**: the lowest `B` seen, never above `QUIET_DB` = −100 dB. Before the phone has heard a quiet room, `QUIET_DB` stands in for it, so a fan already running at the start is still found.
- **Running level `R`**, updated while RUNNING: the highest `B` of a steady reading in the last 10 s, kept when there is none. A slow spin-down drags `B` down with it, but not `R`. `R` is frozen while STOPPED, or the quiet after a stop would become the new "running" level.

| From | Condition, held for | To |
| --- | --- | --- |
| LISTENING | steady and `B ≥ F + 10 dB`, 10 s | RUNNING |
| RUNNING | in the last 3 s, lows (`level ≤ R − 6 dB`) are ≥ 70% of readings not louder than `R + 3 dB`, and ≥ 20% of all | STOPPED |
| STOPPED | `level > R − 6 dB`, 5 s | RUNNING (the window restarts at that run) |
| STOPPED | steady and `B ≥ F + 10 dB`, 10 s | RUNNING (a new fan level) |

"Held for" means from the first reading of an unbroken run to the current one. A reading that breaks a condition restarts its run, and so does any change of state or a gap of more than 2 s between readings. When the fan comes back at its old level, the window restarts at the 5 s run: otherwise `B` would still describe the quiet for 16 s and the next stop would go unseen. The stop test sets aside readings more than 3 dB over `R`: once the fan is off, talk is louder than the fan was, so those readings say nothing about it, and the quiet between words is what shows the stop. In silence a stop is reported 2.0 s after the level falls (21 of 30 readings), well inside the 5 s mark of spike T4. A click or a door slam is loud and set aside; a 1.5 s dropout is half of 3 s, under 70%; at least 20% of the last 3 s (0.6 s) must be low, so a brief dip under loud talk over a running fan is not a stop. `R` is only updated once the window spans 10 s of readings: after a gap (a frozen tab), the quiet of a fan that stopped unheard cannot become the running level, and the first readings after the gap alert. A level that is not finite (digital silence from a muted microphone, a bad value) is skipped: it says nothing about the fan.

| Parameter | Value | Why |
| --- | --- | --- |
| Window | 20 s | Long enough that a few seconds of speech are under 20% of it |
| Baseline percentile | 20th | Robust to speech; follows a real drop after 4 s |
| Steady spread | 4 dB | Fan noise spreads about 1 dB; an oscillating fan about 3 |
| Above floor | 10 dB | Clear of room noise and microphone self-noise |
| Run hold | 10 s | A fan is a fixture; a 10 s sound is not |
| Drop | 6 dB | A quarter of the power or less, far beyond fan jitter |
| Stop test | 3 s, 70% low, 20% low of all, set aside over `R + 3 dB` | Alert 2.0 s after a stop in silence, and in the first pause of 0.6 s when talk goes on; a 1.5 s dropout is 50% |
| Gap | 2 s | Longer than the 1 s timers of a hidden tab; a longer gap breaks every run |
| Recover hold | 5 s | Longer than most unbroken speech, so talk does not clear the alert |
| `QUIET_DB` | −100 dB | Assumption from typical phone microphone self-noise; set by the device test |

## Interface

`createFanWatch({ label })` returns `{ push(t, level) }`. `push` returns a reading `{ t, state, levelDb, baselineDb, floorDb, runningDb, steady, label }`, with `runningDb` null until the first RUNNING. It returns null for a skipped level. It throws RangeError for a `t` that is not finite or earlier than the last one, and `createFanWatch` throws RangeError for a label other than LIVE, REPLAY or SIMULATED.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Detector | Band level with a percentile baseline | YAMNet sound model (plan's T4 option); spectral shape match | No model file, no dependency, runs at 10 Hz on any phone; the question is "did steady sound stop", which a level answers |
| Baseline | 20th percentile of 20 s | Mean; minimum; exponential average | Mean and average rise with speech; the minimum follows one dropout |
| Reference for a drop | Highest steady `B` in 10 s, frozen while STOPPED | The current `B` | `B` lags a slow spin-down by 4 s and follows it down, so a 1 dB/s spin-down never alerted |
| Floor | Lowest `B`, capped at `QUIET_DB` | Learned only; fixed only | Learned only misses a fan running from the start; fixed only ignores each phone's gain |
| Steadiness gate | Median minus 20th percentile ≤ 4 dB | None | Without it, music or a long talk could count as a fan and alert when it ends |
| Time | Caller's `t` in seconds | Count readings | A hidden tab slows timers to about 1 Hz; holds in seconds still mean seconds |
| Stop test | Share of quiet readings in 3 s, loud ones set aside | Every reading low for 2 s; share of all readings, nothing set aside | One word restarts an unbroken run, and talk after a stop hid it for good; without setting talk aside, a conversation with short pauses still hid it |
| After a gap | Runs restart; `R` waits for 10 s of window | Clear the window | Clearing still let the first reading after the gap set `R` to the quiet |
| Hum notch | 4 bins each side | ±30 Hz | ±30 Hz is narrower than the window's main lobe: the hum alone read as a fan, and a hum cut as a fan stop |
| Non-finite level | Skipped | Treated as silence | Digital silence is a muted microphone, not a stopped fan |

## Open Questions & Future Decisions

### Deferred
1. `QUIET_DB` and the 10 dB margin come from estimates, not phones. The device test logs levels for a fan at 1 m and 3 m and a quiet room; set both from it.
2. Any steady sound in the band that stops (a fridge, a pump, a radio left on) alerts as a fan stop. The words say "check the fan", not "the fan failed".
3. Moving the phone, or something between it and the fan, can drop the level by 6 dB: the alert says to check, so this errs towards warning.
4. A fan that fades slower than about 0.4 dB/s, or comes back more than 6 dB quieter, is followed as a change of level, not a stop.
5. Speech unbroken for 5 s during STOPPED clears the alert until it ends; the alert then returns about 2 s later.
6. The lowest `B` is kept for the session, so a phone muffled in a pocket for a while lowers `F`, and a steady room sound may then read as a fan.
7. Talk that goes on after the fan stops delays the alert until a pause of about 0.6 s: unbroken talk hides the stop while it lasts. Talk quieter than `R + 3 dB` counts as fan and can hide it longer.
8. A dropout while people talk loudly over a running fan can alert, because the talk is set aside and the dropout is then most of what is left.
9. With readings once a minute (a long-hidden tab), one low reading is a stop, and the watch cannot enter RUNNING. The line shows the last state while no readings arrive.

## References

- `docs/plan.md`: problem 1, the audio frequency plan, spike T4 ("a fan stop noticed within 5 s", no false alert over 5 minutes of fan noise and speech)
- `docs/intent/tracker/tracker-design.md` (the hum on the same microphone), `docs/intent/world/airheat/airheat-design.md` (the SIMULATED air model)
- Web Audio `AnalyserNode`: https://webaudio.github.io/web-audio-api/#AnalyserNode
