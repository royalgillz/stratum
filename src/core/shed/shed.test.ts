import { describe, expect, it } from 'vitest';
import type { Label, Tier } from '../contracts.ts';
import { createShedLedger, type ShedReport } from './shed.ts';

const MIN = 60000;
const T0 = 29_000_000; // a Unix minute
const ms = (minute: number, sec = 0) => minute * MIN + sec * 1000;
// A power-off REPORT for `level` from member `member` of key set `keySet`, at packet minute `minute`.
const off = (minute: number, level: number, member: number, keySet = 'public', extra: Partial<ShedReport> = {}): ShedReport => ({
  type: 2, minute, keySet, duplicate: false,
  payload: { member, code: 0, level, sector: 0, flags: 0, value: 0 },
  ...extra,
});
// Three distinct senders report `level` off at `minute`.
const cut3 = (minute: number, level: number) => [0, 1, 2].map((m) => off(minute, level, m));
const later = ms(T0 + 1000);

describe('shed ledger', () => {
  // @spec SHED-001
  it('SHED-001 opens AMBER and RED events on rises', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    s.tier(ms(T0, 30), 'AMBER'); // AMBER event at T0
    s.tier(ms(T0 + 1), 'RED'); // RED event at T0 + 1
    s.tier(ms(T0 + 2), 'GREEN');
    s.tier(ms(T0 + 20), 'RED'); // GREEN to RED: one AMBER and one RED event at T0 + 20
    expect(s.odds(1, 'AMBER', later).events).toBe(2);
    expect(s.odds(1, 'RED', later).events).toBe(2);
    // event minute is floor(nowMs / 60000): a cut at T0 counts, one at T0 - 1 does not
    const t = createShedLedger({ label: 'SIMULATED' });
    t.tier(ms(T0, 59), 'AMBER');
    cut3(T0, 4).forEach((r) => t.report(r));
    cut3(T0 - 1, 5).forEach((r) => t.report(r));
    expect(t.odds(4, 'AMBER', later).cuts).toBe(1);
    expect(t.odds(5, 'AMBER', later).cuts).toBe(0);
    // first call AMBER counts as a rise from GREEN
    const u = createShedLedger({ label: 'LIVE' });
    u.tier(ms(T0), 'AMBER');
    expect(u.odds(1, 'AMBER', later).events).toBe(1);
    expect(u.odds(1, 'RED', later).events).toBe(0);
  });

  // @spec SHED-002
  it('SHED-002 ignores repeats, falls and rises within 10 minutes of the same tier', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    s.tier(ms(T0), 'AMBER');
    s.tier(ms(T0, 30), 'AMBER'); // repeat
    s.tier(ms(T0 + 1), 'GREEN'); // fall
    s.tier(ms(T0 + 9, 59), 'AMBER'); // 9 minutes later: suppressed
    s.tier(ms(T0 + 9, 59), 'RED'); // RED never opened before: opens
    s.tier(ms(T0 + 10), 'GREEN');
    s.tier(ms(T0 + 10), 'AMBER'); // 10 minutes after the first AMBER: opens
    expect(s.odds(1, 'AMBER', later).events).toBe(2);
    expect(s.odds(1, 'RED', later).events).toBe(1);
    // tier still updated when suppressed: AMBER then RED is judged from AMBER
    const t = createShedLedger({ label: 'SIMULATED' });
    t.tier(ms(T0), 'AMBER');
    t.tier(ms(T0 + 1), 'GREEN');
    t.tier(ms(T0 + 2), 'AMBER'); // suppressed AMBER, tier is now AMBER
    t.tier(ms(T0 + 3), 'RED');
    expect(t.odds(1, 'AMBER', later).events).toBe(1);
    expect(t.odds(1, 'RED', later).events).toBe(1);
  });

  // @spec SHED-003
  it('SHED-003 rejects bad tier calls and keeps state', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    s.tier(ms(T0 + 5), 'GREEN');
    expect(() => s.tier(ms(T0 + 4), 'AMBER')).toThrow(RangeError);
    expect(() => s.tier(NaN, 'AMBER')).toThrow(RangeError);
    expect(() => s.tier(Infinity, 'AMBER')).toThrow(RangeError);
    expect(() => s.tier(ms(T0 + 6), 'BLUE' as Tier)).toThrow(RangeError);
    expect(() => s.tier(ms(T0 + 6), 'toString' as Tier)).toThrow(RangeError);
    expect(s.odds(1, 'AMBER', later).events).toBe(0);
    s.tier(ms(T0 + 5), 'AMBER'); // time unchanged by the failures, tier still GREEN
    expect(s.odds(1, 'AMBER', later).events).toBe(1);
  });

  // @spec SHED-004
  it('SHED-004 stores only power-off OK or REPORT packets that are new and in range', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    expect(s.report(off(T0, 3, 0))).toBe(true);
    expect(s.report(off(T0, 3, 1, 'fam', { type: 0 }))).toBe(true); // OK
    for (const type of [1, 3, 4, 5, 6, 7]) expect(s.report(off(T0, 3, 9, 'public', { type }))).toBe(false);
    expect(s.report(off(T0, 3, 9, 'public', { duplicate: true }))).toBe(false);
    expect(s.report(off(T0, 3, 9, 'public', { payload: { member: 9, code: 0, level: 3, sector: 0, flags: 1, value: 0 } }))).toBe(false);
    expect(s.report(off(T0, 3, 9, 'public', { payload: { member: 9, code: 0, level: 3, sector: 0, flags: 3, value: 0 } }))).toBe(false);
    for (const level of [0, 7, 15, 2.5, NaN]) expect(s.report(off(T0, level, 9))).toBe(false);
    expect(s.report(off(T0 + 0.5, 3, 9))).toBe(false);
    expect(s.report(off(NaN, 3, 9))).toBe(false);
    // other flag bits do not matter, only bit 0
    expect(s.report(off(T0, 3, 2, 'public', { payload: { member: 2, code: 0, level: 3, sector: 0, flags: 2, value: 0 } }))).toBe(true);
    // the rejected ones were not stored: only senders 0, fam/1 and 2 count, which is 3
    s.tier(ms(T0), 'AMBER');
    expect(s.odds(3, 'AMBER', later).cuts).toBe(1);
    const t = createShedLedger({ label: 'SIMULATED' });
    t.tier(ms(T0), 'AMBER');
    t.report(off(T0, 3, 0));
    t.report(off(T0, 3, 1));
    t.report(off(T0, 3, 9, 'public', { duplicate: true }));
    expect(t.odds(3, 'AMBER', later).cuts).toBe(0);
  });

  // @spec SHED-005
  it('SHED-005 needs 3 distinct senders inside the 10-minute window', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    s.tier(ms(T0), 'AMBER');
    // level 1: one sender repeated five times plus one more: 2 senders, not cut
    for (let i = 0; i < 5; i++) s.report(off(T0 + i, 1, 7));
    s.report(off(T0, 1, 8));
    // level 2: same member byte under three key sets: 3 senders, cut
    ['a', 'b', 'public'].forEach((k) => s.report(off(T0 + 9, 2, 1, k)));
    // level 3: two members of one family plus one public: 3 senders, cut
    s.report(off(T0, 3, 0, 'fam'));
    s.report(off(T0, 3, 1, 'fam'));
    s.report(off(T0, 3, 0));
    // level 4: third sender at minute T0 + 10, outside the window
    s.report(off(T0, 4, 0));
    s.report(off(T0 + 5, 4, 1));
    s.report(off(T0 + 10, 4, 2));
    // level 5: senders spread over levels do not add up
    s.report(off(T0, 5, 0));
    s.report(off(T0, 5, 1));
    s.report(off(T0, 6, 2));
    const cuts = [1, 2, 3, 4, 5, 6].map((l) => s.odds(l, 'AMBER', later).cuts);
    expect(cuts).toEqual([0, 1, 1, 0, 0, 0]);
  });

  // @spec SHED-006
  it('SHED-006 counts closed events and applies (c + 1) / (e + 2)', () => {
    const s = createShedLedger({ label: 'REPLAY' });
    for (let k = 0; k < 4; k++) {
      s.tier(ms(T0 + 20 * k), 'RED');
      s.tier(ms(T0 + 20 * k + 1), 'GREEN');
      if (k < 3) cut3(T0 + 20 * k + 2, 5).forEach((r) => s.report(r));
    }
    const r = s.odds(5, 'RED', later);
    expect(r).toEqual({ p: 4 / 6, cuts: 3, events: 4, label: 'REPLAY' });
    expect(s.odds(5, 'AMBER', later).p).toBeCloseTo(4 / 6, 15); // GREEN to RED is also AMBER-or-worse
    expect(s.odds(2, 'RED', later)).toEqual({ p: 1 / 6, cuts: 0, events: 4, label: 'REPLAY' });
    // the last event (minute T0 + 60) closes exactly at (T0 + 70) * 60000
    expect(s.odds(5, 'RED', ms(T0 + 70) - 1).events).toBe(3);
    expect(s.odds(5, 'RED', ms(T0 + 70)).events).toBe(4);
    // a cut inside an open event is not counted until the window ends
    expect(s.odds(5, 'RED', ms(T0 + 45))).toEqual({ p: 3 / 4, cuts: 2, events: 2, label: 'REPLAY' });
  });

  // @spec SHED-007
  it('SHED-007 gives exactly 1/2 with no closed event', () => {
    const s = createShedLedger({ label: 'LIVE' });
    expect(s.odds(6, 'RED', later)).toEqual({ p: 0.5, cuts: 0, events: 0, label: 'LIVE' });
    s.tier(ms(T0), 'RED');
    cut3(T0, 6).forEach((r) => s.report(r));
    expect(s.odds(6, 'RED', ms(T0 + 9, 59))).toEqual({ p: 0.5, cuts: 0, events: 0, label: 'LIVE' });
  });

  // @spec SHED-008
  it('SHED-008 rejects bad odds queries', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    for (const level of [0, 7, 2.5, NaN]) expect(() => s.odds(level, 'RED', later)).toThrow(RangeError);
    expect(() => s.odds(1, 'GREEN' as 'RED', later)).toThrow(RangeError);
    expect(() => s.odds(1, 'toString' as 'RED', later)).toThrow(RangeError);
    expect(() => s.odds(1, 'RED', NaN)).toThrow(RangeError);
    expect(() => s.odds(1, 'RED', -Infinity)).toThrow(RangeError);
  });

  // @spec SHED-009
  it('SHED-009 does not depend on report arrival order', () => {
    const tiers: [number, Tier][] = [[ms(T0), 'AMBER'], [ms(T0 + 2), 'RED'], [ms(T0 + 5), 'GREEN'], [ms(T0 + 30), 'AMBER'], [ms(T0 + 31), 'GREEN']];
    const reports = [...cut3(T0 + 3, 5), off(T0 + 31, 2, 0), off(T0 + 32, 2, 1), off(T0 + 39, 2, 2), off(T0 + 1, 1, 0), off(T0 + 2, 1, 0)];
    const run = (order: number[], at: number) => {
      const s = createShedLedger({ label: 'SIMULATED' });
      let i = 0;
      for (const [t, tier] of tiers) {
        while (i < order.length && i < at) s.report(reports[order[i++]]);
        s.tier(t, tier);
        at += 2;
      }
      while (i < order.length) s.report(reports[order[i++]]);
      return [1, 2, 5].flatMap((l) => (['AMBER', 'RED'] as const).map((t) => s.odds(l, t, later)));
    };
    const base = run([0, 1, 2, 3, 4, 5, 6, 7], 0);
    expect(base.map((r) => r.cuts)).toEqual([0, 0, 1, 0, 1, 1]);
    expect(run([7, 6, 5, 4, 3, 2, 1, 0], 0)).toEqual(base);
    expect(run([3, 0, 6, 1, 4, 7, 2, 5], 3)).toEqual(base);
    expect(run([5, 2, 7, 4, 1, 6, 3, 0], 99)).toEqual(base); // all after the window ended
  });

  // @spec SHED-010
  it('SHED-010 validates the label and takes every time from the caller', () => {
    expect(() => createShedLedger({ label: 'LIVEISH' as Label })).toThrow(RangeError);
    for (const label of ['LIVE', 'REPLAY', 'SIMULATED'] as const) expect(createShedLedger({ label }).odds(1, 'RED', 0).label).toBe(label);
    // same calls give the same answer at any wall-clock time: nothing reads a clock
    const run = () => {
      const s = createShedLedger({ label: 'SIMULATED' });
      s.tier(ms(T0), 'RED');
      cut3(T0, 2).forEach((r) => s.report(r));
      return s.odds(2, 'RED', later);
    };
    expect(run()).toEqual(run());
    expect(run()).toEqual({ p: 2 / 3, cuts: 1, events: 1, label: 'SIMULATED' });
  });
});
