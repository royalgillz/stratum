// Breath Count: a decision aid, not a medical device. WHO chart for community health workers,
// https://ncbi.nlm.nih.gov/books/NBK143752/ . Pure: no clock, no randomness, no state.
import type { Label } from '../contracts.ts';

export interface DangerSigns {
  chestIndrawing: boolean;
  unableToDrink: boolean; // or breastfeed
  vomitsEverything: boolean;
  convulsions: boolean;
  sleepyOrUnconscious: boolean;
}

export interface BreathInput {
  ageMonths: number;
  tapsMs: number[]; // one tap per breath, ms since the count started, in order
  elapsedMs: number; // how long the count ran
  signs: DangerSigns;
  label: Label;
}

export type BreathClass = 'RED' | 'AMBER' | 'GREEN' | 'RECOUNT' | 'REFER_YOUNG';

export interface BreathResult {
  classification: BreathClass | null; // null: 60 months or older, no classification
  rate: number | null; // breaths per minute, full 60 s counts only
  threshold: number | null; // fast-breathing threshold for the age, breaths per minute
  ignoredTaps: number;
  card: string;
  disclaimer: string;
  label: Label;
}

export const DISCLAIMER =
  'Decision aid, not a medical device. It follows the WHO chart for community health workers, for children aged 2 months up to 5 years. If you are worried, take the child to a health worker.';

export const CARDS = {
  red: 'Danger sign. Take the child to a health worker now. Send a medicine request.',
  amber: 'Fast breathing. The child needs medicine and a health worker today. Send a medicine request.',
  green: 'Breathing is not fast. Watch the child, and count again if the child gets worse.',
  recountShort: 'The count stopped before one minute. Count again for a full minute.',
  recountImplausible: 'This count looks wrong. Count again for a full minute. If you get the same count, take the child to a health worker.',
  tooYoung: 'Too young for this aid. Take the baby to a health worker.',
  outOfRange: 'This aid is for children under five only.',
} as const;

/** NEED packet payload codes (type NEED, existing codec). 0x10 to 0x1F are reserved for care. */
export const NEED_CODES = { BREATH_RED: 0x10, BREATH_AMBER: 0x11 } as const;

const MINUTE_MS = 60000;
const DEBOUNCE_MS = 250;
const RATE_MIN = 10;
const RATE_MAX = 120;

// @spec BREATH-001, BREATH-002, BREATH-003, BREATH-004, BREATH-005, BREATH-006, BREATH-007, BREATH-008, BREATH-009, BREATH-010, BREATH-011
export function classify({ ageMonths, tapsMs, elapsedMs, signs, label }: BreathInput): BreathResult {
  const ok = (x: number) => Number.isFinite(x) && x >= 0;
  if (!ok(ageMonths) || !ok(elapsedMs)) throw new RangeError('ageMonths and elapsedMs must be finite and non-negative');
  tapsMs.forEach((t, i) => {
    if (!ok(t) || t > elapsedMs || (i > 0 && t < tapsMs[i - 1])) throw new RangeError(`tap ${i} is out of order or range`);
  });

  let counted = 0;
  let ignoredTaps = 0;
  let last = -Infinity;
  for (const t of tapsMs) {
    if (t >= MINUTE_MS) break;
    if (t - last >= DEBOUNCE_MS) {
      counted++;
      last = t;
    }
    else ignoredTaps++;
  }

  const out = (classification: BreathClass | null, card: string, rate: number | null = null, threshold: number | null = null): BreathResult =>
    ({ classification, rate, threshold, ignoredTaps, card, disclaimer: DISCLAIMER, label });
  if (ageMonths >= 60) return out(null, CARDS.outOfRange);
  if (ageMonths < 2) return out('REFER_YOUNG', CARDS.tooYoung);

  const threshold = ageMonths < 12 ? 50 : 40;
  const rate = elapsedMs >= MINUTE_MS ? counted : null; // never scaled up from a short count
  if (Object.values(signs).some(Boolean)) return out('RED', CARDS.red, rate, threshold);
  if (rate === null) return out('RECOUNT', CARDS.recountShort, rate, threshold);
  if (rate < RATE_MIN || rate > RATE_MAX) return out('RECOUNT', CARDS.recountImplausible, rate, threshold);
  return rate >= threshold ? out('AMBER', CARDS.amber, rate, threshold) : out('GREEN', CARDS.green, rate, threshold);
}

// @spec BREATH-012
export function needRequest(r: BreathResult): { code: number; value: number } | null {
  if (r.classification === 'RED') return { code: NEED_CODES.BREATH_RED, value: r.rate ?? 0 };
  if (r.classification === 'AMBER') return { code: NEED_CODES.BREATH_AMBER, value: r.rate ?? 0 };
  return null;
}
