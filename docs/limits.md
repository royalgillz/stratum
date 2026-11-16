# Known limits

Stated plainly, so nobody finds them for us. Copy this section into the README before submission.

## What is simulated

- District 7 is a simulation. Its heat, water, sewage, disease, food and surface values are
  model outputs, not measurements.
- The in-world grid runs at 400 Hz. That is a design choice that puts the hum where phone
  microphones hear well. The tracker is scored on real recordings from a 50 Hz grid.

## What the warning cannot do

- The hum shows when the grid is stressed. It cannot say which level will be cut. The ledger of
  neighbours' power reports estimates that.
- A sudden plant trip collapses the grid in seconds. The warning only helps with slow shortfalls.
- After the power is cut, the room has no hum to hear. The warning works before a cut, not during one.
- The tracker needs to be close to the hum. With the phone 30 cm from the source it followed a slow
  ramp within 4 mHz. At 1 m in a room where people moved, echoes made the reading wander by
  ±15 mHz even after smoothing, so the warning levels sit well above that.

## Phone battery

- Phones run on their own batteries, so the app keeps working when the power is cut.
- A phone will not last a multi-day blackout by itself. During a cut the app stops hum tracking
  and wakes the microphone only in short bursts to catch messages.
- Phone charging is treated as a small guaranteed minimum in the fair-share rule.
- Battery relay boxes in stairwells are roadmap, not built.

## Sound messages

- Sound carries a few metres in one room. The live demo proves one hop. Multi-hop reach is simulated.
- A packet takes about 2 to 3 seconds. This is for status and short codes, not chat.
- Phones relay other families' messages without being able to check them, so well-formed junk can cost air time. Each phone relays any one message at most once and at most 4 hops, but an attacker can make endless new messages, and phones carry each one up to 4 hops of rooms beyond the attacker's speaker.
- Anyone who hears a message can replay it marked "no hops left", so phones that hear the replay first never pass the real message on.
- Public alerts are not signed. A grid alert is relayed only if the receiving phone hears the same stress or hears no hum at all, so during a cut, or far from any hum, a forged alert still travels.
- Messages carry their send time from the sender's clock. A receiver whose clock runs more than
  2 minutes behind the sender rejects fresh messages as from the future. Phones underground have no
  time signal, so clocks can drift apart over a long blackout.
- Messages older than 24 hours are rejected.

## Fair sharing

- The Directorate holds the breakers. The tool proves the pattern of who gets cut and lets a level
  share fairly what it controls. It cannot force anyone.

## Health

- Breath Count is a decision aid that follows published thresholds for children under five.
  It is not a medical device and gives no verdict for adults.
- Sound cannot detect contaminated water. The detector reads sensor values and residents' reports.

## Results that go against us

- Lamps cannot feed a level: one person's daily calories need roughly 120 to 360 kWh of electricity.
- Shift-sharing of sleeping space raises contact rates.
- Shafts are not the limit on the return to the surface. Surface reception is.

## Surface

- The plan can show that a claim about the surface is false or unsupported. It cannot prove the
  surface is safe from inside a simulation.
- Mapping suits, domes and outposts onto respirator protection factors is our assumption.
