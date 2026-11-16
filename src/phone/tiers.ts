// Tier words and the deviation line, shared by the phone Listen tab and judge mode so both say the same thing.
export const TIER_TEXT = { GREEN: '● GREEN: normal', AMBER: '▲ AMBER: WARNING, grid under strain', RED: '■ RED: DANGER, cut likely soon' } as const;

export const CALIBRATING_TEXT = 'Learning this grid’s normal sound, about 30 s.';

/** "48.7 mHz below normal (hum pitch) · LIVE": plain words, no minus sign to decode. */
export const devText = (mHz: number, label: string) => `${Math.abs(mHz).toFixed(1)} mHz ${mHz < 0 ? 'below' : 'above'} normal (hum pitch) · ${label}`;
