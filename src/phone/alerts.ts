// Alerts beyond the screen: a vibration and a screen-reader announcement for the events that matter,
// on whichever tab is open (the tab's own live regions are silent while their panel is hidden). Outside src/core.
import { TYPES, type Decoded } from '../core/packet/codec.ts';
import type { FanReading } from '../core/air/fan.ts';
import type { Tier } from '../core/contracts.ts';
import type { Reading } from '../core/tracker/tracker.ts';
import { $, app, store, type Heard } from './app.ts';
import { says } from './screens/family.ts';
import { TIER_TEXT } from './tiers.ts';

/** `where`: the tab's own polite live region that already says this while its tab is open. `urgent`: interrupts, and repeats until Seen. */
export interface Cue { buzz: number[]; say: string; urgent: boolean; where?: string; flash?: 'AMBER' | 'RED' }
// One pattern per alert, so each can be told apart by feel. Pulses stay long: a 200 ms pulse alone was hard to feel on the Fold 7.
export const AMBER_BUZZ = [700]; // one long pulse
export const RED_BUZZ = [150, 100, 150, 100, 150, 250, 500, 150, 500, 150, 500]; // three short, three long
export const MESSAGE_BUZZ = [200, 150, 200]; // two short taps: a family need or a public alert
export const FAN_BUZZ = [500, 150, 200, 150, 500]; // long, short, long
export const REPEAT_MS = 30_000;
export const VIBRATE_KEY = 'stratum.vibrate';

/** A change into AMBER or RED; nothing while the tier stays the same or on a way down to GREEN. */
export function tierCue(prev: Tier | undefined, next: Tier | undefined): Cue | null {
  if (next === prev) return null;
  if (next === 'AMBER') return { buzz: AMBER_BUZZ, say: TIER_TEXT.AMBER, urgent: false, where: '#tier', flash: 'AMBER' };
  if (next === 'RED') return { buzz: RED_BUZZ, say: TIER_TEXT.RED, urgent: true, flash: 'RED' };
  return null;
}

const FAN_SAY = 'Fan stopped: the air may stop moving. Check the fan and the vents.';
/** The fan-stop alert, once per stop. */
export const fanCue = (prev: FanReading['state'] | undefined, next: FanReading['state'] | undefined): Cue | null =>
  next === 'STOPPED' && prev !== 'STOPPED' ? { buzz: FAN_BUZZ, say: FAN_SAY, urgent: true, flash: 'RED' } : null;

/** The pattern to buzz again now: RED or a fan stop still on, not yet Seen, and 30 s since the last buzz. */
export function repeatBuzz(tier: Tier | undefined, fan: FanReading['state'] | undefined, seen: boolean, sinceMs: number): number[] | null {
  if (seen || sinceMs < REPEAT_MS) return null;
  return tier === 'RED' ? RED_BUZZ : fan === 'STOPPED' ? FAN_BUZZ : null;
}

/** A family NEED or a public HOLD WATER or ROUTE alert heard for the first time, not this phone's own echo.
 *  `line`: the public alert's inbox row, which holds its LIVE label and sender count (anyone can forge one, so it is never said as fact). */
export function packetCue(d: Decoded, me: number, line = `${says(d)}, not confirmed`): Cue | null {
  if (d.duplicate || d.payload.member === me) return null;
  if (d.type === TYPES.NEED && !d.public) return { buzz: MESSAGE_BUZZ, say: `Family message: ${says(d)}`, urgent: false, where: '#inbox' };
  if ((d.type === TYPES.HOLD_WATER || d.type === TYPES.ROUTE) && d.public) return { buzz: MESSAGE_BUZZ, say: `Public alert: ${line}`, urgent: false, where: '#inbox' };
  return null;
}

/** Vibrates if the phone can and the user has not turned it off. */
function buzz(p: number[]) {
  if (p.length && store.get(VIBRATE_KEY) !== 'off' && typeof navigator.vibrate === 'function') navigator.vibrate(p);
}

let flashTimer = 0;
/** A brief full-screen colour flash (a static border under reduced motion, phone.css); it never blocks a tap. */
function flash(color: 'AMBER' | 'RED') {
  const el = $('#flash');
  el.className = '';
  void el.offsetWidth; // restart the animation
  el.className = color;
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => (el.className = ''), 600);
}

/** Fires a cue: vibrates, flashes and announces it. */
function fire(c: Cue | null) {
  if (!c) return;
  buzz(c.buzz);
  if (c.flash) flash(c.flash);
  if (c.where && !$(c.where)?.closest('[hidden]')) return; // its open tab says it already: once is enough
  const el = $(c.urgent ? '#alertNow' : '#alertSoon');
  // Same text twice is not announced again: clear first, then write on the next frame.
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = c.say));
}

export function mountAlerts() {
  let tier: Tier | undefined, fan: FanReading['state'] | undefined, seen = true, last = 0;
  const banner = $('#alertBanner');
  /** Fires a cue; an urgent one shows the banner and repeats until Seen. Readings arrive many times a second while listening, so each one checks the repeat. */
  const alarm = (c: Cue | null) => {
    fire(c);
    if (c?.urgent) { seen = false; last = Date.now(); }
    const again = repeatBuzz(tier, fan, seen, Date.now() - last);
    if (again) { buzz(again); last = Date.now(); }
    banner.hidden = seen || !(tier === 'RED' || fan === 'STOPPED');
    const text = tier === 'RED' ? TIER_TEXT.RED : FAN_SAY, line = $('#alertBannerText');
    if (!banner.hidden && line.textContent !== text) line.textContent = text; // on change only: the banner is role=alert
  };
  $('#seenBtn').onclick = () => { seen = true; banner.hidden = true; };
  app.on('reading', (r: Reading) => { const c = tierCue(tier, r.tier); tier = r.tier; alarm(c); });
  app.on('fan', (r: FanReading | null) => { const c = fanCue(fan, r?.state); fan = r?.state; alarm(c); });
  const buzzed = new Set<string>();
  // mountFamily's handler ran first, so the inbox's top row is this packet's own line (its sender count included).
  app.on('packet', ({ decoded: d }: Heard) => {
    const c = packetCue(d, app.member, $('#inbox li')?.textContent ?? undefined);
    // A public alert is forgeable: buzz only the first time its type, code and place are heard, so one phone cannot buzz everyone again and again.
    const key = `${d.type}:${d.payload.code}:${d.payload.level}:${d.payload.sector}`;
    if (c && d.public && buzzed.has(key)) c.buzz = [];
    if (c && d.public) buzzed.add(key);
    fire(c);
  });
}
