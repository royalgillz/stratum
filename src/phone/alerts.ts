// Alerts beyond the screen: a vibration and a screen-reader announcement for the events that matter,
// on whichever tab is open (the tab's own live regions are silent while their panel is hidden). Outside src/core.
import { TYPES, type Decoded } from '../core/packet/codec.ts';
import type { FanReading } from '../core/air/fan.ts';
import type { Tier } from '../core/contracts.ts';
import type { Reading } from '../core/tracker/tracker.ts';
import { $, app, store, type Heard } from './app.ts';
import { says } from './screens/family.ts';
import { TIER_TEXT } from './tiers.ts';

/** `where`: the tab's own polite live region that already says this while its tab is open. */
export interface Cue { buzz: number[]; say: string; urgent: boolean; where?: string }
export const ONE = [500], THREE = [500, 200, 500, 200, 500]; // long pulses: a 200 ms pulse was hard to feel on the Fold 7
export const VIBRATE_KEY = 'stratum.vibrate';

/** A change into AMBER (one pulse) or RED (three pulses); nothing while the tier stays the same or on a way down to GREEN. */
export function tierCue(prev: Tier | undefined, next: Tier | undefined): Cue | null {
  if (next === prev) return null;
  if (next === 'AMBER') return { buzz: ONE, say: TIER_TEXT.AMBER, urgent: false, where: '#tier' };
  if (next === 'RED') return { buzz: THREE, say: TIER_TEXT.RED, urgent: true };
  return null;
}

/** The fan-stop alert, once per stop. */
export const fanCue = (prev: FanReading['state'] | undefined, next: FanReading['state'] | undefined): Cue | null =>
  next === 'STOPPED' && prev !== 'STOPPED' ? { buzz: ONE, say: 'Fan stopped: the air may stop moving. Check the fan and the vents.', urgent: true } : null;

/** A family NEED or a public HOLD WATER or ROUTE alert heard for the first time, not this phone's own echo.
 *  `line`: the public alert's inbox row, which holds its LIVE label and sender count (anyone can forge one, so it is never said as fact). */
export function packetCue(d: Decoded, me: number, line = `${says(d)}, not confirmed`): Cue | null {
  if (d.duplicate || d.payload.member === me) return null;
  if (d.type === TYPES.NEED && !d.public) return { buzz: ONE, say: `Family message: ${says(d)}`, urgent: false, where: '#inbox' };
  if ((d.type === TYPES.HOLD_WATER || d.type === TYPES.ROUTE) && d.public) return { buzz: ONE, say: `Public alert: ${line}`, urgent: false, where: '#inbox' };
  return null;
}

/** Fires a cue: vibrates if the phone can and the user has not turned it off, and announces it. */
function fire(c: Cue | null) {
  if (!c) return;
  if (c.buzz.length && store.get(VIBRATE_KEY) !== 'off' && typeof navigator.vibrate === 'function') navigator.vibrate(c.buzz);
  if (c.where && !$(c.where)?.closest('[hidden]')) return; // its open tab says it already: once is enough
  const el = $(c.urgent ? '#alertNow' : '#alertSoon');
  // Same text twice is not announced again: clear first, then write on the next frame.
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = c.say));
}

export function mountAlerts() {
  let tier: Tier | undefined, fan: FanReading['state'] | undefined;
  app.on('reading', (r: Reading) => { fire(tierCue(tier, r.tier)); tier = r.tier; });
  app.on('fan', (r: FanReading | null) => { fire(fanCue(fan, r?.state)); fan = r?.state; });
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
