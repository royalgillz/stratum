// Tier words and the deviation line, shared by the phone Listen tab and judge mode so both say the same thing.
import enf from '../../public/evidence/enf-whu.json'; // bundled at build time, so the REPLAY figures show offline

export const TIER_TEXT = { GREEN: '● GREEN: normal', AMBER: '▲ AMBER: WARNING, grid under strain', RED: '■ RED: DANGER, cut likely soon' } as const;

export const CALIBRATING_TEXT = 'Learning this grid’s normal sound, about 30 s.';

/** "48.7 mHz below normal (hum pitch) · LIVE": plain words, no minus sign to decode. */
export const devText = (mHz: number, label: string) => `${Math.abs(mHz).toFixed(1)} mHz ${mHz < 0 ? 'below' : 'above'} normal (hum pitch) · ${label}`;

// The same tracker on real recorded grids (npm run score:enf). The evidence file asks for both medians together.
const w = enf.withHum, c = w.clipMedians;
export const REPLAY_TEXT = `In a replay of ${c.clips} recordings of a real 50 Hz grid, the tracker was typically ${Math.round(c.medianMHz)} mHz off; ${Math.round((100 * c.over500) / c.clips)}% followed another hum instead · REPLAY`;
export const REPLAY_DETAILS = `The tracker replayed ${w.clips} recordings of a real 50 Hz grid (ENF-WHU) and was checked against the grid's own record. ` +
  `Median of each recording's median error: ${c.medianMHz} mHz (${c.clips} recordings; ${w.clips - c.clips} gave no reading). ` +
  `Median over all ${w.scored.toLocaleString('en-US')} readings pooled: ${w.medianMHz} mHz, lower because clean recordings give more readings. ` +
  `${c.over500} of the ${c.clips} recordings were off by over 500 mHz: the tracker locked onto another tone. The grid here runs at 400 Hz, not 50 Hz, so take these figures as a guide · REPLAY`;
