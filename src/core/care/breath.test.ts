import { describe, expect, it } from 'vitest';
import { CARDS, DISCLAIMER, classify, needRequest, type BreathInput, type DangerSigns } from './breath.ts';

const none: DangerSigns = { chestIndrawing: false, unableToDrink: false, vomitsEverything: false, convulsions: false, sleepyOrUnconscious: false };
// n taps evenly spread over the first minute
const taps = (n: number) => Array.from({ length: n }, (_, i) => i * Math.floor(60000 / Math.max(n, 1)));
const input = (o: Partial<BreathInput> = {}): BreathInput => ({ ageMonths: 24, cough: true, tapsMs: taps(30), elapsedMs: 60000, signs: none, label: 'LIVE', ...o });

describe('breath', () => {
  // @spec BREATH-001
  it('BREATH-001 throws on bad input before classifying', () => {
    for (const bad of [
      { ageMonths: -1 }, { ageMonths: NaN }, { ageMonths: Infinity }, { ageMonths: 70, elapsedMs: -1 },
      { elapsedMs: NaN }, { tapsMs: [-5] }, { tapsMs: [NaN] }, { tapsMs: [1000, 500] }, { elapsedMs: 30000, tapsMs: [30001] },
    ]) expect(() => classify(input(bad)), JSON.stringify(bad)).toThrow(RangeError);
    expect(() => classify(input({ elapsedMs: 30000, tapsMs: [30000] }))).not.toThrow();
  });

  // @spec BREATH-002
  it('BREATH-002 gives no classification at 60 months or more', () => {
    const r = classify(input({ ageMonths: 60, signs: { ...none, convulsions: true } }));
    expect([r.classification, r.rate, r.threshold, r.card]).toEqual([null, null, null, CARDS.outOfRange]);
    expect(classify(input({ ageMonths: 59.9 })).classification).not.toBeNull();
  });

  // @spec BREATH-003
  it('BREATH-003 refers infants under 2 months', () => {
    const r = classify(input({ ageMonths: 1.9, tapsMs: taps(70), signs: { ...none, chestIndrawing: true } }));
    expect([r.classification, r.rate, r.threshold, r.card]).toEqual(['REFER_YOUNG', null, null, CARDS.tooYoung]);
    expect(classify(input({ ageMonths: 2 })).classification).toBe('GREEN');
  });

  // @spec BREATH-004
  it('BREATH-004 debounces double taps and ignores taps after 60 s', () => {
    // 0, 100 (dropped), 250 (counted: 250 after 0), 400 (dropped), 59999, 60000 and 61000 (outside)
    const r = classify(input({ tapsMs: [0, 100, 250, 400, 59999, 60000, 61000], elapsedMs: 62000 }));
    expect(r.rate).toBe(3);
    expect(r.ignoredTaps).toBe(2);
    expect(classify(input({ tapsMs: [0, 0, 0] })).ignoredTaps).toBe(2);
  });

  // @spec BREATH-005
  it('BREATH-005 reports the full-minute count and never extrapolates', () => {
    expect(classify(input({ tapsMs: taps(33) })).rate).toBe(33);
    expect(classify(input({ tapsMs: taps(33), elapsedMs: 90000 })).rate).toBe(33);
    const short = classify(input({ tapsMs: [0, 1000, 2000, 3000], elapsedMs: 59999 }));
    expect(short.rate).toBeNull();
  });

  // @spec BREATH-006
  it('BREATH-006 uses 50 under 12 months and 40 from 12 months', () => {
    expect(classify(input({ ageMonths: 2 })).threshold).toBe(50);
    expect(classify(input({ ageMonths: 11.99 })).threshold).toBe(50);
    expect(classify(input({ ageMonths: 12 })).threshold).toBe(40);
    expect(classify(input({ ageMonths: 59 })).threshold).toBe(40);
  });

  // @spec BREATH-007
  it('BREATH-007 is RED on any danger sign, short count or not', () => {
    for (const k of Object.keys(none) as (keyof DangerSigns)[]) {
      const r = classify(input({ signs: { ...none, [k]: true } }));
      expect([r.classification, r.rate, r.card], k).toEqual(['RED', 30, CARDS.red]);
    }
    const short = classify(input({ signs: { ...none, chestIndrawing: true }, tapsMs: [0], elapsedMs: 5000 }));
    expect([short.classification, short.rate]).toEqual(['RED', null]);
    expect(classify(input({ cough: false, signs: { ...none, convulsions: true } })).classification).toBe('RED');
    // only the five fields count, and only when exactly true (the phone may pass its whole form)
    const form = { ...none, notes: 'cough' } as DangerSigns;
    expect(classify(input({ signs: form })).classification).toBe('GREEN');
    const stringly = { ...none, convulsions: 'false' } as unknown as DangerSigns;
    expect(classify(input({ signs: stringly })).classification).toBe('GREEN');
  });

  // @spec BREATH-008
  it('BREATH-008 asks for a recount when stopped before 60 s', () => {
    const r = classify(input({ tapsMs: taps(60).filter((t) => t < 30000), elapsedMs: 30000 }));
    expect([r.classification, r.rate, r.card]).toEqual(['RECOUNT', null, CARDS.recountShort]);
    // the chart counts breaths only when there is cough or difficult breathing
    const noCough = classify(input({ ageMonths: 24, cough: false, tapsMs: taps(44) }));
    expect([noCough.classification, noCough.rate, noCough.card]).toEqual(['NOT_ASSESSED', 44, CARDS.notAssessed]);
    expect(classify(input({ cough: false, tapsMs: [0], elapsedMs: 5000 })).rate).toBeNull();
  });

  // @spec BREATH-009
  it('BREATH-009 asks for a recount on an implausible rate', () => {
    for (const n of [0, 9, 121]) {
      const r = classify(input({ tapsMs: taps(n) }));
      expect([r.classification, r.rate, r.card], String(n)).toEqual(['RECOUNT', n, CARDS.recountImplausible]);
    }
    // 25 taps in the first 25 s, then the caregiver stops tapping while the timer runs on
    const abandoned = classify(input({ ageMonths: 6, tapsMs: Array.from({ length: 25 }, (_, i) => i * 1000) }));
    expect([abandoned.classification, abandoned.rate, abandoned.card]).toEqual(['RECOUNT', 25, CARDS.recountGap]);
    // a missed stretch in the middle: 44 per minute with 8 s untapped
    const gap = taps(44).filter((t) => t < 20000 || t > 28000);
    expect(classify(input({ tapsMs: gap })).card).toBe(CARDS.recountGap);
    // a late start, then steady taps
    expect(classify(input({ tapsMs: taps(60).filter((t) => t >= 10000) })).card).toBe(CARDS.recountGap);
  });

  // @spec BREATH-010
  it('BREATH-010 classifies AMBER at or above the threshold, GREEN below', () => {
    const at = (ageMonths: number, n: number) => classify(input({ ageMonths, tapsMs: taps(n) }));
    expect([at(6, 50).classification, at(6, 50).card]).toEqual(['AMBER', CARDS.amber]);
    expect([at(6, 49).classification, at(6, 49).card]).toEqual(['GREEN', CARDS.green]);
    expect(at(24, 40).classification).toBe('AMBER');
    expect(at(24, 39).classification).toBe('GREEN');
    expect(at(24, 10).classification).toBe('GREEN');
    expect(at(24, 120).classification).toBe('AMBER');
  });

  // @spec BREATH-011
  it('BREATH-011 always carries the disclaimer, label and one digit-free card', () => {
    expect(DISCLAIMER).toMatch(/breathing and five danger signs only/);
    const cards = Object.values(CARDS);
    for (const c of cards) expect(c).not.toMatch(/\d/);
    const cases = [input({ ageMonths: 80 }), input({ ageMonths: 1 }), input({ signs: { ...none, convulsions: true } }),
      input({ elapsedMs: 100, tapsMs: [] }), input({ tapsMs: taps(5) }), input({ tapsMs: taps(45) }), input({ label: 'SIMULATED' }), input({ cough: false })];
    for (const i of cases) {
      const r = classify(i);
      expect(r.disclaimer).toBe(DISCLAIMER);
      expect(r.label).toBe(i.label);
      expect(typeof r.ignoredTaps).toBe('number');
      expect(cards).toContain(r.card);
      expect(classify(i)).toEqual(r);
    }
  });

  // @spec BREATH-012
  it('BREATH-012 gives NEED codes for RED and AMBER only', () => {
    expect(needRequest(classify(input({ signs: { ...none, convulsions: true } })))).toEqual({ code: 0x10, value: 30 });
    expect(needRequest(classify(input({ signs: { ...none, convulsions: true }, elapsedMs: 1000, tapsMs: [] })))).toEqual({ code: 0x10, value: 0 });
    expect(needRequest(classify(input({ tapsMs: taps(45) })))).toEqual({ code: 0x11, value: 45 });
    for (const i of [input(), input({ ageMonths: 1 }), input({ ageMonths: 61 }), input({ elapsedMs: 0, tapsMs: [] }), input({ cough: false, tapsMs: taps(45) })]) expect(needRequest(classify(i))).toBeNull();
  });
});
